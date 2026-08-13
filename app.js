const bookStage = document.querySelector('#bookStage');
const bookPage = document.querySelector('#bookPage');
const bookCover = document.querySelector('#bookCover');
const loginForm = document.querySelector('#loginForm');
const loginSubmit = document.querySelector('#loginSubmit');
const loginMessage = document.querySelector('#loginMessage');
const registerForm = document.querySelector('#registerForm');
const registerSubmit = document.querySelector('#registerSubmit');
const registerMessage = document.querySelector('#registerMessage');
const registerEmail = document.querySelector('#registerEmail');
const sendEmailCode = document.querySelector('#sendEmailCode');
const verificationModal = document.querySelector('#verificationModal');
const verificationMessage = document.querySelector('#verificationMessage');
const verificationClosers = document.querySelectorAll('[data-close-verification]');
const recoveryForm = document.querySelector('#recoveryForm');
const recoverySubmit = document.querySelector('#recoverySubmit');
const recoveryMessage = document.querySelector('#recoveryMessage');
const recoveryUsername = document.querySelector('#recoveryUsername');
const recoveryEmail = document.querySelector('#recoveryEmail');
const sendResetCode = document.querySelector('#sendResetCode');
const pagePanels = document.querySelectorAll('[data-page]');
const pageOpeners = document.querySelectorAll('[data-open-page]');
const pageClosers = document.querySelectorAll('[data-close-book]');

let turnstileId = null;
let turnstileToken = '';
let turnstileSiteKey = '';
let verificationTarget = 'register';
const emailCodeTimers = new Map();

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

function getVerificationElements() {
  if (verificationTarget === 'password-reset') {
    return {
      button: sendResetCode,
      emailInput: recoveryEmail,
      codeInput: document.querySelector('#recoveryEmailCode'),
      message: recoveryMessage,
    };
  }
  return {
    button: sendEmailCode,
    emailInput: registerEmail,
    codeInput: document.querySelector('#registerEmailCode'),
    message: registerMessage,
  };
}

function closeVerificationModal({ keepButtonDisabled = false } = {}) {
  const { button, emailInput } = getVerificationElements();
  verificationModal.hidden = true;
  bookStage.inert = false;
  resetTurnstile();
  if (!keepButtonDisabled) setSubmitting(button, false);
  emailInput.focus();
}

function startEmailCodeCountdown(button, seconds) {
  const currentTimer = emailCodeTimers.get(button);
  if (currentTimer) clearInterval(currentTimer);
  let remaining = Math.max(1, Number(seconds) || 60);
  button.disabled = true;
  button.textContent = `${remaining} 秒后重发`;
  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(timer);
      emailCodeTimers.delete(button);
      button.disabled = false;
      button.textContent = '重新发送';
      return;
    }
    button.textContent = `${remaining} 秒后重发`;
  }, 1000);
  emailCodeTimers.set(button, timer);
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
    setMessage(verificationMessage, error.message, 'error');
    return;
  }

  turnstileId = window.turnstile.render('#turnstileWidget', {
    sitekey: turnstileSiteKey,
    theme: 'light',
    size: window.matchMedia('(max-width: 420px)').matches ? 'compact' : 'flexible',
    callback(token) {
      turnstileToken = token;
      requestVerificationCode(token);
    },
    'expired-callback': resetTurnstile,
    'error-callback': () => {
      turnstileToken = '';
      setMessage(verificationMessage, '人机验证加载失败，请关闭后重试。', 'error');
    },
  });
}

function waitForTurnstile() {
  if (verificationModal.hidden) return;
  if (window.turnstile) {
    renderTurnstile();
    return;
  }
  window.setTimeout(waitForTurnstile, 100);
}

function openVerificationModal(target) {
  verificationTarget = target;
  const { button } = getVerificationElements();
  setMessage(verificationMessage, '验证通过后将自动发送验证码');
  verificationModal.hidden = false;
  bookStage.inert = true;
  setSubmitting(button, true);
  waitForTurnstile();
  document.querySelector('.verification-close').focus();
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
    window.setTimeout(() => document.querySelector('#registerUsername').focus(), 720);
  } else {
    window.setTimeout(() => document.querySelector('#recoveryUsername').focus(), 720);
  }
}

