ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN signature TEXT NOT NULL DEFAULT '这个人很深情，还没留下签名。';
ALTER TABLE users ADD COLUMN avatar_text TEXT;
ALTER TABLE users ADD COLUMN active_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_seen_at TEXT;

CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE,
  message TEXT NOT NULL,
  contact TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS feedback_submissions_created_idx
  ON feedback_submissions(created_at DESC);
