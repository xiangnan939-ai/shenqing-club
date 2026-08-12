import { json } from './auth.js';

const CODE_TTL_MINUTES = 10;
const RESEND_SECONDS = 60;
const MAX_SENDS_PER_EMAIL_HOUR = 5;
const MAX_SENDS_PER_IP_HOUR = 12;
const MAX_VERIFY_ATTEMPTS = 5;

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function sha256(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export function normalizeEmail(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

export function isValidEmail(email) {
  if (email.length < 6 || email.length > 254 || email.includes('..')) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email);
}

export function generateVerificationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const value = new DataView(bytes.buffer).getUint32(0);
  return String(value % 1000000).padStart(6, '0');
}

export async function hashVerificationCode(code, salt, secret) {
  return sha256(`${secret}:${salt}:${code}`);
}

export async function verifyVerificationCode(code, request, secret) {
  const actual = await hashVerificationCode(code, request.code_salt, secret);
  return constantTimeEqual(actual, request.code_hash);
}

export async function hashRequestIp(request, secret) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return sha256(`${secret}:${ip}`);
}

export function verificationWindow(now = new Date()) {
  return {
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000).toISOString(),
    resendAt: new Date(now.getTime() + RESEND_SECONDS * 1000).toISOString(),
  };
}

export async function checkEmailSendLimits(db, email, ipHash, now = new Date()) {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const [latest, emailCount, ipCount] = await db.batch([
    db.prepare(
      'SELECT created_at FROM email_verification_requests WHERE email = ? ORDER BY created_at DESC LIMIT 1',
    ).bind(email),
    db.prepare(
      'SELECT COUNT(*) AS count FROM email_verification_requests WHERE email = ? AND created_at >= ?',
    ).bind(email, oneHourAgo),
    db.prepare(
      'SELECT COUNT(*) AS count FROM email_verification_requests WHERE request_ip_hash = ? AND created_at >= ?',
    ).bind(ipHash, oneHourAgo),
  ]);

  const latestCreatedAt = latest.results?.[0]?.created_at;
  if (latestCreatedAt) {
    const waitSeconds = RESEND_SECONDS - Math.floor((now.getTime() - new Date(latestCreatedAt).getTime()) / 1000);
    if (waitSeconds > 0) return { allowed: false, waitSeconds };
  }
  if (Number(emailCount.results?.[0]?.count || 0) >= MAX_SENDS_PER_EMAIL_HOUR) {
    return { allowed: false, waitSeconds: 3600 };
  }
  if (Number(ipCount.results?.[0]?.count || 0) >= MAX_SENDS_PER_IP_HOUR) {
    return { allowed: false, waitSeconds: 3600 };
  }
  return { allowed: true, waitSeconds: 0 };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export async function sendVerificationEmail({ apiKey, from, email, code }) {
  if (!apiKey || !from) throw new Error('email-not-configured');
  const safeCode = escapeHtml(code);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: '深情俱乐部注册验证码',
      html: `<div style="font-family:system-ui,sans-serif;color:#2d241d;line-height:1.7"><h1 style="font-size:22px">深情俱乐部</h1><p>你的注册验证码是：</p><p style="font-size:32px;font-weight:700;letter-spacing:8px">${safeCode}</p><p>验证码 ${CODE_TTL_MINUTES} 分钟内有效。如非本人操作，请忽略此邮件。</p></div>`,
      text: `你的深情俱乐部注册验证码是 ${code}，${CODE_TTL_MINUTES} 分钟内有效。`,
    }),
  });
  if (!response.ok) {
    throw new Error(`email-send-failed:${response.status}`);
  }
}

export function emailServiceError(error) {
  const unavailable = String(error).includes('email-not-configured');
  return json({
    error: unavailable ? '邮箱验证服务尚未配置。' : '验证邮件发送失败，请稍后重试。',
    resetTurnstile: true,
  }, 503);
}

export const EMAIL_VERIFICATION_LIMITS = Object.freeze({
  codeTtlMinutes: CODE_TTL_MINUTES,
  resendSeconds: RESEND_SECONDS,
  maxVerifyAttempts: MAX_VERIFY_ATTEMPTS,
});
