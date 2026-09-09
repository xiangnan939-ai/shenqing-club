import { json } from '../_lib/auth.js';
import { futureIso, GAME_LIMITS, isRoomId } from '../_lib/game-online.js';
import { requireUser } from '../_lib/user.js';

async function joinedMember(db, roomId, userId) {
  return db.prepare(
    `SELECT m.user_id FROM game_room_members m
     JOIN game_rooms r ON r.id = m.room_id
     WHERE m.room_id = ? AND m.user_id = ? AND m.status = 'joined'
       AND r.status IN ('waiting', 'racing')
       AND datetime(r.expires_at) > CURRENT_TIMESTAMP LIMIT 1`,
  ).bind(roomId, userId).first();
}

async function roomMembership(db, roomId, userId) {
  return db.prepare(
    `SELECT m.status AS member_status, r.status AS room_status, r.expires_at
     FROM game_room_members m JOIN game_rooms r ON r.id = m.room_id
     WHERE m.room_id = ? AND m.user_id = ? LIMIT 1`,
  ).bind(roomId, userId).first();
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  const url = new URL(context.request.url);
  const roomId = String(url.searchParams.get('roomId') || '');
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  if (!isRoomId(roomId)) {
    return json({ error: '无法读取这个房间的联机信息。' }, 403);
  }
  const member = await roomMembership(context.env.DB, roomId, user.id);
  if (!member || member.member_status !== 'joined') {
    return json({ error: '无法读取这个房间的联机信息。' }, 403);
  }
  if (member.room_status === 'closed' || new Date(member.expires_at).getTime() <= Date.now()) {
    return json({ ok: true, closed: true, signals: [] });
  }
  await context.env.DB.prepare(
    "DELETE FROM game_signals WHERE datetime(expires_at) <= CURRENT_TIMESTAMP",
  ).run();
  const result = await context.env.DB.prepare(
    `SELECT id, sender_id, kind, payload FROM game_signals
     WHERE room_id = ? AND recipient_id = ? AND id > ?
     ORDER BY id ASC LIMIT 100`,
  ).bind(roomId, user.id, after).all();
  const signals = (result.results || []).map((signal) => {
    let payload = null;
    try { payload = JSON.parse(signal.payload); } catch {}
    return {
      id: Number(signal.id),
      senderId: Number(signal.sender_id),
      kind: signal.kind,
      payload,
    };
  }).filter((signal) => signal.payload !== null);
  return json({ ok: true, signals });
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }
  const roomId = String(input.roomId || '');
  const recipientId = Number(input.recipientId);
  const kind = String(input.kind || '');
  if (!isRoomId(roomId) || !Number.isSafeInteger(recipientId) || recipientId <= 0
    || recipientId === Number(user.id) || !['offer', 'answer', 'ice'].includes(kind)) {
    return json({ error: '联机信息不正确。' }, 400);
  }
  if (!await joinedMember(context.env.DB, roomId, user.id)
    || !await joinedMember(context.env.DB, roomId, recipientId)) {
    return json({ error: '双方不在同一房间。' }, 403);
  }
  const payload = JSON.stringify(input.payload ?? null);
  if (payload.length > GAME_LIMITS.maxSignalBytes) {
    return json({ error: '联机信息过大。' }, 413);
  }
  const recent = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM game_signals
     WHERE sender_id = ? AND created_at >= datetime('now', '-1 minute')`,
  ).bind(user.id).first();
  if (Number(recent?.count) >= GAME_LIMITS.maxSignalsPerMinute) {
    return json({ error: '联机请求过于频繁。' }, 429);
  }
  const insert = await context.env.DB.prepare(
    `INSERT INTO game_signals
     (room_id, sender_id, recipient_id, kind, payload, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(roomId, user.id, recipientId, kind, payload, futureIso(GAME_LIMITS.signalTtlMs)).run();
  return json({ ok: true, signalId: Number(insert.meta?.last_row_id) }, 201);
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
}
