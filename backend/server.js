const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const FormData = require('form-data');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: function(origin, callback) {
    callback(null, true);
  },
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '20mb' }));
app.use('/api/roadmap', require('./routes/roadmap'));

const upload = multer({ storage: multer.memoryStorage() });

const PYTHON_SERVICE = process.env.PYTHON_SERVICE_URL;
if (!PYTHON_SERVICE) console.error('❌ PYTHON_SERVICE_URL env variable is not set!');
const JWT_SECRET = process.env.JWT_SECRET || 'pathwayai-secret-key';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pathwayai';

// ─────────────────────────────────────────────
// MONGODB CONNECTION
// ─────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ─────────────────────────────────────────────
// USER SCHEMA
// ─────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  fname:      { type: String, required: true },
  lname:      { type: String, default: '' },
  email:      { type: String, required: true, unique: true },
  password:   { type: String, default: null }, // null for Google users
  phone:      { type: String, default: '' },
  location:   { type: String, default: '' },
  bio:        { type: String, default: '' },
  college:    { type: String, default: '' },
  eduLevel:   { type: String, default: '' },
  eduField:   { type: String, default: '' },
  gradYear:   { type: String, default: '' },
  experience: { type: String, default: '' },
  interest:   { type: String, default: '' },
  skills:     { type: [String], default: [] },
  googleId:   { type: String, default: null },
  quizResult: { type: Object, default: null },
  savedJobs:  { type: Array, default: [] },
  activity:   { type: Array, default: [] },
  createdAt:  { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function safeUser(user) {
  const u = user.toObject();
  delete u.password;
  return u;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

// REGISTER — only fname, lname, email, password
app.post('/api/register', async (req, res) => {
  try {
    const { fname, lname, email, password, quizResult } = req.body;

    if (!fname || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      fname, lname, email, password: hashed,
      quizResult: quizResult || null,
      activity: [{ text: 'Account created & profile setup started', dot: 'muted', time: new Date() }]
    });

    res.json({ token: generateToken(user), user: safeUser(user) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    // Block Google-only users from password login
    if (!user.password)
      return res.status(401).json({ error: 'This account uses Google Sign-In' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    res.json({ token: generateToken(user), user: safeUser(user) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GOOGLE AUTH — creates account if doesn't exist
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, fname, lname, googleId } = req.body;

    if (!email || !googleId)
      return res.status(400).json({ error: 'Missing Google account info' });

    let user = await User.findOne({ email });

    if (!user) {
      // First time Google login → create account
      user = await User.create({ fname, lname, email, googleId, password: null });
    } else if (!user.googleId) {
      // Existing email account → link Google to it
      user.googleId = googleId;
      await user.save();
    }

    res.json({ token: generateToken(user), user: safeUser(user) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// VERIFY TOKEN
app.get('/api/verify', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ valid: false });
    res.json({ valid: true, user: safeUser(user) });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// ─────────────────────────────────────────────
// PROFILE ROUTES
// ─────────────────────────────────────────────

// UPDATE PROFILE
app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const allowed = ['fname','lname','phone','location','bio','college','eduLevel','eduField','gradYear','experience','interest','skills'];
    const updates = {};
    allowed.forEach(key => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ user: safeUser(user) });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CHANGE PASSWORD
app.put('/api/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.password)
      return res.status(400).json({ error: 'This account uses Google Sign-In' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ error: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password updated successfully' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE ACCOUNT
app.delete('/api/account', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user.id);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// RESUME ROUTES (your existing ones)
// ─────────────────────────────────────────────
app.post('/api/resume/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'No file uploaded' } });

    const role = req.body.role || '';
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    form.append('role', role);

    const pyRes = await fetch(`${PYTHON_SERVICE}/extract`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const pyData = await pyRes.json();
    if (!pyRes.ok) return res.status(500).json({ error: pyData });
    res.json(pyData);

  } catch (err) {
    res.status(500).json({ error: { message: 'Python service unavailable: ' + err.message } });
  }
});

app.post('/api/resume/analyze', async (req, res) => {
  try {
    const { messages, model, max_tokens, temperature, skillContext } = req.body;

    const skillsNote = skillContext
      ? `\n\nSKILL DATABASE ANALYSIS:\n` +
        `Required: ${skillContext.required_skills?.join(', ')}\n` +
        `Matched: ${skillContext.matched_skills?.join(', ') || 'none'}\n` +
        `Missing: ${skillContext.missing_skills?.join(', ') || 'none'}\n` +
        `Score: ${skillContext.match_pct}%\n`
      : '';

    const enhancedMessages = messages.map(m =>
      m.role === 'user' ? { ...m, content: m.content + skillsNote } : m
    );

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-oss-120b',
        max_tokens: max_tokens || 4000,
        temperature: temperature || 0.3,
        messages: enhancedMessages
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/roles', async (req, res) => {
  try {
    const pyRes = await fetch(`${PYTHON_SERVICE}/roles`);
    const data = await pyRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Python service unavailable' });
  }
});

// UPLOAD RESUME
app.post('/api/resume/upload', authMiddleware, async (req, res) => {
  try {
    const { resumeBase64 } = req.body;
    if (!resumeBase64) return res.status(400).json({ error: 'No resume data provided' });

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { resume: resumeBase64 },
      { new: true }
    );
    res.json({ message: 'Resume uploaded successfully', user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET RESUME
app.get('/api/resume/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.resume) return res.status(404).json({ error: 'No resume uploaded yet' });
    res.json({ resume: user.resume });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const { spawn } = require('child_process');
const path = require('path');

app.post('/api/career-recommend', authMiddleware, async (req, res) => {
  const { skills } = req.body;
  if (!skills) return res.status(400).json({ error: 'Skills required' });
  if (!PYTHON_SERVICE) return res.status(500).json({ error: 'Python service URL not configured' });

  try {
    const pyRes = await fetch(`${PYTHON_SERVICE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills })
    });
    const data = await pyRes.json();
    if (!pyRes.ok) return res.status(500).json({ error: 'Recommender failed' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Python service unavailable: ' + err.message });
  }
});

// SAVE A JOB (deduplication + applied status)
app.post('/api/jobs/save', authMiddleware, async (req, res) => {
  try {
    const { title, company, score, tags, logo } = req.body;
    const user = await User.findById(req.user.id);

    // Deduplicate — skip if same title+company already saved
    const alreadySaved = (user.savedJobs || []).some(
      j => j.title.toLowerCase() === title.toLowerCase() && j.company.toLowerCase() === company.toLowerCase()
    );
    if (alreadySaved) return res.json({ savedJobs: user.savedJobs, duplicate: true });

    const job = {
      id: Date.now().toString(),
      title, company, score,
      tags: tags || [],
      logo: logo || '💼',
      savedAt: new Date(),
      applied: false
    };
    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { savedJobs: { $each: [job], $position: 0 } } },
      { new: true }
    );
    await User.findByIdAndUpdate(req.user.id, {
      $push: { activity: { $each: [{ text: `Saved job — ${title} at ${company}`, time: new Date(), dot: 'green' }], $position: 0, $slice: 20 } }
    });
    res.json({ savedJobs: updated.savedJobs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// TOGGLE APPLIED STATUS
app.patch('/api/jobs/save/:jobId/applied', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const job = (user.savedJobs || []).find(j => j.id === req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    job.applied = !job.applied;
    user.markModified('savedJobs');
    await user.save();
    if (job.applied) {
      await User.findByIdAndUpdate(req.user.id, {
        $push: { activity: { $each: [{ text: `Marked as applied — ${job.title} at ${job.company}`, time: new Date(), dot: 'gold' }], $position: 0, $slice: 20 } }
      });
    }
    res.json({ savedJobs: user.savedJobs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UNSAVE A JOB
app.delete('/api/jobs/save/:jobId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { savedJobs: { id: req.params.jobId } } },
      { new: true }
    );
    res.json({ savedJobs: user.savedJobs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET SAVED JOBS
app.get('/api/jobs/saved', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ savedJobs: user.savedJobs || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOG ACTIVITY
app.post('/api/activity', authMiddleware, async (req, res) => {
  try {
    const { text, dot } = req.body;
    await User.findByIdAndUpdate(req.user.id, {
      $push: { activity: { $each: [{ text, dot: dot || 'muted', time: new Date() }], $position: 0, $slice: 20 } }
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ACTIVITY
app.get('/api/activity', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ activity: (user.activity || []).slice(0, 5) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DASHBOARD STATS — returns career matches + top job roles for dashboard
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const skillsArr = user.skills || [];
    const skillsStr = skillsArr.join(' ');

    // If no skills, return empty state
    if (!skillsStr.trim()) {
      return res.json({
        careerMatches: 0,
        topRoles: [],
        skillsHave: 0,
        skillsMissing: 0,
        jobsMatched: 0
      });
    }

    // Call Python recommender
    const pyRes = await fetch(`${PYTHON_SERVICE}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: skillsStr })
    });
    const pyData = await pyRes.json();
    const recs = pyData.recommendations || [];

    // Top 3 roles for the stat card
    const topRoles = recs.slice(0, 3).map(r => ({
      name: r.career,
      score: Math.min(Math.round(r.match_score), 99),
      matched: r.matched_skills || [],
      missing: (r.required_skills || []).filter(s => !(r.matched_skills || []).includes(s))
    }));

    // Top 4 career matches for Career Path Matches section
    const careerMatches = recs.slice(0, 4).map(r => ({
      name: r.career,
      category: r.category || '',
      score: Math.min(Math.round(r.match_score), 99),
      matched: r.matched_skills || [],
      missing: (r.required_skills || []).filter(s =>
        !(r.matched_skills || []).map(m => m.toLowerCase()).includes(s.toLowerCase())
      ),
      required: r.required_skills || []
    }));

    // Skill gap analysis for top role
    const topRole = recs[0] || null;
    const skillsMissing = topRole
      ? (topRole.required_skills || []).filter(s => !(topRole.matched_skills || []).includes(s)).length
      : 0;

    // Build skill gap rows for top role
    const skillGapRows = topRole ? (topRole.required_skills || []).slice(0, 8).map(skill => {
      const isMatched = (topRole.matched_skills || []).map(m => m.toLowerCase()).includes(skill.toLowerCase());
      return {
        name: skill,
        have: isMatched,
        pct: isMatched ? Math.floor(70 + Math.random() * 30) : Math.floor(5 + Math.random() * 25)
      };
    }) : [];

    // Top Job Matches section — use top career matches as job listings
    const topJobMatches = recs.slice(0, 4).map(r => ({
      title: r.career,
      company: r.category || 'Industry',
      score: Math.min(Math.round(r.match_score), 99),
      tags: (r.matched_skills || []).slice(0, 3)
    }));

    return res.json({
      careerMatches: recs.length,
      topRoles,
      careerMatchList: careerMatches,
      skillGapRows,
      skillGapRole: topRole ? topRole.career : '',
      topJobMatches,
      skillsHave: skillsArr.length,
      skillsMissing,
      jobsMatched: recs.length
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('✅ PathwayAI backend running on http://localhost:3000');
});
