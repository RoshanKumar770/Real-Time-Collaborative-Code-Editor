import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Bot, Play, Square, MessageSquare, ExternalLink, X, Zap, GitMerge, ShieldCheck } from "lucide-react";
import { TextCRDTDoc } from "../utils/crdt";

interface SimulateCollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  activeFileId: string;
}

const PEER_PERSONAS = [
  {
    name: "Maya_Dev",
    color: "#EC4899", // Pink
    role: "Full-Stack Engineer",
    actions: [
      "Adding memoization cache to Fibonacci function",
      "Refactoring algorithmic loop for high performance",
      "Testing concurrent delta synchronization",
    ],
  },
  {
    name: "Kenji_Systems",
    color: "#F59E0B", // Amber
    role: "Backend Architect",
    actions: [
      "Profiling memory allocation in pipeline",
      "Adding health check probe handler",
      "Inspecting operational transform version clock",
    ],
  },
];

export const SimulateCollaboratorModal: React.FC<SimulateCollaboratorModalProps> = ({
  isOpen,
  onClose,
  roomId,
  activeFileId,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(PEER_PERSONAS[0]);
  const [activityLog, setActivityLog] = useState<string[]>([]);

  const peerSocketRef = useRef<Socket | null>(null);
  const intervalRef = useRef<any>(null);

  const appendLog = (msg: string) => {
    setActivityLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ${msg}`,
      ...prev.slice(0, 15),
    ]);
  };

  const startSimulation = () => {
    if (isRunning) return;

    appendLog(`Connecting real WebSocket client for ${selectedPersona.name}...`);
    const token = sessionStorage.getItem("auth_token");

const socket = io({
  transports: ["websocket", "polling"],
  forceNew: true,
  auth: {
    token,
  },
});
    peerSocketRef.current = socket;

    socket.on("connect", () => {
      appendLog(`WebSocket connected (Socket ID: ${socket.id?.substring(0, 6)}). Joining room ${roomId}...`);
      socket.emit("room:join", {
        roomId,
        username: selectedPersona.name,
        userColor: selectedPersona.color,
        activeFileId,
      });

      // Send greeting chat
      setTimeout(() => {
        socket.emit("chat:send", {
          roomId,
          text: `Hey everyone! ${selectedPersona.name} here, starting work on performance optimization.`,
        });
        appendLog(`Sent chat message: "Hey everyone!..."`);
      }, 1000);

      // Automated collaborative typing & cursor motion sequence
      let step = 0;
      let line = 12;
      let ch = 1;

      intervalRef.current = setInterval(() => {
        if (!socket.connected) return;

        step++;
        // Move cursor
        line = 10 + (step % 8);
        ch = 2 + ((step * 4) % 25);
        socket.emit("cursor:move", {
          roomId,
          fileId: activeFileId,
          cursor: { line, ch },
          selection: null,
        });

        // Periodically inject a useful snippet into active file or send chat
        if (step % 5 === 0) {
          const timestampStr = new Date().toLocaleTimeString();
          const sampleComment = `\n// [${selectedPersona.name} @ ${timestampStr}]: Verified iteration #${step} at Ln ${line}\n`;
          
          // Generate non-destructive CRDT operations
          const simDoc = new TextCRDTDoc(selectedPersona.name);
          const ops = simDoc.insert(0, sampleComment);

          socket.emit("crdt:ops", {
            roomId,
            fileId: activeFileId,
            ops,
            content: sampleComment,
            clientVersion: 100 + step,
            peerId: selectedPersona.name,
            clock: Date.now(),
            changeOrigin: selectedPersona.name,
          });
          appendLog(`Dispatched CRDT concurrent operations to ${activeFileId}`);
        }

        if (step % 9 === 0) {
          socket.emit("chat:send", {
            roomId,
            text: `Step #${step}: Code diff validated without conflicts!`,
          });
          appendLog(`Sent chat update: Step #${step}`);
        }
      }, 3000);
    });

    setIsRunning(true);
  };

  const stopSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (peerSocketRef.current) {
      peerSocketRef.current.disconnect();
      peerSocketRef.current = null;
    }
    setIsRunning(false);
    appendLog("Simulation stopped. Peer disconnected.");
  };

  useEffect(() => {
    return () => {
      stopSimulation();
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Live Peer Simulator & Testing</h2>
              <p className="text-[11px] text-slate-400">
                Test simultaneous multi-user typing, presence cursors, and live chat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Persona selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Collaborator Persona
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PEER_PERSONAS.map((p) => (
                <button
                  key={p.name}
                  disabled={isRunning}
                  onClick={() => setSelectedPersona(p)}
                  className={`p-3 rounded-lg border text-left transition ${
                    selectedPersona.name === p.name
                      ? "bg-slate-800 border-indigo-500 text-white"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs font-bold">{p.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{p.role}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              {!isRunning ? (
                <button
                  onClick={startSimulation}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Automated Collaborator</span>
                </button>
              ) : (
                <button
                  onClick={stopSimulation}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Collaborator</span>
                </button>
              )}

              <button
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("room", roomId);
                  window.open(url.toString(), "_blank");
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold py-2.5 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                title="Open the same room in a new browser window to type side-by-side"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open 2nd Window</span>
              </button>
            </div>

            {/* CRDT Stress Test Button */}
            <button
              onClick={() => {
                if (!peerSocketRef.current) {
                  // Connect temporary peer socket if not running
                  const token = sessionStorage.getItem("auth_token");
                  const socket = io({
                    transports: ["websocket", "polling"],
                    auth: {
                      token,
                    },
                  });
                  socket.emit("room:join", {
                    roomId,
                    username: selectedPersona.name,
                    userColor: selectedPersona.color,
                    activeFileId,
                  });
                  const comment = `\n// [${selectedPersona.name} CRDT RACE TEST @ ${new Date().toLocaleTimeString()}]: Concurrent insertion test\n`;
                  const doc = new TextCRDTDoc(selectedPersona.name);
                  const ops = doc.insert(0, comment);
                  setTimeout(() => {
                    socket.emit("crdt:ops", {
                      roomId,
                      fileId: activeFileId,
                      ops,
                      content: comment,
                      clientVersion: 888,
                      peerId: selectedPersona.name,
                      clock: Date.now(),
                      changeOrigin: selectedPersona.name,
                    });
                    appendLog(`Injected synthetic CRDT race condition with ${selectedPersona.name}`);
                    setTimeout(() => socket.disconnect(), 1000);
                  }, 400);
                } else {
                  const comment = `\n// [${selectedPersona.name} CRDT RACE TEST @ ${new Date().toLocaleTimeString()}]: Concurrent insertion test\n`;
                  const doc = new TextCRDTDoc(selectedPersona.name);
                  const ops = doc.insert(0, comment);
                  peerSocketRef.current.emit("crdt:ops", {
                    roomId,
                    fileId: activeFileId,
                    ops,
                    content: comment,
                    clientVersion: 888,
                    peerId: selectedPersona.name,
                    clock: Date.now(),
                    changeOrigin: selectedPersona.name,
                  });
                  appendLog(`Injected synthetic CRDT race condition with ${selectedPersona.name}`);
                }
              }}
              className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold py-2 px-4 rounded-lg text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <GitMerge className="w-3.5 h-3.5 text-emerald-400" />
              <span>Simulate High-Latency Concurrent Conflict (Test CRDT Merge)</span>
            </button>
          </div>

          {/* Activity Log */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulator Telemetry</span>
            </div>
            <div className="h-28 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1">
              {activityLog.length === 0 ? (
                <div className="text-slate-600 italic">No events logged yet. Click Start to begin.</div>
              ) : (
                activityLog.map((log, i) => (
                  <div key={i} className="leading-tight">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
