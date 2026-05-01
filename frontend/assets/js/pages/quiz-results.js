// ── CAREER META (salary/demand by category from market data) ──
const CAREER_META = {
  'Data & AI':           { salary: '₹8–35 LPA',  growth: '35% Growth', demand: 'Very High' },
  'Software Development':{ salary: '₹6–30 LPA',  growth: '25% Growth', demand: 'Very High' },
  'Cybersecurity':       { salary: '₹7–28 LPA',  growth: '28% Growth', demand: 'High'      },
  'Design':              { salary: '₹4–20 LPA',  growth: '18% Growth', demand: 'High'      },
  'Management':          { salary: '₹8–30 LPA',  growth: '14% Growth', demand: 'Medium'    },
  'Marketing':           { salary: '₹4–18 LPA',  growth: '16% Growth', demand: 'High'      },
  'IT Infrastructure':   { salary: '₹4–20 LPA',  growth: '12% Growth', demand: 'Medium'    },
  'Finance':             { salary: '₹6–25 LPA',  growth: '10% Growth', demand: 'Medium'    },
  'Engineering':         { salary: '₹5–22 LPA',  growth: '8% Growth',  demand: 'Medium'    },
  'Human Resources':     { salary: '₹4–15 LPA',  growth: '7% Growth',  demand: 'Medium'    },
  'Research':            { salary: '₹6–20 LPA',  growth: '12% Growth', demand: 'Medium'    },
  'Other':               { salary: '₹4–15 LPA',  growth: '10% Growth', demand: 'Medium'    },
};

const CATEGORY_ICONS = {
  'Data & AI': '🤖', 'Software Development': '💻', 'Cybersecurity': '🔐',
  'Design': '🎨', 'Management': '📋', 'Marketing': '📣',
  'IT Infrastructure': '🖥️', 'Finance': '💰', 'Engineering': '⚙️',
  'Human Resources': '👥', 'Research': '🔬', 'Other': '🌐'
};

// ── FLASK API URL — change to your tunnel URL when deployed ──
const FLASK_URL = 'https://pathwayai-backend.up.railway.app';

// ── FALLBACK DATA (used if API is offline) ──
const FALLBACK_CAREERS = [
  { name: 'Frontend Developer', score: 85, category: 'Software Development',
    matched_skills: ['html','css','javascript','react'], required_skills: ['html','css','javascript','react','typescript','testing'] },
  { name: 'UI/UX Designer',     score: 72, category: 'Design',
    matched_skills: ['figma','css'], required_skills: ['figma','prototyping','user research','css','typography'] },
  { name: 'Data Analyst',       score: 60, category: 'Data & AI',
    matched_skills: ['python','sql'], required_skills: ['python','sql','pandas','tableau','statistics'] },
  { name: 'Backend Developer',  score: 50, category: 'Software Development',
    matched_skills: ['javascript'], required_skills: ['nodejs','sql','rest api','docker','databases'] },
];

// ── Convert API response to internal career format ──
function apiToCareer(rec) {
  const meta = CAREER_META[rec.category] || CAREER_META['Other'];
  const icon = CATEGORY_ICONS[rec.category] || '💼';
  return {
    name:           rec.career,
    score:          Math.round(rec.match_score),
    category:       rec.category,
    icon:           icon,
    tags:           (rec.matched_skills || []).slice(0, 3),
    salary:         meta.salary,
    growth:         meta.growth,
    demand:         meta.demand,
    matched_skills: rec.matched_skills || [],
    skills: (rec.required_skills || []).slice(0, 5).map(s => {
      const userSkillSet = new Set((window._userSkills || '').toLowerCase().split(/\s+/));
      const has = userSkillSet.has(s.toLowerCase());
      return {
        name:  s,
        pct:   has ? Math.floor(Math.random() * 25) + 70 : Math.floor(Math.random() * 25) + 10,
        level: has ? 'high' : 'low'
      };
    }),
    nodes: (rec.required_skills || []).slice(0, 7),
  };
}

// ── MAIN: fetch real recommendations from Flask ──
let careers = [];
let topCareer = null;

