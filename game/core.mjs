import {
  ENEMIES,
  GAMEPLAY_CONFIG,
  GENERALS,
  ITEMS,
  MAPS,
  RANKS,
  SOLDIERS,
  WEAPONS,
} from './config.mjs';

export class SeededRng {
  constructor(seed = Date.now()) {
    this.seed = Number(seed) >>> 0 || 1;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  weighted(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = this.next() * total;
    for (const entry of entries) {
      cursor -= entry.weight;
      if (cursor <= 0) return entry.value;
    }
    return entries.at(-1)?.value;
  }
}

export class SaveService {
  constructor(storage, key = 'shenqing.zhaoyun.meta.v2') {
    this.storage = storage;
    this.key = key;
  }

  defaultSave(now = new Date()) {
    return {
      saveVersion: 2,
      coins: GAMEPLAY_CONFIG.meta.initialCoins,
      energy: GAMEPLAY_CONFIG.meta.initialEnergy,
      lastEnergyAt: now.toISOString(),
      rank: { tierIndex: 0, stars: 0 },
      ownedWeapons: ['weapon_diangang', 'weapon_guding'],
      equippedWeapons: ['weapon_diangang'],
      settings: { music: true, sound: true, vibration: true, showHealth: true },
      daily: {
        dateKey: localDateKey(now),
        shopSeed: hashString(localDateKey(now)),
        ownedItems: [],
        activeLoadout: [],
        passiveLoadout: [],
      },
      claimedSessions: [],
      tutorialSeen: false,
    };
  }

  load(now = new Date()) {
    let save;
    try {
      save = JSON.parse(this.storage?.getItem(this.key) || 'null');
    } catch {
      save = null;
    }
    save = this.migrate(save, now);
    this.regenerateEnergy(save, now);
    this.resetDaily(save, now);
    this.save(save);
    return save;
  }

  migrate(value, now = new Date()) {
    const defaults = this.defaultSave(now);
    if (!value || typeof value !== 'object') return defaults;
    return {
      ...defaults,
      ...value,
      saveVersion: 2,
      rank: { ...defaults.rank, ...(value.rank || {}) },
      settings: { ...defaults.settings, ...(value.settings || {}) },
      daily: { ...defaults.daily, ...(value.daily || {}) },
      claimedSessions: Array.isArray(value.claimedSessions) ? value.claimedSessions.slice(-50) : [],
    };
  }

  regenerateEnergy(save, now = new Date()) {
    if (save.energy >= GAMEPLAY_CONFIG.meta.maxEnergy) {
      save.energy = GAMEPLAY_CONFIG.meta.maxEnergy;
      save.lastEnergyAt = now.toISOString();
      return;
    }
    const previous = new Date(save.lastEnergyAt).getTime();
    const elapsed = Math.max(0, now.getTime() - previous);
    const gained = Math.floor(elapsed / (GAMEPLAY_CONFIG.meta.energyRegenSeconds * 1000));
    if (gained > 0) {
      save.energy = Math.min(GAMEPLAY_CONFIG.meta.maxEnergy, save.energy + gained);
      save.lastEnergyAt = new Date(previous + gained * GAMEPLAY_CONFIG.meta.energyRegenSeconds * 1000).toISOString();
    }
  }

  resetDaily(save, now = new Date()) {
    const key = localDateKey(now);
    if (save.daily.dateKey === key) return false;
    save.daily = {
      dateKey: key,
      shopSeed: hashString(key),
      ownedItems: [],
      activeLoadout: [],
      passiveLoadout: [],
    };
    return true;
  }

  save(value) {
    this.storage?.setItem(this.key, JSON.stringify(value));
  }

