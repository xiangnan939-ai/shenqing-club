(() => {
  const game = document.querySelector('#zhaoGame');
  const shell = game?.querySelector('.zy-game-shell');
  const openButton = document.querySelector('#openZhaoGame');
  const closeButton = document.querySelector('#closeZhaoGame');
  const restartButton = document.querySelector('#restartZhaoGame');
  const introModal = document.querySelector('#zyIntroModal');
  const resultModal = document.querySelector('#zyResultModal');
  const startButton = document.querySelector('#startZhaoGame');
  const playAgainButton = document.querySelector('#zyPlayAgain');
  const leaveResultButton = document.querySelector('#zyLeaveResult');
  const board = document.querySelector('#zyPlayerBoard');
  const enemyRanks = document.querySelector('#zyEnemyRanks');
  const recruitButton = document.querySelector('#zyRecruit');
  const shovelButton = document.querySelector('#zyShovel');
  const heroButton = document.querySelector('#zySeekHero');

  if (!game || !openButton) return;

  const ui = {
    buns: document.querySelector('#zyBuns'),
    wave: document.querySelector('#zyWaveLabel'),
    playerHearts: document.querySelector('#zyPlayerHearts'),
    enemyHearts: document.querySelector('#zyEnemyHearts'),
    enemyType: document.querySelector('#zyEnemyType'),
    timer: document.querySelector('#zyBattleTimer'),
    health: document.querySelector('#zyEnemyHealthBar'),
    message: document.querySelector('#zyBattleMessage'),
    power: document.querySelector('#zyPowerLabel'),
    recruitCost: document.querySelector('#zyRecruitCost'),
    shovelCost: document.querySelector('#zyShovelCost'),
    heroCost: document.querySelector('#zyHeroCost'),
    resultTitle: document.querySelector('#zyResultTitle'),
    resultEyebrow: document.querySelector('#zyResultEyebrow'),
    resultWaves: document.querySelector('#zyResultWaves'),
    resultPower: document.querySelector('#zyResultPower'),
  };

  const soldierTypes = ['刀', '枪', '骑', '弓'];
  const fragmentTypes = ['赵', '云', '关', '羽', '张', '飞', '黄', '忠'];
  const heroPairs = [
    { first: '赵', second: '云', name: '赵云', power: 45 },
    { first: '关', second: '羽', name: '关羽', power: 42 },
    { first: '张', second: '飞', name: '张飞', power: 40 },
    { first: '黄', second: '忠', name: '黄忠', power: 44 },
  ];
  const soldierPower = { 刀: 7, 枪: 9, 骑: 8, 弓: 10 };
  const enemyNames = ['黄巾 · 刀兵', '虎豹 · 骑兵', '长弓 · 弓兵', '铁甲 · 枪兵'];
  const enemySymbols = ['刀', '骑', '弓', '枪'];
  const BOARD_SIZE = 15;
  const INITIAL_UNLOCKED = 8;
  const WAVE_SECONDS = 13;
  let timerId;
  let state;
  let selectedIndex = null;
  let dragIndex = null;
  let lastTick = 0;
  let incomeClock = 0;
  let attackClock = 0;
  let nextWaveClock = 0;

  function freshState() {
    return {
      active: false,
      over: false,
      wave: 1,
      buns: 40,
      playerHearts: 3,
      enemyHearts: 3,
      recruitCost: 10,
      shovelCost: 24,
      heroCost: 32,
      recruits: 0,
      unlocked: INITIAL_UNLOCKED,
      units: Array(BOARD_SIZE).fill(null),
      enemyMaxHealth: 62,
      enemyHealth: 62,
      timeLeft: WAVE_SECONDS,
      highestPower: 0,
      pendingWave: false,
      clearedWaves: 0,
    };
  }

  function unitPower(unit) {
    if (!unit) return 0;
    if (unit.kind === 'hero') return unit.power * (1 + (unit.level - 1) * 0.75);
    if (unit.kind === 'fragment') return 0;
    return soldierPower[unit.type] * 2 ** (unit.level - 1);
  }

  function totalPower() {
    return Math.round(state.units.reduce((sum, unit) => sum + unitPower(unit), 0));
  }

  function battlePower() {
    const enemyType = enemySymbols[(state.wave - 1) % enemySymbols.length];
    return state.units.reduce((sum, unit) => {
      if (!unit) return sum;
      let multiplier = 1;
      if (unit.kind === 'soldier') {
        const countersEnemy =
          (enemyType === '弓' && (unit.type === '刀' || unit.type === '枪')) ||
          (enemyType === '骑' && unit.type === '弓') ||
          ((enemyType === '刀' || enemyType === '枪') && unit.type === '骑');
        const counteredByEnemy =
          (unit.type === '弓' && (enemyType === '刀' || enemyType === '枪')) ||
          (unit.type === '骑' && enemyType === '弓') ||
          ((unit.type === '刀' || unit.type === '枪') && enemyType === '骑');
        if (countersEnemy) multiplier = 1.35;
        else if (counteredByEnemy) multiplier = 0.78;
      }
      return sum + unitPower(unit) * multiplier;
    }, 0);
  }

  function emptyUnlockedCells() {
    return state.units
      .map((unit, index) => ({ unit, index }))
      .filter(({ unit, index }) => index < state.unlocked && unit === null)
      .map(({ index }) => index);
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function renderHearts(container, count) {
    container.replaceChildren();
    container.setAttribute('aria-label', `剩余 ${count} 条命`);
    for (let index = 0; index < 3; index += 1) {
      const heart = document.createElement('span');
      heart.className = `zy-heart${index >= count ? ' is-lost' : ''}`;
      heart.textContent = '♥';
      container.append(heart);
    }
  }

  function renderBoard(newIndex = null) {
    board.replaceChildren();
    state.units.forEach((unit, index) => {
      const cell = document.createElement('button');
      cell.className = 'zy-cell';
      cell.type = 'button';
      cell.dataset.index = String(index);

      if (index >= state.unlocked) {
        cell.classList.add('is-locked');
        cell.disabled = true;
        cell.setAttribute('aria-label', '未开垦阵地');
      } else if (!unit) {
        cell.setAttribute('aria-label', `空阵地 ${index + 1}`);
      } else {
        const unitElement = document.createElement('span');
        unitElement.className = 'zy-unit';
        unitElement.dataset.kind = unit.kind;
        unitElement.dataset.type = unit.type;
        unitElement.draggable = true;
        unitElement.textContent = unit.type;

        if (unit.kind !== 'fragment') {
          const level = document.createElement('small');
          level.className = 'zy-unit-level';
          level.textContent = `Lv.${unit.level}`;
          unitElement.append(level);
        }

        cell.setAttribute('aria-label', `${unit.type}${unit.kind === 'fragment' ? '武将文字' : `${unit.level}级`}`);
        cell.append(unitElement);
      }

      if (index === selectedIndex) cell.classList.add('is-selected');
      if (index === newIndex) cell.classList.add('is-new');
      if (selectedIndex !== null && canMerge(selectedIndex, index)) cell.classList.add('is-merge-target');
      board.append(cell);
    });
  }

  function renderEnemy() {
    const enemyIndex = (state.wave - 1) % enemySymbols.length;
    const enemyCount = Math.min(5, 2 + Math.floor((state.wave - 1) / 2));
    enemyRanks.replaceChildren();
    for (let index = 0; index < enemyCount; index += 1) {
      const unit = document.createElement('span');
      unit.className = 'zy-enemy-unit';
      unit.textContent = enemySymbols[enemyIndex];
      const level = document.createElement('small');
      level.textContent = `Lv.${Math.ceil(state.wave / 3)}`;
      unit.append(level);
      enemyRanks.append(unit);
    }
    ui.enemyType.textContent = enemyNames[enemyIndex];
  }

  function render() {
    const power = totalPower();
    state.highestPower = Math.max(state.highestPower, power);
    ui.buns.textContent = String(Math.floor(state.buns));
    ui.wave.textContent = `第 ${state.wave} 波`;
    ui.power.textContent = `战力 ${power}`;
    ui.recruitCost.textContent = String(state.recruitCost);
    ui.shovelCost.textContent = String(state.shovelCost);
    ui.heroCost.textContent = String(state.heroCost);
    ui.timer.textContent = state.pendingWave ? '整军中' : `来袭 ${Math.max(0, Math.ceil(state.timeLeft))} 秒`;
    ui.health.style.transform = `scaleX(${Math.max(0, state.enemyHealth / state.enemyMaxHealth)})`;
    recruitButton.disabled = state.over || state.buns < state.recruitCost || emptyUnlockedCells().length === 0;
    shovelButton.disabled = state.over || state.buns < state.shovelCost || state.unlocked >= BOARD_SIZE;
    heroButton.disabled = state.over || state.buns < state.heroCost || emptyUnlockedCells().length === 0;
    renderHearts(ui.playerHearts, state.playerHearts);
    renderHearts(ui.enemyHearts, state.enemyHearts);
  }

  function showMessage(message) {
    ui.message.textContent = message;
  }

  function floatText(message) {
    const text = document.createElement('p');
    text.className = 'zy-float-text';
    text.textContent = message;
    shell.append(text);
    window.setTimeout(() => text.remove(), 920);
  }

  function shake() {
    shell.classList.remove('zy-screen-shake');
    void shell.offsetWidth;
    shell.classList.add('zy-screen-shake');
  }

  function canMerge(from, to) {
    if (from === to || from === null || to >= state.unlocked) return false;
    const source = state.units[from];
    const target = state.units[to];
    return Boolean(
      source &&
      target &&
      source.kind !== 'fragment' &&
      source.kind === target.kind &&
      source.type === target.type &&
      source.level === target.level,
    );
  }

  function handleCellAction(index) {
    if (state.over || index >= state.unlocked) return;

    if (selectedIndex === null) {
      if (state.units[index]) {
        selectedIndex = index;
        renderBoard();
        showMessage('再点一个格子移动、交换或合成');
      }
      return;
    }

    if (selectedIndex === index) {
      selectedIndex = null;
      renderBoard();
      return;
    }

    moveOrMerge(selectedIndex, index);
    selectedIndex = null;
  }

  function moveOrMerge(from, to) {
    const source = state.units[from];
    const target = state.units[to];
    if (!source || to >= state.unlocked) return;

    if (canMerge(from, to)) {
      target.level += 1;
      state.units[from] = null;
      floatText(`${target.type} · 升至 ${target.level} 级`);
      showMessage('合成成功，战力大幅提升');
      renderBoard(to);
      render();
      return;
    }

    state.units[to] = source;
    state.units[from] = target;
    showMessage(target ? '交换位置' : '完成部署');
    renderBoard(to);
    render();
  }

  function placeUnit(unit) {
    const emptyCells = emptyUnlockedCells();
    if (!emptyCells.length) {
      showMessage('阵地已满，请合成或扩地');
      return false;
    }
    const index = randomItem(emptyCells);
    state.units[index] = unit;
    renderBoard(index);
    render();
    return true;
  }

  function recruit() {
    if (state.buns < state.recruitCost || !emptyUnlockedCells().length) return;
    state.buns -= state.recruitCost;
    state.recruits += 1;
    if (state.recruits % 3 === 0) state.recruitCost += 2;
    const type = randomItem(soldierTypes);
    placeUnit({ kind: 'soldier', type, level: 1 });
    showMessage(`${type}兵入阵，相同文字可以合成`);
  }

  function expandLand() {
    if (state.buns < state.shovelCost || state.unlocked >= BOARD_SIZE) return;
    state.buns -= state.shovelCost;
    state.unlocked += 1;
    state.shovelCost += 9;
    renderBoard(state.unlocked - 1);
    render();
    floatText('开垦一格');
    showMessage('阵地扩大，可以部署更多文字兵');
  }

  function seekHero() {
    if (state.buns < state.heroCost || !emptyUnlockedCells().length) return;
    state.buns -= state.heroCost;
    state.heroCost += 6;
    const type = randomItem(fragmentTypes);
    placeUnit({ kind: 'fragment', type, level: 1 });
    showMessage(`获得武将文字「${type}」，凑齐姓名即可出阵`);
    combineHeroIfReady();
  }

  function combineHeroIfReady() {
    for (const hero of heroPairs) {
      const firstIndex = state.units.findIndex((unit) => unit?.kind === 'fragment' && unit.type === hero.first);
      const secondIndex = state.units.findIndex((unit) => unit?.kind === 'fragment' && unit.type === hero.second);
      if (firstIndex === -1 || secondIndex === -1) continue;

      state.units[firstIndex] = { kind: 'hero', type: hero.name, level: 1, power: hero.power };
      state.units[secondIndex] = null;
      renderBoard(firstIndex);
      render();
      floatText(`${hero.name} · 出阵`);
      showMessage(`${hero.name}已激活，武将可与同名武将继续合成`);
      return;
    }
  }

  function setupWave() {
    state.pendingWave = false;
    state.enemyMaxHealth = 48 + state.wave * 28 + Math.floor(state.wave / 3) * 18;
    state.enemyHealth = state.enemyMaxHealth;
    state.timeLeft = WAVE_SECONDS;
    nextWaveClock = 0;
    renderEnemy();
    render();
    showMessage(`第 ${state.wave} 波来袭，文字兵自动迎敌`);
  }

  function clearWave() {
    state.pendingWave = true;
    state.clearedWaves += 1;
    const reward = 11 + state.wave * 3;
    state.buns += reward;
    floatText(`破敌 · 馒 +${reward}`);

    if (state.wave % 3 === 0) {
      state.enemyHearts -= 1;
      shake();
      if (state.enemyHearts <= 0) {
        finishGame(true);
        return;
      }
      showMessage('攻破敌阵，敌方阿斗失去一条命');
    } else {
      showMessage('敌军溃退，下一波正在集结');
    }

    state.wave += 1;
    render();
  }

  function failWave() {
    state.pendingWave = true;
    state.playerHearts -= 1;
    shake();
    floatText('敌军破阵');
    if (state.playerHearts <= 0) {
      finishGame(false);
      return;
    }
    state.wave += 1;
    showMessage('阿斗失去一条命，迅速补充兵力');
    render();
  }

  function finishGame(victory) {
    state.active = false;
    state.over = true;
    stopTimer();
    render();
    ui.resultEyebrow.textContent = victory ? '长坂坡 · 凯旋' : '长坂坡 · 战败';
    ui.resultTitle.textContent = victory ? '守护成功' : '阿斗失守';
    ui.resultWaves.textContent = String(state.clearedWaves);
    ui.resultPower.textContent = String(state.highestPower);
    resultModal.hidden = false;
  }

  function tick(time) {
    if (!state.active || state.over || game.hidden) return;
    const elapsed = Math.min(0.5, (time - lastTick) / 1000 || 0);
    lastTick = time;
    incomeClock += elapsed;
    attackClock += elapsed;

    if (incomeClock >= 2) {
      const income = Math.floor(incomeClock / 2);
      state.buns += income;
      incomeClock %= 2;
    }

    if (state.pendingWave) {
      nextWaveClock += elapsed;
      if (nextWaveClock >= 1.7) setupWave();
      render();
      return;
    }

    const power = battlePower();
    const heroBonus = state.units.some((unit) => unit?.type === '赵云') ? 1.18 : 1;
    const damage = power * heroBonus * elapsed;
    state.enemyHealth -= damage;
    state.timeLeft -= elapsed;

    if (attackClock >= 0.75 && power > 0) {
      attackClock = 0;
      const occupied = [...board.querySelectorAll('.zy-cell')].filter((cell) => state.units[Number(cell.dataset.index)]);
      const attacker = randomItem(occupied)?.querySelector('.zy-unit');
      if (attacker) {
        attacker.classList.remove('is-hit');
        void attacker.offsetWidth;
        attacker.classList.add('is-hit');
      }
    }

    if (state.enemyHealth <= 0) clearWave();
    else if (state.timeLeft <= 0) failWave();
    else render();
  }

  function startTimer() {
    stopTimer();
    lastTick = performance.now();
    timerId = window.setInterval(() => tick(performance.now()), 100);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = undefined;
  }

  function resetGame({ showIntro = false } = {}) {
    stopTimer();
    state = freshState();
    selectedIndex = null;
    incomeClock = 0;
    attackClock = 0;
    nextWaveClock = 0;
    resultModal.hidden = true;
    introModal.hidden = !showIntro;
    renderBoard();
    renderEnemy();
    render();
    showMessage('部署文字兵，守住阿斗');
    if (!showIntro) {
      state.active = true;
      startTimer();
    }
  }

  function openGame() {
    game.hidden = false;
    document.body.classList.add('zy-game-open');
    if (!state) resetGame({ showIntro: true });
    else if (!state.over && introModal.hidden) {
      state.active = true;
      startTimer();
    }
    closeButton.focus();
  }

  function closeGame() {
    stopTimer();
    if (state) state.active = false;
    game.hidden = true;
    document.body.classList.remove('zy-game-open');
    openButton.focus();
  }

  board.addEventListener('click', (event) => {
    const cell = event.target.closest('.zy-cell');
    if (cell) handleCellAction(Number(cell.dataset.index));
  });

  board.addEventListener('dragstart', (event) => {
    const cell = event.target.closest('.zy-cell');
    if (!cell || !state.units[Number(cell.dataset.index)]) return;
    dragIndex = Number(cell.dataset.index);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragIndex));
  });

  board.addEventListener('dragover', (event) => {
    const cell = event.target.closest('.zy-cell:not(.is-locked)');
    if (cell) event.preventDefault();
  });

  board.addEventListener('drop', (event) => {
    const cell = event.target.closest('.zy-cell:not(.is-locked)');
    if (!cell || dragIndex === null) return;
    event.preventDefault();
    moveOrMerge(dragIndex, Number(cell.dataset.index));
    dragIndex = null;
    selectedIndex = null;
  });

  openButton.addEventListener('click', openGame);
  closeButton.addEventListener('click', closeGame);
  restartButton.addEventListener('click', () => resetGame());
  startButton.addEventListener('click', () => {
    introModal.hidden = true;
    state.active = true;
    startTimer();
  });
  playAgainButton.addEventListener('click', () => resetGame());
  leaveResultButton.addEventListener('click', closeGame);
  recruitButton.addEventListener('click', recruit);
  shovelButton.addEventListener('click', expandLand);
  heroButton.addEventListener('click', seekHero);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !game.hidden) closeGame();
  });
})();
