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
      saveVersion: 3,
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
        ownedItems: ['item_mine', 'item_trap', 'item_haste'],
        activeLoadout: ['item_mine', 'item_trap', 'item_haste'],
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
    const legacyDaily = Number(value.saveVersion || 0) < 3;
    return {
      ...defaults,
      ...value,
      saveVersion: 3,
      rank: { ...defaults.rank, ...(value.rank || {}) },
      settings: { ...defaults.settings, ...(value.settings || {}) },
      daily: legacyDaily ? defaults.daily : { ...defaults.daily, ...(value.daily || {}) },
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
      ownedItems: ['item_mine', 'item_trap', 'item_haste'],
      activeLoadout: ['item_mine', 'item_trap', 'item_haste'],
      passiveLoadout: [],
    };
    return true;
  }

  save(value) {
    this.storage?.setItem(this.key, JSON.stringify(value));
  }

  claimResult(save, result) {
    if (save.claimedSessions.includes(result.sessionId)) return { claimed: false, coins: 0, stars: 0 };
    const reward = result.baseCoins;
    const stars = result.victory ? result.stars : GAMEPLAY_CONFIG.result.loseStars;
    save.coins += reward;
    applyStars(save.rank, stars);
    save.claimedSessions.push(result.sessionId);
    save.claimedSessions = save.claimedSessions.slice(-50);
    this.save(save);
    return { claimed: true, coins: reward, stars };
  }
}

export class BattleSession {
  constructor({ seed, playerLoadout = { active: [], passive: [] }, equippedWeapons = [] } = {}) {
    this.sessionId = `battle_${seed}_${Date.now().toString(36)}`;
    this.seed = Number(seed) >>> 0;
    this.rng = new SeededRng(this.seed);
    this.map = this.rng.pick(MAPS);
    this.wave = 1;
    this.paused = false;
    this.over = false;
    this.victory = false;
    this.clearedWaves = 0;
    this.maxPower = 0;
    this.activeSeconds = 0;
    this.interWaveTime = 0;
    this.spawnClock = GAMEPLAY_CONFIG.battle.spawnIntervalSeconds;
    this.enemySerial = 0;
    this.enemies = [];
    this.spawnQueue = createWaveQueue(this.wave, this.rng);
    this.lastEvent = '第 1 波敌军来袭';
    this.player = createSide('player', playerLoadout, equippedWeapons, this.rng);
    this.result = null;
  }

