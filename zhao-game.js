import {
  GAMEPLAY_CONFIG,
  GENERALS,
  ITEMS,
  QUALITY_LABELS,
  RANKS,
  SOLDIERS,
  WEAPONS,
} from './game/config.mjs';
import { BattleSession, FakeAdService, GameRules, SaveService, SeededRng } from './game/core.mjs';

const game = document.querySelector('#zhaoGame');
const shell = document.querySelector('#zyGameShell');
const live = document.querySelector('#zyLive');
const openButton = document.querySelector('#openZhaoGame');

if (game && shell && openButton) {
  const saveService = new SaveService(window.localStorage);
  const adService = new FakeAdService();
  let meta = saveService.load();
  let screen = 'home';
  let previousScreen = 'home';
  let merchantTab = 'shop';
  let deckTab = 'deck';
  let battle = null;
  let battleTimer = null;
  let matchTimer = null;
  let overlay = null;
  let selected = null;
  let pendingItem = null;
  let toastTimer = null;
  let resultClaiming = false;
  let debugVisible = false;
  let pointerDrag = null;
  let suppressNextCellClick = false;

  const icons = {
    back: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"></path></svg>',
    close: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"></path></svg>',
    gear: '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.64 9 1.7 1.7 0 0 0 4.3 7.12l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3h4v.08A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08A1.7 1.7 0 0 0 19.4 15z"></path></svg>',
    pause: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"></path></svg>',
    deck: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h6M8 11h6M8 15h4"></path></svg>',
  };

  function showToast(message) {
    live.textContent = message;
    live.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => live.classList.remove('is-visible'), 1800);
  }

  function openGame() {
    meta = saveService.load();
    game.hidden = false;
    document.body.classList.add('zy-game-open');
    go('home');
  }

  function closeGame() {
    stopBattleClock();
    clearTimeout(matchTimer);
    if (battle && !battle.over) battle.setPaused(true);
    game.hidden = true;
    document.body.classList.remove('zy-game-open');
    openButton.focus();
  }

  function go(next) {
    stopBattleClock();
    clearTimeout(matchTimer);
    previousScreen = screen;
    screen = next;
    overlay = null;
    selected = null;
    pendingItem = null;
    render();
  }

  function render() {
    if (screen === 'home') renderHome();
    else if (screen === 'merchant') renderMerchant();
    else if (screen === 'weapons') renderWeapons();
    else if (screen === 'settings') renderSettings();
    else if (screen === 'match') renderMatch();
    else if (screen === 'battle') renderBattle();
    else if (screen === 'result') renderResult();
  }

  function pageBar(title, right = '') {
    return `<header class="zy-page-bar">
      <button class="zy-icon-button" data-action="back" type="button" aria-label="返回">${icons.back}</button>
      <h1>${title}</h1>
      ${right || '<span></span>'}
    </header>`;
  }

  function renderHome() {
    const rank = RANKS[meta.rank.tierIndex];
    const stars = Array.from({ length: rank.starsToAdvance }, (_, index) => index < meta.rank.stars ? '◆' : '◇').join('');
    shell.innerHTML = `<main class="zy-screen zy-home" aria-label="游戏主页">
      <header class="zy-home-top">
        <button class="zy-icon-button" data-action="exit-app" type="button" aria-label="退出游戏">${icons.back}</button>
        <span></span>
        <div class="zy-meta-resources">
          <div class="zy-resource-pill"><i>金</i><b>${meta.coins}</b></div>
          <button class="zy-resource-pill energy" data-action="refill-energy" type="button" aria-label="补充体力"><i>力</i><b>${meta.energy}/${GAMEPLAY_CONFIG.meta.maxEnergy}</b></button>
          <button class="zy-icon-button" data-action="settings" type="button" aria-label="设置">${icons.gear}</button>
        </div>
      </header>
      <div class="zy-home-art">
        <section class="zy-title-mark">
          <small>汉字合成策略塔防</small>
          <h2>赵云与阿斗</h2>
          <p>一身是胆 · 长坂救主</p>
        </section>
        <section class="zy-rank-seal" aria-label="当前段位 ${rank.name}">
          <div><small>当前军职</small><strong>${rank.name}</strong><span class="zy-stars">${stars}</span></div>
        </section>
        <div class="zy-home-actions">
          <button class="zy-primary-button" data-action="start-match" type="button">开始游戏 · 体力 ${GAMEPLAY_CONFIG.meta.battleEnergyCost}</button>
          <div class="zy-secondary-actions">
            <button class="zy-secondary-button" data-action="merchant" type="button"><span>商</span>神秘商人</button>
            <button class="zy-secondary-button" data-action="weapons" type="button"><span>兵</span>武器背包</button>
          </div>
        </div>
      </div>
      <footer class="zy-version">REFERENCE 2026.08 · 本地存档</footer>
    </main>`;
  }

  function dailyShopItems() {
    const rng = new SeededRng(meta.daily.shopSeed);
    const pool = [...ITEMS];
    const selectedItems = [];
    while (pool.length && selectedItems.length < 5) selectedItems.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
    return selectedItems;
  }

  function renderMerchant() {
    const shopItems = dailyShopItems();
    const cards = shopItems.map((item) => {
      const owned = meta.daily.ownedItems.includes(item.id);
      const equipped = meta.daily.activeLoadout.includes(item.id) || meta.daily.passiveLoadout.includes(item.id);
      const action = !owned ? `购买 ${item.price}` : equipped ? '卸下' : '装备';
      return `<article class="zy-shop-card quality-${item.quality}">
        <div class="zy-quality-icon">${item.name[0]}</div>
        <div class="zy-card-copy"><small>${QUALITY_LABELS[item.quality]} · ${item.type === 'active' ? '主动' : '被动'}</small><strong>${item.name}</strong><span>${item.description}</span></div>
        <button class="zy-card-action${equipped ? ' is-equipped' : ''}" data-action="shop-item" data-id="${item.id}" type="button">${action}</button>
      </article>`;
    }).join('');
    const lottery = `<section class="zy-panel" style="margin:18px auto;box-shadow:none">
      <h2>今日抽奖</h2><p>从今日道具池随机获得一件尚未拥有的道具。抽奖结果会保存到今日结束。</p>
      <button class="zy-primary-button" data-action="lottery" type="button">抽取一次 · 金币 100</button>
    </section>`;
    shell.innerHTML = `<main class="zy-screen" aria-label="神秘商人">
      ${pageBar('神秘商人')}
      <nav class="zy-tabbar" aria-label="商人标签"><button class="zy-tab${merchantTab === 'shop' ? ' is-active' : ''}" data-action="merchant-tab" data-tab="shop">商店</button><button class="zy-tab${merchantTab === 'lottery' ? ' is-active' : ''}" data-action="merchant-tab" data-tab="lottery">抽奖</button></nav>
      <div class="zy-scroll zy-section-body">
        ${merchantTab === 'shop' ? `<div class="zy-shop-grid">${cards}</div>` : lottery}
        ${loadoutHtml()}
        <p class="zy-daily-note">今日道具将在本地日期 00:00 重置，永久武器不受影响。</p>
      </div>
    </main>`;
  }

  function loadoutHtml() {
    const slots = [];
    for (let index = 0; index < GAMEPLAY_CONFIG.battle.activeItemSlots; index += 1) {
      const item = ITEMS.find((entry) => entry.id === meta.daily.activeLoadout[index]);
      slots.push(`<span class="zy-loadout-slot${item ? ' is-filled' : ''}">${item ? item.name : '主动空位'}</span>`);
    }
    for (let index = 0; index < GAMEPLAY_CONFIG.battle.passiveItemSlots; index += 1) {
      const item = ITEMS.find((entry) => entry.id === meta.daily.passiveLoadout[index]);
      slots.push(`<span class="zy-loadout-slot${item ? ' is-filled' : ''}">${item ? item.name : '被动空位'}</span>`);
    }
    return `<div class="zy-subheading"><strong>我的道具</strong><span>主动 2 · 被动 6</span></div><div class="zy-loadout">${slots.join('')}</div>`;
  }

  function renderWeapons() {
    const owned = WEAPONS.filter((weapon) => meta.ownedWeapons.includes(weapon.id));
    shell.innerHTML = `<main class="zy-screen" aria-label="武器背包">
      ${pageBar('武器背包')}
      <div class="zy-scroll zy-section-body">
        <div class="zy-subheading" style="margin-top:0"><strong>永久武器</strong><span>已装备 ${meta.equippedWeapons.length}/2</span></div>
        <div class="zy-weapon-list">${owned.map((weapon) => weaponCard(weapon)).join('')}</div>
        <div class="zy-subheading"><strong>尚未获得</strong><span>${WEAPONS.length - owned.length}</span></div>
        <div class="zy-weapon-list">${WEAPONS.filter((weapon) => !meta.ownedWeapons.includes(weapon.id)).map((weapon) => weaponCard(weapon, true)).join('')}</div>
      </div>
    </main>`;
  }

  function weaponCard(weapon, locked = false) {
    const equipped = meta.equippedWeapons.includes(weapon.id);
    const quality = weapon.quality;
    return `<article class="zy-weapon-card quality-${quality}"${locked ? ' style="opacity:.45"' : ''}>
      <div class="zy-quality-icon">${weapon.name.at(-1)}</div>
      <div class="zy-card-copy"><small>${QUALITY_LABELS[quality]} · ${Math.round(weapon.attackBonus * 100)}% 攻击</small><strong>${weapon.name}</strong><span>${weapon.effect}</span></div>
      <button class="zy-card-action${equipped ? ' is-equipped' : ''}" data-action="weapon" data-id="${weapon.id}" type="button" ${locked ? 'disabled' : ''}>${locked ? '未获得' : equipped ? '卸下' : '装备'}</button>
    </article>`;
  }

  function renderSettings() {
    const rows = [
      ['music', '音乐'], ['sound', '音效'], ['vibration', '振动反馈'], ['showHealth', '显示生命条'],
    ].map(([key, label]) => `<div class="zy-setting-row"><span>${label}</span><button class="zy-switch${meta.settings[key] ? ' is-on' : ''}" data-action="toggle-setting" data-key="${key}" type="button" role="switch" aria-checked="${meta.settings[key]}"></button></div>`).join('');
    shell.innerHTML = `<main class="zy-screen" aria-label="游戏设置">${pageBar('设置')}<div class="zy-scroll zy-section-body">${rows}<p class="zy-daily-note">设置会保存在当前浏览器中。</p></div></main>`;
  }

  function beginMatch() {
    if (battle && !battle.over && screen === 'match') return;
    if (meta.energy < GAMEPLAY_CONFIG.meta.battleEnergyCost) {
      showToast('体力不足，点击顶部体力可补充');
      return;
    }
    meta.energy -= GAMEPLAY_CONFIG.meta.battleEnergyCost;
    meta.lastEnergyAt = new Date().toISOString();
    saveService.save(meta);
    battle = new BattleSession({
      seed: (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0,
      playerLoadout: { active: meta.daily.activeLoadout, passive: meta.daily.passiveLoadout },
      equippedWeapons: meta.equippedWeapons,
    });
    go('match');
    matchTimer = window.setTimeout(startBattle, 1700);
  }

  function renderMatch() {
    const rank = RANKS[meta.rank.tierIndex];
    shell.innerHTML = `<main class="zy-screen zy-match" aria-label="匹配完成">
      <h1>匹配完成</h1>
      <section class="zy-match-player"><div class="zy-match-avatar">赵</div><div><strong>常山赵子龙</strong><span>${rank.name} · 本局技能 ${meta.daily.activeLoadout.length + meta.daily.passiveLoadout.length}</span></div></section>
      <div class="zy-vs">VS</div>
      <section class="zy-match-player is-opponent"><div><strong>${battle.profile.name}</strong><span>${battle.profile.rank} · 胜率 ${battle.profile.winRate}</span></div><div class="zy-match-avatar">${battle.profile.avatar}</div></section>
      <button class="zy-primary-button" data-action="skip-match" type="button">进入战场</button>
    </main>`;
  }

  function startBattle() {
    clearTimeout(matchTimer);
    if (!battle || battle.over) return;
    screen = 'battle';
    battle.setPaused(false);
    renderBattle();
    startBattleClock();
  }

  function startBattleClock() {
    stopBattleClock();
    battleTimer = window.setInterval(() => {
      if (!battle || battle.paused || battle.over) return;
      battle.tick(GAMEPLAY_CONFIG.battle.tickMs / 1000);
      if (battle.over) {
        stopBattleClock();
        go('result');
      } else if (screen === 'battle' && !overlay && !pointerDrag) {
        renderBattle();
      }
    }, GAMEPLAY_CONFIG.battle.tickMs);
  }

  function stopBattleClock() {
    if (battleTimer) window.clearInterval(battleTimer);
    battleTimer = null;
  }

  function renderBattle() {
    const snapshot = battle.snapshot();
    shell.innerHTML = `<main class="zy-screen zy-battle" aria-label="战斗">
      <header class="zy-battle-hud">
        <button class="zy-icon-button" data-action="pause" type="button" aria-label="暂停">${icons.pause}</button>
        <div class="zy-battle-title"><small>${snapshot.map.name}</small><strong>${snapshot.enemy.boss ? `BOSS · ${snapshot.enemy.name}` : snapshot.enemy.name}</strong></div>
        <span class="zy-wave-chip">第 ${snapshot.wave} 波 · ${Math.max(0, Math.ceil(snapshot.waveTime))}s</span>
        <button class="zy-icon-button" data-action="deck" type="button" aria-label="牌库与图鉴">${icons.deck}</button>
      </header>
      <div class="zy-battle-main">
        <section class="zy-opponent-zone" aria-label="对手战场">
          ${sideMetaHtml(snapshot.opponent, snapshot.profile.name, true)}
          <div class="zy-mini-board">${miniBoardHtml(snapshot.opponent)}</div>
        </section>
        <section class="zy-wave-zone" aria-label="波次压力">
          <div class="zy-wave-row"><span>我方防线</span><strong>${snapshot.enemy.name}</strong><span>对手防线</span></div>
          <div class="zy-dual-bars"><div class="zy-pressure"><span style="transform:scaleX(${pressureRatio(snapshot.player)})"></span></div><div class="zy-pressure is-ai"><span style="transform:scaleX(${pressureRatio(snapshot.opponent)})"></span></div></div>
          <div class="zy-event-line">${snapshot.lastEvent}</div>
        </section>
        <section class="zy-player-zone" aria-label="玩家战场">
          <div class="zy-player-heading"><span>我方阵地 · 战力 <strong>${Math.round(GameRules.sidePower(battle.player))}</strong></span><span>${heartsHtml(snapshot.player.adouHp, snapshot.player.maxAdouHp)} 阿斗</span></div>
          <div class="zy-board">${boardHtml(snapshot.player)}</div>
          <div class="zy-reserve-row"><div class="zy-reserve-label">备战<br>${snapshot.player.reserve.filter(Boolean).length}/5</div>${reserveHtml(snapshot.player)}</div>
        </section>
      </div>
      <footer class="zy-command-bar" aria-label="战斗操作">
        <button class="zy-command" data-action="recruit" type="button" ${canRecruit(snapshot.player) ? '' : 'disabled'}><span class="zy-command-symbol">兵</span><strong>征兵</strong><small>馒 ${GameRules.currentRecruitCost(snapshot.player)} · 现有 ${Math.floor(snapshot.player.buns)}</small></button>
        <button class="zy-command" data-action="open-land" type="button" ${canOpenLand(snapshot.player) ? '' : 'disabled'}><span class="zy-command-symbol">铲</span><strong>扩地</strong><small>馒 ${GameRules.currentLandCost(snapshot.player)}</small></button>
        <button class="zy-command" data-action="use-item-menu" type="button" ${snapshot.player.activeItems.every((id) => snapshot.player.usedItems.includes(id)) ? 'disabled' : ''}><span class="zy-command-symbol">技</span><strong>技能</strong><small>${snapshot.player.activeItems.length} 个</small></button>
        <button class="zy-command" data-action="recycle" type="button" ${selected ? '' : 'disabled'}><span class="zy-command-symbol">炉</span><strong>回收</strong><small>选中单位</small></button>
      </footer>
      ${overlayHtml(snapshot)}
    </main>`;
  }

  function sideMetaHtml(side, name, opponent = false) {
    return `<div class="zy-side-meta"><span class="zy-adou">斗</span><div class="zy-hearts">${heartsHtml(side.adouHp, side.maxAdouHp)}</div><small>${name}<br>馒 ${Math.floor(side.buns)}</small></div>`;
  }

  function miniBoardHtml(side) {
    return side.board.slice(0, 10).map((unit) => `<div class="zy-mini-cell">${unit ? `${unit.char}<small>${unit.level}</small>` : ''}</div>`).join('');
  }

  function boardHtml(side) {
    return side.board.map((unit, index) => {
      if (index >= side.unlocked) return `<button class="zy-cell is-locked" type="button" disabled aria-label="未开垦阵地"></button>`;
      const isSelected = selected?.location === 'board' && selected.index === index;
      return `<button class="zy-cell${isSelected ? ' is-selected' : ''}" data-action="cell" data-location="board" data-index="${index}" data-occupied="${Boolean(unit)}" type="button" aria-label="${unit ? unit.char : `空阵地 ${index + 1}`}">${unitHtml(unit)}</button>`;
    }).join('');
  }

  function reserveHtml(side) {
    return side.reserve.map((unit, index) => {
      const isSelected = selected?.location === 'reserve' && selected.index === index;
      return `<button class="zy-reserve-cell${isSelected ? ' is-selected' : ''}" data-action="cell" data-location="reserve" data-index="${index}" data-occupied="${Boolean(unit)}" type="button" aria-label="${unit ? unit.char : `空备战位 ${index + 1}`}">${unitHtml(unit)}</button>`;
    }).join('');
  }

  function unitHtml(unit) {
    if (!unit) return '';
    const expNeeded = GAMEPLAY_CONFIG.battle.generalExpCurve[unit.level] || 1;
    const exp = unit.kind === 'general' ? `<span class="zy-exp"><span style="width:${Math.min(100, unit.exp / expNeeded * 100)}%"></span></span>` : '';
    return `<span class="zy-unit" data-kind="${unit.kind}">${unit.char}<small class="zy-level">Lv.${unit.level}</small>${exp}</span>`;
  }

  function heartsHtml(count, max = GAMEPLAY_CONFIG.battle.initialAdouHp) {
    return Array.from({ length: max }, (_, index) => `<span class="zy-heart${index >= count ? ' is-lost' : ''}">♥</span>`).join('');
  }

  function pressureRatio(side) {
    return Math.max(0, Math.min(1, side.pressureHp / side.pressureMaxHp));
  }

  function canRecruit(side) {
    return side.buns >= GameRules.currentRecruitCost(side) && side.reserve.some((unit) => !unit);
  }

  function canOpenLand(side) {
    return side.unlocked < GAMEPLAY_CONFIG.battle.boardSize && (side.freeLand || side.buns >= GameRules.currentLandCost(side));
  }

  function overlayHtml(snapshot) {
    if (!overlay) return '';
    if (overlay === 'pause') return pauseOverlay();
    if (overlay === 'deck') return deckOverlay(snapshot);
    if (overlay === 'items') return itemOverlay(snapshot);
    if (overlay === 'debug') return debugOverlay(snapshot);
    return '';
  }

  function pauseOverlay() {
    return `<div class="zy-overlay" role="dialog" aria-modal="true" aria-label="暂停"><div class="zy-panel"><h2>战斗暂停</h2><p>波次、敌军、AI、农民产出与技能计时均已冻结。</p><div class="zy-pause-actions"><button class="zy-primary-button" data-action="resume" type="button">继续战斗</button><button class="zy-secondary-button" data-action="settings-from-battle" type="button">战斗设置</button><button class="zy-text-button" data-action="quit-battle" type="button">退出本局</button></div></div></div>`;
  }

  function deckOverlay(snapshot) {
    const weights = Object.entries(GAMEPLAY_CONFIG.recruitment.baseWeights).map(([id, weight]) => `<div class="zy-probability"><strong>${SOLDIERS[id].char}</strong><small>${weight}%</small></div>`).join('');
    const pool = Object.entries(snapshot.player.pool).map(([char, count]) => `<span class="zy-pool-char" style="position:relative;opacity:${count ? 1 : 0.35}">${char}<small>${count}</small></span>`).join('');
    const gallery = GENERALS.map((general) => `<article class="zy-general-entry${snapshot.player.gallery.includes(general.id) ? '' : ' is-locked'}"><strong>${general.name}</strong><small>${general.chars.join(' + ')}</small><small>${general.skill}</small></article>`).join('');
    return `<div class="zy-overlay" role="dialog" aria-modal="true" aria-label="牌库与图鉴"><div class="zy-panel">
      <h2>${deckTab === 'deck' ? '牌库' : '图鉴'}</h2>
      <nav class="zy-tabbar" style="margin:0 -24px 18px"><button class="zy-tab${deckTab === 'deck' ? ' is-active' : ''}" data-action="deck-tab" data-tab="deck">牌库</button><button class="zy-tab${deckTab === 'gallery' ? ' is-active' : ''}" data-action="deck-tab" data-tab="gallery">图鉴</button></nav>
      ${deckTab === 'deck' ? `<div class="zy-deck-probabilities">${weights}<div class="zy-probability"><strong>将</strong><small>${(GAMEPLAY_CONFIG.recruitment.generalChance + snapshot.player.generalChanceBonus).toFixed(1)}%</small></div></div><div class="zy-subheading"><strong>剩余武将文字</strong><span>有限牌池</span></div><div class="zy-char-pool">${pool}</div>` : `<div class="zy-gallery-grid">${gallery}</div>`}
      <button class="zy-primary-button" data-action="close-overlay" type="button">返回战场</button>
    </div></div>`;
  }

  function itemOverlay(snapshot) {
    const available = snapshot.player.activeItems.filter((id) => !snapshot.player.usedItems.includes(id));
    return `<div class="zy-overlay" role="dialog" aria-modal="true" aria-label="主动技能"><div class="zy-panel"><h2>主动技能</h2><p>目标型技能选中后，再点击一个单位施放。</p><div class="zy-shop-grid">${available.map((id) => {
      const item = ITEMS.find((entry) => entry.id === id);
      return `<article class="zy-shop-card quality-${item.quality}"><div class="zy-quality-icon">${item.name[0]}</div><div class="zy-card-copy"><strong>${item.name}</strong><span>${item.description}</span></div><button class="zy-card-action" data-action="use-item" data-id="${item.id}">使用</button></article>`;
    }).join('') || '<p class="zy-daily-note">本局没有可用主动技能。</p>'}</div><button class="zy-text-button" data-action="close-overlay">返回战场</button></div></div>`;
  }

  function debugOverlay(snapshot) {
    return `<div class="zy-overlay" role="dialog" aria-modal="true" aria-label="调试信息"><div class="zy-panel"><h2>Debug Overlay</h2><p style="text-align:left;font-family:ui-monospace,monospace;white-space:pre-wrap">seed: ${snapshot.seed}\nsession: ${snapshot.sessionId}\nwave: ${snapshot.wave} / ${snapshot.waveTime.toFixed(2)}s\nplayer buns: ${snapshot.player.buns.toFixed(1)}\nopponent buns: ${snapshot.opponent.buns.toFixed(1)}\nplayer units: ${snapshot.player.board.filter(Boolean).length}\nopponent units: ${snapshot.opponent.board.filter(Boolean).length}\nAI action: ${snapshot.opponent.lastAction}\nconfig: ${GAMEPLAY_CONFIG.version}</p><button class="zy-primary-button" data-action="close-overlay">关闭</button></div></div>`;
  }

  function renderResult() {
    const result = battle.result;
    const alreadyClaimed = meta.claimedSessions.includes(result.sessionId);
    shell.innerHTML = `<main class="zy-screen zy-match" aria-label="战斗结算">
      <section class="zy-panel" style="box-shadow:none">
        <div class="zy-result-seal">${result.victory ? '胜利' : '败北'}</div>
        <h2>${result.victory ? '守住了阿斗' : '阿斗失守'}</h2>
        <p>${battle.map.name} · ${battle.profile.name}</p>
        <div class="zy-result-stats"><span>抵御波次<b>${result.clearedWaves}</b></span><span>最高战力<b>${result.maxPower}</b></span><span>基础金币<b>${result.baseCoins}</b></span></div>
        <button class="zy-primary-button" data-action="claim-result" type="button" ${alreadyClaimed ? 'disabled' : ''}>${alreadyClaimed ? '奖励已领取' : `领取奖励 · 金币 ${result.baseCoins}`}</button>
        <button class="zy-secondary-button" style="width:100%;margin-top:9px" data-action="double-result" type="button" ${alreadyClaimed ? 'disabled' : ''}>观看模拟广告 · 双倍金币</button>
        <button class="zy-text-button" data-action="result-home" type="button">返回主页</button>
      </section>
    </main>`;
  }

  function back() {
    if (screen === 'home') closeGame();
    else if (screen === 'settings' && battle && !battle.over && previousScreen === 'battle') {
      screen = 'battle';
      battle.setPaused(false);
      overlay = null;
      renderBattle();
      startBattleClock();
    } else go('home');
  }

  function buyOrEquipItem(id) {
    const item = ITEMS.find((entry) => entry.id === id);
    if (!item) return;
    const owned = meta.daily.ownedItems.includes(id);
    const loadoutKey = item.type === 'active' ? 'activeLoadout' : 'passiveLoadout';
    const limit = item.type === 'active' ? GAMEPLAY_CONFIG.battle.activeItemSlots : GAMEPLAY_CONFIG.battle.passiveItemSlots;
    const equipped = meta.daily[loadoutKey].includes(id);
    if (!owned) {
      if (meta.coins < item.price) return showToast('金币不足');
      meta.coins -= item.price;
      meta.daily.ownedItems.push(id);
      showToast(`已购入${item.name}`);
    } else if (equipped) {
      meta.daily[loadoutKey] = meta.daily[loadoutKey].filter((entry) => entry !== id);
    } else {
      if (meta.daily[loadoutKey].length >= limit) return showToast(`${item.type === 'active' ? '主动' : '被动'}槽已满，请先卸下一件`);
      meta.daily[loadoutKey].push(id);
    }
    saveService.save(meta);
    renderMerchant();
  }

  function lottery() {
    if (meta.coins < 100) return showToast('金币不足');
    const candidates = ITEMS.filter((item) => !meta.daily.ownedItems.includes(item.id));
    if (!candidates.length) return showToast('今日道具已全部获得');
    meta.coins -= 100;
    const rng = new SeededRng(meta.daily.shopSeed ^ meta.coins ^ meta.daily.ownedItems.length);
    const item = rng.pick(candidates);
    meta.daily.ownedItems.push(item.id);
    saveService.save(meta);
    showToast(`抽得「${item.name}」`);
    renderMerchant();
  }

  function toggleWeapon(id) {
    if (!meta.ownedWeapons.includes(id)) return;
    if (meta.equippedWeapons.includes(id)) meta.equippedWeapons = meta.equippedWeapons.filter((entry) => entry !== id);
    else if (meta.equippedWeapons.length >= 2) return showToast('最多装备两件武器');
    else meta.equippedWeapons.push(id);
    saveService.save(meta);
    renderWeapons();
  }

  async function refillEnergy() {
    if (meta.energy >= GAMEPLAY_CONFIG.meta.maxEnergy) return showToast('体力已经满了');
    showToast('正在播放模拟奖励广告');
    const result = await adService.showRewarded('energy_refill');
    if (result.rewarded) {
      meta.energy = Math.min(GAMEPLAY_CONFIG.meta.maxEnergy, meta.energy + 5);
      saveService.save(meta);
      renderHome();
      showToast('体力 +5');
    }
  }

  function handleCell(location, index) {
    if (pendingItem) {
      const result = battle.executeCommand('player', { type: 'UseItem', itemId: pendingItem, target: { location, index } });
      pendingItem = null;
      showToast(result.message || '该目标无法使用此技能');
      renderBattle();
      return;
    }
    const side = battle.player;
    const collection = location === 'reserve' ? side.reserve : side.board;
    const unit = collection[index];
    if (!selected) {
      if (unit) selected = { location, index };
      renderBattle();
      return;
    }
    if (selected.location === location && selected.index === index) {
      selected = null;
      renderBattle();
      return;
    }
    let result;
    if (selected.location === 'reserve' && location === 'board') result = battle.executeCommand('player', { type: 'Deploy', from: selected.index, to: index });
    else if (selected.location === 'board' && location === 'board') result = battle.executeCommand('player', { type: 'Move', from: selected.index, to: index });
    else result = { ok: false, reason: 'invalid_move' };
    if (!result.ok) showToast(result.reason === 'illegal_merge' ? '这两个文字不能合成' : '无法放到这里');
    else showToast(result.general ? `${result.general.name}出阵` : result.action === 'merge' ? '合成升级' : '部署完成');
    selected = null;
    renderBattle();
  }

  function useItem(id) {
    const item = ITEMS.find((entry) => entry.id === id);
    if (['item_mine', 'item_haste'].includes(id)) {
      battle.setPaused(false);
      const result = battle.executeCommand('player', { type: 'UseItem', itemId: id, target: null });
      overlay = null;
      showToast(result.message || '技能无法使用');
      renderBattle();
      return;
    }
    pendingItem = id;
    overlay = null;
    battle.setPaused(false);
    showToast(`请选择${item.name}的目标单位`);
    renderBattle();
    startBattleClock();
  }

  async function claimResult(double = false) {
    if (resultClaiming || meta.claimedSessions.includes(battle.result.sessionId)) return;
    resultClaiming = true;
    let multiplier = 1;
    if (double) {
      battle.setPaused(true);
      const ad = await adService.showRewarded('result_double_coin');
      if (ad.rewarded) multiplier = 2;
    }
    const claim = saveService.claimResult(meta, battle.result, multiplier);
    resultClaiming = false;
    if (claim.claimed) showToast(`金币 +${claim.coins} · 星数 ${claim.stars >= 0 ? '+' : ''}${claim.stars}`);
    renderResult();
  }

  shell.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'exit-app') closeGame();
    else if (action === 'back') back();
    else if (action === 'settings') go('settings');
    else if (action === 'merchant') go('merchant');
    else if (action === 'weapons') go('weapons');
    else if (action === 'refill-energy') refillEnergy();
    else if (action === 'start-match') beginMatch();
    else if (action === 'merchant-tab') { merchantTab = button.dataset.tab; renderMerchant(); }
    else if (action === 'shop-item') buyOrEquipItem(button.dataset.id);
    else if (action === 'lottery') lottery();
    else if (action === 'weapon') toggleWeapon(button.dataset.id);
    else if (action === 'toggle-setting') {
      const key = button.dataset.key;
      meta.settings[key] = !meta.settings[key];
      saveService.save(meta);
      renderSettings();
    }
    else if (action === 'skip-match') startBattle();
    else if (action === 'pause') { battle.setPaused(true); overlay = 'pause'; renderBattle(); }
    else if (action === 'resume') { battle.setPaused(false); overlay = null; renderBattle(); startBattleClock(); }
    else if (action === 'settings-from-battle') { previousScreen = 'battle'; screen = 'settings'; renderSettings(); }
    else if (action === 'quit-battle') { battle.finish(false); go('result'); }
    else if (action === 'deck') { battle.setPaused(true); overlay = 'deck'; renderBattle(); }
    else if (action === 'deck-tab') { deckTab = button.dataset.tab; renderBattle(); }
    else if (action === 'close-overlay') { overlay = null; debugVisible = false; battle.setPaused(false); renderBattle(); startBattleClock(); }
    else if (action === 'recruit') {
      const result = battle.executeCommand('player', { type: 'Recruit' });
      showToast(result.ok ? `征得「${result.unit.char}」` : result.reason === 'reserve_full' ? '备战栏已满' : '馒头不足');
      renderBattle();
    }
    else if (action === 'open-land') {
      const result = battle.executeCommand('player', { type: 'OpenLand' });
      showToast(result.ok ? '开垦一格阵地' : '暂时无法扩地');
      renderBattle();
    }
    else if (action === 'cell') {
      if (suppressNextCellClick) suppressNextCellClick = false;
      else handleCell(button.dataset.location, Number(button.dataset.index));
    }
    else if (action === 'recycle' && selected) {
      const result = battle.executeCommand('player', { type: 'Recycle', location: selected.location, index: selected.index });
      selected = null;
      showToast(result.ok ? `回收获得馒头 ${result.refund}` : '无法回收');
      renderBattle();
    }
    else if (action === 'use-item-menu') { battle.setPaused(true); overlay = 'items'; renderBattle(); }
    else if (action === 'use-item') useItem(button.dataset.id);
    else if (action === 'claim-result') claimResult(false);
    else if (action === 'double-result') claimResult(true);
    else if (action === 'result-home') go('home');
  });

  shell.addEventListener('pointerdown', (event) => {
    const cell = event.target.closest('[data-action="cell"][data-occupied="true"]');
    if (!cell || screen !== 'battle' || overlay) return;
    pointerDrag = {
      pointerId: event.pointerId,
      source: { location: cell.dataset.location, index: Number(cell.dataset.index) },
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    cell.setPointerCapture?.(event.pointerId);
  });

  shell.addEventListener('pointermove', (event) => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) > 10) {
      pointerDrag.moved = true;
      shell.querySelectorAll('.is-drag-over').forEach((element) => element.classList.remove('is-drag-over'));
      document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-action="cell"]')?.classList.add('is-drag-over');
    }
  });

  shell.addEventListener('pointerup', (event) => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    const drag = pointerDrag;
    pointerDrag = null;
    shell.querySelectorAll('.is-drag-over').forEach((element) => element.classList.remove('is-drag-over'));
    if (!drag.moved) return;
    suppressNextCellClick = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-action="cell"]');
    if (!target) return;
    selected = drag.source;
    handleCell(target.dataset.location, Number(target.dataset.index));
  });

  openButton.addEventListener('click', openGame);
  document.addEventListener('keydown', (event) => {
    if (game.hidden) return;
    if (event.key === 'F1' && screen === 'battle') {
      event.preventDefault();
      debugVisible = !debugVisible;
      battle.setPaused(debugVisible);
      overlay = debugVisible ? 'debug' : null;
      renderBattle();
      if (!debugVisible) startBattleClock();
    } else if (event.key === 'Escape') {
      if (overlay && screen === 'battle') {
        overlay = null;
        battle.setPaused(false);
        renderBattle();
        startBattleClock();
      } else if (screen !== 'home') back();
      else closeGame();
    }
  });
}
