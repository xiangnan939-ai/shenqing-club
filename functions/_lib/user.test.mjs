import test from 'node:test';
import assert from 'node:assert/strict';

import { memberLevel, serializeUser, validateAvatarImage } from './user.js';

test('member level starts at V1 and increases with active time', () => {
  assert.equal(memberLevel(0), 1);
  assert.equal(memberLevel(30 * 60 - 1), 1);
  assert.equal(memberLevel(30 * 60), 2);
  assert.equal(memberLevel(2 * 60 * 60), 3);
});

test('serialized user exposes profile defaults', () => {
  const profile = serializeUser({
    id: 7,
    username: 'shenqing',
    email: 'test@example.com',
    nickname: null,
    signature: '',
    avatar_image: '',
    active_seconds: 0,
    created_at: '2026-08-13T00:00:00.000Z',
  });

  assert.equal(profile.memberLevel, 'V1');
  assert.equal(profile.nickname, 'shenqing');
  assert.equal(profile.avatarImage, '');
});

test('avatar image validation rejects oversized data urls', () => {
  assert.deepEqual(validateAvatarImage(''), { ok: true, value: '' });
  assert.equal(validateAvatarImage('data:text/plain;base64,AAAA').ok, false);
  assert.equal(validateAvatarImage(`data:image/png;base64,${'A'.repeat(230000)}`).ok, false);
  assert.deepEqual(validateAvatarImage('data:image/png;base64,AAAA'), {
    ok: true,
    value: 'data:image/png;base64,AAAA',
  });
});