  executeCommand(sideId, command) {
    if (this.over || this.paused) return { ok: false, reason: 'battle_inactive' };
    const side = this.player;
    switch (command.type) {
      case 'Recruit': return recruit(side, this.rng);
      case 'Deploy': return deploy(side, command.from, command.to);
      case 'Move': return moveOrMerge(side, command.from, command.to);
      case 'Bench': return bench(side, command.from, command.to);
      case 'MoveReserve': return moveReserve(side, command.from, command.to);
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
    if (side.adouHp <= 0) this.finish(false);
    return result;
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  tick(seconds) {
    if (this.over || this.paused || seconds <= 0) return;
    let remaining = Math.min(seconds, 2);
    while (remaining > 0 && !this.over) {
      const delta = Math.min(remaining, 0.1);
      this.updateStep(delta);
      remaining -= delta;
    }
  }

  updateStep(delta) {
    this.activeSeconds += delta;
    this.applyIncome(this.player, delta);
    if (this.interWaveTime > 0) {
      this.interWaveTime -= delta;
      if (this.interWaveTime <= 0) this.startNextWave();
      return;
    }

    this.spawnClock += delta;
    while (this.spawnQueue.length && this.spawnClock >= GAMEPLAY_CONFIG.battle.spawnIntervalSeconds) {
      this.spawnClock -= GAMEPLAY_CONFIG.battle.spawnIntervalSeconds;
      this.spawnEnemy(this.spawnQueue.shift());
    }

    this.updateEnemies(delta);
    this.updateGenerals(delta);
    this.enemies = this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedEnd);
    this.maxPower = Math.max(this.maxPower, sidePower(this.player));

    if (!this.spawnQueue.length && !this.enemies.length && !this.over) this.completeWave();
  }

  applyIncome(side, delta) {
    const farmers = [...side.board, ...side.reserve].filter((unit) => unit?.kind === 'farmer');
    side.farmerClock += delta;
    if (farmers.length && side.farmerClock >= GAMEPLAY_CONFIG.economy.farmerIntervalSeconds) {
      side.farmerClock %= GAMEPLAY_CONFIG.economy.farmerIntervalSeconds;
      const income = farmers.reduce((sum, unit) => sum + unit.level * GAMEPLAY_CONFIG.economy.farmerBunsPerLevel, 0);
      side.buns += income;
      side.lastAction = `农民送来馒头 +${income}`;
    }
  }

  spawnEnemy(typeId) {
    const type = ENEMIES.find((entry) => entry.id === typeId) || ENEMIES[0];
    const bossName = this.map.bossWaves?.[this.wave];
    const boss = type.id === 'enemy_boss';
    const growth = 1 + this.wave * 0.15;
    const maxHp = Math.round(type.baseHp * growth * (boss ? 1 + this.wave * 0.025 : 1));
    this.enemySerial += 1;
    this.enemies.push({
      id: `enemy_${this.enemySerial}`,
      typeId: type.id,
      char: type.char,
      name: bossName && boss ? bossName : type.name,
      boss,
      hp: maxHp,
      maxHp,
      speed: type.speed,
      damage: type.damage,
      goldReward: type.goldReward,
      progress: 0,
      slowRemaining: 0,
      stunRemaining: 0,
      hitFlash: 0,
      dead: false,
      reachedEnd: false,
    });
  }

  updateEnemies(delta) {
    const pathEnd = this.map.path.length - 1;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.reachedEnd) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - delta);
      enemy.slowRemaining = Math.max(0, enemy.slowRemaining - delta);
      enemy.stunRemaining = Math.max(0, enemy.stunRemaining - delta);
      if (enemy.stunRemaining > 0) continue;
      const slow = enemy.slowRemaining > 0 ? 0.5 : 1;
      enemy.progress += enemy.speed * slow * delta;
      if (enemy.progress >= pathEnd) this.enemyReachedEnd(enemy);
    }
  }

  updateGenerals(delta) {
    for (let slot = 0; slot < this.player.unlocked; slot += 1) {
      const unit = this.player.board[slot];
      if (!unit || unit.kind === 'farmer' || unit.kind === 'fragment') continue;
      unit.attackClock = Math.max(0, (unit.attackClock || 0) - delta);
      if (unit.attackClock > 0) continue;
      const combat = unitCombat(unit, this.player);
      const target = this.findTarget(slot, combat.range);
      if (!target) continue;
      this.performAttack(unit, target, combat, slot);
      unit.attackClock = 1 / Math.max(0.1, combat.attackSpeed);
    }
  }

  findTarget(slot, range) {
    const origin = this.map.slots[slot];
    return this.enemies
      .filter((enemy) => !enemy.dead && !enemy.reachedEnd && gridDistance(origin, positionAtProgress(this.map.path, enemy.progress)) <= range)
      .sort((a, b) => b.progress - a.progress)[0] || null;
  }

  performAttack(unit, target, combat, slot) {
    unit.attackCount = (unit.attackCount || 0) + 1;
    const weapon = equippedWeaponFor(unit, this.player.equippedWeapons);
    const enemyType = ENEMIES.find((entry) => entry.id === target.typeId);
    let damage = combat.attack;
    if (enemyType?.counteredBy.includes(combat.classId)) damage *= 1.35;
    if (weapon) damage *= 1 + weapon.attackBonus;

    const firstHit = !unit.firstTargets?.includes(target.id);
    if (!unit.firstTargets) unit.firstTargets = [];
    if (firstHit) unit.firstTargets.push(target.id);

    if (weapon?.id === 'weapon_luori') {
      const distance = gridDistance(this.map.slots[slot], positionAtProgress(this.map.path, target.progress));
      damage *= 1 + distance * 0.2;
    }
    if (weapon?.id === 'weapon_diangang' && firstHit && this.rng.next() < 0.2) {
      damage *= 3;
      target.stunRemaining = Math.max(target.stunRemaining, 0.5);
      this.lastEvent = '点钢枪破甲，敌军眩晕';
    }
    if (weapon?.id === 'weapon_guding' && firstHit) this.player.buns += 1;

    this.applyDamage(target, damage, unit, weapon);

    if (unit.soldierId === 'cavalry') {
      this.damageNearProgress(target.progress, damage * 0.45, 0.85, target.id);
    } else if (unit.soldierId === 'spear') {
      this.damageNearProgress(target.progress, damage * 0.35, 1.15, target.id);
    }

    if (unit.kind === 'general' && unit.attackCount % 10 === 0) this.triggerGeneralSkill(unit, damage);
    if (weapon?.id === 'weapon_longdan' && unit.generalId === 'general_zhaoyun' && this.rng.next() < 0.15) {
      for (const enemy of this.enemies) this.applyDamage(enemy, damage * 2.2);
      this.lastEvent = '龙胆亮银枪召来漫天飞枪';
    }
  }

  triggerGeneralSkill(unit, damage) {
    if (unit.generalId === 'general_zhaoyun') {
      for (const enemy of this.enemies) this.applyDamage(enemy, damage * 0.9);
      this.lastEvent = '赵云发动七进七出';
    } else if (unit.generalId === 'general_zhangfei') {
      this.enemies.forEach((enemy) => { enemy.stunRemaining = Math.max(enemy.stunRemaining, 1.2); });
      this.lastEvent = '张飞当阳大喝，震慑全场';
    } else if (unit.generalId === 'general_huangzhong') {
      for (const enemy of this.enemies) this.applyDamage(enemy, damage * 0.7);
      this.lastEvent = '黄忠发动百步穿杨';
    } else if (unit.generalId === 'general_liubei') {
      this.player.hasteBonus += 0.08;
      this.lastEvent = '刘备仁德激励全军';
    } else {
      const targets = [...this.enemies].filter((enemy) => !enemy.dead).sort((a, b) => b.progress - a.progress).slice(0, 3);
      targets.forEach((enemy) => {
        this.applyDamage(enemy, damage * 0.8);
        enemy.stunRemaining = Math.max(enemy.stunRemaining, 0.45);
      });
      this.lastEvent = `${unit.char}发动武将技`;
    }
  }

  applyDamage(enemy, amount, source = null, weapon = null) {
    if (!enemy || enemy.dead || enemy.reachedEnd) return false;
    enemy.hp -= Math.max(0, amount);
    enemy.hitFlash = 0.12;
    if (enemy.hp > 0) return false;
    enemy.hp = 0;
    enemy.dead = true;
    this.player.buns += enemy.goldReward;
    this.player.kills += 1;
    if (weapon?.id === 'weapon_qinglong' && source?.generalId === 'general_guanyu') {
      for (const other of this.enemies) this.applyDamage(other, amount * 0.55);
      this.lastEvent = '青龙偃月刀释放刀气';
    }
    return true;
  }

  damageNearProgress(progress, damage, radius, excludedId = '') {
    this.enemies
      .filter((enemy) => enemy.id !== excludedId && Math.abs(enemy.progress - progress) <= radius)
      .forEach((enemy) => this.applyDamage(enemy, damage));
  }

  enemyReachedEnd(enemy) {
    enemy.reachedEnd = true;
    if (this.player.meteorReady) {
      this.player.meteorReady = false;
      this.lastEvent = '陨石替阿斗挡下破阵一击';
      return;
    }
    this.player.adouHp = Math.max(0, this.player.adouHp - enemy.damage);
    this.lastEvent = `${enemy.name}突破防线，阿斗失去 ${enemy.damage} 点生命`;
    if (this.player.adouHp <= 0) this.finish(false);
  }

  completeWave() {
    this.clearedWaves = this.wave;
    rewardClear(this.player, this.wave);
    if (this.wave >= GAMEPLAY_CONFIG.battle.maxWaves) {
      this.finish(true);
      return;
    }
    this.lastEvent = `第 ${this.wave} 波已肃清，援军正在集结`;
    this.interWaveTime = GAMEPLAY_CONFIG.battle.interWaveSeconds;
  }

  startNextWave() {
    this.wave += 1;
    this.spawnQueue = createWaveQueue(this.wave, this.rng);
    this.spawnClock = GAMEPLAY_CONFIG.battle.spawnIntervalSeconds;
    this.interWaveTime = 0;
    this.lastEvent = `第 ${this.wave} 波敌军来袭`;
  }

  finish(victory) {
    if (this.over) return;
    this.over = true;
    this.victory = victory;
    const stars = victory ? calculateStars(this.player.adouHp, this.player.maxAdouHp) : 0;
    const baseCoins = (victory ? GAMEPLAY_CONFIG.result.winCoins : GAMEPLAY_CONFIG.result.loseCoins)
      + this.clearedWaves * GAMEPLAY_CONFIG.result.coinsPerClearedWave;
    this.result = {
      sessionId: this.sessionId,
      victory,
      stars,
      adouHp: this.player.adouHp,
      clearedWaves: this.clearedWaves,
      maxPower: Math.round(this.maxPower),
      kills: this.player.kills,
      baseCoins,
    };
  }

  snapshot() {
    return {
      sessionId: this.sessionId,
      seed: this.seed,
      map: this.map,
      wave: this.wave,
      maxWaves: GAMEPLAY_CONFIG.battle.maxWaves,
      paused: this.paused,
      over: this.over,
      interWaveTime: this.interWaveTime,
      queuedEnemies: this.spawnQueue.length,
      player: cloneSide(this.player),
      enemies: this.enemies.filter((enemy) => !enemy.dead && !enemy.reachedEnd).map((enemy) => ({ ...enemy })),
      result: this.result ? { ...this.result } : null,
      lastEvent: this.lastEvent,
    };
  }
}

