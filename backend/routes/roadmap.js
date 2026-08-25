const express = require('express');
const router = express.Router();

router.post('/generate', async (req, res) => {
  const { goal, level, months, skills } = req.body;

  if (!goal || !level || !months) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const skillsText = skills && skills.length > 0 ? skills.join(', ') : 'none listed';
  const totalWeeks = parseInt(months) * 4;
  const numPhases = parseInt(months) === 12 ? 4 : 3;

  const prompt = `You are a career coaching expert. Generate a detailed learning roadmap.

Career goal: "${goal}"
Experience level: ${level}
Timeline: ${months} months (${totalWeeks} weeks total)
Current skills: ${skillsText}

Respond with ONLY a valid JSON object — no markdown, no explanation, no backticks. Use this exact structure:

{
  "readinessScore": <integer 0-100>,
  "scoreLabel": "<short encouraging phrase>",
  "skillGaps": [
    { "name": "<skill name>", "level": "high" | "med" | "low" }
  ],
  "phases": [
    {
      "title": "<phase title>",
      "weeks": <integer>,
      "desc": "<2-3 sentence description>",
      "topics": ["<topic 1>", "<topic 2>", "<topic 3>", "<topic 4>", "<topic 5>", "<topic 6>"],
      "resources": ["<resource 1>", "<resource 2>", "<resource 3>", "<resource 4>"],
      "milestone": "<one concrete hands-on project or achievement>"
    }
  ]
}

Rules:
- Generate exactly ${numPhases} phases
- All phases weeks values must sum to exactly ${totalWeeks}
- skillGaps: exactly 6 items
- Be very specific to the exact role
- Resources must be real well-known platforms or books
- Milestones must be concrete and portfolio-worthy`;

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Groq API key not configured in .env' });
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({
        error: errData?.error?.message || `Groq API error: ${groqRes.status}`
      });
    }

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || '';
    const clean = raw.replace(/```json|```/gi, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
    }

    return res.json(parsed);
  } catch (err) {
    console.error('Roadmap generation error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});



router.post('/blogs', async (req, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Missing role' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key not configured' });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{
          role: 'user',
          content: `Generate 6 learning resource recommendations for someone learning "${role}".
ONLY use these REAL verified base URLs — do NOT invent URLs:
- https://www.freecodecamp.org/news/
- https://medium.com/
- https://dev.to/
- https://towardsdatascience.com/
- https://roadmap.sh/
- https://www.geeksforgeeks.org/
- https://kaggle.com/learn
- https://www.coursera.org/browse/
- https://javascript.info/
- https://css-tricks.com/

Respond ONLY with a JSON array, no markdown, no backticks, no explanation:
[{"title":"topic or concept name","site":"Site Name","url":"use one base URL above exactly","tags":["tag1","tag2"],"emoji":"one emoji","desc":"one sentence about what this covers"}]`
        }],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(groqRes.status).json({ error: err?.error?.message || 'Groq error' });
    }

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || '[]';
    const clean = raw.replace(/```json|```/gi, '').trim();

    try {
      const parsed = JSON.parse(clean);
      return res.json(parsed);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }
  } catch (err) {
    console.error('Blogs error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/courses', async (req, res) => {
  const { role, missingSkills } = req.body;
  if (!role) return res.status(400).json({ error: 'Missing role' });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Groq API key not configured' });

    const missingText = missingSkills && missingSkills.length ? `They need to learn: ${missingSkills.slice(0,5).join(', ')}.` : '';

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{
          role: 'user',
          content: `You are a learning advisor. Suggest exactly 6 foundation courses for someone targeting the role: "${role}". ${missingText}
Return ONLY a JSON array (no markdown, no explanation) with exactly 6 objects:
[{"title":"Course Title","platform":"Platform Name","duration":"X hours","level":"Beginner|Intermediate|Advanced","emoji":"📘","why":"One sentence why this course matters for ${role}","tags":["tag1","tag2"]}]`
        }],
        temperature: 0.5,
        max_tokens: 1000
      })
    });

    const groqData = await groqRes.json();
    const raw = groqData.choices?.[0]?.message?.content || '[]';
    const clean = raw.replace(/```json|```/gi, '').trim();
    return res.json(JSON.parse(clean));
  } catch (err) {
    console.error('Courses error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;