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
const friendList = document.querySelector('#friendList');
const visibleFriendCount = document.querySelector('#visibleFriendCount');
const emptyFriends = document.querySelector('#emptyFriends');
const friendsHome = document.querySelector('#friendsHome');
const friendRequestsPage = document.querySelector('#friendRequestsPage');
const incomingRequestList = document.querySelector('#incomingRequestList');
const outgoingRequestList = document.querySelector('#outgoingRequestList');
const incomingRequestCount = document.querySelector('#incomingRequestCount');
const outgoingRequestCount = document.querySelector('#outgoingRequestCount');
const emptyIncomingRequests = document.querySelector('#emptyIncomingRequests');
const emptyOutgoingRequests = document.querySelector('#emptyOutgoingRequests');
const friendRequestCount = document.querySelector('#friendRequestCount');
const friendRequestSummary = document.querySelector('#friendRequestSummary');
const friendNavBadge = document.querySelector('#friendNavBadge');
const openFriendRequests = document.querySelector('#openFriendRequests');
const openAddFriend = document.querySelector('#openAddFriend');
const backFromChat = document.querySelector('#backFromChat');
const friendsTitle = document.querySelector('#friendsTitle');
const chatPage = document.querySelector('#chatPage');
const chatMessages = document.querySelector('#chatMessages');
const chatEmpty = document.querySelector('#chatEmpty');
const chatForm = document.querySelector('#chatForm');
const chatInput = document.querySelector('#chatInput');
const addFriendModal = document.querySelector('#addFriendModal');
const addFriendForm = document.querySelector('#addFriendForm');
const addFriendUsername = document.querySelector('#addFriendUsername');
const addFriendMessage = document.querySelector('#addFriendMessage');
const userSearchResult = document.querySelector('#userSearchResult');
const addFriendClosers = document.querySelectorAll('[data-close-add-friend]');
const appToast = document.querySelector('#appToast');
const settingsOpeners = document.querySelectorAll('#openSettings');
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
let friendsData = { friends: [], incoming: [], outgoing: [] };
let activeFriend = null;
let friendRefreshTimer = null;
let chatRefreshTimer = null;
const MAX_AVATAR_DATA_LENGTH = 210000;

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

  if (target === 'friends') {
    showFriendsHome();
    loadFriends().catch((error) => showToast(error.message));
  } else {
    stopChatRefresh();
  }
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

  const source = await readImageFile(file);
  const image = await loadImage(source);
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.floor((image.naturalWidth - size) / 2);
  const sourceY = Math.floor((image.naturalHeight - size) / 2);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const attempts = [];
  for (const outputSize of [320, 288, 256, 224, 192, 160, 128]) {
    attempts.push({ outputSize, type: 'image/png' });
    for (const quality of [0.92, 0.82, 0.72, 0.62]) {
      attempts.push({ outputSize, type: 'image/webp', quality });
    }
    for (const quality of [0.9, 0.78, 0.66]) {
      attempts.push({ outputSize, type: 'image/jpeg', quality });
    }
  }

  for (const attempt of attempts) {
    const { outputSize, type, quality } = attempt;
    canvas.width = outputSize;
    canvas.height = outputSize;
    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(image, sourceX, sourceY, size, size, 0, 0, outputSize, outputSize);
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrl.length <= MAX_AVATAR_DATA_LENGTH) return dataUrl;
  }

  throw new Error('头像自动压缩失败，请换一张图片。');
}

async function apiRequest(endpoint, payload, method = 'POST') {
  let response;
  try {
    const options = {
      method,
      credentials: 'same-origin',
    };
    if (payload != null) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }
    response = await fetch(endpoint, options);
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
    await loadFriends();
    friendRefreshTimer = window.setInterval(() => {
      loadFriends({ quiet: true }).catch(() => {});
    }, 15000);
    activityTimer = window.setInterval(() => {
      refreshSession().catch(() => {});
    }, 60 * 1000);
  } catch {
    window.location.replace('/');
  }
}

function createAvatar(profile, className = 'friend-avatar') {
  const avatar = document.createElement('div');
  avatar.className = className;
  avatar.setAttribute('aria-hidden', 'true');
  if (profile.avatarImage) {
    avatar.classList.add('has-image');
    avatar.style.backgroundImage = `url("${profile.avatarImage}")`;
  }
  return avatar;
}