const EFFECT_HANDLERS = {
  life_bun({ session, side, rng }) {
    if (rng.next() < 0.55) {
      side.adouHp = Math.min(side.maxAdouHp, side.adouHp + 1);
      return { ok: true, message: '包子生效，阿斗续命成功' };
    }
    side.adouHp = Math.max(0, side.adouHp - 1);
    return { ok: true, message: '包子失效，阿斗失去一命' };
  },
  trap_path({ session }) {
    session.enemies.forEach((enemy) => { enemy.stunRemaining = Math.max(enemy.stunRemaining, 3); });
    return { ok: true, message: '陷阱发动，敌军停滞 3 秒' };
  },
  slow_wave({ session }) {
    session.enemies.forEach((enemy) => { enemy.slowRemaining = Math.max(enemy.slowRemaining, 5); });
    return { ok: true, message: '墨汁泼洒，敌军减速 5 秒' };
  },
  team_range({ side }) {
    side.rangeMultiplier = 2;
    return { ok: true, message: '御敌千里生效，远程射程翻倍' };
  },
  upgrade_unit({ side, target }) {
    const unit = resolveTarget(side, target);
    if (!unit || unit.kind === 'fragment' || unit.level >= GAMEPLAY_CONFIG.battle.maxUnitLevel) return { ok: false, reason: 'invalid_target' };
    unit.level += 1;
    return { ok: true, message: `${unit.char}提升一级` };
  },
  train_unit({ side, target, rng }) {
    const unit = resolveTarget(side, target);
    if (!unit || unit.kind === 'fragment') return { ok: false, reason: 'invalid_target' };
    unit.level = Math.max(1, Math.min(GAMEPLAY_CONFIG.battle.maxUnitLevel, unit.level + (rng.next() > 0.35 ? 1 : -1)));
    return { ok: true, message: '练兵完成' };
  },
  damage_wave({ session }) {
    const damage = 115 + session.wave * 18;
    session.enemies.forEach((enemy) => session.applyDamage(enemy, damage));
    return { ok: true, message: `地雷爆炸，敌军受到 ${damage} 点伤害` };
  },
  team_haste({ side }) {
    side.hasteBonus += 0.4;
    return { ok: true, message: '全军攻速提升 40%' };
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
    activeItems: [...loadout.active],
    passiveItems: [...loadout.passive],
    usedItems: [],
    equippedWeapons: [...equippedWeapons],
    hasteBonus: 0,
    rangeMultiplier: 1,
    farmerClock: 0,
    meteorReady: loadout.passive.includes('item_meteor'),
    freeLand: loadout.passive.includes('item_shovel'),
    generalChanceBonus: loadout.passive.includes('item_recruit') ? 7 : 0,
    gallery: [],
    kills: 0,
    lastAction: '等待部署',
    pool: createRecruitmentPool(),
  };
  if (loadout.passive.includes('item_farmer')) side.reserve[0] = createSoldier('farmer', rng);
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
    unit = { id: tokenId(rng), kind: 'fragment', char, level: 1, exp: 0, attackClock: 0, attackCount: 0, firstTargets: [] };
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
  return { id: tokenId(rng), kind: soldierId === 'farmer' ? 'farmer' : 'soldier', soldierId, char: soldier.char, level: 1, exp: 0, attackClock: 0, attackCount: 0, firstTargets: [] };
}

