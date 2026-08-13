ALTER TABLE email_verification_requests
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'register';

DROP INDEX IF EXISTS email_verification_email_created_idx;
DROP INDEX IF EXISTS email_verification_ip_created_idx;

CREATE INDEX IF NOT EXISTS email_verification_email_purpose_created_idx
  ON email_verification_requests(email, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS email_verification_ip_purpose_created_idx
  ON email_verification_requests(request_ip_hash, purpose, created_at DESC);
