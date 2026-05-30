const API_URL = (window.ENV_BACKEND_URL || 'https://pathwayai-backend-2qor.onrender.com') + '/api';

// ── TOKEN HELPERS ──
function getToken()         { return localStorage.getItem('token'); }
function setToken(token)    { localStorage.setItem('token', token); }
function removeToken()      { localStorage.removeItem('token'); }

// ── BASE FETCH ──
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
  } catch (err) {
    if (err.message === 'Failed to fetch') {
      throw new Error('Server is waking up — please wait 30 seconds and try again.');
    }
    throw err;
  }
}

// ── AUTH GUARD: call on every protected page ──
async function requireAuth() {
  const token = getToken();
  if (!token) { showAuthModal(); return null; }

  try {
    const data = await apiFetch('/verify');
    if (!data.valid) { showAuthModal(); return null; }
    syncUserToStorage(data.user);
    return data.user;
  } catch {
    showAuthModal();
    return null;
  }
}

function showAuthModal() {
  localStorage.setItem('redirectAfterLogin', window.location.href);
  const existing = document.getElementById('auth-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'auth-modal-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);
    z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#111111;border:1px solid rgba(212,175,55,0.2);border-radius:20px;
      padding:40px 36px;max-width:420px;width:100%;text-align:center;
      box-shadow:0 30px 80px rgba(0,0,0,0.8);position:relative;
    ">
      <div style="width:52px;height:52px;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.25);
        border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" stroke-width="1.8" stroke-linecap="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div style="font-size:20px;font-weight:700;color:#F5F5F5;margin-bottom:8px;">Sign in to continue</div>
      <div style="font-size:14px;color:#A1A1AA;margin-bottom:28px;line-height:1.6;">
        This feature requires a free PathwayAI account.<br/>Sign in or create an account to access it.
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="../auth/login.html" style="
          display:block;background:#D4AF37;color:#0A0A0A;font-weight:700;
          font-size:14px;padding:13px;border-radius:10px;text-decoration:none;
          font-family:'Inter',sans-serif;transition:opacity 0.2s;
        " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
          Sign In →
        </a>
        <a href="../auth/register.html" style="
          display:block;background:rgba(255,255,255,0.05);color:#F5F5F5;font-weight:600;
          font-size:14px;padding:13px;border-radius:10px;text-decoration:none;
          border:1px solid rgba(255,255,255,0.1);font-family:'Inter',sans-serif;
        " onmouseover="this.style.background='rgba(255,255,255,0.09)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
          Create Free Account
        </a>
        <button onclick="document.getElementById('auth-modal-overlay').remove()" style="
          background:none;border:none;color:#71717A;font-size:13px;cursor:pointer;
          margin-top:4px;font-family:'Inter',sans-serif;padding:4px;
        ">Maybe later</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.remove();
  });
}

// ── SYNC USER TO LOCALSTORAGE (for UI rendering) ──
function syncUserToStorage(user) {
  const fullName = user.lname ? `${user.fname} ${user.lname}` : user.fname;
  localStorage.setItem('userName',  fullName || '');
  localStorage.setItem('userEmail', user.email || '');
  if (user.eduLevel) {
    const role = user.eduLevel + (user.eduField ? ' · ' + user.eduField.split('/')[0].trim() : '');
    localStorage.setItem('userRole', role);
  }
  localStorage.setItem('profileData', JSON.stringify({
    fname:      user.fname      || '',
    lname:      user.lname      || '',
    email:      user.email      || '',
    phone:      user.phone      || '',
    location:   user.location   || '',
    bio:        user.bio        || '',
    college:    user.college    || '',
    eduLevel:   user.eduLevel   || '',
    eduField:   user.eduField   || '',
    gradYear:   user.gradYear   || '',
    experience: user.experience || '',
    interest:   user.interest   || '',
    skills:     user.skills     || []
  }));
  if (user.quizResult) localStorage.setItem('quizResult', JSON.stringify(user.quizResult));
}


// ── REGISTER ──
async function apiRegister(data) {
  const result = await apiFetch('/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  setToken(result.token);
  syncUserToStorage(result.user);
  return result;
}

// ── LOGIN ──
async function apiLogin(email, password) {
  const result = await apiFetch('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(result.token);
  syncUserToStorage(result.user);
  return result;
}

// ── UPDATE PROFILE ──
async function apiUpdateProfile(profileData) {
  const result = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
  syncUserToStorage(result.user);
  return result;
}

// ── CHANGE PASSWORD ──
async function apiChangePassword(currentPassword, newPassword) {
  return await apiFetch('/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword })
  });
}

// ── DELETE ACCOUNT ──
async function apiDeleteAccount() {
  await apiFetch('/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirmText: 'DELETE' })
  });
  localStorage.clear();
  removeToken();
  window.location.href = '../public/index.html';
}

// ── SIGN OUT ──
function signOut() {
  // Keep settings preferences, clear auth
  const settingsKeys = [];
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('settings_')) settingsKeys.push({ k, v: localStorage.getItem(k) });
  });
  localStorage.clear();
  removeToken();
  settingsKeys.forEach(({ k, v }) => localStorage.setItem(k, v));
  window.location.href = '../public/index.html';
}

// Handle Google redirect result on page load
firebase.auth().getRedirectResult().then(async (result) => {
  if (!result || !result.user) return;
  const fbUser = result.user;
  try {
    const res = await fetch((window.ENV_BACKEND_URL || 'https://pathwayai-backend-2qor.onrender.com') + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    fbUser.email,
        fname:    fbUser.displayName?.split(' ')[0] || '',
        lname:    fbUser.displayName?.split(' ').slice(1).join(' ') || '',
        googleId: fbUser.uid
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
    setToken(data.token);
    syncUserToStorage(data.user);
    showToast('✓ Signed in with Google!');
    const redirect = localStorage.getItem('authRedirect') || localStorage.getItem('redirectAfterLogin');
    localStorage.removeItem('authRedirect');
    localStorage.removeItem('redirectAfterLogin');
    setTimeout(() => window.location.href = redirect || '../app/dashboard.html', 900);
  } catch (err) {
    showToast('Google sign-in failed: ' + err.message);
  }
}).catch((err) => {
  if (err.code !== 'auth/no-auth-event') {
    console.error('Redirect result error:', err);
  }
});