function deploy(side, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= side.reserve.length || to < 0 || to >= side.unlocked) return { ok: false, reason: 'invalid_cell' };
  const source = side.reserve[from];
  const target = side.board[to];
  if (!source) return { ok: false, reason: 'empty_source' };
  if (target) {
    const general = resolveGeneral(source, target);
    if (general) {
      side.board[to] = createGeneral(general, Math.max(source.level, target.level));
      side.reserve[from] = null;
      if (!side.gallery.includes(general.id)) side.gallery.push(general.id);
      side.lastAction = `${general.name}出阵`;
      return { ok: true, action: 'general', general };
    }
    const sameUnit = source.kind === target.kind && source.char === target.char && source.level === target.level;
    if (sameUnit && source.kind !== 'fragment' && target.level < GAMEPLAY_CONFIG.battle.maxUnitLevel) {
      const third = findThirdCopy(side, source, new Set([source.id, target.id]));
      if (!third) return { ok: false, reason: 'need_third_copy' };
      target.level += 1;
      target.attackClock = 0;
      side.reserve[from] = null;
      third.collection[third.index] = null;
      side.lastAction = `三合一：${target.char}升至 ${target.level} 级`;
      return { ok: true, action: 'merge', unit: target };
    }
    return { ok: false, reason: 'occupied' };
  }
  side.board[to] = source;
  side.reserve[from] = null;
  side.lastAction = '单位部署';
  return { ok: true, action: 'deploy' };
}

