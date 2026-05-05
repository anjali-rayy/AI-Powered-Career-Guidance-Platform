/* ── RESTORE UI INSTANTLY FROM CACHE (prevents flash on refresh) ── */
(function restoreFromCache() {
  const ini   = localStorage.getItem('displayIni')   || '';
  const first = localStorage.getItem('displayFirst') || '';
  const full  = localStorage.getItem('displayFull')  || '';
  const role  = localStorage.getItem('userRole')     || 'PathwayAI Member';
  if (ini) {
    document.getElementById('sidebar-av').textContent   = ini;
    document.getElementById('topbar-av').textContent    = ini;
  }
  if (full) document.getElementById('sidebar-name').textContent = full;
  if (role) document.getElementById('sidebar-role').textContent = role;
  if (first) {
    const hour  = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('dash-greeting').innerHTML = greet + ', <em>' + first + '</em> 👋';
  }
})();

/* ── LOAD FRESH DATA FROM MONGODB ── */
requireAuth().then(function() {

  /* ── PERSONALIZED DASHBOARD ── */
  const userName  = localStorage.getItem('userName')  || '';
  const userEmail = localStorage.getItem('userEmail') || '';
  const parts     = userName.trim().split(' ');
  const initials  = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : (userName.slice(0,2).toUpperCase() || 'U');
  const firstName = parts[0] || 'User';
  const userRole  = localStorage.getItem('userRole') || 'PathwayAI Member';

  const profileData   = JSON.parse(localStorage.getItem('profileData') || '{}');
  const displayFirst  = profileData.fname || (userName ? userName.split(' ')[0] : (userEmail ? userEmail.split('@')[0] : 'there'));
  const displayFull   = profileData.fname
    ? (profileData.fname + (profileData.lname ? ' ' + profileData.lname : ''))
    : (userName || (userEmail ? userEmail.split('@')[0] : 'User'));
  const displayParts  = displayFull.trim().split(' ');
  const displayIni    = displayParts.length >= 2
    ? (displayParts[0][0] + displayParts[1][0]).toUpperCase()
    : displayFull.slice(0, 2).toUpperCase() || 'U';

  document.getElementById('sidebar-av').textContent   = displayIni;
  document.getElementById('sidebar-name').textContent = displayFull || 'User';
  document.getElementById('sidebar-role').textContent = userRole;
  document.getElementById('topbar-av').textContent    = displayIni;

  // Save display state so it survives refresh
  localStorage.setItem('displayIni',   displayIni);
  localStorage.setItem('displayFirst', displayFirst);
  localStorage.setItem('displayFull',  displayFull);

  const hour  = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const qr = JSON.parse(localStorage.getItem('quizResult') || 'null');
  const careerHint = qr ? ` · Your top match: <span style="color:var(--gold)">${qr.career}</span>` : '';
  document.getElementById('dash-greeting').innerHTML  = greet + ', <em>' + displayFirst + '</em> 👋' + careerHint;

  /* ── LIVE STATS FROM BACKEND ── */
  (async function syncStats() {
    const el = (id) => document.getElementById(id);
    const _p = JSON.parse(localStorage.getItem('profileData') || '{}');

    // Show cached values instantly while fetching
    const cached = JSON.parse(localStorage.getItem('dashStats') || '{}');
    const skillsHaveCached = cached.skillsHave || (Array.isArray(_p.skills) ? _p.skills.length : 0);
    if (el('stat-readiness')) el('stat-readiness').textContent = cached.readiness || '—';
    if (el('stat-jobs'))      el('stat-jobs').textContent      = cached.jobsMatch || '—';
    if (el('stat-skills'))    el('stat-skills').textContent    = cached.skillsGap ?? '—';
    if (el('ring-rec-count'))   el('ring-rec-count').textContent   = cached.readiness || '—';
    if (el('ring-skills-have')) el('ring-skills-have').textContent = skillsHaveCached || '—';
    if (el('ring-skills-gap'))  el('ring-skills-gap').textContent  = cached.skillsGap ?? '—';
    if (el('ring-jobs-match'))  el('ring-jobs-match').textContent  = cached.jobsMatch || '—';

    // Render cached top roles immediately (before API fetch completes)
    if (cached.topRoles && cached.topRoles.length > 0) {
      const rolesEl = document.getElementById('stat-top-roles');
      if (rolesEl) {
        const colors = ['#3B5BDB', '#D4AF37', '#4CAF70'];
        rolesEl.innerHTML = cached.topRoles.map((role, i) => `
          <div class="stat-top-role-row">
            <span class="stat-role-dot" style="background:${colors[i] || '#A1A1AA'}"></span>
            <span class="stat-role-name">${role.name}</span>
            <span class="stat-role-pct">${role.score}%</span>
          </div>
        `).join('');
      }
    }

    // Fetch fresh data
    try {
      const token = localStorage.getItem('token');
      const res = await fetch((window.ENV_BACKEND_URL || 'http://localhost:3000') + '/api/dashboard/stats', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Stats fetch failed');
      const data = await res.json();

      // Update stat numbers
      if (el('stat-readiness')) el('stat-readiness').textContent = data.careerMatches || '—';
      if (el('stat-jobs'))      el('stat-jobs').textContent      = data.jobsMatched   || '—';
      if (el('stat-skills'))    el('stat-skills').textContent    = data.skillsMissing ?? 0;
      if (el('ring-rec-count'))   el('ring-rec-count').textContent   = data.careerMatches || '—';
      if (el('ring-skills-have')) el('ring-skills-have').textContent = data.skillsHave    || '—';
      if (el('ring-skills-gap'))  el('ring-skills-gap').textContent  = data.skillsMissing ?? 0;
      if (el('ring-jobs-match'))  el('ring-jobs-match').textContent  = data.jobsMatched   || '—';

      // Update Top Job Matches stat card with real roles
      const rolesEl = document.getElementById('stat-top-roles');
      if (rolesEl && data.topRoles && data.topRoles.length > 0) {
        const colors = ['#3B5BDB', '#D4AF37', '#4CAF70'];
        rolesEl.innerHTML = data.topRoles.map((role, i) => `
          <div class="stat-top-role-row">
            <span class="stat-role-dot" style="background:${colors[i] || '#A1A1AA'}"></span>
            <span class="stat-role-name">${role.name}</span>
            <span class="stat-role-pct">${role.score}%</span>
          </div>
        `).join('');
      }

      // Update Career Path Matches section with real data
      const careerBody = document.querySelector('.d-card .d-card-body');
      if (careerBody && data.topRoles && data.topRoles.length > 0) {
        const roleEmojis = ['💻', '🎨', '📊', '⚙️', '🚀', '🔬', '📱', '☁️'];
        const roleColors = [
          'rgba(59,91,219,0.12)', 'rgba(212,175,55,0.1)', 'rgba(46,107,62,0.12)',
          'rgba(107,44,44,0.12)', 'rgba(139,92,246,0.12)', 'rgba(20,184,166,0.12)'
        ];
        const roleBorders = [
          'rgba(59,91,219,0.2)', 'rgba(212,175,55,0.18)', 'rgba(46,107,62,0.2)',
          'rgba(107,44,44,0.2)', 'rgba(139,92,246,0.2)', 'rgba(20,184,166,0.2)'
        ];
        const displayRoles = data.topRoles.slice(0, 4);
        careerBody.innerHTML = displayRoles.map((role, i) => {
          const missingCount = role.missing ? role.missing.length : 0;
          const skillsPreview = role.matched && role.matched.length
            ? role.matched.slice(0, 3).join(' · ') + (missingCount ? ` · ${missingCount} missing` : '')
            : `${missingCount} skills to learn`;
          return `
            <div class="career-match" onclick="showToast('Opening ${role.name} details...')">
              <div class="cm-icon" style="background:${roleColors[i]};border:1px solid ${roleBorders[i]}">
                ${roleEmojis[i] || '💼'}
              </div>
              <div class="cm-info">
                <div class="cm-title">${role.name}</div>
                <div class="cm-meta">${skillsPreview}</div>
                <div class="cm-bar-row">
                  <div class="cm-bar-bg">
                    <div class="cm-bar-fill" style="width:${role.score}%"></div>
                  </div>
                </div>
              </div>
              <div class="cm-score">
                <div class="cm-pct">${role.score}%</div>
                <div class="cm-pct-sub">match</div>
              </div>
            </div>`;
        }).join('');
      }

      // Cache for next load
      localStorage.setItem('dashStats', JSON.stringify({
        readiness:  data.careerMatches,
        jobsMatch:  data.jobsMatched,
        skillsGap:  data.skillsMissing,
        skillsHave: data.skillsHave,
        matches:    data.careerMatches
      }));

    } catch (err) {
      console.warn('Dashboard stats fetch failed, using cached data:', err);
    }
  })();

  /* ── PROFILE COMPLETION ── */
  (function updateCompletion() {
    const p = JSON.parse(localStorage.getItem('profileData') || '{}');
    const checks = [
      { done: !!(p.fname || userName),                  label: 'Basic profile added',       doneLabel: 'Basic profile added ✓' },
      { done: !!(p.email || userEmail),                 label: 'Email added',               doneLabel: 'Email added ✓' },
      { done: !!p.location,                             label: 'Location added',            doneLabel: 'Location added ✓' },
      { done: !!p.eduLevel,                             label: 'Education details filled',  doneLabel: 'Education details filled ✓' },
      { done: !!(p.skills && p.skills.length >= 3),     label: 'Add at least 3 skills',     doneLabel: 'Skills list updated ✓' },
      { done: !!p.bio,                                  label: 'Write a bio',               doneLabel: 'Bio written ✓' },
      { done: !!localStorage.getItem('quizResult'),     label: 'Complete career quiz',       doneLabel: 'Career quiz completed ✓' },
      { done: !!localStorage.getItem('userResume'),     label: 'Upload your resume',         doneLabel: 'Resume uploaded ✓' },
    ];
    const done = checks.filter(c => c.done).length;
    const pct  = Math.round((done / checks.length) * 100);

    const pctEl = document.getElementById('dash-completion-pct');
    const barEl = document.getElementById('dash-completion-bar');
    if (pctEl) pctEl.textContent = pct + '%';
    if (barEl) barEl.style.width = pct + '%';

    const container = document.getElementById('dash-profile-items') || document.querySelector('.profile-items');
    if (container) {
      container.innerHTML = checks.map(c => `
        <div class="profile-item">
          <div class="pi-check ${c.done ? 'done' : 'todo'}">${c.done ? '✓' : '○'}</div>
          <span class="pi-label ${c.done ? '' : 'todo'}">${c.done ? c.doneLabel : c.label}</span>
        </div>
      `).join('');
    }
  })();

  

  /* ── AVATAR DROPDOWN ── */
  function toggleAvatarMenu() {
    const menu = document.getElementById('avatar-menu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    document.getElementById('menu-name').textContent  = localStorage.getItem('userName')  || 'User';
    document.getElementById('menu-email').textContent = localStorage.getItem('userEmail') || '—';
  }
  document.addEventListener('click', function(e) {
    const menu = document.getElementById('avatar-menu');
    const av   = document.getElementById('topbar-av');
    if (menu && !menu.contains(e.target) && !av.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  // Expose toggleAvatarMenu globally so onclick in HTML works
  window.toggleAvatarMenu = toggleAvatarMenu;

}); // end requireAuth

window.signOut = function signOut() {
  const keysToKeep = [];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(key => {
    if (key === 'profileData' || key.startsWith('settings_')) {
      keysToKeep.push({ key, value: localStorage.getItem(key) });
    }
  });
  localStorage.clear();
  keysToKeep.forEach(item => localStorage.setItem(item.key, item.value));
  window.location.href = '../public/index.html';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
window.showToast = showToast;