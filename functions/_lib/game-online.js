export const GAME_LIMITS = Object.freeze({
  maxPlayers: 6,
  maxSignalBytes: 100000,
  maxSignalsPerMinute: 360,
  roomTtlMs: 2 * 60 * 60 * 1000,
  signalTtlMs: 5 * 60 * 1000,
});

export function parseGameIndex(value, max = 4) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= max ? number : null;
}

export function isRoomId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
    .test(String(value || ''));
}

export function futureIso(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

export function serializeGameRoom(room, members, currentUserId) {
  const userId = Number(currentUserId);
  return {
    id: room.id,
    status: room.status,
    trackIndex: Number(room.track_index) || 0,
    maxPlayers: Number(room.max_players) || GAME_LIMITS.maxPlayers,
    aiCount: Math.max(0, Math.min(Number(room.ai_count ?? 5), GAME_LIMITS.maxPlayers - members.filter(member => ['joined','invited'].includes(member.status)).length)),
    hostId: Number(room.host_user_id),
    isHost: Number(room.host_user_id) === userId,
    expiresAt: room.expires_at,
    members: members.map((member) => ({
      id: Number(member.user_id),
      username: member.username,
      nickname: member.nickname || member.username,
      role: member.role,
      status: member.status,
      ready: Boolean(member.ready),
      carIndex: Number(member.car_index) || 0,
      online: Boolean(member.last_seen_at
        && Date.now() - new Date(member.last_seen_at).getTime() <= 15000),
    })),
  };
}
