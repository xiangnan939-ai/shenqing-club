import {
  createSessionCookie,
  hashPassword,
  isValidUsername,
  json,
  normalizeUsername,
  verifyTurnstile,
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
  const turnstileToken = String(input.turnstileToken || '');

  if (!isValidUsername(username)) {
    return json({ error: '账号需为 2 到 24 位中文、字母、数字、下划线或短横线。' }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: '密码需为 8 到 128 位字符。' }, 400);
  }

  const human = await verifyTurnstile(turnstileToken, context.request, context.env.TURNSTILE_SECRET_KEY);
  if (!human) {
    return json({ error: '人机验证失败，请重新验证。', resetTurnstile: true }, 400);
  }

  const existing = await context.env.DB.prepare(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
  ).bind(username).first();
  if (existing) {
    return json({ error: '这个账号已经存在。', resetTurnstile: true }, 409);
  }

  const passwordData = await hashPassword(password);
  try {
    await context.env.DB.prepare(
      'INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)',
    ).bind(username, passwordData.hash, passwordData.salt).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return json({ error: '这个账号已经存在。', resetTurnstile: true }, 409);
    }
    throw error;
  }

  const cookie = await createSessionCookie(username, context.env.SESSION_SECRET);
  return json({ ok: true, username }, 201, { 'Set-Cookie': cookie });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
