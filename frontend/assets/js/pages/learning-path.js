/* ============================================================
   learning-path.js  –  PathwayAI
   Reads profile from localStorage, calls roadmap / courses /
   blogs endpoints, then renders the full UI into #lp-root.
   ============================================================ */

(async function () {
  const root = document.getElementById('lp-root');
  if (!root) return;

  /* ── 1. LOAD USER PROFILE FROM LOCALSTORAGE ── */
  let profile = {};
  try { profile = JSON.parse(localStorage.getItem('profileData') || '{}'); } catch {}
  let quizResult = {};
  try { quizResult = JSON.parse(localStorage.getItem('quizResult') || '{}'); } catch {}

  // Derive the values roadmap.js needs
  const urlRole = new URLSearchParams(window.location.search).get('role');
const lastRec = JSON.parse(localStorage.getItem('lastRecommendation') || '{}');
const selectedRole = localStorage.getItem('lpSelectedRole');
const goal = urlRole || selectedRole || lastRec?.career || profile.interest || profile.eduField || 'Software Developer';
  const level   = profile.experience === '0' || profile.experience === '' ? 'Beginner'
                : profile.experience === '1-2' ? 'Intermediate' : 'Advanced';
  const months  = 6; // default timeline
  const skills  = Array.isArray(profile.skills) ? profile.skills : [];

  /* ── 2. CACHE KEY – regenerate once per 24 h ── */
  const CACHE_KEY  = `lp_data_${goal}`;
  const CACHE_TIME = 24 * 60 * 60 * 1000;
  let cached = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (Date.now() - obj.ts < CACHE_TIME) cached = obj;
    }
  } catch {}

  /* ── 3. FETCH HELPERS ── */
  const BASE = (window.ENV_BACKEND_URL || 'https://pathwayai-backend.up.railway.app') + '/api/roadmap';

  async function post(path, body) {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  }

  /* ── 4. FETCH OR USE CACHE ── */
  let roadmap, courses, blogs, fromCache = false;

  if (cached) {
    ({ roadmap, courses, blogs } = cached);
    fromCache = true;
  } else {
    try {
      [roadmap, courses, blogs] = await Promise.all([
        post('/generate', { goal, level, months, skills }),
        post('/courses',  { role: goal, missingSkills: lastRec?.missing || [] }),
        post('/blogs',    { role: goal })
      ]);
      // courses needs skillGaps from roadmap — fetch sequentially if needed
      if (!courses) courses = await post('/courses', { role: goal, missingSkills: (roadmap?.skillGaps || []).map(s => s.name) });

      localStorage.setItem(CACHE_KEY, JSON.stringify({ roadmap, courses, blogs, ts: Date.now() }));
    } catch (err) {
      root.innerHTML = `
        <div class="lp-error">
          <h3>⚠️ Could not generate your learning path</h3>
          <p>${err.message || 'Something went wrong. Please try again.'}</p>
          <button onclick="localStorage.removeItem('${CACHE_KEY}');location.reload()"
            style="background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);color:var(--gold);
                   padding:10px 24px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;">
            Try Again
          </button>
        </div>`;
      return;
    }
  }

  /* ── 5. DERIVED STATS ── */
  const phases      = roadmap.phases || [];
  const totalWeeks  = phases.reduce((s, p) => s + (p.weeks || 0), 0);
  const doneCount   = 0; // future: persist progress
  const phasePct    = phases.length ? Math.round((doneCount / phases.length) * 100) : 0;
  const readiness   = roadmap.readinessScore || 0;
  const skillGaps   = roadmap.skillGaps || [];
  const scoreLabel  = roadmap.scoreLabel || 'Keep going!';

  /* ── 6. PHASE STATUS HELPERS ── */
  function phaseStatus(i) {
    const saved = localStorage.getItem(`lp_phase_${CACHE_KEY}_${i}`);
    if (saved === 'done') return 'done';
    if (i === 0 || localStorage.getItem(`lp_phase_${CACHE_KEY}_${i - 1}`) === 'done') return 'active';
    return 'locked';
  }
  function phaseEmoji(i) {
    const emojis = ['🧠','🛠️','🚀','🏆','⚡','🎯'];
    return emojis[i % emojis.length];
  }
  function levelColor(l) {
    return l === 'high' ? '#EF4444' : l === 'med' ? '#F59E0B' : '#4CAF70';
  }

  /* ── 7. RENDER TIMELINE ITEMS ── */
  function renderPhases() {
    return phases.map((p, i) => {
      const status = phaseStatus(i);
      const topics = (p.topics || []).map(t =>
        `<span class="lp-tl-skill-chip">${t}</span>`).join('');
      const completeBtn = status === 'active'
        ? `<button class="lp-tl-complete-btn" onclick="markDone(${i})">Mark Complete ✓</button>`
        : '';
      return `
        <div class="lp-tl-item ${status}" id="phase-item-${i}">
          <div class="lp-tl-dot-col">
            <div class="lp-tl-dot">${status === 'done' ? '✓' : phaseEmoji(i)}</div>
          </div>
          <div class="lp-tl-content">
            <div class="lp-tl-top">
              <div class="lp-tl-name">${p.title || 'Phase ' + (i + 1)}</div>
              <span class="lp-tl-badge">${status === 'done' ? 'Completed' : status === 'active' ? 'In Progress' : 'Locked'}</span>
            </div>
            <p class="lp-tl-desc">${p.desc || ''}</p>
            <div class="lp-tl-skills">${topics}</div>
            ${p.milestone ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">🏆 <strong style="color:var(--text)">Milestone:</strong> ${p.milestone}</div>` : ''}
            <div class="lp-tl-meta">
              <span class="lp-tl-weeks">📅 ${p.weeks} week${p.weeks !== 1 ? 's' : ''}</span>
              <div class="lp-tl-pbar"><div class="lp-tl-pfill"></div></div>
              ${completeBtn}
            </div>
          </div>
        </div>`;
    }).join('');
  }

  /* ── 8. RENDER COURSES ── */
  function renderCourses() {
    if (!Array.isArray(courses) || !courses.length) return '<p style="color:var(--muted);font-size:13px;">No courses found.</p>';
    return courses.map(c => `
      <div class="lp-course-card">
        <div class="lp-course-top">
          <div class="lp-course-ico">${c.emoji || '📘'}</div>
          <div class="lp-course-info">
            <div class="lp-course-title">${c.title}</div>
            <div class="lp-course-platform">${c.platform}</div>
          </div>
        </div>
        <p class="lp-course-desc">${c.why || ''}</p>
        <div class="lp-course-footer">
          <div class="lp-course-meta">
            <span>⏱ ${c.duration || ''}</span>
            <span style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);color:var(--gold);
              padding:2px 8px;border-radius:100px;font-size:10.5px;">${c.level || ''}</span>
          </div>
          <span class="lp-course-link-arrow">→</span>
        </div>
      </div>`).join('');
  }

  /* ── 9. RENDER BLOGS ── */
  function renderBlogs() {
    if (!Array.isArray(blogs) || !blogs.length) return '<p style="color:var(--muted);font-size:13px;">No resources found.</p>';
    return blogs.map(b => `
      <a class="lp-blog-card" href="${b.url || '#'}" target="_blank" rel="noopener">
        <div class="lp-blog-top">
          <div class="lp-blog-ico" style="background:rgba(212,175,55,0.07);">${b.emoji || '📄'}</div>
          <div class="lp-blog-info">
            <div class="lp-blog-title">${b.title}</div>
            <div class="lp-blog-site-name">${b.site}</div>
          </div>
        </div>
        <p class="lp-blog-desc">${b.desc || ''}</p>
        <div class="lp-blog-tags">
          ${(b.tags || []).map(t => `<span class="lp-blog-tag" style="background:rgba(212,175,55,0.07);border:1px solid rgba(212,175,55,0.15);color:rgba(212,175,55,0.85);">${t}</span>`).join('')}
        </div>
      </a>`).join('');
  }

  /* ── 10. RENDER SKILL GAPS SIDEBAR ── */
  function renderSkillGaps() {
    return skillGaps.map(s => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <span style="font-size:12.5px;color:var(--text)">${s.name}</span>
        <span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:100px;
          background:${levelColor(s.level)}18;color:${levelColor(s.level)};border:1px solid ${levelColor(s.level)}30;">
          ${s.level === 'high' ? 'Priority' : s.level === 'med' ? 'Medium' : 'Low'}
        </span>
      </div>`).join('');
  }

  /* ── 11. BUILD FULL HTML ── */
  const donutDeg = Math.round(readiness * 3.6);
  const completedPhases = phases.filter((_, i) => phaseStatus(i) === 'done').length;

  root.innerHTML = `
    ${fromCache ? `<div class="lp-cache-notice">⚡ Showing cached roadmap &nbsp;·&nbsp; <span style="cursor:pointer;color:var(--gold)" onclick="localStorage.removeItem('${CACHE_KEY}');location.reload()">Regenerate</span></div>` : ''}

    <!-- HERO -->
    <div class="lp-hero">
      <div class="lp-hero-top">
        <div>
          <div class="lp-hero-title">Your <em>${goal}</em> Roadmap</div>
          <div class="lp-hero-sub">
            Personalised for <strong>${localStorage.getItem('userName') || 'you'}</strong> ·
            ${level} level · ${months}-month plan
          </div>
        </div>
        <button onclick="localStorage.removeItem('${CACHE_KEY}');location.reload()"
          style="flex-shrink:0;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.25);
            color:var(--gold);padding:8px 18px;border-radius:10px;cursor:pointer;font-size:12.5px;font-weight:600;white-space:nowrap;">
          🔄 Regenerate
        </button>
      </div>

      <div class="lp-stats-row">
        <div class="lp-stat-cell">
          <span class="lp-stat-val">${phases.length}</span>
          <span class="lp-stat-lbl">Phases</span>
        </div>
        <div class="lp-stat-cell">
          <span class="lp-stat-val">${totalWeeks}w</span>
          <span class="lp-stat-lbl">Total Duration</span>
        </div>
        <div class="lp-stat-cell">
          <span class="lp-stat-val">${skillGaps.length}</span>
          <span class="lp-stat-lbl">Skills to Build</span>
        </div>
        <div class="lp-stat-cell">
          <span class="lp-stat-val">${readiness}%</span>
          <span class="lp-stat-lbl">Readiness Score</span>
        </div>
      </div>

      <div class="lp-progress-wrap">
        <div class="lp-progress-row">
          <span>Overall Progress</span>
          <strong>${completedPhases}/${phases.length} phases</strong>
        </div>
        <div class="lp-bar">
          <div class="lp-bar-fill" id="hero-bar" style="width:0%"></div>
        </div>
      </div>
    </div>

    <!-- LAYOUT -->
    <div class="lp-layout">

      <!-- LEFT: ROADMAP + COURSES + BLOGS -->
      <div>
        <!-- SKILL ROADMAP -->
        <div class="lp-roadmap-wrap">
          <div class="lp-roadmap-header">
            <div>
              <div class="lp-roadmap-title">Skill <em>Roadmap</em></div>
              <div class="lp-roadmap-subtitle">${phases.length} phases · ${totalWeeks} weeks</div>
            </div>
          </div>
          <div class="lp-roadmap-body">
            <div class="lp-timeline">
              ${renderPhases()}
            </div>
          </div>
        </div>

        <!-- COURSES -->
        <div class="lp-section-wrap">
          <div class="lp-section-head">
            <div class="lp-section-left">
              <span class="lp-section-label">Recommended <em>Courses</em></span>
              <span class="lp-section-badge">${Array.isArray(courses) ? courses.length : 0} courses</span>
            </div>
          </div>
          <div class="lp-courses-grid">${renderCourses()}</div>
        </div>

        <!-- BLOGS / RESOURCES -->
        <div class="lp-section-wrap">
          <div class="lp-section-head">
            <div class="lp-section-left">
              <span class="lp-section-label">Learning <em>Resources</em></span>
              <span class="lp-section-badge">${Array.isArray(blogs) ? blogs.length : 0} articles</span>
            </div>
          </div>
          <div class="lp-blogs-grid">${renderBlogs()}</div>
        </div>
      </div>

      <!-- RIGHT SIDEBAR -->
      <div class="lp-sidebar">

        <!-- READINESS WIDGET -->
        <div class="lp-widget">
          <div class="lp-widget-head">Career Readiness</div>
          <div class="lp-readiness">
            <div class="lp-donut-wrap">
              <div class="lp-donut" style="--deg:${donutDeg}deg"></div>
              <span class="lp-donut-num">${readiness}%</span>
            </div>
            <div>
              <div class="lp-readiness-title">${scoreLabel}</div>
              <div class="lp-readiness-sub">Based on your profile, skills and quiz results.</div>
            </div>
          </div>
        </div>

        <!-- SKILL GAPS -->
        <div class="lp-widget">
          <div class="lp-widget-head">Skill Gaps to Address</div>
          ${renderSkillGaps()}
        </div>

        <!-- TIP -->
        <div class="lp-tip">
          <div class="lp-tip-ico">💡</div>
          <div>
            <div class="lp-tip-title">Pro Tip</div>
            <div class="lp-tip-body">
              Complete phases <strong>in order</strong>. Each phase builds on the previous one.
              Mark a phase done to unlock the next.
            </div>
          </div>
        </div>

      </div>
    </div>`;

  /* ── 12. ANIMATE PROGRESS BAR ── */
  setTimeout(() => {
    const bar = document.getElementById('hero-bar');
    if (bar) bar.style.width = phasePct + '%';
  }, 200);

  /* ── 13. MARK DONE HANDLER ── */
  window.markDone = function (i) {
    localStorage.setItem(`lp_phase_${CACHE_KEY}_${i}`, 'done');
    // Re-render just the timeline section without full page reload
    const item = document.getElementById(`phase-item-${i}`);
    if (item) {
      item.classList.remove('active');
      item.classList.add('done');
      item.querySelector('.lp-tl-dot').textContent = '✓';
      item.querySelector('.lp-tl-badge').textContent = 'Completed';
      const btn = item.querySelector('.lp-tl-complete-btn');
      if (btn) btn.remove();
      // Activate next phase
      const next = document.getElementById(`phase-item-${i + 1}`);
      if (next) {
        next.classList.remove('locked');
        next.classList.add('active');
        next.querySelector('.lp-tl-dot').textContent = phaseEmoji(i + 1);
        next.querySelector('.lp-tl-badge').textContent = 'In Progress';
        // Insert complete button for next phase
        const meta = next.querySelector('.lp-tl-meta');
        if (meta) {
          const btn2 = document.createElement('button');
          btn2.className = 'lp-tl-complete-btn';
          btn2.textContent = 'Mark Complete ✓';
          btn2.onclick = () => window.markDone(i + 1);
          meta.appendChild(btn2);
        }
      }
    }
    // Update hero progress bar
    const completedNow = phases.filter((_, idx) => localStorage.getItem(`lp_phase_${CACHE_KEY}_${idx}`) === 'done').length;
    const newPct = Math.round((completedNow / phases.length) * 100);
    const bar = document.getElementById('hero-bar');
    if (bar) bar.style.width = newPct + '%';
    if (typeof showToast === 'function') showToast('Phase marked as complete! 🎉');
  };

  /* ── 14. EMOJI HELPER (used in markDone) ── */
  function phaseEmoji(i) {
    return ['🧠','🛠️','🚀','🏆','⚡','🎯'][i % 6];
  }

})();