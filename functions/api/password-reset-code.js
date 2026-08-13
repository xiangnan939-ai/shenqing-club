import {
  EMAIL_VERIFICATION_LIMITS,
  checkEmailSendLimits,
  emailServiceError,
  generateVerificationCode,
  hashRequestIp,
  hashVerificationCode,
  isValidEmail,
  normalizeEmail,
  sendVerificationEmail,
  verificationWindow,
} from '../_lib/email.js';
import { isValidUsername, json, normalizeUsername } from '../_lib/auth.js';

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }

  const username = normalizeUsername(input.username);
  const email = normalizeEmail(input.email);
  if (!isValidUsername(username)) {
    return json({ error: '请输入有效的账号。' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: '请输入有效的邮箱地址。' }, 400);
  }
  if (!context.env.EMAIL_CODE_SECRET) {
    return json({ error: '邮箱验证服务尚未配置。' }, 503);
  }

  try {
    const user = await context.env.DB.prepare(
      'SELECT id FROM users WHERE username = ? AND email = ? LIMIT 1',
    ).bind(username, email).first();
    if (!user) {
      return json({ error: '账号与邮箱不匹配。', resetTurnstile: true }, 404);
    }

    const ipHash = await hashRequestIp(context.request, context.env.EMAIL_CODE_SECRET);
    const limit = await checkEmailSendLimits(context.env.DB, email, ipHash, 'password-reset');
    if (!limit.allowed) {
      return json({
        error: limit.waitSeconds < 3600
          ? `请 ${limit.waitSeconds} 秒后再发送。`
          : '发送过于频繁，请一小时后再试。',
        retryAfter: limit.waitSeconds,
        resetTurnstile: true,
      }, 429);
    }

    const code = generateVerificationCode();
    const salt = crypto.randomUUID();
    const codeHash = await hashVerificationCode(code, salt, context.env.EMAIL_CODE_SECRET);
    const id = crypto.randomUUID();
    const now = new Date();
    const { expiresAt } = verificationWindow(now);

    await context.env.DB.prepare(
      `INSERT INTO email_verification_requests
       (id, email, purpose, code_hash, code_salt, request_ip_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, email, 'password-reset', codeHash, salt, ipHash, expiresAt, now.toISOString()).run();

    try {
      await sendVerificationEmail({
        apiKey: context.env.RESEND_API_KEY,
        from: context.env.EMAIL_FROM,
        email,
        code,
        purpose: 'password-reset',
      });
    } catch (error) {
      await context.env.DB.prepare('DELETE FROM email_verification_requests WHERE id = ?').bind(id).run();
      return emailServiceError(error);
    }

    return json({
      ok: true,
      expiresIn: EMAIL_VERIFICATION_LIMITS.codeTtlMinutes * 60,
      retryAfter: EMAIL_VERIFICATION_LIMITS.resendSeconds,
    });
  } catch (error) {
    if (String(error).includes('no such column') || String(error).includes('no such table')) {
      return json({ error: '邮箱验证数据库尚未就绪。' }, 503);
    }
    return json({ error: '密码找回服务暂时不可用。' }, 503);
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
}
