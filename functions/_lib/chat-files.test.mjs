import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachmentDisposition,
  sanitizeFileName,
  sanitizeMimeType,
  serializeChatMessage,
} from './chat-files.js';

test('file names keep useful Unicode while removing paths and controls', () => {
  assert.equal(sanitizeFileName('../资料/照片\u0000.png'), '.._资料_照片.png');
  assert.equal(sanitizeFileName(''), '未命名文件');
  assert.doesNotThrow(() => attachmentDisposition(`${'文'.repeat(179)}😀.zip`));
});

test('untrusted MIME values fall back to binary download', () => {
  assert.equal(sanitizeMimeType('image/png'), 'image/png');
  assert.equal(sanitizeMimeType('text/html; charset=utf-8'), 'application/octet-stream');
});

test('content disposition includes a safe fallback and UTF-8 filename', () => {
  const value = attachmentDisposition('项目资料 终稿.zip');
  assert.match(value, /^attachment; filename=/u);
  assert.match(value, /filename\*=UTF-8''/u);
  assert.match(value, /%E9%A1%B9%E7%9B%AE/u);
  assert.match(attachmentDisposition("设计稿's.zip"), /%27/u);
});

test('file message serialization distinguishes pending, received, and expired data', () => {
  const base = {
    id: 1,
    sender_id: 2,
    recipient_id: 3,
    message_type: 'file',
    body: '',
    created_at: '2026-08-21 10:00:00',
    attachment_id: 'file-1',
    attachment_name: '资料.zip',
    attachment_size: 123,
    attachment_mime: 'application/zip',
  };
  assert.equal(serializeChatMessage({ ...base, attachment_available: 1 }).attachment.status, 'pending');
  assert.equal(serializeChatMessage({ ...base, attachment_available: 0, attachment_received_at: '2026-08-21 10:01:00' }).attachment.status, 'received');
  assert.equal(serializeChatMessage({ ...base, attachment_available: 0 }).attachment.status, 'expired');
});
