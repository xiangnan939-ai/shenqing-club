const views = document.querySelectorAll('[data-view]');
const navItems = document.querySelectorAll('[data-target]');
const profileUsername = document.querySelector('#profileUsername');
const accountUsername = document.querySelector('#accountUsername');
const profileAvatar = document.querySelector('#profileAvatar');
const logoutButton = document.querySelector('#logoutButton');
const friendSearch = document.querySelector('#friendSearch');
const friendRows = document.querySelectorAll('[data-friend]');
const visibleFriendCount = document.querySelector('#visibleFriendCount');
const emptyFriends = document.querySelector('#emptyFriends');
const appToast = document.querySelector('#appToast');
let toastTimer;

function switchView(target) {
  views.forEach((view) => {
    const active = view.dataset.view === target;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  });

  navItems.forEach((item) => {
    const active = item.dataset.target === target;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
}

function filterFriends() {
  const query = friendSearch.value.normalize('NFKC').trim().toLowerCase();
  let visible = 0;

  friendRows.forEach((row) => {
    const matches = row.dataset.friend.toLowerCase().includes(query);
    row.hidden = !matches;
    if (matches) visible += 1;
  });

  visibleFriendCount.textContent = String(visible);
  emptyFriends.hidden = visible !== 0;
}

async function loadSession() {
  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Unauthorized');
    const session = await response.json();
    const username = String(session.username || '深情用户');
    profileUsername.textContent = username;
    accountUsername.textContent = username;
    profileAvatar.textContent = Array.from(username)[0] || '深';
    document.body.classList.remove('session-loading');
  } catch {
    window.location.replace('/');
  }
}

navItems.forEach((item) => {
  item.addEventListener('click', () => switchView(item.dataset.target));
});

friendSearch.addEventListener('input', filterFriends);

document.querySelectorAll('.message-button').forEach((button) => {
  button.addEventListener('click', () => {
    const friendName = button.closest('[data-friend]').dataset.friend;
    appToast.textContent = `${friendName}的聊天功能正在准备中`;
    appToast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => appToast.classList.remove('is-visible'), 1800);
    button.blur();
  });
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } finally {
    window.location.replace('/');
  }
});

loadSession();
