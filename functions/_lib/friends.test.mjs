import assert from 'node:assert/strict';
import test from 'node:test';

import { friendshipPair, serializeFriend } from './friends.js';

test('friendship pair always stores the lower user id first', () => {
  assert.deepEqual(friendshipPair(9, 3), [3, 9]);
  assert.deepEqual(friendshipPair(2, 7), [2, 7]);
});

test('friend serialization exposes public profile fields and unread metadata', () => {
  const friend = serializeFriend({
    id: 7,
    username: 'river',
    nickname: '晚风',
    avatar_image: 'data:image/png;base64,AA==',
    signature: '今晚月色很好',
    last_seen_at: new Date().toISOString(),
  }, { unreadCount: 2 });

  assert.equal(friend.id, 7);
  assert.equal(friend.nickname, '晚风');
  assert.equal(friend.unreadCount, 2);
  assert.equal(friend.online, true);
  assert.equal('email' in friend, false);
});
