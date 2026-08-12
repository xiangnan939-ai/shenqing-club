const SESSION_COOKIE = 'shenqing_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
// Cloudflare's free Workers tier has a tight per-request CPU budget.
// Web Crypto still provides a salted, deliberately slow password derivation.
const PASSWORD_ITERATIONS = 50000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function derivePassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PASSWORD_ITERATIONS,
    },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  for (const item of cookieHeader.split(';')) {
    const [key, ...parts] = item.trim().split('=');
    if (key === name) return parts.join('=');
  }
  return null;
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function normalizeUsername(value) {
  return String(value || '').normalize('NFKC').trim().toLowerCase();
}

export function isValidUsername(username) {
  return /^[\p{L}\p{N}_-]{2,24}$/u.test(username);
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt);
  return {
    hash: bytesToBase64Url(hash),
    salt: bytesToBase64Url(salt),
  };
}

export async function verifyPassword(password, storedHash, storedSalt) {
  try {
    const expected = base64UrlToBytes(storedHash);
    const actual = await derivePassword(password, base64UrlToBytes(storedSalt));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createSessionCookie(username, secret) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({
    username,
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  })));
  const signature = bytesToBase64Url(await sign(payload, secret));
  return `${SESSION_COOKIE}=${payload}.${signature}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function readSession(request, secret) {
  if (!secret) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  try {
    const expected = await sign(payload, secret);
    if (!constantTimeEqual(expected, base64UrlToBytes(signature))) return null;
    const session = JSON.parse(decoder.decode(base64UrlToBytes(payload)));
    if (!session.username || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function verifyTurnstile(token, request, secret) {
  if (!token || !secret) return { success: false, errorCodes: ['missing-input'] };
  const remoteIp = request.headers.get('CF-Connecting-IP');
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {}),
      }),
    });
    if (!response.ok) return { success: false, errorCodes: ['siteverify-unavailable'] };
    const result = await response.json();
    return {
      success: result.success === true,
      errorCodes: Array.isArray(result['error-codes']) ? result['error-codes'] : [],
    };
  } catch {
    return { success: false, errorCodes: ['siteverify-unavailable'] };
  }
}
