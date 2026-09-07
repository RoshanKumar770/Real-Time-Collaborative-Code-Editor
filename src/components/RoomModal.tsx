import React, { useState, useEffect } from "react";
import { 
  Users, 
  DoorOpen, 
  Plus, 
  X, 
  Check, 
  Radio, 
  Hash, 
  Layers,
  ArrowRight
} from "lucide-react";

interface RoomSummary {
  id: string;
  name: string;
  userCount: number;
  fileCount: number;
  versionCount: number;
  latestVersion: number;
  users: Array<{ id: string; username: string; color: string }>;
}

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId: string;
  onSwitchRoom: (roomId: string) => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
  onSwitchRoom,
}) => {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/rooms");
      const data = await res.json();
      if (data.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomId.trim()) return;

    const cleanId = newRoomId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "");
    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cleanId,
          name: newRoomName.trim() || `Workspace ${cleanId}`,
        }),
      });
      onSwitchRoom(cleanId);
      onClose();
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-14 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <DoorOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Collaborative Workspaces</h2>
              <p className="text-[11px] text-slate-400">
                Join an active collaborative session or launch a private workspace.
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

        {/* Modal Content */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Create New Room Form */}
          <form onSubmit={handleCreateRoom} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Plus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Create New Workspace</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Room ID (e.g. team-sprint-04)"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="text"
                placeholder="Display Name (optional)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={!newRoomId.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <DoorOpen className="w-4 h-4" />
              <span>Launch & Join Workspace</span>
            </button>
          </form>

          {/* Active Rooms List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Active Rooms ({rooms.length})
              </span>
              <button
                onClick={fetchRooms}
                disabled={loading}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="space-y-2">
              {rooms.map((room) => {
                const isCurrent = room.id === currentRoomId;
                return (
                  <div
                    key={room.id}
                    className={`p-3 rounded-lg border transition flex items-center justify-between ${
                      isCurrent
                        ? "bg-indigo-950/30 border-indigo-500/50 text-slate-100"
                        : "bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                        <Hash className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-100 truncate">
                            {room.name}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {room.id}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              Current Room
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-slate-500" />
                            {room.userCount} active {room.userCount === 1 ? "user" : "users"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-500" />
                            {room.fileCount} files
                          </span>
                          <span className="text-slate-500">v{room.latestVersion}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      {isCurrent ? (
                        <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                          <Check className="w-4 h-4" /> Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            onSwitchRoom(room.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white px-3 py-1.5 rounded-md border border-slate-700 transition cursor-pointer"
                        >
                          <span>Switch</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