function bench(side, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= side.unlocked || to < 0 || to >= side.reserve.length) return { ok: false, reason: 'invalid_cell' };
  if (!side.board[from] || side.reserve[to]) return { ok: false, reason: 'occupied' };
  side.reserve[to] = side.board[from];
  side.board[from] = null;
  side.lastAction = '单位退回备战席';
  return { ok: true, action: 'bench' };
}

function moveReserve(side, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to || from < 0 || from >= side.reserve.length || to < 0 || to >= side.reserve.length) return { ok: false, reason: 'invalid_cell' };
  if (!side.reserve[from] || side.reserve[to]) return { ok: false, reason: 'occupied' };
  side.reserve[to] = side.reserve[from];
  side.reserve[from] = null;
  side.lastAction = '调整备战席';
  return { ok: true, action: 'move' };
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
    side.board[to] = createGeneral(general, Math.max(source.level, target.level));
    side.board[from] = null;
    if (!side.gallery.includes(general.id)) side.gallery.push(general.id);
    side.lastAction = `${general.name}出阵`;
    return { ok: true, action: 'general', general };
  }
  const sameUnit = source.kind === target.kind && source.char === target.char && source.level === target.level;
  if (sameUnit && source.kind !== 'fragment' && target.level < GAMEPLAY_CONFIG.battle.maxUnitLevel) {
    const third = findThirdCopy(side, source, new Set([source.id, target.id]));
    if (!third) return { ok: false, reason: 'need_third_copy' };
    target.level += 1;
    target.attackClock = 0;
    side.board[from] = null;
    third.collection[third.index] = null;
    side.lastAction = `三合一：${target.char}升至 ${target.level} 级`;
    return { ok: true, action: 'merge', unit: target };
  }
  return { ok: false, reason: 'illegal_merge' };
}

function findThirdCopy(side, sample, excludedIds) {
  for (const collection of [side.board, side.reserve]) {
    const index = collection.findIndex((unit) => unit
      && !excludedIds.has(unit.id)
      && unit.kind === sample.kind
      && unit.char === sample.char
      && unit.level === sample.level);
    if (index !== -1) return { collection, index };
  }
  return null;
}

function resolveGeneral(first, second) {
  if (first.kind !== 'fragment' || second.kind !== 'fragment') return null;
  return GENERALS.find((general) => general.chars.includes(first.char) && general.chars.includes(second.char) && first.char !== second.char) || null;
}

function createGeneral(general, level = 1) {
  return { id: `${general.id}_${Date.now().toString(36)}`, kind: 'general', generalId: general.id, char: general.name, level: Math.min(level, GAMEPLAY_CONFIG.battle.maxGeneralLevel), exp: 0, attackClock: 0, attackCount: 0, firstTargets: [] };
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
      const same = a.kind === b.kind && a.kind !== 'fragment' && a.char === b.char && a.level === b.level && a.level < GAMEPLAY_CONFIG.battle.maxUnitLevel;
      if (same && findThirdCopy(side, a, new Set([a.id, b.id]))) return [first, second];
    }
  }
  return null;
}

