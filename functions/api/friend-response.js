import { json } from '../_lib/auth.js';
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
  const friendshipId = String(input.friendshipId || '').trim();
  const action = String(input.action || '');
  if (!friendshipId || !['accept', 'decline'].includes(action)) {
    return json({ error: '好友申请操作无效。' }, 400);
  }

  const request = await context.env.DB.prepare(
    `SELECT id, requested_by_id FROM friendships
     WHERE id = ? AND status = 'pending'
       AND (user_low_id = ? OR user_high_id = ?)
     LIMIT 1`,
  ).bind(friendshipId, user.id, user.id).first();
  if (!request) return json({ error: '好友申请不存在或已经处理。' }, 404);
  if (Number(request.requested_by_id) === Number(user.id)) {
    return json({ error: '不能处理自己发送的申请。' }, 403);
  }

  if (action === 'accept') {
    await context.env.DB.prepare(
      `UPDATE friendships SET status = 'accepted', responded_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(friendshipId).run();
  } else {
    await context.env.DB.prepare('DELETE FROM friendships WHERE id = ?').bind(friendshipId).run();
  }
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
