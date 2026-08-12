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

  const verification = await verifyTurnstile(
    turnstileToken,
    context.request,
    context.env.TURNSTILE_SECRET_KEY,
  );
  if (!verification.success) {
    const configurationError = verification.errorCodes.some((code) => [
      'invalid-input-secret',
      'missing-input-secret',
      'siteverify-unavailable',
    ].includes(code));
    return json({
      error: configurationError
        ? '注册验证服务暂时不可用，请稍后重试。'
        : '人机验证失败，请重新验证。',
      resetTurnstile: true,
    }, configurationError ? 503 : 400);
  }

  let existing;
  try {
    existing = await context.env.DB.prepare(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
    ).bind(username).first();
  } catch {
    return json({ error: '账号数据库暂时不可用，请稍后重试。' }, 503);
  }
  if (existing) {
    return json({ error: '这个账号已经存在。', resetTurnstile: true }, 409);
  }

  let passwordData;
  try {
    passwordData = await hashPassword(password);
  } catch {
    return json({ error: '密码安全处理失败，请稍后重试。' }, 503);
  }
  try {
    await context.env.DB.prepare(
      'INSERT INTO users (username, password_hash, password_salt) VALUES (?, ?, ?)',
    ).bind(username, passwordData.hash, passwordData.salt).run();
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return json({ error: '这个账号已经存在。', resetTurnstile: true }, 409);
    }
    return json({ error: '账号保存失败，请稍后重试。' }, 503);
  }

  let cookie;
  try {
    cookie = await createSessionCookie(username, context.env.SESSION_SECRET);
  } catch {
    return json({ error: '账号已创建，请返回登录页登录。' }, 503);
  }
  return json({ ok: true, username }, 201, { 'Set-Cookie': cookie });
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
