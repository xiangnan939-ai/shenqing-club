import { isValidUsername, json, normalizeUsername } from '../_lib/auth.js';
import { friendshipPair } from '../_lib/friends.js';
import { requireUser } from '../_lib/user.js';

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;

  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }
  const username = normalizeUsername(input.username);
  if (!isValidUsername(username)) return json({ error: '账号格式不正确。' }, 400);
  if (username === user.username) return json({ error: '不能添加自己为好友。' }, 400);

  const target = await context.env.DB.prepare(
    'SELECT id, username FROM users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (!target) return json({ error: '没有找到这个账号。' }, 404);

  const [lowId, highId] = friendshipPair(user.id, target.id);
  const existing = await context.env.DB.prepare(
    `SELECT status, requested_by_id FROM friendships
     WHERE user_low_id = ? AND user_high_id = ? LIMIT 1`,
  ).bind(lowId, highId).first();
  if (existing?.status === 'accepted') return json({ error: '你们已经是好友。' }, 409);
  if (existing) {
    const error = Number(existing.requested_by_id) === Number(user.id)
      ? '好友申请已经发送。'
      : '对方已经向你发送申请，请到好友申请中处理。';
    return json({ error }, 409);
  }

  await context.env.DB.prepare(
    `INSERT INTO friendships
     (id, user_low_id, user_high_id, requested_by_id, status)
     VALUES (?, ?, ?, ?, 'pending')`,
  ).bind(crypto.randomUUID(), lowId, highId, user.id).run();
  return json({ ok: true }, 201);
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
