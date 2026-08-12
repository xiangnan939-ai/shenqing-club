const STORAGE_KEYS = {
  users: 'shenqingUsers',
  session: 'shenqingSession',
};

const authForm = document.querySelector('#authForm');
const tabs = document.querySelectorAll('[data-auth-mode]');
const submitLabel = document.querySelector('.auth-submit span:first-child');
const message = document.querySelector('#authMessage');
const authTitle = document.querySelector('#authTitle');
const authDescription = document.querySelector('#authDescription');
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

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function enterMain(username) {
  localStorage.setItem(STORAGE_KEYS.session, username);
  window.location.replace('main.html');
}

function switchMode(nextMode) {
  mode = nextMode;
  setMessage('');
  authForm.reset();
  authTitle.textContent = mode === 'login' ? '登录' : '创建账号';
  authDescription.textContent = mode === 'login' ? '进入你的私人空间' : '创建一个仅属于此设备的账号';
  submitLabel.textContent = mode === 'login' ? '进入' : '完成注册';
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
    setMessage('两次输入的密码不一致。', 'error');
    return;
  }

  const users = readUsers();
  if (users[username]) {
    setMessage('这个账号已经存在。', 'error');
    return;
  }

  users[username] = { password };
  writeUsers(users);
  enterMain(username);
}

function login(username, password) {
  const users = readUsers();
  if (!users[username] || users[username].password !== password) {
    setMessage('账号或密码不正确。', 'error');
    return;
  }

  enterMain(username);
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

const activeSession = localStorage.getItem(STORAGE_KEYS.session);
if (activeSession && readUsers()[activeSession]) {
  window.location.replace('main.html');
} else {
  localStorage.removeItem(STORAGE_KEYS.session);
}
