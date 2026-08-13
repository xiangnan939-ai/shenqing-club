import { json, verifyPassword } from '../_lib/auth.js';
import { isValidEmail, normalizeEmail } from '../_lib/email.js';
import { requireUser, serializeUser } from '../_lib/user.js';

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
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) return json({ error: '请输入有效的邮箱地址。' }, 400);

  const record = await context.env.DB.prepare(
    'SELECT password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
  ).bind(user.username).first();
  if (!record || !await verifyPassword(currentPassword, record.password_hash, record.password_salt)) {
    return json({ error: '当前密码不正确。' }, 401);
  }

  const existing = await context.env.DB.prepare(
    'SELECT username FROM users WHERE email = ? AND username <> ? LIMIT 1',
  ).bind(email, user.username).first();
  if (existing) return json({ error: '这个邮箱已经绑定其他账号。' }, 409);

  await context.env.DB.prepare(
    'UPDATE users SET email = ?, email_verified_at = CURRENT_TIMESTAMP WHERE username = ?',
  ).bind(email, user.username).run();

  return json({ ok: true, profile: serializeUser({ ...user, email }) });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
