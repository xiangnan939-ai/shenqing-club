import { json } from '../_lib/auth.js';
import { serializeFriend } from '../_lib/friends.js';
import { requireUser } from '../_lib/user.js';

const USER_COLUMNS = 'u.id, u.username, u.nickname, u.signature, u.avatar_image, u.last_seen_at';

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  const [friendsResult, requestsResult] = await context.env.DB.batch([
    context.env.DB.prepare(
      `SELECT ${USER_COLUMNS}, f.id AS friendship_id,
              (SELECT COUNT(*) FROM direct_messages m
               WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL) AS unread_count,
              (SELECT body FROM direct_messages m
               WHERE (m.sender_id = ? AND m.recipient_id = u.id)
                  OR (m.sender_id = u.id AND m.recipient_id = ?)
               ORDER BY m.id DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM direct_messages m
               WHERE (m.sender_id = ? AND m.recipient_id = u.id)
                  OR (m.sender_id = u.id AND m.recipient_id = ?)
               ORDER BY m.id DESC LIMIT 1) AS last_message_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_low_id = ? THEN f.user_high_id ELSE f.user_low_id END
       WHERE f.status = 'accepted' AND (f.user_low_id = ? OR f.user_high_id = ?)
       ORDER BY COALESCE(last_message_at, f.responded_at, f.created_at) DESC`,
    ).bind(user.id, user.id, user.id, user.id, user.id, user.id, user.id, user.id),
    context.env.DB.prepare(
      `SELECT ${USER_COLUMNS}, f.id AS friendship_id, f.requested_by_id, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_low_id = ? THEN f.user_high_id ELSE f.user_low_id END
       WHERE f.status = 'pending' AND (f.user_low_id = ? OR f.user_high_id = ?)
       ORDER BY f.created_at DESC`,
    ).bind(user.id, user.id, user.id),
  ]);

  const friends = (friendsResult.results || []).map((record) => serializeFriend(record, {
    friendshipId: record.friendship_id,
    unreadCount: Number(record.unread_count) || 0,
    lastMessage: record.last_message || '',
    lastMessageAt: record.last_message_at || '',
  }));
  const incoming = [];
  const outgoing = [];
  (requestsResult.results || []).forEach((record) => {
    const request = serializeFriend(record, {
      friendshipId: record.friendship_id,
      createdAt: record.created_at,
    });
    if (Number(record.requested_by_id) === Number(user.id)) outgoing.push(request);
    else incoming.push(request);
  });

  return json({ ok: true, friends, incoming, outgoing });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
}
