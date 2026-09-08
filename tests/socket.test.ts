import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as createClient, Socket } from "socket.io-client";
import { httpServer } from "../server";

let port: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.listen(0, "127.0.0.1", () => {
      const address = httpServer.address();

      if (address && typeof address !== "string") {
        port = address.port;
      }

      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
});

function createTestClient(): Socket {
  return createClient(`http://127.0.0.1:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
}

function connect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Socket connection timed out"));
    }, 3000);

    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForEvent<T = any>(
  socket: Socket,
  event: string,
  timeout = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for "${event}"`));
    }, timeout);

    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function disconnect(socket: Socket): Promise<void> {
  if (!socket.connected) {
    socket.close();
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("disconnect", () => resolve());
    socket.disconnect();
  });
}

async function joinRoom(
  socket: Socket,
  roomId: string,
  username: string,
  color: string
) {
  const initPromise = waitForEvent(socket, "room:init");

  socket.emit("room:join", {
    roomId,
    username,
    userColor: color,
    activeFileId: "file-main-js",
  });

  return await initPromise;
}

describe("Socket.IO Integration", () => {
  it("connects a client to the Socket.IO server", async () => {
    const client = createTestClient();

    await connect(client);

    expect(client.connected).toBe(true);

    await disconnect(client);
  });

  it("allows a client to join a room and receive initial state", async () => {
    const client = createTestClient();

    await connect(client);

    const init = await joinRoom(
      client,
      "global-workspace",
      "Integration Tester",
      "#6366F1"
    );

    expect(init).toHaveProperty("room");
    expect(init).toHaveProperty("self");

    expect(init.room.id).toBe("global-workspace");
    expect(init.room.name).toBe("Global Workspace");
    expect(Array.isArray(init.room.files)).toBe(true);
    expect(init.room.files.length).toBeGreaterThan(0);
    expect(Array.isArray(init.room.users)).toBe(true);

    expect(init.self.username).toBe("Integration Tester");
    expect(init.self.activeFileId).toBe("file-main-js");

    await disconnect(client);
  });

  it("notifies existing users when another collaborator joins", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `presence-join-${Date.now()}`;

    await joinRoom(clientA, roomId, "User A", "#6366F1");

    const joinedPromise = waitForEvent(clientA, "user:joined");

    await joinRoom(clientB, roomId, "User B", "#22C55E");

    const joined = await joinedPromise;

    expect(joined.user.username).toBe("User B");
    expect(joined.user.color).toBe("#22C55E");
    expect(joined.users.length).toBe(2);

    await Promise.all([
      disconnect(clientA),
      disconnect(clientB),
    ]);
  });

  it("broadcasts code updates to another client", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `code-test-${Date.now()}`;

    await joinRoom(clientA, roomId, "User A", "#6366F1");
    await joinRoom(clientB, roomId, "User B", "#22C55E");

    const updatePromise = waitForEvent(clientB, "code:update");

    clientA.emit("code:change", {
      roomId,
      fileId: "file-main-js",
      content: 'console.log("Hello from User A");',
      clientVersion: 1,
      changeOrigin: "integration-test",
    });

    const update = await updatePromise;

    expect(update.fileId).toBe("file-main-js");
    expect(update.content).toContain("Hello from User A");
    expect(update.authorName).toBe("User A");
    expect(update.authorColor).toBe("#6366F1");
    expect(update.version).toBeGreaterThan(1);

    await Promise.all([
      disconnect(clientA),
      disconnect(clientB),
    ]);
  });

  it("relays CRDT operations and code updates", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `crdt-test-${Date.now()}`;

    await joinRoom(clientA, roomId, "CRDT A", "#6366F1");
    await joinRoom(clientB, roomId, "CRDT B", "#22C55E");

    const opsPromise = waitForEvent(clientB, "crdt:ops");

    const operations = [
      {
        type: "insert",
        id: "crdt-op-1",
        peerId: "crdt-user-a",
        clock: 1,
        char: "X",
        pos: [1],
      },
    ];

    clientA.emit("crdt:ops", {
      roomId,
      fileId: "file-main-js",
      ops: operations,
      content: "X",
      clientVersion: 1,
      peerId: "crdt-user-a",
      clock: 1,
      changeOrigin: "integration-test",
    });

    const received = await opsPromise;

    expect(received.fileId).toBe("file-main-js");
    expect(received.ops).toEqual(operations);
    expect(received.content).toBe("X");
    expect(received.peerId).toBe("crdt-user-a");
    expect(received.clock).toBe(1);
    expect(received.authorName).toBe("CRDT A");

    await Promise.all([
      disconnect(clientA),
      disconnect(clientB),
    ]);
  });

  it("broadcasts chat messages to room members", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `chat-test-${Date.now()}`;

    await joinRoom(clientA, roomId, "Chat A", "#6366F1");
    await joinRoom(clientB, roomId, "Chat B", "#22C55E");

    const messagePromise = waitForEvent(clientB, "chat:message");

    clientA.emit("chat:send", {
      roomId,
      text: "Hello from integration test",
    });

    const message = await messagePromise;

    expect(message.text).toBe("Hello from integration test");
    expect(message.username).toBe("Chat A");
    expect(message.type).toBe("chat");
    expect(message.userColor).toBe("#6366F1");

    await Promise.all([
      disconnect(clientA),
      disconnect(clientB),
    ]);
  });

  it("broadcasts cursor updates to other collaborators", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `cursor-test-${Date.now()}`;

    await joinRoom(clientA, roomId, "Cursor A", "#6366F1");
    await joinRoom(clientB, roomId, "Cursor B", "#22C55E");

    const cursorPromise = waitForEvent(clientB, "cursor:update");

    clientA.emit("cursor:move", {
      roomId,
      fileId: "file-main-js",
      cursor: {
        line: 4,
        ch: 12,
      },
      selection: null,
    });

    const cursor = await cursorPromise;

    expect(cursor.username).toBe("Cursor A");
    expect(cursor.fileId).toBe("file-main-js");
    expect(cursor.cursor.line).toBe(4);
    expect(cursor.cursor.ch).toBe(12);

    await Promise.all([
      disconnect(clientA),
      disconnect(clientB),
    ]);
  });

  it("notifies remaining users when a collaborator disconnects", async () => {
    const clientA = createTestClient();
    const clientB = createTestClient();

    await Promise.all([connect(clientA), connect(clientB)]);

    const roomId = `disconnect-test-${Date.now()}`;

    await joinRoom(clientA, roomId, "Presence A", "#6366F1");
    await joinRoom(clientB, roomId, "Presence B", "#22C55E");

    const leftPromise = waitForEvent(clientB, "user:left");

    await disconnect(clientA);

    const leftUser = await leftPromise;

    expect(leftUser.username).toBe("Presence A");
    expect(leftUser.users.length).toBe(1);

    await disconnect(clientB);
  });
});