const bookStage = document.querySelector('#bookStage');
const bookPage = document.querySelector('#bookPage');
const bookCover = document.querySelector('#bookCover');
const loginForm = document.querySelector('#loginForm');
const loginSubmit = document.querySelector('#loginSubmit');
const loginMessage = document.querySelector('#loginMessage');
const registerForm = document.querySelector('#registerForm');
const registerSubmit = document.querySelector('#registerSubmit');
const registerMessage = document.querySelector('#registerMessage');
const recoveryForm = document.querySelector('#recoveryForm');
const recoveryMessage = document.querySelector('#recoveryMessage');
const pagePanels = document.querySelectorAll('[data-page]');
const pageOpeners = document.querySelectorAll('[data-open-page]');
const pageClosers = document.querySelectorAll('[data-close-book]');

let turnstileId = null;
let turnstileToken = '';
let turnstileSiteKey = '';

function setMessage(element, text, tone = 'neutral') {
  element.textContent = text;
  element.dataset.tone = tone;
}

function setSubmitting(button, isSubmitting) {
  button.disabled = isSubmitting;
}

function resetTurnstile() {
  turnstileToken = '';
  if (window.turnstile && turnstileId !== null) {
    window.turnstile.reset(turnstileId);
  }
}

async function loadTurnstileConfig() {
  if (turnstileSiteKey) return;
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('无法加载人机验证配置。');
  const config = await response.json();
  turnstileSiteKey = config.turnstileSiteKey;
  if (!turnstileSiteKey) throw new Error('人机验证尚未配置。');
}

async function renderTurnstile() {
  if (turnstileId !== null || !window.turnstile) return;
  try {
    await loadTurnstileConfig();
  } catch (error) {
    setMessage(registerMessage, error.message, 'error');
    return;
  }

  turnstileId = window.turnstile.render('#turnstileWidget', {
    sitekey: turnstileSiteKey,
    theme: 'light',
    size: 'flexible',
    callback(token) {
      turnstileToken = token;
      setMessage(registerMessage, '');
    },
    'expired-callback': resetTurnstile,
    'error-callback': () => {
      turnstileToken = '';
      setMessage(registerMessage, '人机验证加载失败，请刷新页面重试。', 'error');
    },
  });
}

function waitForTurnstile() {
  if (bookStage.dataset.view !== 'register') return;
  if (window.turnstile) {
    renderTurnstile();
    return;
  }
  window.setTimeout(waitForTurnstile, 100);
}

function openBook(pageName) {
  setMessage(loginMessage, '');
  setMessage(registerMessage, '');
  setMessage(recoveryMessage, '');

  pagePanels.forEach((panel) => {
    const isActive = panel.dataset.page === pageName;
    panel.classList.toggle('is-active', isActive);
    panel.hidden = !isActive;
  });

  bookStage.dataset.view = pageName;
  bookPage.setAttribute('aria-hidden', 'false');
  loginForm.inert = true;
  bookPage.inert = false;

  if (pageName === 'register') {
    waitForTurnstile();
    window.setTimeout(() => document.querySelector('#registerUsername').focus(), 720);
  } else {
    window.setTimeout(() => document.querySelector('#recoveryUsername').focus(), 720);
  }
}

function closeBook() {
  bookStage.dataset.view = 'login';
  bookPage.setAttribute('aria-hidden', 'true');
  bookPage.inert = true;
  loginForm.inert = false;
  window.setTimeout(() => document.querySelector('#loginUsername').focus(), 620);
}

async function sendAuthRequest(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || '请求失败，请稍后重试。');
    error.resetTurnstile = result.resetTurnstile;
    throw error;
  }
  return result;
}

pageOpeners.forEach((button) => {
  button.addEventListener('click', () => openBook(button.dataset.openPage));
});

pageClosers.forEach((button) => {
  button.addEventListener('click', closeBook);
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(loginMessage, '');
  setSubmitting(loginSubmit, true);

  const formData = new FormData(loginForm);
  try {
    await sendAuthRequest('/api/login', {
      username: String(formData.get('username') || '').trim(),
      password: String(formData.get('password') || ''),
    });
    window.location.replace('/main');
  } catch (error) {
    setMessage(loginMessage, error.message, 'error');
  } finally {
    setSubmitting(loginSubmit, false);
  }
});

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(registerMessage, '');

  const formData = new FormData(registerForm);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password !== confirmPassword) {
    setMessage(registerMessage, '两次输入的密码不一致。', 'error');
    return;
  }
  if (!turnstileToken) {
    setMessage(registerMessage, '请先完成人机验证。', 'error');
    return;
  }

  setSubmitting(registerSubmit, true);
  try {
    await sendAuthRequest('/api/register', { username, password, turnstileToken });
    window.location.replace('/main');
  } catch (error) {
    setMessage(registerMessage, error.message, 'error');
    if (error.resetTurnstile) resetTurnstile();
  } finally {
    setSubmitting(registerSubmit, false);
  }
});

recoveryForm.addEventListener('submit', (event) => {
  event.preventDefault();
  setMessage(
    recoveryMessage,
    '为保护账号安全，当前不提供自动重置。请联系站点管理员核验身份后处理。',
    'success',
  );
});

bookPage.inert = true;

fetch('/api/session', { credentials: 'same-origin' }).then((response) => {
  if (response.ok) window.location.replace('/main');
});