  claimResult(save, result, multiplier = 1) {
    if (save.claimedSessions.includes(result.sessionId)) return { claimed: false, coins: 0, stars: 0 };
    const reward = Math.round(result.baseCoins * multiplier);
    const stars = result.victory ? GAMEPLAY_CONFIG.result.winStars : GAMEPLAY_CONFIG.result.loseStars;
    save.coins += reward;
    applyStars(save.rank, stars);
    save.claimedSessions.push(result.sessionId);
    save.claimedSessions = save.claimedSessions.slice(-50);
    this.save(save);
    return { claimed: true, coins: reward, stars };
  }
}

export class FakeAdService {
  async showRewarded() {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { rewarded: true };
  }
}

export class BattleSession {
  constructor({ seed, playerLoadout = { active: [], passive: [] }, equippedWeapons = [] } = {}) {
    this.sessionId = `battle_${seed}_${Date.now().toString(36)}`;
    this.seed = Number(seed) >>> 0;
    this.rng = new SeededRng(this.seed);
    this.map = this.rng.pick(MAPS);
    this.wave = 1;
    this.waveTime = GAMEPLAY_CONFIG.battle.waveSeconds;
    this.interWaveTime = 0;
    this.paused = false;
    this.over = false;
    this.victory = false;
    this.clearedWaves = 0;
    this.maxPower = 0;
    this.activeSeconds = 0;
    this.lastEvent = '双方正在整军';
    this.player = createSide('player', playerLoadout, equippedWeapons, this.rng);
    this.opponent = createSide('opponent', makeAiLoadout(this.rng), pickAiWeapons(this.rng), this.rng);
    this.profile = createAiProfile(this.rng);
    this.enemy = createEnemyState(this.wave);
    this.player.pressureHp = this.enemy.maxHp;
    this.player.pressureMaxHp = this.enemy.maxHp;
    this.opponent.pressureHp = this.enemy.maxHp;
    this.opponent.pressureMaxHp = this.enemy.maxHp;
    this.aiClock = 0;
    this.incomeClock = 0;
    this.result = null;
  }

  executeCommand(sideId, command) {
    if (this.over || this.paused) return { ok: false, reason: 'battle_inactive' };
    const side = sideId === 'opponent' ? this.opponent : this.player;
    switch (command.type) {
      case 'Recruit': return recruit(side, this.rng);
      case 'Deploy': return deploy(side, command.from, command.to);
      case 'Move': return moveOrMerge(side, command.from, command.to);
      case 'OpenLand': return openLand(side);
      case 'Recycle': return recycle(side, command.location, command.index);
      case 'UseItem': return this.useItem(side, command.itemId, command.target);
      default: return { ok: false, reason: 'unknown_command' };
    }
  }

