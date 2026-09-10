import { pool, query } from "./database";

export interface PersistedRoom {
  id: string;
  name: string;
  createdAt: number;
  activeFileId: string;
  syncVersion: number;
}

export interface PersistedFile {
  id: string;
  roomId: string;
  name: string;
  language: string;
  content: string;
  version: number;
  lastModifiedBy?: string;
  lastModifiedAt?: number;
}

export async function findRoom(
  roomId: string
): Promise<PersistedRoom | null> {
  const result = await query<PersistedRoom>(
    `
      SELECT
        id,
        name,
        created_at AS "createdAt",
        active_file_id AS "activeFileId",
        sync_version AS "syncVersion"
      FROM rooms
      WHERE id = $1
    `,
    [roomId]
  );

  const room = result.rows[0];

  if (!room) {
    return null;
  }

  return {
    ...room,
    createdAt: Number(room.createdAt),
  };
}

export async function createRoom(room: PersistedRoom) {
  await query(
    `
      INSERT INTO rooms (
        id,
        name,
        created_at,
        active_file_id,
        sync_version
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      room.id,
      room.name,
      room.createdAt,
      room.activeFileId,
      room.syncVersion,
    ]
  );
}

export async function listRooms(): Promise<PersistedRoom[]> {
  const result = await query<PersistedRoom>(
    `
      SELECT
        id,
        name,
        created_at AS "createdAt",
        active_file_id AS "activeFileId",
        sync_version AS "syncVersion"
      FROM rooms
      ORDER BY created_at ASC
    `
  );

  return result.rows.map((room) => ({
    ...room,
    createdAt: Number(room.createdAt),
  }));
}

export async function replaceRoomFiles(
  roomId: string,
  files: PersistedFile[]
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `DELETE FROM files WHERE room_id = $1`,
      [roomId]
    );

    for (const file of files) {
      await client.query(
        `
          INSERT INTO files (
            id,
            room_id,
            name,
            language,
            content,
            version,
            last_modified_by,
            last_modified_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          file.id,
          roomId,
          file.name,
          file.language,
          file.content,
          file.version,
          file.lastModifiedBy ?? null,
          file.lastModifiedAt ?? null,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findRoomFiles(
  roomId: string
): Promise<PersistedFile[]> {
  const result = await query<PersistedFile>(
    `
      SELECT
        id,
        room_id AS "roomId",
        name,
        language,
        content,
        version,
        last_modified_by AS "lastModifiedBy",
        last_modified_at AS "lastModifiedAt"
      FROM files
      WHERE room_id = $1
      ORDER BY id
    `,
    [roomId]
  );

  return result.rows.map((file) => ({
    ...file,
    lastModifiedAt:
      file.lastModifiedAt == null
        ? undefined
        : Number(file.lastModifiedAt),
  }));
}
export interface PersistedVersionSnapshot {
  id: string;
  roomId: string;
  versionNumber: number;
  timestamp: number;
  authorName: string;
  authorColor: string;
  commitMessage: string;
  filesSnapshot: Record<string, string>;
  fileNames: Record<string, string>;
  activeFileId: string;
  changeSummary: string;
}

export interface PersistedChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  userColor: string;
  text: string;
  timestamp: number;
  type: "chat" | "system";
}

export async function saveVersionSnapshot(
  snapshot: PersistedVersionSnapshot
) {
  await query(
    `
      INSERT INTO version_snapshots (
        id,
        room_id,
        version_number,
        timestamp,
        author_name,
        author_color,
        commit_message,
        files_snapshot,
        file_names,
        active_file_id,
        change_summary
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8::jsonb, $9::jsonb, $10, $11
      )
      ON CONFLICT (id) DO NOTHING
    `,
    [
      snapshot.id,
      snapshot.roomId,
      snapshot.versionNumber,
      snapshot.timestamp,
      snapshot.authorName,
      snapshot.authorColor,
      snapshot.commitMessage,
      JSON.stringify(snapshot.filesSnapshot),
      JSON.stringify(snapshot.fileNames),
      snapshot.activeFileId,
      snapshot.changeSummary,
    ]
  );
}

export async function findRoomVersionHistory(
  roomId: string
): Promise<PersistedVersionSnapshot[]> {
  const result = await query<PersistedVersionSnapshot>(
    `
      SELECT
        id,
        room_id AS "roomId",
        version_number AS "versionNumber",
        timestamp,
        author_name AS "authorName",
        author_color AS "authorColor",
        commit_message AS "commitMessage",
        files_snapshot AS "filesSnapshot",
        file_names AS "fileNames",
        active_file_id AS "activeFileId",
        change_summary AS "changeSummary"
      FROM version_snapshots
      WHERE room_id = $1
      ORDER BY version_number ASC
    `,
    [roomId]
  );

  return result.rows.map((snapshot) => ({
    ...snapshot,
    timestamp: Number(snapshot.timestamp),
  }));
}

export async function saveChatMessage(
  message: PersistedChatMessage
) {
  await query(
    `
      INSERT INTO chat_messages (
        id,
        room_id,
        user_id,
        username,
        user_color,
        text,
        timestamp,
        type
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      message.id,
      message.roomId,
      message.userId,
      message.username,
      message.userColor,
      message.text,
      message.timestamp,
      message.type,
    ]
  );
}

export async function findRoomChatMessages(
  roomId: string,
  limit = 50
): Promise<PersistedChatMessage[]> {
  const result = await query<PersistedChatMessage>(
    `
      SELECT
        id,
        room_id AS "roomId",
        user_id AS "userId",
        username,
        user_color AS "userColor",
        text,
        timestamp,
        type
      FROM chat_messages
      WHERE room_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `,
    [roomId, limit]
  );

  return result.rows
    .reverse()
    .map((message) => ({
      ...message,
      timestamp: Number(message.timestamp),
    }));
}
export async function updateRoom(
  roomId: string,
  activeFileId: string,
  syncVersion: number
) {
  await query(
    `
      UPDATE rooms
      SET active_file_id = $2,
          sync_version = $3
      WHERE id = $1
    `,
    [roomId, activeFileId, syncVersion]
  );
}

export async function deleteRoom(roomId: string) {
  await query(
    `DELETE FROM rooms WHERE id = $1`,
    [roomId]
  );
}