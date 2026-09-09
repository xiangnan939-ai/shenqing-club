import { json } from '../_lib/auth.js';
import { acceptedFriendship } from '../_lib/friends.js';
import {
  futureIso,
  GAME_LIMITS,
  isRoomId,
  parseGameIndex,
  serializeGameRoom,
} from '../_lib/game-online.js';
import { requireUser } from '../_lib/user.js';

async function cleanup(db) {
  await db.batch([
    db.prepare("DELETE FROM game_signals WHERE datetime(expires_at) <= CURRENT_TIMESTAMP"),
    db.prepare(
      `UPDATE game_rooms SET status = 'closed', updated_at = CURRENT_TIMESTAMP
       WHERE status <> 'closed' AND datetime(expires_at) <= CURRENT_TIMESTAMP`,
    ),
  ]);
}

async function roomRecord(db, roomId) {
  return db.prepare(
    `SELECT * FROM game_rooms
     WHERE id = ? AND status <> 'closed' AND datetime(expires_at) > CURRENT_TIMESTAMP
     LIMIT 1`,
  ).bind(roomId).first();
}

async function membership(db, roomId, userId) {
  return db.prepare(
    'SELECT * FROM game_room_members WHERE room_id = ? AND user_id = ? LIMIT 1',
  ).bind(roomId, userId).first();
}

async function loadRoom(db, roomId, currentUserId) {
  const room = await roomRecord(db, roomId);
  if (!room) return null;
  const ownMembership = await membership(db, roomId, currentUserId);
  if (!ownMembership || !['invited', 'joined'].includes(ownMembership.status)) return null;
  const result = await db.prepare(
    `SELECT m.*, u.username, u.nickname
     FROM game_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = ? AND m.status IN ('invited', 'joined')
     ORDER BY CASE m.role WHEN 'host' THEN 0 ELSE 1 END, m.joined_at, m.invited_at`,
  ).bind(roomId).all();
  return serializeGameRoom(room, result.results || [], currentUserId);
}

function parseUserId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

