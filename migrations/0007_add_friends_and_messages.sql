CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_low_id INTEGER NOT NULL,
  user_high_id INTEGER NOT NULL,
  requested_by_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TEXT,
  CHECK (user_low_id < user_high_id),
  CHECK (requested_by_id IN (user_low_id, user_high_id)),
  UNIQUE (user_low_id, user_high_id),
  FOREIGN KEY (user_low_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_high_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS friendships_low_status_idx
  ON friendships(user_low_id, status);

CREATE INDEX IF NOT EXISTS friendships_high_status_idx
  ON friendships(user_high_id, status);

CREATE TABLE IF NOT EXISTS direct_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT,
  CHECK (sender_id <> recipient_id),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_idx
  ON direct_messages(sender_id, recipient_id, id DESC);

CREATE INDEX IF NOT EXISTS direct_messages_unread_idx
  ON direct_messages(recipient_id, read_at, id DESC);
