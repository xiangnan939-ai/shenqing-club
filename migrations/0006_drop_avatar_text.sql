CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  email TEXT COLLATE NOCASE,
  email_verified_at TEXT,
  nickname TEXT,
  signature TEXT NOT NULL DEFAULT '这个人很深情，还没留下签名。',
  active_seconds INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  avatar_image TEXT
);

INSERT INTO users_new (
  id, username, password_hash, password_salt, created_at,
  email, email_verified_at, nickname, signature,
  active_seconds, last_seen_at, avatar_image
)
SELECT
  id, username, password_hash, password_salt, created_at,
  email, email_verified_at, nickname, signature,
  active_seconds, last_seen_at, avatar_image
FROM users;

DROP TABLE users;
ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS users_created_at_idx ON users(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users(email)
  WHERE email IS NOT NULL;
