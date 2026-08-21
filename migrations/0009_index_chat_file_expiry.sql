CREATE INDEX IF NOT EXISTS message_attachments_expires_idx
  ON message_attachments(expires_at);
