import { json, readSession } from './auth.js';

const ACTIVITY_CAP_SECONDS = 5 * 60;
const LEVEL_THRESHOLDS = [
  0,
  30 * 60,
  2 * 60 * 60,
  6 * 60 * 60,
  24 * 60 * 60,
  3 * 24 * 60 * 60,
  7 * 24 * 60 * 60,
  15 * 24 * 60 * 60,
  30 * 24 * 60 * 60,
  60 * 24 * 60 * 60,
];

function cleanProfileText(value, maxLength) {
  return String(value || '').normalize('NFKC').trim().slice(0, maxLength);
}

export function normalizeNickname(value) {
  return cleanProfileText(value, 24);
}

export function normalizeSignature(value) {
  return cleanProfileText(value, 80);
}

export function normalizeAvatarText(value) {
  const [first = ''] = Array.from(cleanProfileText(value, 4));
  return first;
}

export function memberLevel(activeSeconds = 0) {
  const seconds = Math.max(0, Number(activeSeconds) || 0);
  let level = 1;
  for (let index = 1; index < LEVEL_THRESHOLDS.length; index += 1) {
    if (seconds >= LEVEL_THRESHOLDS[index]) level = index + 1;
  }
  return level;
}

export function serializeUser(user) {
  const nickname = user.nickname || user.username;
  const avatarText = user.avatar_text || Array.from(nickname)[0] || '深';
  const activeSeconds = Math.max(0, Number(user.active_seconds) || 0);
  return {
    id: user.id,
    username: user.username,
    email: user.email || '',
    nickname,
    signature: user.signature || '这个人很深情，还没留下签名。',
    avatarText,
    memberTitle: `中国第${user.id}深情`,
    memberLevel: `V${memberLevel(activeSeconds)}`,
    activeSeconds,
    activeMinutes: Math.floor(activeSeconds / 60),
    createdAt: user.created_at,
  };
}

export async function requireUser(context) {
  const session = await readSession(context.request, context.env.SESSION_SECRET);
  if (!session) return { response: json({ authenticated: false }, 401) };

  const user = await context.env.DB.prepare(
    `SELECT id, username, email, nickname, signature, avatar_text,
            active_seconds, last_seen_at, created_at
     FROM users
     WHERE username = ? LIMIT 1`,
  ).bind(session.username).first();
  if (!user) return { response: json({ authenticated: false }, 401) };
  return { user };
}

export async function recordActivity(db, user) {
  const now = new Date();
  const nowIso = now.toISOString();
  const previous = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
  const elapsedSeconds = previous ? Math.floor((now.getTime() - previous) / 1000) : 0;
  const addSeconds = elapsedSeconds > 0 ? Math.min(elapsedSeconds, ACTIVITY_CAP_SECONDS) : 0;

  if (addSeconds > 0) {
    await db.prepare(
      `UPDATE users
       SET active_seconds = active_seconds + ?, last_seen_at = ?
       WHERE username = ?`,
    ).bind(addSeconds, nowIso, user.username).run();
    user.active_seconds = Number(user.active_seconds || 0) + addSeconds;
  } else {
    await db.prepare('UPDATE users SET last_seen_at = ? WHERE username = ?')
      .bind(nowIso, user.username)
      .run();
  }
  user.last_seen_at = nowIso;
  return user;
}
