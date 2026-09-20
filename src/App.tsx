import React, { useState, useEffect, useRef, useMemo } from "react";
import { socketService } from "./services/socket";
import {
  UserPresence,
  CodeFile,
  VersionSnapshot,
  ChatMessage,
  ExecutionResult,
  CodeAnalysis,
  SupportedLanguage
} from "./types";
import { CRDTOperation } from "./utils/crdt";
import { Navbar } from "./components/Navbar";
import { FileExplorer } from "./components/FileExplorer";
import { CodeEditor } from "./components/CodeEditor";
import { VersionHistoryModal } from "./components/VersionHistoryModal";
import { CollaborationChat } from "./components/CollaborationChat";
import { TerminalOutput } from "./components/TerminalOutput";
import RoomModal from "./components/RoomModal";
import { SimulateCollaboratorModal } from "./components/SimulateCollaboratorModal";

const USER_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#8B5CF6", // Purple
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
];

export default function App() {
  // Room state
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || "global-workspace";
  });
  const [roomName, setRoomName] = useState<string>("Global Workspace");

  // User identity
  const [currentUser, setCurrentUser] = useState<UserPresence | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [users, setUsers] = useState<UserPresence[]>([]);

  // Files & Editor state
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>("");

  // History & Snapshots
  const [versionHistory, setVersionHistory] = useState<VersionSnapshot[]>([]);

  // Real-time Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Execution & Diagnostics
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [codeAnalysis, setCodeAnalysis] = useState<CodeAnalysis | null>(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Connection Telemetry
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(12);

  // Remote Collaborator Edits Tracking
  const [recentRemoteEdits, setRecentRemoteEdits] = useState<
    Record<string, { username: string; color: string; timestamp: number }>
  >({});

  // Periodic ticker to smoothly update elapsed time / expire editing badges
  const [, setTicker] = useState(0);

  // Refs
  const prettifyActiveFileRef = useRef<(() => Promise<void>) | null>(null);
  const lastCursorEmitRef = useRef<number>(0);

  // Active file derived
  const activeFile = files.find((f: { id: any }) => f.id === activeFileId) || files[0] || null;

  useEffect(() => {
    const interval = setInterval(() => {
      setTicker((t: number) => t + 1);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Initialize authenticated identity once
  useEffect(() => {
    let cancelled = false;

    const initializeUser = async () => {
      const storedUsername = sessionStorage.getItem("collab_user_name");
      const storedColor = sessionStorage.getItem("collab_user_color");
      const storedToken = sessionStorage.getItem("auth_token");
      const storedUserId = sessionStorage.getItem("auth_user_id");

      const username =
        storedUsername ||
        `Dev_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

      const color =
        storedColor ||
        USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];

      sessionStorage.setItem("collab_user_name", username);
      sessionStorage.setItem("collab_user_color", color);

      let token = storedToken;
      let userId = storedUserId;

      if (!token || !userId) {
        let password = sessionStorage.getItem("auth_guest_password");

        if (!password) {
          password = `Dev_${crypto.randomUUID()}_Secure123!`;
          sessionStorage.setItem("auth_guest_password", password);
        }

        try {
          let response = await fetch("/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              username,
              password,
            }),
          });

          if (response.status === 409) {
            response = await fetch("/api/auth/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                username,
                password,
              }),
            });
          }

          if (!response.ok) {
            throw new Error(
              `Guest authentication failed: ${response.status}`
            );
          }

          const data = await response.json();

          token = data.token;
          userId = data.user.id;

          sessionStorage.setItem("auth_token", token);
          sessionStorage.setItem("auth_user_id", userId);
        } catch (error) {
          console.error("[Auth] Guest authentication failed:", error);

          if (!cancelled) {
            setAuthReady(true);
          }

          return;
        }
      }

      if (cancelled) return;

      setCurrentUser({
        id: userId!,
        socketId: "",
        username,
        color,
        activeFileId: "",
        lastActive: Date.now(),
      });

      setAuthReady(true);
    };

    initializeUser();

    return () => {
      cancelled = true;
    };
  }, []);
  // Connect and bind socket listeners when roomId or currentUser is ready
  useEffect(() => {
    if (!currentUser) return;

    const handleConnect = () => {
      setIsConnected(true);
      socketService.joinRoom(
        roomId,
        currentUser.username,
        currentUser.color,
        activeFileId
      );
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRoomInit = (data: any) => {
      if (data.room) {
        setRoomName(data.room.name);
        setFiles(data.room.files || []);
        setActiveFileId(data.room.activeFileId || data.room.files?.[0]?.id || "");
        setUsers(data.room.users || []);
        setVersionHistory(data.room.versionHistory || []);
        setChatMessages((prev) => {
          const serverMessages: ChatMessage[] = data.room.chatMessages || [];

          if (prev.length === 0) {
            return serverMessages;
          }

          const merged = [...serverMessages];

          for (const existingMessage of prev) {
            const alreadyExists = merged.some(
              (serverMessage) =>
                serverMessage.id === existingMessage.id ||
                (
                  serverMessage.userId === existingMessage.userId &&
                  serverMessage.text === existingMessage.text
                )
            );

            if (!alreadyExists) {
              merged.push(existingMessage);
            }
          }

          return merged;
        });
      }
      if (data.self) {
        setCurrentUser(data.self);
      }
    };

    const handleUserJoined = (data: { user: UserPresence; users: UserPresence[] }) => {
      setUsers(data.users);
    };

    const handleUserLeft = (data: { socketId: string; users: UserPresence[] }) => {
      setUsers(data.users);
    };

    const handleCodeUpdate = (data: {
      fileId: string;
      content: string;
      version: number;
      authorSocketId: string;
      authorName?: string;
      authorColor?: string;
    }) => {
      setFiles((prevFiles: any[]) =>
        prevFiles.map((f: { id: string }) =>
          f.id === data.fileId ? { ...f, content: data.content, version: data.version } : f
        )
      );

      setRecentRemoteEdits((prev: any) => ({
        ...prev,
        [data.fileId]: {
          username: data.authorName || "Collaborator",
          color: data.authorColor || "#10B981",
          timestamp: Date.now(),
        },
      }));
    };

    const handleCRDTOps = (data: {
      fileId: string;
      ops: any[];
      content: string;
      version: number;
      authorSocketId: string;
      authorName?: string;
      authorColor?: string;
    }) => {
      setFiles((prevFiles: any[]) =>
        prevFiles.map((f: { id: string }) =>
          f.id === data.fileId ? { ...f, content: data.content, version: data.version } : f
        )
      );

      setRecentRemoteEdits((prev: any) => ({
        ...prev,
        [data.fileId]: {
          username: data.authorName || "Collaborator",
          color: data.authorColor || "#10B981",
          timestamp: Date.now(),
        },
      }));
    };

    const handleCursorUpdate = (data: {
      socketId: string;
      userId: string;
      username: string;
      color: string;
      fileId: string;
      cursor: any;
      selection: any;
    }) => {
      setUsers((prevUsers: any[]) =>
        prevUsers.map((u: { socketId: string; id: string }) => {
          if (u.socketId === data.socketId || u.id === data.userId) {
            return {
              ...u,
              cursor: data.cursor,
              selection: data.selection,
              activeFileId: data.fileId,
              lastActive: Date.now(),
            };
          }
          return u;
        })
      );

      if (data.cursor && data.fileId) {
        setRecentRemoteEdits((prev: any) => ({
          ...prev,
          [data.fileId]: {
            username: data.username,
            color: data.color,
            timestamp: Date.now(),
          },
        }));
      }
    };

    const handleChatMessage = (msg: ChatMessage) => {

      setChatMessages((prev) => {
        // Ignore exact duplicates.
        if (prev.some((existing) => existing.id === msg.id)) {
          return prev;
        }

        // The sender already displayed this message optimistically.
        // Keep the local message instead of replacing it with the server echo.
        const optimisticExists = prev.some(
          (existing) =>
            existing.id.startsWith("local-") &&
            existing.userId === msg.userId &&
            existing.text === msg.text
        );

        if (optimisticExists) {
          return prev;
        }

        // Message came from another collaborator.
        return [...prev, msg];
      });
    };

    const handleTypingStatus = (data: { socketId: string; username: string; isTyping: boolean }) => {
      setTypingUsers((prev: string[]) => {
        if (data.isTyping) {
          if (!prev.includes(data.username)) return [...prev, data.username];
          return prev;
        } else {
          return prev.filter((name: string) => name !== data.username);
        }
      });
    };

    const handleFileCreated = (data: { file: CodeFile; activeFileId: string; files: CodeFile[] }) => {
      setFiles(data.files);
      setActiveFileId(data.activeFileId);
    };

    const handleFileDeleted = (data: { fileId: string; activeFileId: string; files: CodeFile[] }) => {
      setFiles(data.files);
      setActiveFileId(data.activeFileId);
    };

    const handleFileRenamed = (data: { fileId: string; newName: string; newLanguage?: SupportedLanguage; files: CodeFile[] }) => {
      setFiles(data.files);
    };

    const handleUserSwitchedFile = (data: { socketId: string; activeFileId: string }) => {
      setUsers((prev: any[]) =>
        prev.map((u: { socketId: string }) => (u.socketId === data.socketId ? { ...u, activeFileId: data.activeFileId } : u))
      );
    };

    const handleNewVersion = (data: { snapshot: VersionSnapshot; versionHistory: VersionSnapshot[] }) => {
      setVersionHistory(data.versionHistory);
    };

    const handleRestored = (data: { files: CodeFile[]; versionHistory: VersionSnapshot[] }) => {
      setFiles(data.files);
      setVersionHistory(data.versionHistory);
    };
    //connect
    const socket = socketService.connect();

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:init", handleRoomInit);
    socket.on("user:joined", handleUserJoined);
    socket.on("user:left", handleUserLeft);
    socket.on("code:update", handleCodeUpdate);
    socket.on("crdt:ops", handleCRDTOps);
    socket.on("cursor:update", handleCursorUpdate);
    socket.on("chat:message", handleChatMessage);
    socket.on("chat:typing_status", handleTypingStatus);
    socket.on("file:created", handleFileCreated);
    socket.on("file:deleted", handleFileDeleted);
    socket.on("file:renamed", handleFileRenamed);
    socket.on("user:switched_file", handleUserSwitchedFile);
    socket.on("history:new_version", handleNewVersion);
    socket.on("history:restored", handleRestored);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    const pingTimer = setInterval(() => {
      setLatency(socketService.getLatency() || Math.floor(10 + Math.random() * 8));
    }, 4000);

    return () => {
      clearInterval(pingTimer);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:init", handleRoomInit);
      socket.off("user:joined", handleUserJoined);
      socket.off("user:left", handleUserLeft);
      socket.off("code:update", handleCodeUpdate);
      socket.off("crdt:ops", handleCRDTOps);
      socket.off("cursor:update", handleCursorUpdate);
      socket.off("chat:message", handleChatMessage);
      socket.off("chat:typing_status", handleTypingStatus);
      socket.off("file:created", handleFileCreated);
      socket.off("file:deleted", handleFileDeleted);
      socket.off("file:renamed", handleFileRenamed);
      socket.off("user:switched_file", handleUserSwitchedFile);
      socket.off("history:new_version", handleNewVersion);
      socket.off("history:restored", handleRestored);
    };
  }, [roomId, currentUser?.username]);

  // Code modification handler (Optimistic local update + CRDT / WebSocket broadcast)
  const handleCodeChange = (newContent: string, crdtOps?: CRDTOperation[], isRemoteMerge?: boolean) => {
    if (!activeFile) return;

    setFiles((prevFiles: any[]) =>
      prevFiles.map((f: { id: any }) => (f.id === activeFile.id ? { ...f, content: newContent } : f))
    );

    // If this update was already merged from remote CRDT, do not re-emit
    if (isRemoteMerge) return;

    if (crdtOps && crdtOps.length > 0) {
      socketService.emitCRDTOps(
        roomId,
        activeFile.id,
        crdtOps,
        newContent,
        activeFile.version,
        currentUser?.id,
        Date.now(),
        currentUser?.username
      );
    } else {
      socketService.emitCodeChange(
        roomId,
        activeFile.id,
        newContent,
        activeFile.version,
        currentUser?.username
      );
    }
  };

  // Cursor movement throttled
  const handleCursorChange = (cursor: { line: number; ch: number } | null, selection: any) => {
    if (!activeFile) return;
    const now = Date.now();
    if (now - lastCursorEmitRef.current > 50) {
      lastCursorEmitRef.current = now;
      socketService.emitCursorMove(roomId, activeFile.id, cursor, selection);
    }
  };

  // Execute Code API
  const handleRunCode = async () => {
    if (!activeFile || isRunningCode) return;
    setIsRunningCode(true);

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeFile.content,
          language: activeFile.language,
        }),
      });
      const data = await response.json();
      setExecutionResult(data);
    } catch (err: any) {
      setExecutionResult({
        stdout: "",
        stderr: String(err?.message || "Execution request failed"),
        executionTimeMs: 0,
        exitCode: 1,
        timestamp: Date.now(),
      });
    } finally {
      setIsRunningCode(false);
    }
  };

  // Code Analyzer API
  const handleAnalyzeCode = async () => {
    if (!activeFile || isAnalyzing) return;
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: activeFile.content }),
      });
      const data = await response.json();
      setCodeAnalysis(data);
    } catch (err) {
      console.error("Analysis failed:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Switch active file
  const handleSelectFile = (fileId: string) => {
    setActiveFileId(fileId);
    socketService.switchFile(roomId, fileId);
  };

  // Create file
  const handleCreateFile = (name: string, language: SupportedLanguage) => {
    socketService.createFile(roomId, name, language);
  };

  // Delete file
  const handleDeleteFile = (fileId: string) => {
    socketService.deleteFile(roomId, fileId);
  };

  // Rename file
  const handleRenameFile = (fileId: string, newName: string, newLanguage: SupportedLanguage) => {
    // Optimistically update local files state immediately
    setFiles((prev: any[]) =>
      prev.map((f: { id: string }) => (f.id === fileId ? { ...f, name: newName, language: newLanguage } : f))
    );
    socketService.renameFile(roomId, fileId, newName, newLanguage);
  };

  // Version Commit Checkpoint
  const handleCreateCommit = (commitMessage: string) => {
    socketService.commitVersion(roomId, commitMessage);
  };

  // Restore snapshot
  const handleRestoreVersion = (versionId: string) => {
    socketService.restoreVersion(roomId, versionId);
  };

  // Send Chat
  const handleSendChatMessage = (text: string) => {
    const trimmedText = text.trim();

    if (!trimmedText) return;

    const sender = currentUser ?? {
      id: "local-user",
      username: "You",
      color: "#818cf8",
    };

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: sender.id,
      username: sender.username,
      userColor: sender.color,
      text: trimmedText,
      timestamp: Date.now(),
      type: "chat",
    };

    setChatMessages((prev) => [...prev, optimisticMessage]);

    socketService.sendChatMessage(roomId, trimmedText);
  };

  // Switch Room
  const handleSwitchRoom = (newRoomId: string) => {
    setRoomId(newRoomId);
    const url = new URL(window.location.href);
    url.searchParams.set("room", newRoomId);
    window.history.pushState({}, "", url.toString());
  };

  const latestVersion = versionHistory[versionHistory.length - 1]?.versionNumber || 1;
  const latestSnapshot = versionHistory[versionHistory.length - 1];

  // Calculate files that have unsaved changes relative to the latest checkpoint
  const unsavedFileIds = useMemo(() => {
    const set = new Set<string>();
    if (!latestSnapshot) return set;
    for (const file of files) {
      const savedContent = latestSnapshot.filesSnapshot?.[file.id];
      if (savedContent === undefined || savedContent !== file.content) {
        set.add(file.id);
      }
    }
    return set;
  }, [files, latestSnapshot]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        roomName={roomName}
        users={users}
        currentUser={currentUser}
        latestVersion={latestVersion}
        isConnected={isConnected}
        latency={latency}
        isRunningCode={isRunningCode}
        onRunCode={handleRunCode}
        onPrettify={activeFile ? () => { prettifyActiveFileRef.current?.(); } : undefined}
        onOpenCommitModal={() => setIsHistoryModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        onToggleSimulator={() => setIsSimulatorOpen(true)}
        isSimulatorActive={false}
        onOpenChat={() => {
          setIsChatOpen((prev: any) => !prev);
          setUnreadChatCount(0);
        }}
        unreadChatCount={unreadChatCount}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Project File Tree */}
        <FileExplorer
          files={files}
          activeFileId={activeFileId}
          users={users}
          currentUser={currentUser}
          unsavedFileIds={unsavedFileIds}
          recentRemoteEdits={recentRemoteEdits}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
        />

        {/* Center: Collaborative Editor & Terminal Split */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {activeFile ? (
            <CodeEditor
              file={activeFile}
              users={users}
              currentUser={currentUser}
              roomId={roomId}
              onCodeChange={handleCodeChange}
              onCursorChange={handleCursorChange}
              onRunCode={handleRunCode}
              onSaveCheckpoint={() => setIsHistoryModalOpen(true)}
              onRegisterPrettify={(fn: any) => {
                prettifyActiveFileRef.current = fn;
              }}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs">
              No active file selected. Choose or create a file from the explorer.
            </div>
          )}

          {/* Bottom Execution Console & Diagnostics */}
          <TerminalOutput
            executionResult={executionResult}
            codeAnalysis={codeAnalysis}
            isRunning={isRunningCode}
            isAnalyzing={isAnalyzing}
            onClearOutput={() => setExecutionResult(null)}
            onTriggerAnalysis={handleAnalyzeCode}
          />
        </main>

        {/* Right: Team Collaboration Chat Drawer */}
        <CollaborationChat
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={chatMessages}
          currentUser={currentUser}
          typingUsers={typingUsers}
          onSendMessage={handleSendChatMessage}
          onTyping={(isTyping: boolean) => socketService.setTyping(roomId, isTyping)}
        />
      </div>

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        versionHistory={versionHistory}
        currentFiles={files}
        activeFileId={activeFileId}
        onRestoreVersion={handleRestoreVersion}
        onCreateCommit={handleCreateCommit}
      />

      {/* Workspace / Room Switcher Modal */}
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        currentRoomId={roomId}
        onSwitchRoom={handleSwitchRoom}
        authReady={authReady}
      />

      {/* Peer Simulator Modal */}
      <SimulateCollaboratorModal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        roomId={roomId}
        activeFileId={activeFileId}
      />
    </div>
  );
}