import "dotenv/config";
import { closeDatabase } from "./database";
import {
  createRoom,
  findRoom,
  listRooms,
  replaceRoomFiles,
  findRoomFiles,
  saveVersionSnapshot,
  findRoomVersionHistory,
  saveChatMessage,
  findRoomChatMessages,
} from "./repository";

async function main() {
  const testRoom = {
    id: "db-test-room",
    name: "Database Test Room",
    createdAt: Date.now(),
    activeFileId: "db-test-file-js",
    syncVersion: 1,
  };

  await createRoom(testRoom);

  const testFiles = [
    {
      id: "db-test-file-js",
      roomId: testRoom.id,
      name: "index.js",
      language: "javascript",
      content: 'console.log("PostgreSQL persistence works");',
      version: 2,
      lastModifiedBy: "Test",
      lastModifiedAt: Date.now(),
    },
    {
      id: "db-test-file-ts",
      roomId: testRoom.id,
      name: "utils.ts",
      language: "typescript",
      content: "export const answer = 42;",
      version: 1,
      lastModifiedBy: "Test",
      lastModifiedAt: Date.now(),
    },
  ];

  await replaceRoomFiles(testRoom.id, testFiles);

  const snapshot = {
    id: "db-test-version-1",
    roomId: testRoom.id,
    versionNumber: 1,
    timestamp: Date.now(),
    authorName: "Test User",
    authorColor: "#6366F1",
    commitMessage: "Test PostgreSQL persistence",
    filesSnapshot: {
      "db-test-file-js": testFiles[0].content,
      "db-test-file-ts": testFiles[1].content,
    },
    fileNames: {
      "db-test-file-js": "index.js",
      "db-test-file-ts": "utils.ts",
    },
    activeFileId: testRoom.activeFileId,
    changeSummary: "Database persistence test checkpoint.",
  };

  await saveVersionSnapshot(snapshot);

  const chatMessage = {
    id: "db-test-message-1",
    roomId: testRoom.id,
    userId: "test-user",
    username: "Test User",
    userColor: "#22C55E",
    text: "PostgreSQL chat persistence works",
    timestamp: Date.now(),
    type: "chat" as const,
  };

  await saveChatMessage(chatMessage);

  const found = await findRoom(testRoom.id);
  const files = await findRoomFiles(testRoom.id);
  const history = await findRoomVersionHistory(testRoom.id);
  const messages = await findRoomChatMessages(testRoom.id);
  const rooms = await listRooms();

  console.log("[Database] Room:", found);
  console.log("[Database] Room count:", rooms.length);
  console.log("[Database] Files:", files);
  console.log("[Database] Version history:", history);
  console.log("[Database] Chat messages:", messages);
}

main()
  .catch((error) => {
    console.error("[Database] Repository test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
