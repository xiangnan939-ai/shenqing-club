import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleSession, GameRules } from './core.mjs';
import { GAMEPLAY_CONFIG } from './config.mjs';

function playOne(seed) {
  const session = new BattleSession({ seed });
  for (let step = 0; step < 6000 && !session.over; step += 1) {
    const side = session.player;
    const pair = GameRules.findMerge(side);
    if (pair) session.executeCommand('player', { type: 'Move', from: pair[0], to: pair[1] });
    const reserveIndex = side.reserve.findIndex(Boolean);
    const emptyIndex = side.board.findIndex((unit, index) => index < side.unlocked && !unit);
    if (reserveIndex !== -1 && emptyIndex !== -1) session.executeCommand('player', { type: 'Deploy', from: reserveIndex, to: emptyIndex });
    if (side.reserve.some((unit) => !unit) && side.buns >= GameRules.currentRecruitCost(side)) session.executeCommand('player', { type: 'Recruit' });
    session.tick(GAMEPLAY_CONFIG.battle.tickMs / 1000);
  }
  return session;
}

test('one thousand deterministic AI mirror battles finish cleanly', () => {
  let wins = 0;
  for (let seed = 1; seed <= 1000; seed += 1) {
    const session = playOne(seed);
    assert.equal(session.over, true, `seed ${seed} did not finish`);
    assert.equal(Number.isFinite(session.result.baseCoins), true);
    assert.equal(Number.isFinite(session.result.maxPower), true);
    if (session.result.victory) wins += 1;
  }
  assert.equal(wins > 0 && wins < 1000, true, `unexpected player win count ${wins}`);
});