  useItem(side, itemId, target) {
    const item = ITEMS.find((candidate) => candidate.id === itemId);
    if (!item || !side.activeItems.includes(itemId) || side.usedItems.includes(itemId)) return { ok: false, reason: 'item_unavailable' };
    const handler = EFFECT_HANDLERS[item.effectId];
    if (!handler) return { ok: false, reason: 'missing_effect' };
    const result = handler({ session: this, side, target, rng: this.rng });
    if (result.ok) side.usedItems.push(itemId);
    return result;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  tick(seconds) {
    if (this.over || this.paused || seconds <= 0) return;
    const delta = Math.min(seconds, 0.5);
    this.activeSeconds += delta;
    this.aiClock += delta;
    this.incomeClock += delta;

    if (this.incomeClock >= 1) {
      this.applyIncome(this.player, this.incomeClock);
      this.applyIncome(this.opponent, this.incomeClock);
      this.incomeClock %= 1;
    }

    if (this.aiClock >= GAMEPLAY_CONFIG.ai.thinkIntervalSeconds) {
      this.aiClock = 0;
      this.runAi();
    }

    if (this.interWaveTime > 0) {
      this.interWaveTime -= delta;
      if (this.interWaveTime <= 0) this.startNextWave();
      return;
    }

    this.waveTime -= delta;
    this.damagePressure(this.player, delta);
    this.damagePressure(this.opponent, delta);
    this.maxPower = Math.max(this.maxPower, sidePower(this.player));

    const playerCleared = this.player.pressureHp <= 0;
    const opponentCleared = this.opponent.pressureHp <= 0;
    if (playerCleared && opponentCleared) this.completeWave();
    else if (this.waveTime <= 0) this.completeWave();
  }

  applyIncome(side, elapsed) {
    const farmers = [...side.board, ...side.reserve].filter((unit) => unit?.kind === 'farmer');
    side.farmerClock += elapsed;
    if (farmers.length && side.farmerClock >= GAMEPLAY_CONFIG.economy.farmerIntervalSeconds) {
      side.farmerClock %= GAMEPLAY_CONFIG.economy.farmerIntervalSeconds;
      side.buns += farmers.reduce((sum, unit) => sum + unit.level * GAMEPLAY_CONFIG.economy.farmerBunsPerLevel, 0);
      side.lastAction = '农民产出馒头';
    }
  }

  damagePressure(side, delta) {
    if (side.pressureHp <= 0) return;
    const power = sidePower(side, this.enemy.id);
    const equippedBonus = side.equippedWeapons
      .map((id) => WEAPONS.find((weapon) => weapon.id === id)?.attackBonus || 0)
      .reduce((sum, bonus) => sum + bonus, 0);
    side.pressureHp -= power * (1 + equippedBonus + side.hasteBonus) * delta;
  }

  completeWave() {
    const playerFailed = this.player.pressureHp > 0;
    const opponentFailed = this.opponent.pressureHp > 0;
    if (!playerFailed) rewardClear(this.player, this.wave);
    if (!opponentFailed) rewardClear(this.opponent, this.wave);
    if (playerFailed) damageAdou(this.player);
    if (opponentFailed) damageAdou(this.opponent);
    if (this.player.adouHp <= 0 || this.opponent.adouHp <= 0) {
      this.finish(this.opponent.adouHp <= 0 && this.player.adouHp > 0);
      return;
    }
    this.clearedWaves += playerFailed ? 0 : 1;
    this.lastEvent = playerFailed ? '敌军突破我方防线' : opponentFailed ? '对手防线失守' : '双方均守住本波';
    this.wave += 1;
    this.interWaveTime = GAMEPLAY_CONFIG.battle.interWaveSeconds;
  }

  startNextWave() {
    this.waveTime = GAMEPLAY_CONFIG.battle.waveSeconds;
    this.enemy = createEnemyState(this.wave, this.map);
    this.player.pressureHp = this.enemy.maxHp;
    this.player.pressureMaxHp = this.enemy.maxHp;
    this.opponent.pressureHp = this.enemy.maxHp;
    this.opponent.pressureMaxHp = this.enemy.maxHp;
    this.lastEvent = `第 ${this.wave} 波来袭`;
    this.interWaveTime = 0;
  }

  runAi() {
    const side = this.opponent;
    const pair = findMerge(side);
    if (pair && this.rng.next() < GAMEPLAY_CONFIG.ai.mergeChance) {
      this.executeCommand('opponent', { type: 'Move', from: pair[0], to: pair[1] });
      return;
    }
    const reserveIndex = side.reserve.findIndex(Boolean);
    const emptyBoard = side.board.findIndex((unit, index) => index < side.unlocked && !unit);
    if (reserveIndex !== -1 && emptyBoard !== -1) {
      this.executeCommand('opponent', { type: 'Deploy', from: reserveIndex, to: emptyBoard });
      return;
    }
    if (side.reserve.filter(Boolean).length >= side.reserve.length - GAMEPLAY_CONFIG.ai.openLandThreshold && side.buns >= currentLandCost(side)) {
      if (this.executeCommand('opponent', { type: 'OpenLand' }).ok) return;
    }
    if (side.buns >= currentRecruitCost(side) && side.reserve.some((unit) => !unit)) {
      side.buns += currentRecruitCost(side) * (GAMEPLAY_CONFIG.ai.recruitResourceMultiplier - 1);
      this.executeCommand('opponent', { type: 'Recruit' });
    }
  }

  finish(victory) {
    this.over = true;
    this.victory = victory;
    const baseCoins = (victory ? GAMEPLAY_CONFIG.result.winCoins : GAMEPLAY_CONFIG.result.loseCoins)
      + this.clearedWaves * GAMEPLAY_CONFIG.result.coinsPerClearedWave;
    this.result = {
      sessionId: this.sessionId,
      victory,
      clearedWaves: this.clearedWaves,
      maxPower: Math.round(this.maxPower),
      baseCoins,
    };
  }

  snapshot() {
    return {
      sessionId: this.sessionId,
      seed: this.seed,
      map: this.map,
      wave: this.wave,
      waveTime: this.waveTime,
      paused: this.paused,
      over: this.over,
      player: cloneSide(this.player),
      opponent: cloneSide(this.opponent),
      enemy: { ...this.enemy },
      profile: { ...this.profile },
      result: this.result ? { ...this.result } : null,
      lastEvent: this.lastEvent,
    };
  }
}

const EFFECT_HANDLERS = {
  upgrade_unit({ side, target }) {
    const unit = resolveTarget(side, target);
    if (!unit || unit.level >= GAMEPLAY_CONFIG.battle.maxUnitLevel) return { ok: false, reason: 'invalid_target' };
    unit.level += 1;
    return { ok: true, message: `${unit.char || unit.name}提升一级` };
  },
  train_unit({ side, target, rng }) {
    const unit = resolveTarget(side, target);
    if (!unit) return { ok: false, reason: 'invalid_target' };
    unit.level = Math.max(1, Math.min(GAMEPLAY_CONFIG.battle.maxUnitLevel, unit.level + (rng.next() > 0.35 ? 1 : -1)));
    return { ok: true, message: '练兵完成' };
  },
  damage_wave({ side }) {
    side.pressureHp = Math.max(0, side.pressureHp - side.pressureMaxHp * 0.42);
    return { ok: true, message: '地雷重创敌军' };
  },
  team_haste({ side }) {
    side.hasteBonus += 0.2;
    return { ok: true, message: '全军攻速提升' };
  },
  reroll_character({ side, target, rng }) {
    const unit = resolveTarget(side, target);
    if (!unit || unit.kind !== 'fragment') return { ok: false, reason: 'invalid_target' };
    unit.char = rng.pick([...new Set(GENERALS.flatMap((general) => general.chars))]);
    return { ok: true, message: `改字为「${unit.char}」` };
  },
};

function createSide(id, loadout, equippedWeapons, rng) {
  const extraLife = loadout.passive.includes('item_revive') ? 1 : 0;
  const side = {
    id,
    buns: GAMEPLAY_CONFIG.battle.initialBuns,
    recruitCount: 0,
    landOpenCount: 0,
    unlocked: GAMEPLAY_CONFIG.battle.initialUnlockedCells,
    board: Array(GAMEPLAY_CONFIG.battle.boardSize).fill(null),
    reserve: Array(GAMEPLAY_CONFIG.battle.reserveSlots).fill(null),
    adouHp: GAMEPLAY_CONFIG.battle.initialAdouHp + extraLife,
    maxAdouHp: GAMEPLAY_CONFIG.battle.initialAdouHp + extraLife,
    pressureHp: 1,
    pressureMaxHp: 1,
    activeItems: [...loadout.active],
    passiveItems: [...loadout.passive],
    usedItems: [],
    equippedWeapons: [...equippedWeapons],
    hasteBonus: 0,
    farmerClock: 0,
    meteorReady: loadout.passive.includes('item_meteor'),
    freeLand: loadout.passive.includes('item_shovel'),
    generalChanceBonus: loadout.passive.includes('item_recruit') ? 7 : 0,
    gallery: [],
    lastAction: '等待部署',
    pool: createRecruitmentPool(),
  };
  if (loadout.passive.includes('item_farmer')) side.reserve[0] = createSoldier('farmer');
  side.buns += Math.floor(rng.next() * 3);
  return side;
}

function createRecruitmentPool() {
  const chars = [...new Set(GENERALS.flatMap((general) => general.chars))];
  return Object.fromEntries(chars.map((char) => [char, GAMEPLAY_CONFIG.recruitment.generalCharacterCopies]));
}

function recruit(side, rng) {
  const cost = currentRecruitCost(side);
  const emptyIndex = side.reserve.findIndex((unit) => !unit);
  if (emptyIndex === -1) return { ok: false, reason: 'reserve_full' };
  if (side.buns < cost) return { ok: false, reason: 'not_enough_buns' };
  side.buns -= cost;
  side.recruitCount += 1;
  const remainingChars = Object.entries(side.pool).filter(([, count]) => count > 0);
  const generalChance = (GAMEPLAY_CONFIG.recruitment.generalChance + side.generalChanceBonus) / 100;
  let unit;
  if (remainingChars.length && rng.next() < generalChance) {
    const char = rng.pick(remainingChars)[0];
    side.pool[char] -= 1;
    unit = { id: tokenId(rng), kind: 'fragment', char, level: 1, exp: 0 };
  } else {
    const soldierId = rng.weighted(Object.entries(GAMEPLAY_CONFIG.recruitment.baseWeights).map(([value, weight]) => ({ value, weight })));
    unit = createSoldier(soldierId, rng);
  }
  side.reserve[emptyIndex] = unit;
  side.lastAction = `征得「${unit.char}」`;
  return { ok: true, unit, index: emptyIndex, cost };
}

function createSoldier(soldierId, rng = new SeededRng(1)) {
  const soldier = SOLDIERS[soldierId];
  return { id: tokenId(rng), kind: soldierId === 'farmer' ? 'farmer' : 'soldier', soldierId, char: soldier.char, level: 1, exp: 0 };
}

function deploy(side, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= side.reserve.length || to < 0 || to >= side.unlocked) return { ok: false, reason: 'invalid_cell' };
  if (!side.reserve[from] || side.board[to]) return { ok: false, reason: 'occupied' };
  side.board[to] = side.reserve[from];
  side.reserve[from] = null;
  side.lastAction = '单位部署';
  return { ok: true };
}

function moveOrMerge(side, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || to < 0 || from >= side.unlocked || to >= side.unlocked) return { ok: false, reason: 'invalid_cell' };
  const source = side.board[from];
  const target = side.board[to];
  if (!source) return { ok: false, reason: 'empty_source' };
  if (!target) {
    side.board[to] = source;
    side.board[from] = null;
    side.lastAction = '调整站位';
    return { ok: true, action: 'move' };
  }
  const general = resolveGeneral(source, target);
  if (general) {
    side.board[to] = createGeneral(general, source.level);
    side.board[from] = null;
    if (!side.gallery.includes(general.id)) side.gallery.push(general.id);
    side.lastAction = `${general.name}出阵`;
    return { ok: true, action: 'general', general };
  }
  const sameUnit = source.kind === target.kind && source.char === target.char && source.level === target.level;
  if (sameUnit && source.kind !== 'fragment' && target.level < GAMEPLAY_CONFIG.battle.maxUnitLevel) {
    target.level += 1;
    side.board[from] = null;
    side.lastAction = `${target.char}升至 ${target.level} 级`;
    return { ok: true, action: 'merge', unit: target };
  }
  return { ok: false, reason: 'illegal_merge' };
}

