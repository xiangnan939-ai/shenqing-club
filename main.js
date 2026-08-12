const currentUser = document.querySelector('#currentUser');
const logoutButton = document.querySelector('#logoutButton');

async function loadSession() {
  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Unauthorized');
    const session = await response.json();
    currentUser.textContent = session.username;
    document.body.classList.remove('session-loading');
  } catch {
    window.location.replace('/');
  }
}

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
