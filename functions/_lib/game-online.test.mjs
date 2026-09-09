import assert from 'node:assert/strict';
import test from 'node:test';
import { isRoomId, parseGameIndex, serializeGameRoom } from './game-online.js';

test('game indexes accept only the five bundled maps and cars', () => {
  assert.equal(parseGameIndex(0), 0);
  assert.equal(parseGameIndex('4'), 4);
  assert.equal(parseGameIndex(5), null);
  assert.equal(parseGameIndex('1.5'), null);
});

test('room ids require a UUID v4 value', () => {
  assert.equal(isRoomId('123e4567-e89b-42d3-a456-426614174000'), true);
  assert.equal(isRoomId('../main'), false);
});

test('serialized rooms expose gameplay state without account secrets', () => {
  const room = serializeGameRoom({
    id: '123e4567-e89b-42d3-a456-426614174000',
    status: 'waiting',
    track_index: 2,
    max_players: 6,
    host_user_id: 7,
    expires_at: '2026-01-01T00:00:00.000Z',
  }, [{
    user_id: 7,
    username: 'host',
    nickname: 'Host',
    role: 'host',
    status: 'joined',
    ready: 1,
    car_index: 3,
    last_seen_at: new Date().toISOString(),
  }], 7);
  assert.equal(room.isHost, true);
  assert.equal(room.members[0].carIndex, 3);
  assert.equal('email' in room.members[0], false);
});