function closeBook() {
  if (!verificationModal.hidden) closeVerificationModal();
  bookStage.dataset.view = 'login';
  bookPage.setAttribute('aria-hidden', 'true');
  bookPage.inert = true;
  loginForm.inert = false;
  window.setTimeout(() => document.querySelector('#loginUsername').focus(), 620);
}

async function sendAuthRequest(endpoint, payload) {
  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('网络连接中断，请检查网络后重试。');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status >= 500
      ? '服务器处理超时，请稍后重试。'
      : '请求未完成，请重新检查输入。';
    const error = new Error(result.error || fallback);
    error.resetTurnstile = result.resetTurnstile;
    error.retryAfter = result.retryAfter;
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
  const email = String(formData.get('email') || '').trim();
  const emailCode = String(formData.get('emailCode') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password !== confirmPassword) {
    setMessage(registerMessage, '两次输入的密码不一致。', 'error');
    return;
  }
  if (!/^\d{6}$/u.test(emailCode)) {
    setMessage(registerMessage, '请输入收到的 6 位邮箱验证码。', 'error');
    return;
  }

  setSubmitting(registerSubmit, true);
  try {
    await sendAuthRequest('/api/register', { username, email, emailCode, password });
    window.location.replace('/main');
  } catch (error) {
    setMessage(registerMessage, error.message, 'error');
    if (error.resetTurnstile) resetTurnstile();
  } finally {
    setSubmitting(registerSubmit, false);
  }
});

async function requestVerificationCode(token) {
  const { button, emailInput, codeInput, message } = getVerificationElements();
  const isPasswordReset = verificationTarget === 'password-reset';
  setMessage(verificationMessage, '验证通过，正在发送…');
  try {
    const result = await sendAuthRequest(isPasswordReset ? '/api/password-reset-code' : '/api/email-code', {
      username: isPasswordReset ? recoveryUsername.value.trim() : undefined,
      email: emailInput.value.trim(),
      turnstileToken: token,
    });
    closeVerificationModal({ keepButtonDisabled: true });
    setMessage(message, '验证码已发送，10 分钟内有效。', 'success');
    startEmailCodeCountdown(button, result.retryAfter);
    codeInput.focus();
  } catch (error) {
    closeVerificationModal({ keepButtonDisabled: Boolean(error.retryAfter) });
    setMessage(message, error.message, 'error');
    if (error.retryAfter) startEmailCodeCountdown(button, error.retryAfter);
  }
}

sendEmailCode.addEventListener('click', () => {
  setMessage(registerMessage, '');
  if (!registerEmail.reportValidity()) return;
  openVerificationModal('register');
});

sendResetCode.addEventListener('click', () => {
  setMessage(recoveryMessage, '');
  if (!recoveryUsername.reportValidity()) return;
  if (!recoveryEmail.reportValidity()) return;
  openVerificationModal('password-reset');
});

verificationClosers.forEach((closer) => closer.addEventListener('click', () => closeVerificationModal()));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !verificationModal.hidden) closeVerificationModal();
});

recoveryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(recoveryMessage, '');

  const formData = new FormData(recoveryForm);
  const username = String(formData.get('username') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const emailCode = String(formData.get('emailCode') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (password !== confirmPassword) {
    setMessage(recoveryMessage, '两次输入的新密码不一致。', 'error');
    return;
  }
  if (!/^\d{6}$/u.test(emailCode)) {
    setMessage(recoveryMessage, '请输入收到的 6 位邮箱验证码。', 'error');
    return;
  }

  setSubmitting(recoverySubmit, true);
  try {
    await sendAuthRequest('/api/password-reset', { username, email, emailCode, password });
    window.location.replace('/main');
  } catch (error) {
    setMessage(recoveryMessage, error.message, 'error');
    if (error.resetTurnstile) resetTurnstile();
  } finally {
    setSubmitting(recoverySubmit, false);
  }
});

bookPage.inert = true;

fetch('/api/session', { credentials: 'same-origin' }).then((response) => {
  if (response.ok) window.location.replace('/main');
});