function resolveGeneral(first, second) {
  if (first.kind !== 'fragment' || second.kind !== 'fragment') return null;
  return GENERALS.find((general) => general.chars.includes(first.char) && general.chars.includes(second.char) && first.char !== second.char) || null;
}

function createGeneral(general, level = 1) {
  return { id: `${general.id}_${Date.now().toString(36)}`, kind: 'general', generalId: general.id, char: general.name, level: Math.min(level, GAMEPLAY_CONFIG.battle.maxGeneralLevel), exp: 0 };
}

function openLand(side) {
  if (side.unlocked >= GAMEPLAY_CONFIG.battle.boardSize) return { ok: false, reason: 'fully_open' };
  let cost = currentLandCost(side);
  if (side.freeLand) {
    cost = 0;
    side.freeLand = false;
  }
  if (side.buns < cost) return { ok: false, reason: 'not_enough_buns' };
  side.buns -= cost;
  side.unlocked += 1;
  side.landOpenCount += 1;
  side.lastAction = '开垦一格';
  return { ok: true, cost, index: side.unlocked - 1 };
}

function recycle(side, location, index) {
  const collection = location === 'reserve' ? side.reserve : side.board;
  const unit = collection[index];
  if (!unit) return { ok: false, reason: 'empty_source' };
  const refund = Math.max(1, Math.round(currentRecruitCost(side) * GAMEPLAY_CONFIG.economy.recycleRatio * unit.level));
  collection[index] = null;
  side.buns += refund;
  side.lastAction = `回收「${unit.char}」`;
  return { ok: true, refund };
}

