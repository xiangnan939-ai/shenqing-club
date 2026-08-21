import { json } from '../_lib/auth.js';
import { serializeChatMessage } from '../_lib/chat-files.js';
import { acceptedFriendship, FRIEND_LIMITS } from '../_lib/friends.js';
import { requireUser } from '../_lib/user.js';

function parseFriendId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

async function verifyFriend(context, userId, friendId) {
  if (!friendId || friendId === Number(userId)) return null;
  const friendship = await acceptedFriendship(context.env.DB, userId, friendId);
  if (!friendship) return null;
  return context.env.DB.prepare(
    `SELECT id, username, nickname, avatar_image, last_seen_at
     FROM users WHERE id = ? LIMIT 1`,
  ).bind(friendId).first();
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const friendId = parseFriendId(new URL(context.request.url).searchParams.get('friendId'));
  const friend = await verifyFriend(context, user.id, friendId);
  if (!friend) return json({ error: '你们还不是好友。' }, 403);

  await context.env.DB.prepare(
    'DELETE FROM message_attachments WHERE expires_at <= CURRENT_TIMESTAMP',
  ).run();

  const result = await context.env.DB.prepare(
    `SELECT * FROM (
       SELECT dm.id, dm.sender_id, dm.recipient_id, dm.body, dm.created_at, dm.read_at,
              dm.message_type, dm.attachment_id, dm.attachment_name,
              dm.attachment_size, dm.attachment_mime, dm.attachment_received_at,
              CASE WHEN ma.id IS NULL THEN 0 ELSE 1 END AS attachment_available
       FROM direct_messages dm
       LEFT JOIN message_attachments ma
         ON ma.id = dm.attachment_id AND ma.expires_at > CURRENT_TIMESTAMP
       WHERE (dm.sender_id = ? AND dm.recipient_id = ?)
          OR (dm.sender_id = ? AND dm.recipient_id = ?)
       ORDER BY dm.id DESC LIMIT 100
     ) ORDER BY id ASC`,
  ).bind(user.id, friendId, friendId, user.id).all();

  await context.env.DB.prepare(
    `UPDATE direct_messages SET read_at = CURRENT_TIMESTAMP
     WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL`,
  ).bind(friendId, user.id).run();

  return json({
    ok: true,
    messages: (result.results || []).map(serializeChatMessage),
  });
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }
  const friendId = parseFriendId(input.friendId);
  const friend = await verifyFriend(context, user.id, friendId);
  if (!friend) return json({ error: '你们还不是好友。' }, 403);
  const body = String(input.body || '').trim();
  if (!body) return json({ error: '消息不能为空。' }, 400);
  if ([...body].length > FRIEND_LIMITS.maxMessageLength) {
    return json({ error: `消息不能超过 ${FRIEND_LIMITS.maxMessageLength} 个字。` }, 400);
  }

  const recent = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM direct_messages
     WHERE sender_id = ? AND created_at >= datetime('now', '-1 minute')`,
  ).bind(user.id).first();
  if (Number(recent?.count) >= FRIEND_LIMITS.maxMessagesPerMinute) {
    return json({ error: '发送太频繁，请稍后再试。' }, 429);
  }

  const insert = await context.env.DB.prepare(
    `INSERT INTO direct_messages (sender_id, recipient_id, body, message_type)
     VALUES (?, ?, ?, 'text')`,
  ).bind(user.id, friendId, body).run();
  return json({ ok: true, messageId: Number(insert.meta?.last_row_id) }, 201);
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
}
