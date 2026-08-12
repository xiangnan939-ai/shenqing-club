ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
ALTER TABLE users ADD COLUMN email_verified_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
  ON users(email)
  WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS email_verification_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  request_ip_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS email_verification_email_created_idx
  ON email_verification_requests(email, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_ip_created_idx
  ON email_verification_requests(request_ip_hash, created_at DESC);
