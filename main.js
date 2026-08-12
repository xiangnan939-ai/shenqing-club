const STORAGE_KEYS = {
  users: 'shenqingUsers',
  session: 'shenqingSession',
};

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users)) || {};
  } catch {
    return {};
  }
}

const activeSession = localStorage.getItem(STORAGE_KEYS.session);
const users = readUsers();

if (!activeSession || !users[activeSession]) {
  localStorage.removeItem(STORAGE_KEYS.session);
  window.location.replace('./');
} else {
  document.querySelector('#currentUser').textContent = activeSession;
  document.body.classList.remove('session-loading');
}

document.querySelector('#logoutButton').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.session);
  window.location.replace('./');
});
