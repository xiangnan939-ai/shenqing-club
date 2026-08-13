import { hashPassword, json, verifyPassword } from '../_lib/auth.js';
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

  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  if (newPassword.length < 8 || newPassword.length > 128) {
    return json({ error: '新密码需为 8 到 128 位字符。' }, 400);
  }

  const record = await context.env.DB.prepare(
    'SELECT password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
  ).bind(user.username).first();
  if (!record || !await verifyPassword(currentPassword, record.password_hash, record.password_salt)) {
    return json({ error: '当前密码不正确。' }, 401);
  }

  const passwordData = await hashPassword(newPassword);
  await context.env.DB.prepare(
    'UPDATE users SET password_hash = ?, password_salt = ? WHERE username = ?',
  ).bind(passwordData.hash, passwordData.salt, user.username).run();

  return json({ ok: true });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
