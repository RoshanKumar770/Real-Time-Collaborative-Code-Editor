import React, { useEffect, useState } from "react";

interface Room {
  id: string;
  name: string;
  created_at?: string;
}

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchRoom: (roomId: string) => void;
  currentRoomId: string;
  authReady: boolean;
}

const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  onSwitchRoom,
  currentRoomId,
  authReady,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newRoomId, setNewRoomId] = useState("");
  const [newRoomName, setNewRoomName] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen, authReady]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem("auth_token");


      const res = await fetch("/api/rooms", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch rooms: ${res.status}`);
      }

      const data = await res.json();
      console.log("[RoomModal] rooms response:", data);

      // Handle both { rooms: [...] } and direct array [...] responses
      if (Array.isArray(data)) {
        setRooms(data);
      } else if (data.rooms && Array.isArray(data.rooms)) {
        setRooms(data.rooms);
      } else {
        setRooms([]);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
      setError("Failed to load workspaces. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedId = newRoomId.trim();
    if (!trimmedId) {
      setError("Workspace ID is required.");
      return;
    }

    const cleanId = trimmedId.toLowerCase().replace(/[^a-z0-9-_]/g, "");

    if (cleanId.length < 3) {
      setError("Workspace ID must be at least 3 characters long.");
      return;
    }

    try {
      setLoading(true);
      const token = sessionStorage.getItem("auth_token");

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: cleanId,
          name: newRoomName.trim() || `Workspace ${cleanId}`,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Failed to create room:", errorText);
        setError(`Failed to create workspace: ${res.status}`);
        return;
      }

      onSwitchRoom(cleanId);
      onClose();

      // Reset form
      setNewRoomId("");
      setNewRoomName("");
    } catch (err) {
      console.error("Failed to create room:", err);
      setError("An unexpected error occurred while creating the workspace.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-gray-900 border border-gray-800 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Switch Workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-gray-300">
            Available Workspaces
          </h3>

          {loading && rooms.length === 0 ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading workspaces...</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-gray-400">
              No workspaces available. Create one below.
            </p>
          ) : (
            <div className="max-h-60 space-y-2 overflow-y-auto pr-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    onSwitchRoom(room.id);
                    onClose();
                  }}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${room.id === currentRoomId
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-700 bg-gray-800 hover:border-gray-600 hover:bg-gray-750"
                    }`}
                >
                  <div className="font-medium text-white">{room.name}</div>
                  <div className="mt-1 text-xs text-gray-400">
                    ID: {room.id}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 pt-5">
          <h3 className="mb-3 text-sm font-medium text-gray-300">
            Create New Workspace
          </h3>

          <form onSubmit={handleCreateRoom} className="space-y-3">
            <div>
              <input
                type="text"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                placeholder="Workspace ID (e.g., my-project)"
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Lowercase letters, numbers, hyphens, and underscores only.
              </p>
            </div>

            <input
              type="text"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Workspace name (optional)"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              disabled={loading}
            />

            <button
              type="submit"
              disabled={loading || !newRoomId.trim()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Workspace"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RoomModal;