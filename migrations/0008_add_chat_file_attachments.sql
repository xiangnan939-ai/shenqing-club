CREATE TABLE IF NOT EXISTS message_attachments (
  id TEXT PRIMARY KEY,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  file_data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  CHECK (sender_id <> recipient_id),
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS message_attachments_recipient_idx
  ON message_attachments(recipient_id, expires_at);

CREATE INDEX IF NOT EXISTS message_attachments_sender_idx
  ON message_attachments(sender_id, expires_at);

ALTER TABLE direct_messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE direct_messages ADD COLUMN attachment_id TEXT;
ALTER TABLE direct_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE direct_messages ADD COLUMN attachment_size INTEGER;
ALTER TABLE direct_messages ADD COLUMN attachment_mime TEXT;
ALTER TABLE direct_messages ADD COLUMN attachment_received_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS direct_messages_attachment_idx
  ON direct_messages(attachment_id)
  WHERE attachment_id IS NOT NULL;
