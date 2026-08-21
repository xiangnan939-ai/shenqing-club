import { json } from '../_lib/auth.js';
import {
  attachmentDisposition,
  CHAT_FILE_LIMITS,
  sanitizeFileName,
  sanitizeMimeType,
} from '../_lib/chat-files.js';
import { acceptedFriendship, FRIEND_LIMITS } from '../_lib/friends.js';
import { requireUser } from '../_lib/user.js';

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

function sqliteTimestamp(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function asBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value)) return new Uint8Array(value);
  return null;
}

async function verifyFriend(db, userId, friendId) {
  if (!friendId || Number(userId) === friendId) return false;
  return Boolean(await acceptedFriendship(db, userId, friendId));
}

async function cleanupExpiredFiles(db) {
  await db.prepare(
    'DELETE FROM message_attachments WHERE expires_at <= CURRENT_TIMESTAMP',
  ).run();
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  const contentLength = Number(context.request.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > CHAT_FILE_LIMITS.maxBytes + 128_000) {
    return json({ error: '单个文件不能超过 1.5 MB。' }, 413);
  }

  let input;
  try {
    input = await context.request.formData();
  } catch {
    return json({ error: '文件上传格式不正确。' }, 400);
  }

  const friendId = parsePositiveId(input.get('friendId'));
  if (!(await verifyFriend(context.env.DB, user.id, friendId))) {
    return json({ error: '你们还不是好友。' }, 403);
  }

  const file = input.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') {
    return json({ error: '请选择要发送的文件。' }, 400);
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return json({ error: '不能发送空文件。' }, 400);
  }
  if (file.size > CHAT_FILE_LIMITS.maxBytes) {
    return json({ error: '单个文件不能超过 1.5 MB。' }, 413);
  }

  const body = String(input.get('body') || '').trim();
  if ([...body].length > FRIEND_LIMITS.maxMessageLength) {
    return json({ error: `附言不能超过 ${FRIEND_LIMITS.maxMessageLength} 个字。` }, 400);
  }

  await cleanupExpiredFiles(context.env.DB);
  const [recent, pending] = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM direct_messages
       WHERE sender_id = ? AND created_at >= datetime('now', '-1 minute')`,
    ).bind(user.id),
    context.env.DB.prepare(
      `SELECT COUNT(*) AS count FROM message_attachments
       WHERE sender_id = ? AND expires_at > CURRENT_TIMESTAMP`,
    ).bind(user.id),
  ]);
  if (Number(recent.results?.[0]?.count) >= FRIEND_LIMITS.maxMessagesPerMinute) {
    return json({ error: '发送太频繁，请稍后再试。' }, 429);
  }
  if (Number(pending.results?.[0]?.count) >= CHAT_FILE_LIMITS.maxPendingPerSender) {
    return json({ error: '待接收文件太多，请等对方接收后再发送。' }, 429);
  }

  const attachmentId = crypto.randomUUID();
  const fileName = sanitizeFileName(file.name);
  const mimeType = sanitizeMimeType(file.type);
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const expiresAt = sqliteTimestamp(new Date(
    Date.now() + CHAT_FILE_LIMITS.retentionDays * 24 * 60 * 60 * 1000,
  ));

  const results = await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO message_attachments
         (id, sender_id, recipient_id, file_data, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(attachmentId, user.id, friendId, fileBytes, expiresAt),
    context.env.DB.prepare(
      `INSERT INTO direct_messages
         (sender_id, recipient_id, body, message_type, attachment_id,
          attachment_name, attachment_size, attachment_mime)
       VALUES (?, ?, ?, 'file', ?, ?, ?, ?)`,
    ).bind(user.id, friendId, body, attachmentId, fileName, file.size, mimeType),
  ]);

  return json({
    ok: true,
    messageId: Number(results[1]?.meta?.last_row_id),
    attachmentId,
  }, 201);
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const attachmentId = new URL(context.request.url).searchParams.get('id') || '';
  if (!attachmentId) return json({ error: '缺少文件标识。' }, 400);

  const record = await context.env.DB.prepare(
    `SELECT dm.attachment_name, dm.attachment_size, ma.file_data
     FROM direct_messages dm
     JOIN message_attachments ma ON ma.id = dm.attachment_id
     WHERE dm.attachment_id = ? AND dm.recipient_id = ?
       AND dm.attachment_received_at IS NULL
       AND ma.recipient_id = ? AND ma.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
  ).bind(attachmentId, user.id, user.id).first();
  if (!record) {
    return json({ error: '文件已接收、已过期或不存在。' }, 410);
  }

  const bytes = asBytes(record.file_data);
  if (!bytes || bytes.byteLength !== Number(record.attachment_size)) {
    return json({ error: '文件数据损坏，无法接收。' }, 500);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Content-Disposition': attachmentDisposition(record.attachment_name),
      'Content-Length': String(bytes.byteLength),
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestDelete(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const attachmentId = new URL(context.request.url).searchParams.get('id') || '';
  if (!attachmentId) return json({ error: '缺少文件标识。' }, 400);

  const record = await context.env.DB.prepare(
    `SELECT dm.id FROM direct_messages dm
     JOIN message_attachments ma ON ma.id = dm.attachment_id
     WHERE dm.attachment_id = ? AND dm.recipient_id = ? AND ma.recipient_id = ?
     LIMIT 1`,
  ).bind(attachmentId, user.id, user.id).first();
  if (!record) return json({ error: '文件已被清除或不存在。' }, 410);

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE direct_messages SET attachment_received_at = CURRENT_TIMESTAMP
       WHERE id = ? AND recipient_id = ? AND attachment_received_at IS NULL`,
    ).bind(record.id, user.id),
    context.env.DB.prepare(
      'DELETE FROM message_attachments WHERE id = ? AND recipient_id = ?',
    ).bind(attachmentId, user.id),
  ]);
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, DELETE' });
}