async function createRoom(context, user, input) {
  const roomId = crypto.randomUUID();
  const trackIndex = parseGameIndex(input.trackIndex) ?? 0;
  const carIndex = parseGameIndex(input.carIndex) ?? 0;
  const expiresAt = futureIso(GAME_LIMITS.roomTtlMs);
  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE game_rooms SET status = 'closed', updated_at = CURRENT_TIMESTAMP
       WHERE host_user_id = ? AND status <> 'closed'`,
    ).bind(user.id),
    context.env.DB.prepare(
      `INSERT INTO game_rooms (id, host_user_id, track_index, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).bind(roomId, user.id, trackIndex, expiresAt),
    context.env.DB.prepare(
      `INSERT INTO game_room_members
       (room_id, user_id, role, status, ready, car_index, joined_at, last_seen_at)
       VALUES (?, ?, 'host', 'joined', 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    ).bind(roomId, user.id, carIndex),
  ]);
  return json({ ok: true, room: await loadRoom(context.env.DB, roomId, user.id) }, 201);
}

async function inviteFriend(context, user, input) {
  const roomId = String(input.roomId || '');
  const friendId = parseUserId(input.friendId);
  if (!isRoomId(roomId) || !friendId || friendId === Number(user.id)) {
    return json({ error: '邀请信息不正确。' }, 400);
  }
  const room = await roomRecord(context.env.DB, roomId);
  if (!room || Number(room.host_user_id) !== Number(user.id) || room.status !== 'waiting') {
    return json({ error: '只有房主可以在等待期间邀请好友。' }, 403);
  }
  if (!await acceptedFriendship(context.env.DB, user.id, friendId)) {
    return json({ error: '只能邀请已添加的好友。' }, 403);
  }
  const count = await context.env.DB.prepare(
    `SELECT COUNT(*) AS count FROM game_room_members
     WHERE room_id = ? AND status IN ('invited', 'joined')`,
  ).bind(roomId).first();
  if (Number(count?.count) >= GAME_LIMITS.maxPlayers) {
    return json({ error: '房间已满。' }, 409);
  }
  await context.env.DB.batch([
    context.env.DB.prepare(
      `INSERT INTO game_room_members (room_id, user_id, role, status, ready, car_index)
       VALUES (?, ?, 'guest', 'invited', 0, 0)
       ON CONFLICT(room_id, user_id) DO UPDATE SET
         status = 'invited', ready = 0, invited_at = CURRENT_TIMESTAMP,
         joined_at = NULL, last_seen_at = NULL`,
    ).bind(roomId, friendId),
    context.env.DB.prepare(
      `INSERT INTO direct_messages
       (sender_id, recipient_id, body, message_type, game_room_id)
       SELECT ?, ?, '邀请你加入《蛋蛋飞车》联机竞速', 'game_invite', ?
       WHERE NOT EXISTS (
         SELECT 1 FROM direct_messages
         WHERE sender_id = ? AND recipient_id = ?
           AND message_type = 'game_invite' AND game_room_id = ?
       )`,
    ).bind(user.id, friendId, roomId, user.id, friendId, roomId),
  ]);
  return json({ ok: true, room: await loadRoom(context.env.DB, roomId, user.id) });
}

async function respondToInvite(context, user, input) {
  const roomId = String(input.roomId || '');
  const accept = input.accept === true;
  if (!isRoomId(roomId)) return json({ error: '房间不存在。' }, 404);
  const room = await roomRecord(context.env.DB, roomId);
  const member = await membership(context.env.DB, roomId, user.id);
  if (!room || room.status !== 'waiting' || member?.status !== 'invited') {
    return json({ error: '邀请已失效。' }, 409);
  }
  if (!accept) {
    await context.env.DB.prepare(
      "UPDATE game_room_members SET status = 'declined', ready = 0 WHERE room_id = ? AND user_id = ?",
    ).bind(roomId, user.id).run();
    return json({ ok: true, declined: true });
  }
  const carIndex = parseGameIndex(input.carIndex) ?? 0;
  await context.env.DB.prepare(
    `UPDATE game_room_members SET status = 'joined', ready = 0, car_index = ?,
       joined_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
     WHERE room_id = ? AND user_id = ?`,
  ).bind(carIndex, roomId, user.id).run();
  return json({ ok: true, room: await loadRoom(context.env.DB, roomId, user.id) });
}

async function updateRoom(context, user, input) {
  const roomId = String(input.roomId || '');
  if (!isRoomId(roomId)) return json({ error: '房间不存在。' }, 404);
  const room = await roomRecord(context.env.DB, roomId);
  const member = await membership(context.env.DB, roomId, user.id);
  if (!room || member?.status !== 'joined') return json({ error: '你不在这个房间中。' }, 403);
  if (room.status !== 'waiting') return json({ error: '比赛开始后不能修改房间。' }, 409);
  const isHost = Number(room.host_user_id) === Number(user.id);
  if ((input.aiCount !== undefined || input.trackIndex !== undefined) && !isHost) {
    return json({ error: '只有房主可以修改比赛设置。' }, 403);
  }
  const aiCount = input.aiCount === undefined ? null : parseGameIndex(input.aiCount, 5);
  const trackIndex = input.trackIndex === undefined ? null : parseGameIndex(input.trackIndex);
  if (input.aiCount !== undefined && aiCount === null) return json({ error: '电脑玩家数量不正确。' }, 400);
  if (input.trackIndex !== undefined && trackIndex === null) return json({ error: '地图选择不正确。' }, 400);
  const carIndex = input.carIndex === undefined ? null : parseGameIndex(input.carIndex);
  if (input.carIndex !== undefined && carIndex === null) {
    return json({ error: '车辆选择不正确。' }, 400);
  }
  const ready = input.ready === undefined ? null : input.ready === true ? 1 : 0;
  await context.env.DB.prepare(
    `UPDATE game_room_members SET
       ready = COALESCE(?, ready), car_index = COALESCE(?, car_index),
       last_seen_at = CURRENT_TIMESTAMP
     WHERE room_id = ? AND user_id = ?`,
  ).bind(ready, carIndex, roomId, user.id).run();
  if (isHost && (trackIndex !== null || aiCount !== null)) {
    await context.env.DB.prepare(
      `UPDATE game_rooms SET track_index = COALESCE(?, track_index), ai_count = COALESCE(?, ai_count), updated_at = CURRENT_TIMESTAMP,
       expires_at = ? WHERE id = ? AND status = 'waiting'`,
    ).bind(trackIndex, aiCount, futureIso(GAME_LIMITS.roomTtlMs), roomId).run();
  }
  return json({ ok: true, room: await loadRoom(context.env.DB, roomId, user.id) });
}

async function startRoom(context, user, input) {
  const roomId = String(input.roomId || '');
  const room = isRoomId(roomId) ? await roomRecord(context.env.DB, roomId) : null;
  if (!room || Number(room.host_user_id) !== Number(user.id) || room.status !== 'waiting') {
    return json({ error: '只有房主可以开始比赛。' }, 403);
  }
  const members = await context.env.DB.prepare(
    "SELECT ready FROM game_room_members WHERE room_id = ? AND status = 'joined'",
  ).bind(roomId).all();
  const joined = members.results || [];
  if (joined.length < 2) return json({ error: '至少需要两名真人玩家。' }, 409);
  if (joined.some((member) => !Number(member.ready))) {
    return json({ error: '还有玩家未准备。' }, 409);
  }
  await context.env.DB.prepare(
    "UPDATE game_rooms SET status = 'racing', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).bind(roomId).run();
  return json({ ok: true, room: await loadRoom(context.env.DB, roomId, user.id) });
}

async function leaveRoom(context, user, input) {
  const roomId = String(input.roomId || '');
  const room = isRoomId(roomId) ? await roomRecord(context.env.DB, roomId) : null;
  const member = room ? await membership(context.env.DB, roomId, user.id) : null;
  if (!room || !member) return json({ ok: true });
  if (Number(room.host_user_id) === Number(user.id)) {
    await context.env.DB.prepare(
      "UPDATE game_rooms SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    ).bind(roomId).run();
  } else {
    await context.env.DB.prepare(
      "UPDATE game_room_members SET status = 'left', ready = 0 WHERE room_id = ? AND user_id = ?",
    ).bind(roomId, user.id).run();
  }
  return json({ ok: true });
}

async function completeRoom(context, user, input) {
  const roomId = String(input.roomId || '');
  const room = isRoomId(roomId) ? await roomRecord(context.env.DB, roomId) : null;
  if (!room || Number(room.host_user_id) !== Number(user.id)) return json({error: '只有房主可以结束比赛。'},403);
  if (room.status === 'racing') await context.env.DB.batch([
    context.env.DB.prepare("UPDATE game_rooms SET status='waiting', updated_at=CURRENT_TIMESTAMP, expires_at=? WHERE id=? AND status='racing'").bind(futureIso(GAME_LIMITS.roomTtlMs),roomId),
    context.env.DB.prepare("UPDATE game_room_members SET ready=CASE WHEN role='host' THEN 1 ELSE 0 END WHERE room_id=? AND status='joined'").bind(roomId),
  ]);
  return json({ok:true,room:await loadRoom(context.env.DB,roomId,user.id)});
}

export async function onRequestGet(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  await cleanup(context.env.DB);
  const url = new URL(context.request.url);
  const roomId = url.searchParams.get('roomId');
  if (roomId) {
    if (!isRoomId(roomId)) return json({ error: '房间不存在。' }, 404);
    const room = await loadRoom(context.env.DB, roomId, user.id);
    if (!room) {
      const previousMember = await membership(context.env.DB, roomId, user.id);
      if (previousMember) return json({ ok: true, closed: true });
      return json({ error: '房间不存在或邀请已失效。' }, 404);
    }
    if (room.members.some((member) => member.id === Number(user.id) && member.status === 'joined')) {
      await context.env.DB.prepare(
        'UPDATE game_room_members SET last_seen_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?',
      ).bind(roomId, user.id).run();
    }
    return json({ ok: true, userId: Number(user.id), room });
  }
  const result = await context.env.DB.prepare(
    `SELECT r.id, r.track_index, r.expires_at, u.username, u.nickname
     FROM game_room_members m
     JOIN game_rooms r ON r.id = m.room_id
     JOIN users u ON u.id = r.host_user_id
     WHERE m.user_id = ? AND m.status = 'invited' AND r.status = 'waiting'
       AND datetime(r.expires_at) > CURRENT_TIMESTAMP
     ORDER BY m.invited_at DESC LIMIT 10`,
  ).bind(user.id).all();
  return json({
    ok: true,
    userId: Number(user.id),
    invitations: (result.results || []).map((invite) => ({
      roomId: invite.id,
      trackIndex: Number(invite.track_index) || 0,
      hostUsername: invite.username,
      hostNickname: invite.nickname || invite.username,
      expiresAt: invite.expires_at,
    })),
  });
}

export async function onRequestPost(context) {
  const { user, response } = await requireUser(context);
  if (response) return response;
  await cleanup(context.env.DB);
  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: '请求格式不正确。' }, 400);
  }
  switch (input.action) {
    case 'create': return createRoom(context, user, input);
    case 'invite': return inviteFriend(context, user, input);
    case 'respond': return respondToInvite(context, user, input);
    case 'update': return updateRoom(context, user, input);
    case 'start': return startRoom(context, user, input);
    case 'complete': return completeRoom(context, user, input);
    case 'leave': return leaveRoom(context, user, input);
    default: return json({ error: '未知的房间操作。' }, 400);
  }
}

export function onRequest() {
  return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST' });
}
