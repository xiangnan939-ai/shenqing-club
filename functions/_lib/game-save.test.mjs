import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRevision, parseStoredGameSave, validateGameSave } from './game-save.js';

test('game saves accept normal objects and reject oversized or invalid values', () => {
  assert.equal(validateGameSave({ coins: 120, records: {} }).ok, true);
  assert.equal(validateGameSave(null).ok, false);
  assert.equal(validateGameSave([]).ok, false);
  assert.equal(validateGameSave({ value: 'x'.repeat(65000) }).ok, false);
});

test('save revisions are non-negative bounded integers', () => {
  assert.equal(parseRevision(0), 0);
  assert.equal(parseRevision('12'), 12);
  assert.equal(parseRevision(-1), null);
  assert.equal(parseRevision(1.5), null);
});

test('stored saves are parsed without throwing on corrupt JSON', () => {
  assert.deepEqual(parseStoredGameSave(null), { revision: 0, data: null, updatedAt: null });
  assert.deepEqual(parseStoredGameSave({ revision: 2, data_json: '{', updated_at: 'now' }), {
    revision: 2,
    data: null,
    updatedAt: 'now',
  });
});
