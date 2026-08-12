import {
  createSessionCookie,
  json,
  normalizeUsername,
  verifyPassword,
} from '../_lib/auth.js';

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }

  const username = normalizeUsername(input.username);
  const password = String(input.password || '');
  const user = await context.env.DB.prepare(
    'SELECT username, password_hash, password_salt FROM users WHERE username = ? LIMIT 1',
  ).bind(username).first();

  if (!user || !await verifyPassword(password, user.password_hash, user.password_salt)) {
    return json({ error: '账号或密码不正确。' }, 401);
  }

  const cookie = await createSessionCookie(user.username, context.env.SESSION_SECRET);
  return json({ ok: true, username: user.username }, 200, { 'Set-Cookie': cookie });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