function findMerge(side) {
  for (let first = 0; first < side.unlocked; first += 1) {
    for (let second = first + 1; second < side.unlocked; second += 1) {
      const a = side.board[first];
      const b = side.board[second];
      if (!a || !b) continue;
      if (resolveGeneral(a, b)) return [first, second];
      if (a.kind === b.kind && a.kind !== 'fragment' && a.char === b.char && a.level === b.level && a.level < GAMEPLAY_CONFIG.battle.maxUnitLevel) return [first, second];
    }
  }
  return null;
}

function sidePower(side, enemyId = null) {
  const enemy = ENEMIES.find((entry) => entry.id === enemyId);
  return side.board.reduce((sum, unit) => {
    if (!unit) return sum;
    if (unit.kind === 'farmer' || unit.kind === 'fragment') return sum;
    if (unit.kind === 'general') {
      const general = GENERALS.find((entry) => entry.id === unit.generalId);
      return sum + general.attack * (1 + (unit.level - 1) * 0.72);
    }
    const soldier = SOLDIERS[unit.soldierId];
    const counter = enemy?.counteredBy.includes(unit.soldierId) ? 1.35 : 1;
    return sum + soldier.attack * 2 ** (unit.level - 1) * counter;
  }, 0);
}

function rewardClear(side, wave) {
  side.buns += 8 + wave * 2;
  side.board.filter((unit) => unit?.kind === 'general').forEach((unit) => {
    unit.exp += 5 + wave;
    const needed = GAMEPLAY_CONFIG.battle.generalExpCurve[unit.level] ?? Infinity;
    if (unit.level < GAMEPLAY_CONFIG.battle.maxGeneralLevel && unit.exp >= needed) {
      unit.exp -= needed;
      unit.level += 1;
    }
  });
}

