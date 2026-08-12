import {
  createSessionCookie,
  hashPassword,
  isValidUsername,
  json,
  normalizeUsername,
} from '../_lib/auth.js';
import {
  EMAIL_VERIFICATION_LIMITS,
  isValidEmail,
  normalizeEmail,
  verifyVerificationCode,
} from '../_lib/email.js';

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }

  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  const password = String(input.password || '');
  const emailCode = String(input.emailCode || '').trim();

  if (!isValidUsername(username)) {
    return json({ error: '账号需为 2 到 24 位中文、字母、数字、下划线或短横线。' }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: '密码需为 8 到 128 位字符。' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: '请输入有效的邮箱地址。' }, 400);
  }
  if (!/^\d{6}$/u.test(emailCode)) {
    return json({ error: '请输入 6 位邮箱验证码。' }, 400);
  }
  if (!context.env.EMAIL_CODE_SECRET) {
    return json({ error: '邮箱验证服务尚未配置。' }, 503);
  }

  let existing;
  try {
    existing = await context.env.DB.prepare(
      'SELECT username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
    ).bind(username, email).first();
  } catch {
    return json({ error: '账号数据库暂时不可用，请稍后重试。' }, 503);
  }
  if (existing) {
    return json({
      error: existing.email?.toLowerCase() === email ? '这个邮箱已经绑定账号。' : '这个账号已经存在。',
      resetTurnstile: true,
    }, 409);
  }

  let emailRequest;
  try {
    emailRequest = await context.env.DB.prepare(
      `SELECT id, code_hash, code_salt, attempts, expires_at
       FROM email_verification_requests
       WHERE email = ? AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
    ).bind(email).first();
  } catch {
    return json({ error: '邮箱验证数据库暂时不可用。' }, 503);
  }
  if (!emailRequest || new Date(emailRequest.expires_at).getTime() <= Date.now()) {
    return json({ error: '邮箱验证码已过期，请重新发送。' }, 400);
  }
  if (emailRequest.attempts >= EMAIL_VERIFICATION_LIMITS.maxVerifyAttempts) {
    return json({ error: '验证码错误次数过多，请重新发送。' }, 400);
  }
  const codeMatches = await verifyVerificationCode(emailCode, emailRequest, context.env.EMAIL_CODE_SECRET);
  if (!codeMatches) {
    await context.env.DB.prepare(
      'UPDATE email_verification_requests SET attempts = attempts + 1 WHERE id = ?',
    ).bind(emailRequest.id).run();
    return json({ error: '邮箱验证码不正确。' }, 400);
  }

  let passwordData;
  try {
    passwordData = await hashPassword(password);
  } catch {
    return json({ error: '密码安全处理失败，请稍后重试。' }, 503);
  }
  try {
    const statements = await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO users
         (username, email, email_verified_at, password_hash, password_salt)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
      ).bind(username, email, passwordData.hash, passwordData.salt),
      context.env.DB.prepare(
        'UPDATE email_verification_requests SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ).bind(emailRequest.id),
    ]);
    if (!statements.every((statement) => statement.success)) throw new Error('batch-failed');
  } catch (error) {
    if (String(error).includes('UNIQUE')) {
      return json({ error: '这个账号或邮箱已经存在。', resetTurnstile: true }, 409);
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
