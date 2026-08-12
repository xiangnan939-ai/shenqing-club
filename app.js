const STORAGE_KEYS = {
  users: 'shenqingUsers',
  session: 'shenqingSession',
};

const body = document.body;
const authForm = document.querySelector('#authForm');
const tabs = document.querySelectorAll('[data-auth-mode]');
const submitButton = document.querySelector('.gate-submit');
const message = document.querySelector('#authMessage');
const currentUser = document.querySelector('#currentUser');
const logoutButton = document.querySelector('#logoutButton');
const registerOnlyFields = document.querySelectorAll('.register-only');
const passwordInput = document.querySelector('#password');
const confirmPasswordInput = document.querySelector('#confirmPassword');

let mode = 'login';

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.users)) || {};
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function setMessage(text, tone = 'neutral') {
  message.textContent = text;
  message.dataset.tone = tone;
}

function showApp(username) {
  body.classList.remove('auth-loading');
  body.classList.add('is-authenticated');
  currentUser.textContent = username;
}

function showAuth() {
  body.classList.remove('auth-loading', 'is-authenticated');
  currentUser.textContent = '';
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function switchMode(nextMode) {
  mode = nextMode;
  setMessage('');
  authForm.reset();
  authForm.classList.toggle('is-register', mode === 'register');
  submitButton.textContent = mode === 'login' ? '进入' : '创建';
  passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  confirmPasswordInput.required = mode === 'register';

  registerOnlyFields.forEach((field) => {
    field.classList.toggle('is-hidden', mode !== 'register');
  });

  tabs.forEach((tab) => {
    const isSelected = tab.dataset.authMode === mode;
    tab.classList.toggle('is-active', isSelected);
    tab.setAttribute('aria-selected', String(isSelected));
  });
}

function register(username, password, confirmPassword) {
  if (password !== confirmPassword) {
    setMessage('两次密码不一致。', 'error');
    return;
  }

  const users = readUsers();
  if (users[username]) {
    setMessage('这个账号已经存在。', 'error');
    return;
  }

  users[username] = { password };
  writeUsers(users);
  localStorage.setItem(STORAGE_KEYS.session, username);
  showApp(username);
}

function login(username, password) {
  const users = readUsers();
  if (!users[username] || users[username].password !== password) {
    setMessage('账号或密码不正确。', 'error');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.session, username);
  showApp(username);
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchMode(tab.dataset.authMode));
});

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const username = normalizeUsername(formData.get('username') || '');
  const password = formData.get('password') || '';
  const confirmPassword = formData.get('confirmPassword') || '';

  if (!username || !password) {
    setMessage('请填写账号和密码。', 'error');
    return;
  }

  if (mode === 'register') {
    register(username, password, confirmPassword);
    return;
  }

  login(username, password);
});

logoutButton.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.session);
  switchMode('login');
  showAuth();
});

const activeSession = localStorage.getItem(STORAGE_KEYS.session);
if (activeSession && readUsers()[activeSession]) {
  showApp(activeSession);
} else {
  localStorage.removeItem(STORAGE_KEYS.session);
  showAuth();
}
