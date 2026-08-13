import assert from 'node:assert/strict';
import test from 'node:test';
import { BattleSession, GameRules } from './core.mjs';
import { GAMEPLAY_CONFIG } from './config.mjs';

function playOne(seed) {
  const session = new BattleSession({
    seed,
    equippedWeapons: ['weapon_diangang'],
    playerLoadout: { active: ['item_haste', 'item_mine', 'item_trap'], passive: [] },
  });
  session.executeCommand('player', { type: 'UseItem', itemId: 'item_haste' });
  for (let step = 0; step < 14000 && !session.over; step += 1) {
    const side = session.player;
    const pair = GameRules.findMerge(side);
    if (pair) session.executeCommand('player', { type: 'Move', from: pair[0], to: pair[1] });
    const reserveIndex = side.reserve.findIndex(Boolean);
    const emptyIndex = side.board.findIndex((unit, index) => index < side.unlocked && !unit);
    if (reserveIndex !== -1 && emptyIndex !== -1) session.executeCommand('player', { type: 'Deploy', from: reserveIndex, to: emptyIndex });
    if (side.unlocked < GAMEPLAY_CONFIG.battle.boardSize && side.buns >= GameRules.currentLandCost(side) + GameRules.currentRecruitCost(side) * 2) {
      session.executeCommand('player', { type: 'OpenLand' });
    }
    if (side.reserve.some((unit) => !unit) && side.buns >= GameRules.currentRecruitCost(side)) session.executeCommand('player', { type: 'Recruit' });
    if (session.wave >= 10 && session.enemies.length && !side.usedItems.includes('item_mine')) session.executeCommand('player', { type: 'UseItem', itemId: 'item_mine' });
    if (session.wave >= 15 && session.enemies.length && !side.usedItems.includes('item_trap')) session.executeCommand('player', { type: 'UseItem', itemId: 'item_trap' });
    session.tick(GAMEPLAY_CONFIG.battle.tickMs / 1000);
  }
  return session;
}

test('two hundred deterministic tower-defense battles finish cleanly', () => {
  let wins = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const session = playOne(seed);
    assert.equal(session.over, true, `seed ${seed} did not finish`);
    assert.equal(Number.isFinite(session.result.baseCoins), true);
    assert.equal(Number.isFinite(session.result.maxPower), true);
    assert.equal(session.result.clearedWaves <= GAMEPLAY_CONFIG.battle.maxWaves, true);
    if (session.result.victory) wins += 1;
  }
  assert.equal(wins > 0 && wins < 200, true, `unexpected player win count ${wins}`);
});
