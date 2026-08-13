import { isValidUsername, json, normalizeUsername } from '../_lib/auth.js';
import { serializeFriend, friendshipPair } from '../_lib/friends.js';
import { requireUser } from '../_lib/user.js';

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  const username = normalizeUsername(new URL(context.request.url).searchParams.get('q'));
  if (!isValidUsername(username)) {
    return json({ error: '请输入完整账号进行查找。' }, 400);
  }
  if (username === user.username) {
    return json({ error: '这是你自己的账号。' }, 400);
  }

  const target = await context.env.DB.prepare(
    `SELECT id, username, nickname, signature, avatar_image, last_seen_at
     FROM users WHERE username = ? LIMIT 1`,
  ).bind(username).first();
  if (!target) return json({ ok: true, user: null });

  const [lowId, highId] = friendshipPair(user.id, target.id);
  const relationship = await context.env.DB.prepare(
    `SELECT status, requested_by_id FROM friendships
     WHERE user_low_id = ? AND user_high_id = ? LIMIT 1`,
  ).bind(lowId, highId).first();

  let relationshipStatus = 'none';
  if (relationship?.status === 'accepted') relationshipStatus = 'accepted';
  else if (Number(relationship?.requested_by_id) === Number(user.id)) relationshipStatus = 'outgoing';
  else if (relationship) relationshipStatus = 'incoming';

  return json({ ok: true, user: serializeFriend(target, { relationshipStatus }) });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET' });
}
