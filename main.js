const views = document.querySelectorAll('[data-view]');
const navItems = document.querySelectorAll('[data-target]');
const profileNickname = document.querySelector('#profileNickname');
const profileSignature = document.querySelector('#profileSignature');
const memberLevel = document.querySelector('#memberLevel');
const accountUsername = document.querySelector('#accountUsername');
const accountEmail = document.querySelector('#accountEmail');
const activeTime = document.querySelector('#activeTime');
const profileAvatar = document.querySelector('#profileAvatar');
const logoutButton = document.querySelector('#logoutButton');
const friendSearch = document.querySelector('#friendSearch');
const friendRows = document.querySelectorAll('[data-friend]');
const visibleFriendCount = document.querySelector('#visibleFriendCount');
const emptyFriends = document.querySelector('#emptyFriends');
const appToast = document.querySelector('#appToast');
const settingsOpeners = document.querySelectorAll('#openSettings, #openSettingsRow');
const backFromSettings = document.querySelector('#backFromSettings');
const settingsTitle = document.querySelector('#settingsTitle');
const settingsMenu = document.querySelector('#settingsMenu');
const settingsDetailButtons = document.querySelectorAll('[data-settings-detail]');
const settingsDetailPanels = document.querySelectorAll('[data-settings-detail-panel]');
const profileEdit = document.querySelector('#profileEdit');
const profileEditMessage = document.querySelector('#profileEditMessage');
const editAvatarPreview = document.querySelector('#editAvatarPreview');
const avatarUpload = document.querySelector('#avatarUpload');
const editNickname = document.querySelector('#editNickname');
const editSignature = document.querySelector('#editSignature');
const feedbackPanel = document.querySelector('#feedbackPanel');
const feedbackStatus = document.querySelector('#feedbackStatus');
const passwordForm = document.querySelector('#passwordForm');
const passwordStatus = document.querySelector('#passwordStatus');
const emailForm = document.querySelector('#emailForm');
const emailStatus = document.querySelector('#emailStatus');
const deleteAccountForm = document.querySelector('#deleteAccountForm');
const deleteStatus = document.querySelector('#deleteStatus');

let toastTimer;
let currentProfile = null;
let activityTimer = null;
let previousMainView = 'profile';
let activeSettingsDetail = '';
let selectedAvatarImage = '';

const settingsDetailTitles = {
  profileDetail: '资料修改',
  feedbackDetail: '意见反馈',
  passwordDetail: '修改密码',
  emailDetail: '修改邮箱',
  logoutDetail: '退出登录',
  deleteDetail: '注销账号',
};

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

function showToast(message) {
  appToast.textContent = message;
  appToast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => appToast.classList.remove('is-visible'), 1800);
}

function setMessage(element, message, tone = 'neutral') {
  element.textContent = message;
  element.dataset.tone = tone;
}

function formatActiveTime(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  if (safeMinutes < 60) return `${safeMinutes} 分钟`;
  const hours = Math.floor(safeMinutes / 60);
  const rest = safeMinutes % 60;
  if (hours < 24) return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `${days} 天 ${dayHours} 小时` : `${days} 天`;
}

function renderAvatar(element, profile) {
  element.textContent = '';
  element.style.backgroundImage = profile.avatarImage ? `url("${profile.avatarImage}")` : '';
  element.classList.toggle('has-image', Boolean(profile.avatarImage));
}

function renderProfile(profile) {
  currentProfile = profile;
  profileNickname.textContent = profile.nickname || profile.username;
  profileSignature.textContent = profile.signature || '这个人很深情，还没留下签名。';
  memberLevel.textContent = profile.memberLevel || 'V1';
  accountUsername.textContent = profile.username || '-';
  accountEmail.textContent = profile.email || '未绑定';
  activeTime.textContent = formatActiveTime(profile.activeMinutes);
  renderAvatar(profileAvatar, profile);
  renderAvatar(editAvatarPreview, profile);
  selectedAvatarImage = profile.avatarImage || '';
  avatarUpload.value = '';
  editNickname.value = profile.nickname || profile.username || '';
  editSignature.value = profile.signature || '';
  emailForm.elements.email.value = profile.email || '';
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(new Error('图片读取失败，请重新选择。')));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('图片加载失败，请换一张图片。')));
    image.src = source;
  });
}

async function cropAvatarFile(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('请选择图片文件。');
  if (file.size > 8 * 1024 * 1024) throw new Error('图片不能超过 8MB。');

  const source = await readImageFile(file);
  const image = await loadImage(source);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - size) / 2);
  const sourceY = Math.floor((image.naturalHeight - size) / 2);
  const canvas = document.createElement('canvas');
  const outputSize = 320;
  canvas.width = outputSize;
  canvas.height = outputSize;
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, size, size, 0, 0, outputSize, outputSize);
  return canvas.toDataURL('image/png');
}

async function apiRequest(endpoint, payload, method = 'POST') {
  let response;
  try {
    response = await fetch(endpoint, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: payload == null ? undefined : JSON.stringify(payload),
    });
  } catch {
    throw new Error('网络连接中断，请稍后重试。');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || '请求失败，请稍后重试。');
  }
  return result;
}

