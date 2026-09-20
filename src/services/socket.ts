import { io, Socket } from "socket.io-client";
import { UserPresence, CodeFile, VersionSnapshot, ChatMessage, RoomState } from "../types";

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private pingLatency: number = 0;
  private pingInterval: any = null;

  public connect(): Socket {
    if (!this.socket) {
      const token = sessionStorage.getItem("auth_token");

      this.socket = io({
        autoConnect: false,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        auth: {
          token,
        },
      });

      this.socket.on("connect", () => {
        this.isConnected = true;
        this.startPingMeasurement();
      });

      this.socket.on("disconnect", () => {
        this.isConnected = false;
        this.stopPingMeasurement();
      });

      this.socket.on("connect_error", (error) => {
        console.error("[Socket] connect_error:", error.message);
      });
    }

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getLatency(): number {
    return this.pingLatency;
  }

  private startPingMeasurement() {
    this.stopPingMeasurement();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.isConnected) {
        const start = Date.now();
        this.socket.emit("ping_check", () => {
          this.pingLatency = Date.now() - start;
        });
      }
    }, 5000);
  }

  private stopPingMeasurement() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public joinRoom(roomId: string, username: string, userColor: string, activeFileId?: string) {
    if (!this.socket) return;
    this.socket.emit("room:join", { roomId, username, userColor, activeFileId });
  }

  private simulatedLatencyMs: number = 0;

  public setSimulatedLatency(ms: number) {
    this.simulatedLatencyMs = Math.max(0, ms);
  }

  public getSimulatedLatency(): number {
    return this.simulatedLatencyMs;
  }

  public emitCodeChange(roomId: string, fileId: string, content: string, clientVersion: number, changeOrigin?: string) {
    if (!this.socket) return;
    const payload = { roomId, fileId, content, clientVersion, changeOrigin };
    if (this.simulatedLatencyMs > 0) {
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit("code:change", payload);
        }
      }, this.simulatedLatencyMs);
    } else {
      this.socket.emit("code:change", payload);
    }
  }

  public emitCRDTOps(
    roomId: string,
    fileId: string,
    ops: any[],
    content: string,
    clientVersion: number,
    peerId?: string,
    clock?: number,
    changeOrigin?: string
  ) {
    if (!this.socket) return;
    const payload = { roomId, fileId, ops, content, clientVersion, peerId, clock, changeOrigin };
    if (this.simulatedLatencyMs > 0) {
      setTimeout(() => {
        if (this.socket && this.socket.connected) {
          this.socket.emit("crdt:ops", payload);
        }
      }, this.simulatedLatencyMs);
    } else {
      this.socket.emit("crdt:ops", payload);
    }
  }

  public onCRDTOps(
    callback: (data: {
      fileId: string;
      ops: any[];
      content: string;
      version: number;
      authorSocketId: string;
      authorName?: string;
      authorColor?: string;
      peerId?: string;
      clock?: number;
      changeOrigin?: string;
    }) => void
  ): () => void {
    if (!this.socket) return () => { };
    this.socket.on("crdt:ops", callback);
    return () => {
      this.socket?.off("crdt:ops", callback);
    };
  }

  public emitCursorMove(
    roomId: string,
    fileId: string,
    cursor: { line: number; ch: number } | null,
    selection: { startLine: number; startCh: number; endLine: number; endCh: number } | null
  ) {
    if (!this.socket) return;
    this.socket.emit("cursor:move", { roomId, fileId, cursor, selection });
  }

  public sendChatMessage(roomId: string, text: string) {
    if (!this.socket) return;

    const send = () => {
      this.socket.emit("chat:send", { roomId, text });
    };

    if (this.socket.connected) {
      send();
      return;
    }

    this.socket.once("connect", send);
  }

  public setTyping(roomId: string, isTyping: boolean) {
    if (!this.socket) return;
    this.socket.emit("chat:typing", { roomId, isTyping });
  }

  public createFile(roomId: string, name: string, language: string, initialContent?: string) {
    if (!this.socket) return;
    this.socket.emit("file:create", { roomId, name, language, initialContent });
  }

  public deleteFile(roomId: string, fileId: string) {
    if (!this.socket) return;
    this.socket.emit("file:delete", { roomId, fileId });
  }

  public renameFile(roomId: string, fileId: string, newName: string, newLanguage?: string) {
    if (!this.socket) return;
    this.socket.emit("file:rename", { roomId, fileId, newName, newLanguage });
  }

  public switchFile(roomId: string, fileId: string) {
    if (!this.socket) return;
    this.socket.emit("file:switch", { roomId, fileId });
  }

  public commitVersion(roomId: string, commitMessage: string) {
    if (!this.socket) return;
    this.socket.emit("history:commit", { roomId, commitMessage });
  }

  public restoreVersion(roomId: string, versionId: string) {
    if (!this.socket) return;
    this.socket.emit("history:restore", { roomId, versionId });
  }

  public disconnect() {
    this.stopPingMeasurement();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
