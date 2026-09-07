import React, { useState } from "react";
import { 
  Code2, 
  Play, 
  History, 
  GitCommit, 
  Users, 
  Copy, 
  Check, 
  Radio, 
  Sparkles, 
  Plus, 
  ChevronDown,
  Bot,
  ExternalLink
} from "lucide-react";
import { UserPresence, VersionSnapshot } from "../types";

interface NavbarProps {
  roomId: string;
  roomName: string;
  users: UserPresence[];
  currentUser: UserPresence | null;
  latestVersion: number;
  isConnected: boolean;
  latency: number;
  isRunningCode: boolean;
  onRunCode: () => void;
  onPrettify?: () => void;
  onOpenCommitModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenRoomModal: () => void;
  onToggleSimulator: () => void;
  isSimulatorActive: boolean;
  onOpenChat: () => void;
  unreadChatCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomId,
  roomName,
  users,
  currentUser,
  latestVersion,
  isConnected,
  latency,
  isRunningCode,
  onRunCode,
  onPrettify,
  onOpenCommitModal,
  onOpenHistoryModal,
  onOpenRoomModal,
  onToggleSimulator,
  isSimulatorActive,
  onOpenChat,
  unreadChatCount,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomId);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  return (
    <header className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between select-none z-30 relative">
      {/* Left: Branding & Room Selection */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold tracking-tight">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
            <Code2 className="w-5 h-5" />
          </div>
          <span className="hidden md:inline text-slate-100 font-bold text-base tracking-tight">
            CodeSync<span className="text-indigo-400 font-normal">.io</span>
          </span>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Room badge & Switcher */}
        <button
          id="room-selector-button"
          onClick={onOpenRoomModal}
          className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
          title="Switch or create collaborative room"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300 max-w-[120px] truncate">{roomId}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* Copy Invite Link */}
        <button
          id="copy-invite-link-btn"
          onClick={handleCopyLink}
          className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800 px-2 py-1.5 rounded border border-slate-700/60 transition"
          title="Copy room URL to invite collaborators"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Share Invite</span>
            </>
          )}
        </button>
      </div>

      {/* Middle: Active Collaborators Presence Bar */}
      <div className="flex items-center gap-2">
        <div className="flex items-center -space-x-1.5 overflow-hidden py-1 px-2 rounded-full bg-slate-950/40 border border-slate-800">
          <div className="flex items-center text-xs text-slate-400 mr-2 font-medium">
            <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>{users.length}</span>
          </div>

          {users.map((u) => {
            const isSelf = currentUser && currentUser.id === u.id;
            return (
              <div
                key={u.id || u.socketId}
                className="relative group cursor-pointer"
                title={`${u.username} ${isSelf ? "(You)" : ""} - Active on ${u.activeFileId}`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase border-2 border-slate-900 shadow-sm transition transform group-hover:scale-110"
                  style={{ backgroundColor: u.color }}
                >
                  {u.username.slice(0, 2)}
                </div>

                {/* Micro tooltip */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center bg-slate-950 text-slate-200 text-[11px] px-2 py-1 rounded shadow-xl border border-slate-700 whitespace-nowrap z-50 pointer-events-none">
                  <span className="font-semibold">{u.username} {isSelf && "(You)"}</span>
                  <span className="text-[10px] text-slate-400">File: {u.activeFileId.replace('file-', '')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection status pill */}
        <div 
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono border"
          style={{
            backgroundColor: isConnected ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
            borderColor: isConnected ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
            color: isConnected ? "#34d399" : "#f87171"
          }}
          title={isConnected ? `Connected via WebSocket (${latency}ms ping)` : "Disconnected"}
        >
          <Radio className="w-3 h-3 animate-pulse" />
          <span>{isConnected ? `${latency}ms` : "Offline"}</span>
        </div>
      </div>

      {/* Right: Actions (Run, Commit, History, Chat) */}
      <div className="flex items-center gap-2">
        {/* Simulate Co-Worker Button */}
        <button
          id="simulate-collab-button"
          onClick={onToggleSimulator}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition cursor-pointer ${
            isSimulatorActive 
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse" 
              : "bg-slate-800/80 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700"
          }`}
          title="Simulate a real-time typing collaborator in this room"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isSimulatorActive ? "Simulating..." : "Simulate Peer"}
          </span>
        </button>

        {/* Version Checkpoint Button */}
        <button
          id="commit-version-btn"
          onClick={onOpenCommitModal}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer"
          title="Create a version checkpoint snapshot"
        >
          <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Save Version</span>
        </button>

        {/* Version History Button */}
        <button
          id="history-btn"
          onClick={onOpenHistoryModal}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer relative"
          title="View checkpoint timeline & diffs"
        >
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden md:inline">v{latestVersion}</span>
        </button>

        {/* Prettify Code Button */}
        {onPrettify && (
          <button
            id="navbar-prettify-button"
            onClick={onPrettify}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer active:scale-95"
            title="Prettify active file based on its language (Shift+Alt+F)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Prettify</span>
          </button>
        )}

        {/* Execute Code Button */}
        <button
          id="run-code-button"
          onClick={onRunCode}
          disabled={isRunningCode}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-md text-xs transition shadow-sm cursor-pointer disabled:opacity-50"
          title="Execute code in Node.js backend (Ctrl+Enter)"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunningCode ? "animate-spin" : ""}`} />
          <span>{isRunningCode ? "Running..." : "Run"}</span>
        </button>

        {/* Chat Drawer Toggle */}
        <button
          id="toggle-chat-button"
          onClick={onOpenChat}
          className="relative flex items-center justify-center w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
          title="Toggle Collaboration Chat"
        >
          <Users className="w-4 h-4" />
          {unreadChatCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold animate-bounce">
              {unreadChatCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
