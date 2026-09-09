(() => {
  let popup = null;
  let busy = false;
  let timer = null;
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/game-invites.css?v=20260909';
  document.head.append(style);

  function show(invite, storageKey, seen) {
    if (popup) return;
    seen[invite.roomId] = invite.expiresAt;
    try { localStorage.setItem(storageKey, JSON.stringify(seen)); } catch {}
    const card = document.createElement('section');
    card.className = 'club-game-invite';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', '游戏邀请');
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = '<button class="club-invite-close" type="button" aria-label="关闭邀请" title="稍后处理">×</button><img src="/assets/dandan-racing-icon.webp" alt=""><div class="club-invite-copy"><strong>蛋蛋飞车 · 游戏邀请</strong><p></p><span class="club-invite-status" role="status"></span></div><div class="club-invite-actions"><button type="button" data-decline>拒绝</button><button type="button" data-accept>接受并加入</button></div>';
    card.querySelector('p').textContent = `${invite.hostNickname} 邀请你一起联机竞速`;
    const close = () => { card.remove(); popup = null; };
    card.querySelector('.club-invite-close').onclick = close;
    async function respond(accept) {
      const buttons = card.querySelectorAll('button');
      buttons.forEach(button => { button.disabled = true; });
      const status = card.querySelector('.club-invite-status');
      status.textContent = accept ? '正在加入房间…' : '';
      try {
        const response = await fetch('/api/game-room', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'respond', roomId: invite.roomId, accept }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '暂时无法处理邀请');
        if (accept) location.assign(`/games/dandan-racing/?room=${encodeURIComponent(invite.roomId)}`);
        else close();
      } catch (error) {
        status.textContent = error.message;
        buttons.forEach(button => { button.disabled = false; });
      }
    }
    card.querySelector('[data-accept]').onclick = () => respond(true);
    card.querySelector('[data-decline]').onclick = () => respond(false);
    popup = { card, roomId: invite.roomId, close };
    document.body.append(card);
  }

  async function poll() {
    clearTimeout(timer);
    if (busy || document.hidden) { timer = setTimeout(poll, 5000); return; }
    busy = true;
    try {
      const response = await fetch('/api/game-room', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      const invites = result.invitations || [];
      if (popup && !invites.some(invite => invite.roomId === popup.roomId)) popup.close();
      const storageKey = `club-game-invites-${result.userId}`;
      let seen = {};
      try { seen = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
      for (const id of Object.keys(seen)) if (Date.parse(seen[id]) <= Date.now()) delete seen[id];
      const next = invites.find(invite => !seen[invite.roomId]);
      if (next && !popup) show(next, storageKey, seen);
    } catch {} finally {
      busy = false;
      timer = setTimeout(poll, 5000);
    }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  poll();
})();
