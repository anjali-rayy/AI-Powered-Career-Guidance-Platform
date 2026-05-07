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

    // Render cached skill gap immediately
    if (cached.skillGapRows && cached.skillGapRows.length > 0) {
      const body = document.getElementById('skill-gap-body');
      const skillGapCard = body ? body.closest('.d-card') : null;
      if (body) {
        const subEl = skillGapCard ? skillGapCard.querySelector('.d-card-sub') : null;
        if (subEl && cached.skillGapRole) subEl.textContent = cached.skillGapRole + ' · top match';
        if (body) {
          body.innerHTML = cached.skillGapRows.map(row => `
            <div class="skill-gap-row">
              <span class="sg-name" style="text-transform:capitalize">${row.name}</span>
              <div class="sg-bar-bg">
                <div class="sg-bar-fill ${row.have ? 'have' : 'gap'}" style="width:${row.pct}%"></div>
              </div>
              <span class="sg-pct ${row.have ? 'have' : 'gap'}">${row.pct}%</span>
              <span class="sg-tag ${row.have ? 'have' : 'gap'}">${row.have ? 'Have' : 'Gap'}</span>
            </div>
          `).join('');
        }
      }
    }

    // Render cached job matches immediately
    if (cached.topJobMatches && cached.topJobMatches.length > 0) {
      const body = document.getElementById('top-job-matches-body');
      if (body) {
        if (body) {
          const jobEmojis = ['💻', '🎨', '📊', '⚙️', '🚀', '🔬', '📱', '☁️'];
          body.innerHTML = cached.topJobMatches.map((job, i) => `
            <div class="job-row" onclick="showToast('Opening ${job.title}...')">
              <div class="job-logo">${jobEmojis[i] || '💼'}</div>
              <div class="job-info">
                <div class="job-title">${job.title}</div>
                <div class="job-company">${job.company}</div>
                <div class="job-tags">
                  ${job.tags.map(t => `<span class="job-tag" style="text-transform:capitalize">${t}</span>`).join('')}
                </div>
              </div>
              <div class="job-right">
                <div class="job-match">${job.score}%</div>
                <div class="job-match-sub">match</div>
                <button class="job-save-btn" id="save-cached-${i}" onclick="event.stopPropagation();saveJob(this,'${job.title.replace(/'/g,"\\'")}','${job.company.replace(/'/g,"\\'")}',${job.score},[${(job.tags||[]).map(t=>`'${t}'`).join(',')}])">♡</button>
              </div>
            </div>
          `).join('');
        }
      }
    }

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
      const careerBody = document.getElementById('career-matches-body');
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

      // ── Update Skill Gap Analysis section ──
      const skillGapBody = document.getElementById('skill-gap-body');
      const skillGapCard = skillGapBody ? skillGapBody.closest('.d-card') : null;
      if (skillGapBody && data.skillGapRows && data.skillGapRows.length > 0) {
        const subEl = skillGapCard ? skillGapCard.querySelector('.d-card-sub') : null;
        if (subEl) subEl.textContent = (data.skillGapRole || 'Top match') + ' · top match';
        const body = skillGapBody;
        if (body) {
          body.innerHTML = data.skillGapRows.map(row => `
            <div class="skill-gap-row">
              <span class="sg-name" style="text-transform:capitalize">${row.name}</span>
              <div class="sg-bar-bg">
                <div class="sg-bar-fill ${row.have ? 'have' : 'gap'}" style="width:${row.pct}%"></div>
              </div>
              <span class="sg-pct ${row.have ? 'have' : 'gap'}">${row.pct}%</span>
              <span class="sg-tag ${row.have ? 'have' : 'gap'}">${row.have ? 'Have' : 'Gap'}</span>
            </div>
          `).join('');
        }
      }

      // ── Update Top Job Matches section ──
      const jobMatchBody = document.getElementById('top-job-matches-body');
      const jobMatchCard = jobMatchBody ? jobMatchBody.closest('.d-card') : null;
      if (jobMatchBody && data.topJobMatches && data.topJobMatches.length > 0) {
        const subEl = jobMatchCard ? jobMatchCard.querySelector('.d-card-sub') : null;
        if (subEl) subEl.textContent = data.topJobMatches.length + ' total · sorted by fit score';
        const body = jobMatchBody;
        if (body) {
          const jobEmojis = ['💻', '🎨', '📊', '⚙️', '🚀', '🔬', '📱', '☁️'];
          body.innerHTML = data.topJobMatches.map((job, i) => `
            <div class="job-row" onclick="showToast('Opening ${job.title}...')">
              <div class="job-logo">${jobEmojis[i] || '💼'}</div>
              <div class="job-info">
                <div class="job-title">${job.title}</div>
                <div class="job-company">${job.company}</div>
                <div class="job-tags">
                  ${job.tags.map(t => `<span class="job-tag" style="text-transform:capitalize">${t}</span>`).join('')}
                </div>
              </div>
              <div class="job-right">
                <div class="job-match">${job.score}%</div>
                <div class="job-match-sub">match</div>
                <button class="job-save-btn" id="save-live-${i}" onclick="event.stopPropagation();saveJob(this,'${job.title.replace(/'/g,"\\'")}','${job.company.replace(/'/g,"\\'")}',${job.score},[${(job.tags||[]).map(t=>`'${t}'`).join(',')}])">♡</button>
              </div>
            </div>
          `).join('');
        }
      }

      // Cache for next load
      localStorage.setItem('dashStats', JSON.stringify({
        readiness:       data.careerMatches,
        jobsMatch:       data.jobsMatched,
        skillsGap:       data.skillsMissing,
        skillsHave:      data.skillsHave,
        matches:         data.careerMatches,
        topRoles:        data.topRoles,
        skillGapRows:    data.skillGapRows,
        skillGapRole:    data.skillGapRole,
        topJobMatches:   data.topJobMatches,
        careerMatchList: data.careerMatchList
      }));

    } catch (err) {
      console.warn('Dashboard stats fetch failed, using cached data:', err);
    }
  })();

  /* ── RECENT ACTIVITY + SAVED JOBS ── */
  (async function loadActivityAndJobs() {
    const token = localStorage.getItem('token');
    const BASE = window.ENV_BACKEND_URL || 'http://localhost:3000';

    function timeAgo(dateStr) {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs  = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 2)  return 'Just now';
      if (mins < 60) return mins + ' minutes ago';
      if (hrs  < 24) return hrs + ' hours ago';
      if (days === 1) return 'Yesterday';
      return days + ' days ago';
    }

    // Load activity
    try {
      const res = await fetch(BASE + '/api/activity', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const acts = data.activity || [];
      const subEl = document.getElementById('activity-sub');
      const listEl = document.getElementById('activity-list');
      if (subEl) subEl.textContent = 'Your last ' + (acts.length || 0) + ' actions';
      if (listEl) {
        if (acts.length === 0) {
          listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No activity yet — start by running a recommendation!</div>';
        } else {
          listEl.innerHTML = acts.map((a, i) => `
            <div class="activity-item">
              <div class="activity-dot-wrap">
                <div class="activity-dot ${a.dot || 'muted'}"></div>
                ${i < acts.length - 1 ? '<div class="activity-line"></div>' : ''}
              </div>
              <div>
                <div class="activity-text">${a.text}</div>
                <div class="activity-time">${timeAgo(a.time)}</div>
              </div>
            </div>
          `).join('');
        }
      }
    } catch (e) {
      const listEl = document.getElementById('activity-list');
      if (listEl) listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0">Could not load activity.</div>';
    }

    // Load saved jobs
    try {
      const res = await fetch(BASE + '/api/jobs/saved', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      const jobs = data.savedJobs || [];
      const subEl = document.getElementById('saved-jobs-sub');
      const bodyEl = document.getElementById('saved-jobs-body');
      if (subEl) subEl.textContent = jobs.length + ' saved · 0 applied';
      if (bodyEl) {
        if (jobs.length === 0) {
          bodyEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:20px 0;text-align:center">No saved jobs yet — save jobs from the Top Job Matches section!</div>';
        } else {
          const top = jobs[0];
          bodyEl.innerHTML = `
            <div class="job-row" onclick="showToast('Opening ${top.title}...')">
              <div class="job-logo">${top.logo || '💼'}</div>
              <div class="job-info">
                <div class="job-title">${top.title}</div>
                <div class="job-company">${top.company}</div>
              </div>
              <div class="job-right">
                <div class="job-match">${top.score}%</div>
                <div class="job-match-sub">match</div>
              </div>
            </div>
            <div style="padding-top:12px">
              <button onclick="showToast('Opening application form...')" class="btn-primary"
                style="width:100%;padding:10px;font-size:13px;justify-content:center">Apply Now →</button>
            </div>
          `;
        }
      }
    } catch (e) {
      const bodyEl = document.getElementById('saved-jobs-body');
      if (bodyEl) bodyEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:16px 0">Could not load saved jobs.</div>';
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

/* ── RUN ANALYSIS MODAL ── */
window.openAnalysisModal = function() {
  const overlay = document.getElementById('analysis-modal-overlay');
  overlay.style.display = 'flex';
  document.getElementById('analysis-options').style.display = 'block';
  document.getElementById('analysis-loading').style.display = 'none';
};

window.closeAnalysisModal = function() {
  document.getElementById('analysis-modal-overlay').style.display = 'none';
};

// Close on backdrop click
document.addEventListener('DOMContentLoaded', function() {
  const overlay = document.getElementById('analysis-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeAnalysisModal();
    });
  }
});

window.runAnalysisOption = async function(type) {
  const options  = document.getElementById('analysis-options');
  const loading  = document.getElementById('analysis-loading');
  const loadText = document.getElementById('analysis-loading-text');

  if (type === 'career') {
    closeAnalysisModal();
    window.location.href = '../app/career-recommendation.html';
    return;
  }
  if (type === 'resume') {
    closeAnalysisModal();
    window.location.href = '../app/resume-analysis.html';
    return;
  }
  if (type === 'quiz') {
    closeAnalysisModal();
    window.location.href = '../app/quiz-assessment.html';
    return;
  }
  if (type === 'roadmap') {
    closeAnalysisModal();
    window.location.href = '../app/roadmap.html';
    return;
  }

  // type === 'dashboard' — refresh stats live
  options.style.display = 'none';
  loading.style.display = 'block';
  loadText.textContent  = 'Refreshing your dashboard...';

  try {
    const token = localStorage.getItem('token');
    const BASE  = window.ENV_BACKEND_URL || 'http://localhost:3000';

    const res = await fetch(BASE + '/api/dashboard/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();

    loadText.textContent = 'Updating stats...';
    await new Promise(r => setTimeout(r, 600)); // small pause so user sees it working

    const el = id => document.getElementById(id);
    if (el('stat-readiness'))   el('stat-readiness').textContent   = data.careerMatches || '—';
    if (el('stat-jobs'))        el('stat-jobs').textContent        = data.jobsMatched   || '—';
    if (el('stat-skills'))      el('stat-skills').textContent      = data.skillsMissing ?? 0;
    if (el('ring-rec-count'))   el('ring-rec-count').textContent   = data.careerMatches || '—';
    if (el('ring-skills-have')) el('ring-skills-have').textContent = data.skillsHave    || '—';
    if (el('ring-skills-gap'))  el('ring-skills-gap').textContent  = data.skillsMissing ?? 0;
    if (el('ring-jobs-match'))  el('ring-jobs-match').textContent  = data.jobsMatched   || '—';

    // Refresh top roles
    const rolesEl = document.getElementById('stat-top-roles');
    if (rolesEl && data.topRoles && data.topRoles.length > 0) {
      const colors = ['#3B5BDB', '#D4AF37', '#4CAF70'];
      rolesEl.innerHTML = data.topRoles.map((role, i) => `
        <div class="stat-top-role-row">
          <span class="stat-role-dot" style="background:${colors[i] || '#A1A1AA'}"></span>
          <span class="stat-role-name">${role.name}</span>
          <span class="stat-role-pct">${role.score}%</span>
        </div>`).join('');
    }

    // Bust cache so next page load gets fresh data too
    localStorage.removeItem('dashStats');

    closeAnalysisModal();
    showToast('✓ Dashboard refreshed successfully!');

  } catch (err) {
    closeAnalysisModal();
    showToast('Could not refresh — please try again.');
  }
};

window.saveJob = async function(btn, title, company, score, tags) {
  btn.style.color = 'var(--gold)';
  showToast('Saving job...');
  try {
    const token = localStorage.getItem('token');
    const BASE = window.ENV_BACKEND_URL || 'http://localhost:3000';
    const saveRes = await fetch(BASE + '/api/jobs/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, company, score, tags })
    });
    const saveData = await saveRes.json();
    if (saveData.duplicate) {
      showToast('Already saved!');
      btn.style.color = 'var(--gold)';
      return;
    }
    btn.textContent = '♥';
    btn.textContent = '♥';
    showToast('Job saved! ✓');
    // Refresh saved jobs panel immediately
    const bodyEl = document.getElementById('saved-jobs-body');
    const subEl = document.getElementById('saved-jobs-sub');
    if (bodyEl) {
      const res2 = await fetch(BASE + '/api/jobs/saved', { headers: { 'Authorization': 'Bearer ' + token } });
      const data2 = await res2.json();
      const jobs = data2.savedJobs || [];
      if (subEl) subEl.textContent = jobs.length + ' saved · 0 applied';
      if (jobs.length > 0) {
        const top = jobs[0];
        bodyEl.innerHTML = `
          <div class="job-row" onclick="showToast('Opening ${top.title}...')">
            <div class="job-logo">${top.logo || '💼'}</div>
            <div class="job-info">
              <div class="job-title">${top.title}</div>
              <div class="job-company">${top.company}</div>
            </div>
            <div class="job-right">
              <div class="job-match">${top.score}%</div>
              <div class="job-match-sub">match</div>
            </div>
          </div>
          <div style="padding-top:12px">
            <button onclick="showToast('Opening application form...')" class="btn-primary"
              style="width:100%;padding:10px;font-size:13px;justify-content:center">Apply Now →</button>
          </div>`;
      }
    }
    // Refresh activity panel
    const listEl = document.getElementById('activity-list');
    const actSubEl = document.getElementById('activity-sub');
    if (listEl) {
      const res3 = await fetch(BASE + '/api/activity', { headers: { 'Authorization': 'Bearer ' + token } });
      const data3 = await res3.json();
      const acts = data3.activity || [];
      if (actSubEl) actSubEl.textContent = 'Your last ' + acts.length + ' actions';
      if (acts.length > 0) {
        listEl.innerHTML = acts.map((a, i) => `
          <div class="activity-item">
            <div class="activity-dot-wrap">
              <div class="activity-dot ${a.dot || 'muted'}"></div>
              ${i < acts.length - 1 ? '<div class="activity-line"></div>' : ''}
            </div>
            <div>
              <div class="activity-text">${a.text}</div>
              <div class="activity-time">Just now</div>
            </div>
          </div>`).join('');
      }
    }
  } catch (e) {
    showToast('Could not save job');
    btn.style.color = '';
    btn.textContent = '♡';
  }
};