function formatPresence(friend) {
  if (friend.online) return '在线';
  if (!friend.lastSeenAt) return '最近未上线';
  const elapsed = Math.max(0, Date.now() - new Date(friend.lastSeenAt).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟前在线`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前在线`;
  return `${Math.floor(hours / 24)} 天前在线`;
}

function renderFriendList() {
  const query = friendSearch.value.normalize('NFKC').trim().toLowerCase();
  const visibleFriends = friendsData.friends.filter((friend) => (
    friend.username.toLowerCase().includes(query)
    || friend.nickname.toLowerCase().includes(query)
  ));
  friendList.replaceChildren();

  visibleFriends.forEach((friend) => {
    const row = document.createElement('li');
    row.className = 'friend-row';
    row.dataset.friendId = String(friend.id);
    const avatar = createAvatar(friend);
    const info = document.createElement('span');
    info.className = 'friend-info';
    const name = document.createElement('strong');
    name.textContent = friend.nickname;
    const preview = document.createElement('span');
    const presence = document.createElement('i');
    presence.className = `presence${friend.online ? ' is-online' : ''}`;
    preview.append(presence, document.createTextNode(
      friend.lastMessage || formatPresence(friend),
    ));
    info.append(name, preview);

    const side = document.createElement('span');
    side.className = 'friend-row-side';
    if (friend.unreadCount) {
      const unread = document.createElement('b');
      unread.className = 'unread-badge';
      unread.textContent = friend.unreadCount > 99 ? '99+' : String(friend.unreadCount);
      side.append(unread);
    }
    const chevron = document.createElement('span');
    chevron.className = 'friend-chevron';
    chevron.textContent = '›';
    side.append(chevron);
    row.append(avatar, info, side);
    row.addEventListener('click', () => openChat(friend));
    friendList.append(row);
  });

  visibleFriendCount.textContent = String(visibleFriends.length);
  emptyFriends.hidden = visibleFriends.length !== 0;
  emptyFriends.textContent = friendsData.friends.length
    ? '没有找到这个好友'
    : '还没有好友，点击右上角添加';
}

function createRequestRow(request, incoming) {
  const row = document.createElement('li');
  row.className = 'request-row';
  const avatar = createAvatar(request);
  const info = document.createElement('span');
  info.className = 'friend-info';
  const name = document.createElement('strong');
  name.textContent = request.nickname;
  const account = document.createElement('span');
  account.textContent = `账号：${request.username}`;
  info.append(name, account);
  row.append(avatar, info);

  if (incoming) {
    const actions = document.createElement('span');
    actions.className = 'request-actions';
    const decline = document.createElement('button');
    decline.type = 'button';
    decline.className = 'request-decline';
    decline.textContent = '拒绝';
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'request-accept';
    accept.textContent = '同意';
    decline.addEventListener('click', () => respondToFriendRequest(request.friendshipId, 'decline'));
    accept.addEventListener('click', () => respondToFriendRequest(request.friendshipId, 'accept'));
    actions.append(decline, accept);
    row.append(actions);
  } else {
    const pending = document.createElement('span');
    pending.className = 'request-pending';
    pending.textContent = '等待验证';
    row.append(pending);
  }
  return row;
}

function renderFriendRequests() {
  incomingRequestList.replaceChildren(...friendsData.incoming.map((item) => createRequestRow(item, true)));
  outgoingRequestList.replaceChildren(...friendsData.outgoing.map((item) => createRequestRow(item, false)));
  incomingRequestCount.textContent = String(friendsData.incoming.length);
  outgoingRequestCount.textContent = String(friendsData.outgoing.length);
  emptyIncomingRequests.hidden = friendsData.incoming.length !== 0;
  emptyOutgoingRequests.hidden = friendsData.outgoing.length !== 0;

  const count = friendsData.incoming.length;
  friendRequestCount.hidden = count === 0;
  friendNavBadge.hidden = count === 0;
  friendRequestCount.textContent = String(count);
  friendNavBadge.textContent = count > 9 ? '9+' : String(count);
  friendRequestSummary.textContent = count ? `${count} 个申请待处理` : '暂无新的好友申请';
}

async function loadFriends({ quiet = false } = {}) {
  try {
    friendsData = await apiRequest('/api/friends', null, 'GET');
    renderFriendList();
    renderFriendRequests();
  } catch (error) {
    if (!quiet) throw error;
  }
}

function showFriendsHome() {
  stopChatRefresh();
  activeFriend = null;
  friendsTitle.textContent = '好友';
  backFromChat.hidden = true;
  openAddFriend.hidden = false;
  friendsHome.hidden = false;
  friendRequestsPage.hidden = true;
  chatPage.hidden = true;
}

function showFriendRequestsPage() {
  stopChatRefresh();
  friendsTitle.textContent = '好友申请';
  backFromChat.hidden = false;
  openAddFriend.hidden = true;
  friendsHome.hidden = true;
  friendRequestsPage.hidden = false;
  chatPage.hidden = true;
}

function renderMessages(messages) {
  const wasNearBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 100;
  chatMessages.replaceChildren();
  messages.forEach((message) => {
    const bubble = document.createElement('article');
    const mine = Number(message.senderId) === Number(currentProfile.id);
    bubble.className = `chat-message${mine ? ' is-mine' : ''}`;
    const body = document.createElement('p');
    body.textContent = message.body;
    const time = document.createElement('time');
    const date = new Date(`${message.createdAt.replace(' ', 'T')}Z`);
    time.textContent = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    bubble.append(body, time);
    chatMessages.append(bubble);
  });
  chatEmpty.hidden = messages.length !== 0;
  if (wasNearBottom || messages.length <= 1) chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function loadMessages({ quiet = false } = {}) {
  if (!activeFriend) return;
  try {
    const result = await apiRequest(`/api/messages?friendId=${activeFriend.id}`, null, 'GET');
    renderMessages(result.messages || []);
    const friend = friendsData.friends.find((item) => item.id === activeFriend.id);
    if (friend) friend.unreadCount = 0;
    renderFriendList();
  } catch (error) {
    if (!quiet) showToast(error.message);
  }
}

function stopChatRefresh() {
  clearInterval(chatRefreshTimer);
  chatRefreshTimer = null;
}

async function openChat(friend) {
  activeFriend = friend;
  friendsTitle.textContent = friend.nickname;
  backFromChat.hidden = false;
  openAddFriend.hidden = true;
  friendsHome.hidden = true;
  friendRequestsPage.hidden = true;
  chatPage.hidden = false;
  chatMessages.replaceChildren();
  chatEmpty.hidden = false;
  await loadMessages();
  stopChatRefresh();
  chatRefreshTimer = window.setInterval(() => loadMessages({ quiet: true }), 3000);
  chatInput.focus();
}

async function respondToFriendRequest(friendshipId, action) {
  try {
    await apiRequest('/api/friend-response', { friendshipId, action });
    showToast(action === 'accept' ? '已成为好友' : '已拒绝申请');
    await loadFriends();
  } catch (error) {
    showToast(error.message);
  }
}

function openAddFriendModal() {
  addFriendModal.hidden = false;
  addFriendForm.reset();
  userSearchResult.hidden = true;
  setMessage(addFriendMessage, '输入对方注册时使用的完整账号');
  window.setTimeout(() => addFriendUsername.focus(), 0);
}

function closeAddFriendModal() {
  addFriendModal.hidden = true;
  userSearchResult.hidden = true;
  openAddFriend.focus();
}

function renderSearchResult(user) {
  userSearchResult.replaceChildren();
  if (!user) {
    userSearchResult.hidden = true;
    setMessage(addFriendMessage, '没有找到这个账号。', 'error');
    return;
  }
  const avatar = createAvatar(user);
  const info = document.createElement('span');
  info.className = 'friend-info';
  const name = document.createElement('strong');
  name.textContent = user.nickname;
  const account = document.createElement('span');
  account.textContent = `账号：${user.username}`;
  info.append(name, account);
  const action = document.createElement('button');
  action.type = 'button';
  const statuses = {
    accepted: '已是好友',
    outgoing: '等待验证',
    incoming: '去处理申请',
    none: '添加',
  };
  action.textContent = statuses[user.relationshipStatus] || '添加';
  action.disabled = ['accepted', 'outgoing'].includes(user.relationshipStatus);
  action.addEventListener('click', async () => {
    if (user.relationshipStatus === 'incoming') {
      closeAddFriendModal();
      showFriendRequestsPage();
      return;
    }
    action.disabled = true;
    try {
      await apiRequest('/api/friend-request', { username: user.username });
      action.textContent = '等待验证';
      setMessage(addFriendMessage, '好友申请已发送。', 'success');
      await loadFriends({ quiet: true });
    } catch (error) {
      action.disabled = false;
      setMessage(addFriendMessage, error.message, 'error');
    }
  });
  userSearchResult.append(avatar, info, action);
  userSearchResult.hidden = false;
  setMessage(addFriendMessage, '');
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

friendSearch.addEventListener('input', renderFriendList);
openAddFriend.addEventListener('click', openAddFriendModal);
openFriendRequests.addEventListener('click', showFriendRequestsPage);
backFromChat.addEventListener('click', showFriendsHome);
addFriendClosers.forEach((button) => button.addEventListener('click', closeAddFriendModal));

addFriendForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = addFriendForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  userSearchResult.hidden = true;
  setMessage(addFriendMessage, '正在查找…');
  try {
    const result = await apiRequest(
      `/api/user-search?q=${encodeURIComponent(addFriendUsername.value.trim())}`,
      null,
      'GET',
    );
    renderSearchResult(result.user);
  } catch (error) {
    setMessage(addFriendMessage, error.message, 'error');
  } finally {
    submit.disabled = false;
  }
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!activeFriend) return;
  const body = chatInput.value.trim();
  if (!body) return;
  const submit = chatForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await apiRequest('/api/messages', { friendId: activeFriend.id, body });
    chatInput.value = '';
    await loadMessages();
    chatInput.focus();
  } catch (error) {
    showToast(error.message);
  } finally {
    submit.disabled = false;
  }
});

chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !addFriendModal.hidden) closeAddFriendModal();
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
    setMessage(profileEditMessage, '头像已自动裁剪压缩，保存资料后生效。', 'success');
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
  clearInterval(friendRefreshTimer);
  stopChatRefresh();
});

loadSession();