function unitCombat(unit, side) {
  if (unit.kind === 'general') {
    const general = GENERALS.find((entry) => entry.id === unit.generalId);
    const baseClass = SOLDIERS[general.classId];
    const ranged = general.classId === 'bow' || ['general_zhaoyun', 'general_machao', 'general_huangzu'].includes(general.id);
    return {
      classId: general.classId,
      attack: general.attack * (1 + (unit.level - 1) * 0.3),
      attackSpeed: (baseClass.attackSpeed + 0.08) * (1 + side.hasteBonus),
      range: (ranged ? Math.max(2.5, baseClass.range) : baseClass.range) * (ranged ? side.rangeMultiplier : 1),
    };
  }
  const soldier = SOLDIERS[unit.soldierId];
  return {
    classId: soldier.id,
    attack: soldier.attack * 1.65 ** (unit.level - 1),
    attackSpeed: soldier.attackSpeed * (1 + side.hasteBonus),
    range: soldier.range * (soldier.range >= 2.5 ? side.rangeMultiplier : 1),
  };
}

function equippedWeaponFor(unit, weaponIds) {
  const general = unit.kind === 'general' ? GENERALS.find((entry) => entry.id === unit.generalId) : null;
  const classId = general?.classId || unit.soldierId;
  const available = weaponIds.map((id) => WEAPONS.find((weapon) => weapon.id === id)).filter(Boolean);
  return available.find((weapon) => weapon.generalId && weapon.generalId === unit.generalId)
    || available.find((weapon) => !weapon.generalId && weapon.classId === classId)
    || null;
}

function sidePower(side) {
  return side.board.reduce((sum, unit) => {
    if (!unit || unit.kind === 'farmer' || unit.kind === 'fragment') return sum;
    const combat = unitCombat(unit, side);
    const weapon = equippedWeaponFor(unit, side.equippedWeapons);
    return sum + combat.attack * combat.attackSpeed * (1 + (weapon?.attackBonus || 0));
  }, 0);
}

function rewardClear(side, wave) {
  side.buns += 10 + wave * 2;
  side.board.filter((unit) => unit?.kind === 'general').forEach((unit) => {
    unit.exp += 5 + wave;
    const needed = GAMEPLAY_CONFIG.battle.generalExpCurve[unit.level] ?? Infinity;
    if (unit.level < GAMEPLAY_CONFIG.battle.maxGeneralLevel && unit.exp >= needed) {
      unit.exp -= needed;
      unit.level += 1;
    }
  });
}

function createWaveQueue(wave, rng) {
  const fixed = {
    1: ['enemy_soldier', 'enemy_soldier', 'enemy_soldier'],
    2: ['enemy_soldier', 'enemy_soldier', 'enemy_soldier', 'enemy_soldier', 'enemy_soldier'],
    3: ['enemy_soldier', 'enemy_soldier', 'enemy_archer', 'enemy_archer'],
    5: ['enemy_cavalry', 'enemy_cavalry', 'enemy_soldier', 'enemy_soldier'],
    10: ['enemy_tank', 'enemy_tank', 'enemy_soldier', 'enemy_soldier', 'enemy_archer'],
    15: ['enemy_boss', 'enemy_tank', 'enemy_soldier', 'enemy_soldier'],
    20: ['enemy_boss', 'enemy_boss', 'enemy_tank', 'enemy_tank'],
  };
  if (fixed[wave]) return [...fixed[wave]];
  const count = Math.min(12, 3 + Math.floor(wave / 2));
  return Array.from({ length: count }, () => rng.weighted([
    { value: 'enemy_soldier', weight: Math.max(26, 58 - wave * 1.5) },
    { value: 'enemy_archer', weight: 22 },
    { value: 'enemy_cavalry', weight: 10 + wave * 0.55 },
    { value: 'enemy_tank', weight: Math.max(1, wave - 4) },
  ]));
}

function positionAtProgress(path, progress) {
  const index = Math.min(path.length - 1, Math.max(0, Math.floor(progress)));
  const nextIndex = Math.min(path.length - 1, index + 1);
  const amount = Math.max(0, Math.min(1, progress - index));
  const current = path[index];
  const next = path[nextIndex];
  return [current[0] + (next[0] - current[0]) * amount, current[1] + (next[1] - current[1]) * amount];
}

function gridDistance(first, second) {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

function calculateStars(adouHp, maxAdouHp) {
  if (adouHp >= maxAdouHp) return 3;
  if (adouHp >= maxAdouHp / 2) return 2;
  return 1;
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
    board: side.board.map((unit) => unit ? { ...unit, firstTargets: [...(unit.firstTargets || [])] } : null),
    reserve: side.reserve.map((unit) => unit ? { ...unit, firstTargets: [...(unit.firstTargets || [])] } : null),
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
  positionAtProgress,
  calculateStars,
  applyStars,
});
