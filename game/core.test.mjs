import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleSession, GameRules, SaveService, SeededRng } from './core.mjs';
import { GAMEPLAY_CONFIG } from './config.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
}

test('seeded RNG is deterministic', () => {
  const first = new SeededRng(939);
  const second = new SeededRng(939);
  assert.deepEqual(Array.from({ length: 8 }, () => first.next()), Array.from({ length: 8 }, () => second.next()));
});

test('full reserve blocks recruit without spending buns', () => {
  const session = new BattleSession({ seed: 11 });
  session.player.reserve.fill({ id: 'x', kind: 'soldier', soldierId: 'sword', char: '刀', level: 1, exp: 0 });
  const before = session.player.buns;
  const result = session.executeCommand('player', { type: 'Recruit' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'reserve_full');
  assert.equal(session.player.buns, before);
});

test('same units merge into exactly one higher level unit', () => {
  const session = new BattleSession({ seed: 12 });
  session.player.board[0] = { id: 'a', kind: 'soldier', soldierId: 'sword', char: '刀', level: 1, exp: 0 };
  session.player.board[1] = { id: 'b', kind: 'soldier', soldierId: 'sword', char: '刀', level: 1, exp: 0 };
  const result = session.executeCommand('player', { type: 'Move', from: 0, to: 1 });
  assert.equal(result.action, 'merge');
  assert.equal(session.player.board.filter(Boolean).length, 1);
  assert.equal(session.player.board[1].level, 2);
});

test('valid recipe creates Zhao Yun and invalid recipe is rejected', () => {
  const valid = new BattleSession({ seed: 13 });
  valid.player.board[0] = { id: 'zhao', kind: 'fragment', char: '赵', level: 1, exp: 0 };
  valid.player.board[1] = { id: 'yun', kind: 'fragment', char: '云', level: 1, exp: 0 };
  const validResult = valid.executeCommand('player', { type: 'Move', from: 0, to: 1 });
  assert.equal(validResult.general.name, '赵云');
  assert.equal(valid.player.board[1].generalId, 'general_zhaoyun');

  const invalid = new BattleSession({ seed: 14 });
  invalid.player.board[0] = { id: 'ma', kind: 'fragment', char: '马', level: 1, exp: 0 };
  invalid.player.board[1] = { id: 'yun', kind: 'fragment', char: '云', level: 1, exp: 0 };
  const invalidResult = invalid.executeCommand('player', { type: 'Move', from: 0, to: 1 });
  assert.equal(invalidResult.ok, false);
  assert.equal(invalid.player.board[0].char, '马');
  assert.equal(invalid.player.board[1].char, '云');
});

test('all twelve configured general recipes resolve uniquely', async () => {
  const { GENERALS } = await import('./config.mjs');
  for (const [index, general] of GENERALS.entries()) {
    const session = new BattleSession({ seed: 100 + index });
    session.player.board[0] = { id: `a${index}`, kind: 'fragment', char: general.chars[0], level: 1, exp: 0 };
    session.player.board[1] = { id: `b${index}`, kind: 'fragment', char: general.chars[1], level: 1, exp: 0 };
    const result = session.executeCommand('player', { type: 'Move', from: 0, to: 1 });
    assert.equal(result.general.id, general.id);
    assert.equal(session.player.board.filter(Boolean).length, 1);
  }
});

test('one hundred valid board moves preserve grid invariants', () => {
  const session = new BattleSession({ seed: 919 });
  for (let index = 0; index < session.player.unlocked; index += 2) {
    session.player.board[index] = { id: `unit-${index}`, kind: 'soldier', soldierId: 'sword', char: '刀', level: index / 2 + 1, exp: 0 };
  }
  for (let step = 0; step < 100; step += 1) {
    const occupied = session.player.board.findIndex(Boolean);
    const empty = session.player.board.findIndex((unit, index) => index < session.player.unlocked && !unit);
    const movedId = session.player.board[occupied].id;
    assert.equal(session.executeCommand('player', { type: 'Move', from: occupied, to: empty }).ok, true);
    const ids = session.player.board.filter(Boolean).map((unit) => unit.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(session.player.board.filter((unit) => unit?.id === movedId).length, 1);
  }
});

test('pause freezes battle clocks and both sides', () => {
  const session = new BattleSession({ seed: 15 });
  const before = session.snapshot();
  session.setPaused(true);
  session.tick(10);
  const after = session.snapshot();
  assert.equal(after.waveTime, before.waveTime);
  assert.equal(after.player.buns, before.player.buns);
  assert.equal(after.opponent.buns, before.opponent.buns);
  assert.deepEqual(after.player.board, before.player.board);
});

test('result claiming is idempotent', () => {
  const storage = new MemoryStorage();
  const service = new SaveService(storage);
  const save = service.load(new Date('2026-08-12T08:00:00'));
  const result = { sessionId: 'battle_fixed', victory: true, baseCoins: 120 };
  const initialCoins = save.coins;
  const first = service.claimResult(save, result);
  const repeats = Array.from({ length: 20 }, () => service.claimResult(save, result));
  assert.equal(first.claimed, true);
  assert.equal(repeats.every((entry) => entry.claimed === false), true);
  assert.equal(save.coins, initialCoins + 120);
});

test('daily items reset while permanent weapons remain', () => {
  const storage = new MemoryStorage();
  const service = new SaveService(storage);
  const firstDay = service.load(new Date('2026-08-12T08:00:00'));
  firstDay.daily.ownedItems.push('item_shenbing');
  const weapons = [...firstDay.ownedWeapons];
  service.save(firstDay);
  const nextDay = service.load(new Date('2026-08-13T08:00:00'));
  assert.deepEqual(nextDay.daily.ownedItems, []);
  assert.deepEqual(nextDay.ownedWeapons, weapons);
});

test('battle simulation reaches a result without NaN or deadlock', () => {
  const session = new BattleSession({ seed: 16 });
  for (let step = 0; step < 5000 && !session.over; step += 1) {
    const side = session.player;
    if (side.reserve.some(Boolean) && side.board.slice(0, side.unlocked).some((unit) => !unit)) {
      const from = side.reserve.findIndex(Boolean);
      const to = side.board.findIndex((unit, index) => index < side.unlocked && !unit);
      session.executeCommand('player', { type: 'Deploy', from, to });
    }
    const merge = GameRules.findMerge(side);
    if (merge) session.executeCommand('player', { type: 'Move', from: merge[0], to: merge[1] });
    if (side.reserve.some((unit) => !unit) && side.buns >= GameRules.currentRecruitCost(side)) session.executeCommand('player', { type: 'Recruit' });
    session.tick(GAMEPLAY_CONFIG.battle.tickMs / 1000);
    assert.equal(Number.isFinite(side.buns), true);
  }
  assert.equal(session.over, true);
  assert.equal(Boolean(session.result), true);
});
