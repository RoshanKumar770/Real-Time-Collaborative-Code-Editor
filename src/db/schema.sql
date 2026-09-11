CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  active_file_id TEXT NOT NULL,
  sync_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS files (
  id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  last_modified_by TEXT,
  last_modified_at BIGINT,
  PRIMARY KEY (room_id, id)
);

CREATE INDEX IF NOT EXISTS idx_files_room_id
  ON files(room_id);

CREATE TABLE IF NOT EXISTS version_snapshots (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  timestamp BIGINT NOT NULL,
  author_name TEXT NOT NULL,
  author_color TEXT NOT NULL,
  commit_message TEXT NOT NULL,
  files_snapshot JSONB NOT NULL,
  file_names JSONB NOT NULL,
  active_file_id TEXT NOT NULL,
  change_summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_version_snapshots_room_id
  ON version_snapshots(room_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  user_color TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('chat', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id
  ON chat_messages(room_id);