async function fetchAndInit() {
  // Get skills from localStorage (saved by quiz-assessment.js)
  const stored = localStorage.getItem('quizCareerScores');
  const quizData = localStorage.getItem('quizResults');

  let userSkills = '';

  // Try to extract skills string from quiz data
  if (quizData) {
    try {
      const parsed = JSON.parse(quizData);
      userSkills = parsed.skills || parsed.extractedSkills || '';
    } catch(e) {}
  }

  // If no skills string, build one from stored career scores tags
  if (!userSkills && stored) {
    try {
      const scores = JSON.parse(stored);
      userSkills = scores.map(c => c.name.toLowerCase().replace(/ /g, ' ')).join(' ');
    } catch(e) {}
  }

  window._userSkills = userSkills;

  let apiSuccess = false;

  if (userSkills) {
    try {
      const res = await fetch(`${FLASK_URL}/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skills: userSkills }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      const data = await res.json();
      if (data.recommendations && data.recommendations.length) {
        careers = data.recommendations.slice(0, 8).map(apiToCareer);
        apiSuccess = true;
      }
    } catch (err) {
      console.warn('[PathwayAI] Flask API offline, using fallback data:', err.message);
    }
  }

  // Fallback: use stored quiz scores or hardcoded fallback
  if (!apiSuccess) {
    if (stored) {
      try {
        const scores = JSON.parse(stored);
        careers = scores.map(c => ({
          name: c.name, score: c.score, icon: '💼',
          category: 'Other', tags: [], salary: '₹6–25 LPA',
          growth: '15% Growth', demand: 'High',
          matched_skills: [], skills: [], nodes: []
        }));
      } catch(e) {
        careers = FALLBACK_CAREERS.map(apiToCareer);
      }
    } else {
      careers = FALLBACK_CAREERS.map(apiToCareer);
    }
  }

  topCareer = careers[0];

  // Now run all UI init functions
  initHero();
  buildCareerCards();
  buildStats();
  buildSkillBars();
  buildCTA();
  setTimeout(initEcosystem, 300);
}

// ── HELPERS ──
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

// ════════════════════════════════
// HERO RING ANIMATION
// ════════════════════════════════
function animateRing(targetPct) {
  const circle = document.getElementById("ring-progress");
  const pctEl = document.getElementById("match-pct");
  if (!circle || !pctEl) return;
  const circumference = 502;
  const offset = circumference - (targetPct / 100) * circumference;
  let current = 0;
  const step = () => {
    current = Math.min(current + 1.5, targetPct);
    pctEl.textContent = Math.round(current) + "%";
    circle.style.strokeDashoffset = circumference - (current / 100) * circumference;
    if (current < targetPct) requestAnimationFrame(step);
  };
  setTimeout(() => requestAnimationFrame(step), 400);
}

// ── SET HERO ──
function initHero() {
  const pill = document.getElementById("top-career-pill");
  document.getElementById("pill-icon").textContent = topCareer.icon;
  document.getElementById("pill-name").textContent = topCareer.name;
  localStorage.setItem('quizResult', JSON.stringify({ career: topCareer.name, score: topCareer.score }));
  const sub = document.getElementById("hero-sub");
  if (sub) sub.textContent = `Based on your answers, our AI matched you to ${careers.length} career paths — here's where you shine.`;
  animateRing(topCareer.score);
}

// ════════════════════════════════
// CAREER CARDS
// ════════════════════════════════
function buildCareerCards() {
  const grid = document.getElementById("careers-grid");
  if (!grid) return;
  grid.innerHTML = "";
  careers.forEach((c, i) => {
    const isPrimary = i === 0 ? "primary" : "";
    const rankLabel = i === 0 ? "Best Match" : `#${i + 1} Match`;
    const tagsHtml = (c.tags || []).map(t => `<span class="card-tag">${t}</span>`).join("");
    const card = document.createElement("div");
    card.className = `career-card ${isPrimary}`;
    card.style.animationDelay = `${0.3 + i * 0.1}s`;
    card.innerHTML = `
      <div class="card-rank">${rankLabel}</div>
      <div class="card-icon">${c.icon}</div>
      <div class="card-title">${c.name}</div>
      <div class="card-bar-wrap">
        <div class="card-bar-bg"><div class="card-bar-fill" data-pct="${c.score}"></div></div>
        <span class="card-pct">${c.score}%</span>
      </div>
      <div class="card-tags">${tagsHtml}</div>`;
    grid.appendChild(card);
  });

  // Animate bars after a short delay
  setTimeout(() => {
    document.querySelectorAll(".card-bar-fill").forEach(el => {
      el.style.width = el.dataset.pct + "%";
    });
  }, 500);
}

// ════════════════════════════════
// STATS ROW
// ════════════════════════════════
function buildStats() {
  document.getElementById("stat-salary-val").textContent = topCareer.salary || "Varies";
  document.getElementById("stat-growth-val").textContent = topCareer.growth || "Growing";
  document.getElementById("stat-demand-val").textContent = topCareer.demand || "High";
  document.getElementById("stat-score-val").textContent = topCareer.score + "%";
}

// ════════════════════════════════
// SKILL BARS
// ════════════════════════════════
function buildSkillBars() {
  const container = document.getElementById("skill-bars");
  if (!container) return;
  container.innerHTML = "";
  (topCareer.skills || []).forEach(s => {
    const row = document.createElement("div");
    row.className = "skill-row";
    row.innerHTML = `
      <div class="skill-row-top">
        <span class="skill-name">${s.name}</span>
        <span class="skill-pct">${s.pct}%</span>
      </div>
      <div class="skill-track">
        <div class="skill-fill ${s.level}" data-pct="${s.pct}"></div>
      </div>`;
    container.appendChild(row);
  });
  setTimeout(() => {
    document.querySelectorAll(".skill-fill").forEach(el => {
      el.style.width = el.dataset.pct + "%";
    });
  }, 600);
}

// ════════════════════════════════
// CTA BUTTONS
// ════════════════════════════════
function buildCTA() {
  const wrap = document.getElementById("cta-btns");
  if (!wrap) return;
  const isLoggedIn = !!localStorage.getItem("token");
  if (isLoggedIn) {
    const goalParam = encodeURIComponent(topCareer.name || '');
    wrap.innerHTML = `
      <a href="../app/roadmap.html?goal=${goalParam}">
        <button class="btn-gold" style="padding:13px 28px;font-size:14px">Generate My Roadmap →</button>
      </a>
      <a href="../app/resume-analysis.html">
        <button class="btn-outline" style="padding:12px 24px;font-size:14px">Analyse My Resume</button>
      </a>`;
  } else {
    wrap.innerHTML = `
      <a href="../auth/login.html">
        <button class="btn-gold" style="padding:13px 28px;font-size:14px">Sign in to Save Results →</button>
      </a>
      <a href="../app/quiz.html">
        <button class="btn-outline" style="padding:12px 24px;font-size:14px">Retake Quiz</button>
      </a>`;
  }
}

// ════════════════════════════════
// PARTICLE BACKGROUND
// ════════════════════════════════
function initParticles() {
  const canvas = document.getElementById("particles-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, pts = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawn() {
    pts = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.5 + 0.15
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212,175,55,${p.a})`;
      ctx.fill();
    });
    // Draw faint connection lines
    pts.forEach((a, i) => {
      pts.slice(i + 1).forEach(b => {
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(212,175,55,${0.04 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
    requestAnimationFrame(draw);
  }
  resize();
  spawn();
  draw();
  window.addEventListener("resize", () => { resize(); spawn(); });
}

// ════════════════════════════════
// 3D ECOSYSTEM CANVAS
// ════════════════════════════════
function initEcosystem() {
  const canvas = document.getElementById("ecosystem-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Match canvas resolution to CSS size
  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    CW = rect.width;
    CH = rect.height;
  }

  let CW, CH;
  resize();
  window.addEventListener("resize", () => { resize(); buildNodes(); });

  // Nodes
  let nodes = [];
  let rotX = 0.2, rotY = 0;
  let isDragging = false, lastMX = 0, lastMY = 0;
  let zoom = 1;
  let animFrame;

  function buildNodes() {
    nodes = [];
    const skillNames = topCareer.nodes || [];
    const otherCareers = careers.slice(1).map(c => c.name);

    // Center node (the user / top career)
    nodes.push({ label: topCareer.name, icon: topCareer.icon, type: "center", x3: 0, y3: 0, z3: 0, r: 22 });

    // Career nodes — orbit on a tilted ring
    const cCount = Math.min(otherCareers.length, 3);
    for (let i = 0; i < cCount; i++) {
      const angle = (i / cCount) * Math.PI * 2;
      const R = 160;
      nodes.push({
        label: careers[i + 1].name,
        icon: careers[i + 1].icon,
        type: "career",
        x3: R * Math.cos(angle),
        y3: R * Math.sin(angle) * 0.45,
        z3: R * Math.sin(angle) * 0.88,
        r: 15
      });
    }

    // Skill nodes — further outer ring
    const sCount = Math.min(skillNames.length, 7);
    for (let i = 0; i < sCount; i++) {
      const angle = (i / sCount) * Math.PI * 2 + 0.4;
      const R = 260;
      nodes.push({
        label: skillNames[i],
        type: "skill",
        x3: R * Math.cos(angle),
        y3: R * Math.sin(angle) * 0.35,
        z3: R * Math.sin(angle) * 0.94,
        r: 10
      });
    }
  }

  // Project 3D → 2D
  function project(x3, y3, z3) {
    // Rotate Y
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = x3 * cosY - z3 * sinY;
    const z1 = x3 * sinY + z3 * cosY;
    // Rotate X
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y1 = y3 * cosX - z1 * sinX;
    const z2 = y3 * sinX + z1 * cosX;
    // Perspective
    const fov = 600 * zoom;
    const scale = fov / (fov + z2);
    return {
      x: CW / 2 + x1 * scale,
      y: CH / 2 + y1 * scale,
      s: scale,
      z: z2
    };
  }

  // Draw loop
  function draw() {
    ctx.clearRect(0, 0, CW, CH);

    // Sort by z depth
    const projected = nodes.map(n => ({
      ...n,
      proj: project(n.x3, n.y3, n.z3)
    })).sort((a, b) => a.proj.z - b.proj.z);

    // Draw edges first
    projected.forEach(n => {
      if (n.type === "center") return;
      const center = projected.find(p => p.type === "center");
      if (!center) return;
      ctx.beginPath();
      ctx.moveTo(center.proj.x, center.proj.y);
      ctx.lineTo(n.proj.x, n.proj.y);
      const alpha = n.type === "career" ? 0.18 : 0.1;
      const color = n.type === "career" ? `rgba(212,175,55,${alpha})` : `rgba(100,180,255,${alpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = n.type === "career" ? 1 : 0.5;
      ctx.setLineDash(n.type === "skill" ? [3, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw nodes
    projected.forEach(n => {
      const { x, y, s } = n.proj;
      const r = n.r * s;

      if (n.type === "center") {
        // Glowing center
        const grd = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
        grd.addColorStop(0, "rgba(212,175,55,0.25)");
        grd.addColorStop(1, "rgba(212,175,55,0)");
        ctx.beginPath(); ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(212,175,55,0.15)";
        ctx.strokeStyle = "rgba(212,175,55,0.8)";
        ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
        // Icon
        ctx.font = `${Math.max(10, 14 * s)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillText(n.icon || "🎯", x, y);
        // Label below
        ctx.font = `500 ${Math.max(9, 11 * s)}px 'Playfair Display', serif`;
        ctx.fillStyle = `rgba(212,175,55,${Math.min(1, 0.85 * s + 0.1)})`;
        ctx.fillText(n.label, x, y + r + 14 * s);

      } else if (n.type === "career") {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(212,175,55,0.12)";
        ctx.strokeStyle = `rgba(212,175,55,${0.5 * s + 0.2})`;
        ctx.lineWidth = 1; ctx.fill(); ctx.stroke();
        ctx.font = `${Math.max(8, 11 * s)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(n.icon, x, y);
        ctx.font = `${Math.max(8, 10 * s)}px sans-serif`;
        ctx.fillStyle = `rgba(200,200,200,${Math.min(1, 0.7 * s + 0.1)})`;
        ctx.fillText(n.label.split(" ")[0], x, y + r + 10 * s);

      } else {
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100,180,255,${0.12 * s + 0.04})`;
        ctx.strokeStyle = `rgba(100,180,255,${0.45 * s + 0.1})`;
        ctx.lineWidth = 0.8; ctx.fill(); ctx.stroke();
        ctx.font = `${Math.max(7, 9 * s)}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(180,220,255,${Math.min(1, 0.8 * s + 0.05)})`;
        ctx.fillText(n.label, x, y + r + 9 * s);
      }
    });

    // Auto-rotate slowly
    if (!isDragging) rotY += 0.003;
    animFrame = requestAnimationFrame(draw);
  }

  // ── DRAG TO ROTATE ──
  canvas.addEventListener("mousedown", e => {
    isDragging = true;
    lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener("mousemove", e => {
    if (!isDragging) return;
    rotY += (e.clientX - lastMX) * 0.007;
    rotX += (e.clientY - lastMY) * 0.007;
    rotX = Math.max(-1, Math.min(1, rotX));
    lastMX = e.clientX; lastMY = e.clientY;
  });
  window.addEventListener("mouseup", () => { isDragging = false; });

  // Touch
  canvas.addEventListener("touchstart", e => {
    isDragging = true;
    lastMX = e.touches[0].clientX;
    lastMY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (!isDragging) return;
    rotY += (e.touches[0].clientX - lastMX) * 0.007;
    rotX += (e.touches[0].clientY - lastMY) * 0.007;
    rotX = Math.max(-1, Math.min(1, rotX));
    lastMX = e.touches[0].clientX;
    lastMY = e.touches[0].clientY;
  }, { passive: true });
  canvas.addEventListener("touchend", () => { isDragging = false; });

  // Scroll to zoom
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoom = Math.max(0.5, Math.min(2, zoom - e.deltaY * 0.001));
  }, { passive: false });

  buildNodes();
  draw();
}

// ════════════════════════════════
// INIT ALL
// ════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  initParticles();
  fetchAndInit(); // loads real API data, then calls all init functions
});

