import { clearSessionCookie, json, verifyPassword } from '../_lib/auth.js';
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

  const password = String(input.password || '');
  const confirmText = String(input.confirmText || '').normalize('NFKC').trim();
  if (confirmText !== '注销账号') {
    return json({ error: '请填写“注销账号”确认。' }, 400);
  }

  const record = await context.env.DB.prepare(
    'SELECT password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
  ).bind(user.username).first();
  if (!record || !await verifyPassword(password, record.password_hash, record.password_salt)) {
    return json({ error: '当前密码不正确。' }, 401);
  }

  await context.env.DB.batch([
    context.env.DB.prepare(
      'DELETE FROM direct_messages WHERE sender_id = ? OR recipient_id = ?',
    ).bind(user.id, user.id),
    context.env.DB.prepare(
      'DELETE FROM friendships WHERE user_low_id = ? OR user_high_id = ?',
    ).bind(user.id, user.id),
    context.env.DB.prepare('DELETE FROM users WHERE username = ?').bind(user.username),
  ]);
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