function damageAdou(side) {
  if (side.meteorReady) {
    side.meteorReady = false;
    side.lastAction = '陨石抵挡破阵';
    return;
  }
  side.adouHp -= 1;
}

function createEnemyState(wave, map = MAPS[0]) {
  const enemy = ENEMIES[(wave - 1) % ENEMIES.length];
  const bossName = map?.bossWaves?.[wave];
  const maxHp = Math.round((enemy.baseHp + wave * 25) * GAMEPLAY_CONFIG.battle.waveHpGrowth ** (wave - 1) * (bossName ? 2.4 : 1));
  return { ...enemy, name: bossName || enemy.name, boss: Boolean(bossName), maxHp };
}

function createAiProfile(rng) {
  const names = ['北地孤枪', '折柳', '子龙旧部', '汉水夜雨', '常山客'];
  const tierIndex = Math.floor(rng.next() * Math.min(3, RANKS.length));
  return {
    name: rng.pick(names),
    rank: RANKS[tierIndex].name,
    winRate: `${Math.round(42 + rng.next() * 31)}.${Math.floor(rng.next() * 10)}%`,
    avatar: rng.pick(['云', '汉', '常', '龙']),
  };
}

function makeAiLoadout(rng) {
  const active = ITEMS.filter((item) => item.type === 'active').sort(() => rng.next() - 0.5).slice(0, 1).map((item) => item.id);
  const passive = ITEMS.filter((item) => item.type === 'passive').sort(() => rng.next() - 0.5).slice(0, 2).map((item) => item.id);
  return { active, passive };
}

function pickAiWeapons(rng) {
  return [rng.pick(WEAPONS).id];
}

function resolveTarget(side, target) {
  if (!target) return null;
  const collection = target.location === 'reserve' ? side.reserve : side.board;
  return collection[target.index] || null;
}

function currentRecruitCost(side) {
  const curve = GAMEPLAY_CONFIG.recruitment.costCurve;
  return curve[Math.min(side.recruitCount, curve.length - 1)];
}

function currentLandCost(side) {
  const curve = GAMEPLAY_CONFIG.economy.openLandCosts;
  const base = curve[Math.min(side.landOpenCount, curve.length - 1)];
  return side.passiveItems.includes('item_shovel') ? Math.round(base * 0.72) : base;
}

function applyStars(rank, delta) {
  rank.stars += delta;
  while (rank.stars < 0 && rank.tierIndex > 0) {
    rank.tierIndex -= 1;
    rank.stars += RANKS[rank.tierIndex].starsToAdvance;
  }
  rank.stars = Math.max(0, rank.stars);
  while (rank.tierIndex < RANKS.length - 1 && rank.stars >= RANKS[rank.tierIndex].starsToAdvance) {
    rank.stars -= RANKS[rank.tierIndex].starsToAdvance;
    rank.tierIndex += 1;
  }
}

function cloneSide(side) {
  return {
    ...side,
    board: side.board.map((unit) => unit ? { ...unit } : null),
    reserve: side.reserve.map((unit) => unit ? { ...unit } : null),
    pool: { ...side.pool },
    gallery: [...side.gallery],
    usedItems: [...side.usedItems],
  };
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function tokenId(rng) {
  return `unit_${Math.floor(rng.next() * 0xffffff).toString(36)}_${Date.now().toString(36)}`;
}

export const GameRules = Object.freeze({
  currentRecruitCost,
  currentLandCost,
  findMerge,
  sidePower,
  resolveGeneral,
  applyStars,
});