async function refreshSession() {
  const response = await fetch('/api/session', {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Unauthorized');
  const session = await response.json();
  renderProfile(session);
}

async function loadSession() {
  try {
    await refreshSession();
    document.body.classList.remove('session-loading');
    activityTimer = window.setInterval(() => {
      refreshSession().catch(() => {});
    }, 60 * 1000);
  } catch {
    window.location.replace('/');
  }
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

function openSettings() {
  const activeView = document.querySelector('.app-view.is-active');
  previousMainView = activeView?.dataset.view === 'settings' ? 'profile' : activeView?.dataset.view || 'profile';
  switchView('settings');
  showSettingsMenu();
  document.querySelector('#settingsView').scrollTop = 0;
  window.setTimeout(() => backFromSettings.focus(), 0);
}

function showSettingsMenu() {
  activeSettingsDetail = '';
  settingsTitle.textContent = '设置';
  settingsMenu.hidden = false;
  settingsDetailPanels.forEach((panel) => {
    panel.hidden = true;
    panel.classList.remove('is-active');
  });
}

function openSettingsDetail(detailId) {
  activeSettingsDetail = detailId;
  settingsTitle.textContent = settingsDetailTitles[detailId] || '设置';
  settingsMenu.hidden = true;
  settingsDetailPanels.forEach((panel) => {
    const active = panel.id === detailId;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
  document.querySelector('#settingsView').scrollTop = 0;
  window.setTimeout(() => backFromSettings.focus(), 0);
}

navItems.forEach((item) => {
  item.addEventListener('click', () => switchView(item.dataset.target));
});

friendSearch.addEventListener('input', filterFriends);

document.querySelectorAll('.message-button').forEach((button) => {
  button.addEventListener('click', () => {
    const friendName = button.closest('[data-friend]').dataset.friend;
    showToast(`${friendName}的聊天功能正在准备中`);
    button.blur();
  });
});

settingsOpeners.forEach((button) => {
  button.addEventListener('click', openSettings);
});

settingsDetailButtons.forEach((button) => {
  button.addEventListener('click', () => openSettingsDetail(button.dataset.settingsDetail));
});

backFromSettings.addEventListener('click', () => {
  if (activeSettingsDetail) {
    showSettingsMenu();
    return;
  }
  switchView(previousMainView || 'profile');
});

profileEdit.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(profileEditMessage, '');
  const submit = profileEdit.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const result = await apiRequest('/api/profile', {
      avatarImage: selectedAvatarImage,
      nickname: editNickname.value,
      signature: editSignature.value,
    }, 'PUT');
    renderProfile(result.profile);
    setMessage(profileEditMessage, '资料已保存。', 'success');
  } catch (error) {
    setMessage(profileEditMessage, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

avatarUpload.addEventListener('change', async () => {
  setMessage(profileEditMessage, '');
  const [file] = avatarUpload.files || [];
  if (!file) return;
  try {
    selectedAvatarImage = await cropAvatarFile(file);
    renderAvatar(editAvatarPreview, {
      avatarImage: selectedAvatarImage,
    });
    setMessage(profileEditMessage, '头像已裁剪为 1:1，保存资料后生效。', 'success');
  } catch (error) {
    selectedAvatarImage = currentProfile?.avatarImage || '';
    avatarUpload.value = '';
    setMessage(profileEditMessage, error.message, 'error');
  }
});

feedbackPanel.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(feedbackStatus, '');
  const submit = feedbackPanel.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest('/api/feedback', {
      contact: feedbackPanel.elements.contact.value,
      message: feedbackPanel.elements.message.value,
    });
    feedbackPanel.reset();
    setMessage(feedbackStatus, '反馈已发送，谢谢你认真写下它。', 'success');
  } catch (error) {
    setMessage(feedbackStatus, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(passwordStatus, '');
  const formData = new FormData(passwordForm);
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');
  if (newPassword !== confirmPassword) {
    setMessage(passwordStatus, '两次输入的新密码不一致。', 'error');
    return;
  }
  const submit = passwordForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest('/api/account-password', {
      currentPassword: String(formData.get('currentPassword') || ''),
      newPassword,
    });
    passwordForm.reset();
    setMessage(passwordStatus, '密码已更新。', 'success');
  } catch (error) {
    setMessage(passwordStatus, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(emailStatus, '');
  const formData = new FormData(emailForm);
  const submit = emailForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    const result = await apiRequest('/api/account-email', {
      email: String(formData.get('email') || ''),
      currentPassword: String(formData.get('currentPassword') || ''),
    });
    renderProfile(result.profile);
    emailForm.elements.currentPassword.value = '';
    setMessage(emailStatus, '邮箱已更新。', 'success');
  } catch (error) {
    setMessage(emailStatus, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

deleteAccountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(deleteStatus, '');
  const formData = new FormData(deleteAccountForm);
  const submit = deleteAccountForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest('/api/account-delete', {
      password: String(formData.get('password') || ''),
      confirmText: String(formData.get('confirmText') || ''),
    });
    window.location.replace('/');
  } catch (error) {
    setMessage(deleteStatus, error.message, 'error');
    submit.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  clearInterval(activityTimer);
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } finally {
    window.location.replace('/');
  }
});

window.addEventListener('beforeunload', () => {
  clearInterval(activityTimer);
});

loadSession();
