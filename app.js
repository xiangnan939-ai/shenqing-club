const authForm = document.querySelector('#authForm');
const tabs = document.querySelectorAll('[data-auth-mode]');
const submitButton = document.querySelector('.auth-submit');
const submitLabel = document.querySelector('.auth-submit span:first-child');
const message = document.querySelector('#authMessage');
const authTitle = document.querySelector('#authTitle');
const authDescription = document.querySelector('#authDescription');
const registerOnlyFields = document.querySelectorAll('.register-only');
const passwordInput = document.querySelector('#password');
const confirmPasswordInput = document.querySelector('#confirmPassword');

let mode = 'login';
let turnstileId = null;
let turnstileToken = '';
let turnstileSiteKey = '';

function setMessage(text, tone = 'neutral') {
  message.textContent = text;
  message.dataset.tone = tone;
}

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.classList.toggle('is-loading', isSubmitting);
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
  if (mode !== 'register' || turnstileId !== null || !window.turnstile) return;
  try {
    await loadTurnstileConfig();
  } catch (error) {
    setMessage(error.message, 'error');
    return;
  }
  turnstileId = window.turnstile.render('#turnstileWidget', {
    sitekey: turnstileSiteKey,
    theme: 'light',
    size: 'flexible',
    callback(token) {
      turnstileToken = token;
      setMessage('');
    },
    'expired-callback': resetTurnstile,
    'error-callback': () => {
      turnstileToken = '';
      setMessage('人机验证加载失败，请刷新页面重试。', 'error');
    },
  });
}

function waitForTurnstile() {
  if (window.turnstile) {
    renderTurnstile();
    return;
  }
  window.setTimeout(waitForTurnstile, 100);
}

function switchMode(nextMode) {
  mode = nextMode;
  setMessage('');
  authForm.reset();
  authTitle.textContent = mode === 'login' ? '登录' : '创建账号';
  authDescription.textContent = mode === 'login' ? '进入你的私人空间' : '注册后可在不同设备登录';
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

  if (mode === 'register') {
    waitForTurnstile();
  } else {
    resetTurnstile();
  }
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

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchMode(tab.dataset.authMode));
});

authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('');

  const formData = new FormData(authForm);
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (mode === 'register' && password !== confirmPassword) {
    setMessage('两次输入的密码不一致。', 'error');
    return;
  }
  if (mode === 'register' && !turnstileToken) {
    setMessage('请先完成人机验证。', 'error');
    return;
  }

  setSubmitting(true);
  try {
    const endpoint = mode === 'login' ? '/api/login' : '/api/register';
    await sendAuthRequest(endpoint, {
      username,
      password,
      turnstileToken: mode === 'register' ? turnstileToken : undefined,
    });
    window.location.replace('/main');
  } catch (error) {
    setMessage(error.message, 'error');
    if (mode === 'register' && error.resetTurnstile) resetTurnstile();
  } finally {
    setSubmitting(false);
  }
});

fetch('/api/session', { credentials: 'same-origin' }).then((response) => {
  if (response.ok) window.location.replace('/main');
});
