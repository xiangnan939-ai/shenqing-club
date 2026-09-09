CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY,
  host_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'racing', 'closed')),
  track_index INTEGER NOT NULL DEFAULT 0 CHECK (track_index BETWEEN 0 AND 4),
  max_players INTEGER NOT NULL DEFAULT 6 CHECK (max_players BETWEEN 2 AND 6),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (host_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS game_rooms_host_status_idx
  ON game_rooms(host_user_id, status);

CREATE INDEX IF NOT EXISTS game_rooms_expiry_idx
  ON game_rooms(expires_at);

CREATE TABLE IF NOT EXISTS game_room_members (
  room_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest' CHECK (role IN ('host', 'guest')),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'joined', 'declined', 'left')),
  ready INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0, 1)),
  car_index INTEGER NOT NULL DEFAULT 0 CHECK (car_index BETWEEN 0 AND 4),
  invited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  joined_at TEXT,
  last_seen_at TEXT,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS game_room_members_user_status_idx
  ON game_room_members(user_id, status, invited_at DESC);

CREATE TABLE IF NOT EXISTS game_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('offer', 'answer', 'ice')),
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  CHECK (sender_id <> recipient_id),
  FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS game_signals_recipient_idx
  ON game_signals(room_id, recipient_id, id);

CREATE INDEX IF NOT EXISTS game_signals_expiry_idx
  ON game_signals(expires_at);

CREATE TABLE IF NOT EXISTS dandan_saves (
  user_id INTEGER PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE direct_messages ADD COLUMN game_room_id TEXT;

CREATE INDEX IF NOT EXISTS direct_messages_game_room_idx
  ON direct_messages(game_room_id)
  WHERE game_room_id IS NOT NULL;
