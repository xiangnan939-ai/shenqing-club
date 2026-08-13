const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export function serializeFriend(user, extra = {}) {
  const lastSeenAt = user.last_seen_at || '';
  const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : 0;
  return {
    id: Number(user.id),
    username: user.username,
    nickname: user.nickname || user.username,
    avatarImage: user.avatar_image || '',
    signature: user.signature || '',
    lastSeenAt,
    online: Boolean(lastSeenTime && Date.now() - lastSeenTime <= ONLINE_WINDOW_MS),
    ...extra,
  };
}

export function friendshipPair(leftId, rightId) {
  const left = Number(leftId);
  const right = Number(rightId);
  return left < right ? [left, right] : [right, left];
}

export async function acceptedFriendship(db, currentUserId, otherUserId) {
  const [lowId, highId] = friendshipPair(currentUserId, otherUserId);
  return db.prepare(
    `SELECT id FROM friendships
     WHERE user_low_id = ? AND user_high_id = ? AND status = 'accepted'
     LIMIT 1`,
  ).bind(lowId, highId).first();
}

export const FRIEND_LIMITS = Object.freeze({
  maxMessageLength: 500,
  maxMessagesPerMinute: 30,
});
