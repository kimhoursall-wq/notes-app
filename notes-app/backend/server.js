const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/notesdb';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin12345';
const ADMIN_SECRET = process.env.ADMIN_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

app.use(express.json());

/* ---------- Model ---------- */
const Note = mongoose.model(
  'Note',
  new mongoose.Schema(
    { title: { type: String, required: true, trim: true }, content: { type: String, default: '' } },
    { timestamps: true }
  )
);

/* ---------- Public REST API (used by the Vue frontend) ---------- */
const publicCors = cors({ origin: process.env.FRONTEND_ORIGIN || '*' });

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/notes', publicCors, async (req, res) => {
  res.json(await Note.find().sort({ createdAt: -1 }));
});

app.post('/notes', publicCors, async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'title is required' });
  const note = await Note.create({ title: req.body.title, content: req.body.content });
  res.status(201).json(note);
});

app.delete('/notes/:id', publicCors, async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

app.options('/notes', publicCors);
app.options('/notes/:id', publicCors);

/* ---------- Admin auth (signed token, no extra packages) ---------- */
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    return payload.exp > Date.now() ? payload : null;
  } catch (e) {
    return null;
  }
}
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const payload = verify(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.admin = payload;
  next();
}

// very small login rate limit: 5 tries per minute per IP
const attempts = new Map();
function loginLimiter(req, res, next) {
  const now = Date.now();
  const list = (attempts.get(req.ip) || []).filter((t) => now - t < 60000);
  if (list.length >= 5) return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
  list.push(now);
  attempts.set(req.ip, list);
  next();
}

/* ---------- Admin API ---------- */
app.post('/admin/api/login', loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const okEmail = safeEqual(String(email || '').toLowerCase(), ADMIN_EMAIL);
  const okPass = safeEqual(password || '', ADMIN_PASSWORD);
  if (!(okEmail && okPass)) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: sign({ email: ADMIN_EMAIL, exp: Date.now() + TOKEN_TTL_MS }), email: ADMIN_EMAIL });
});

app.get('/admin/api/stats', requireAdmin, async (req, res) => {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(startToday.getTime() - 6 * 86400000);

  const [total, today, latest, perDay] = await Promise.all([
    Note.countDocuments(),
    Note.countDocuments({ createdAt: { $gte: startToday } }),
    Note.findOne().sort({ createdAt: -1 }),
    Note.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const map = Object.fromEntries(perDay.map((d) => [d._id, d.count]));
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startToday.getTime() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: map[key] || 0 });
  }

  res.json({
    total,
    today,
    latestAt: latest ? latest.createdAt : null,
    days,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
  });
});

app.get('/admin/api/notes', requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = q
    ? {
        $or: [
          { title: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { content: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        ],
      }
    : {};
  res.json(await Note.find(filter).sort({ createdAt: -1 }).limit(200));
});

app.post('/admin/api/notes', requireAdmin, async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'title is required' });
  res.status(201).json(await Note.create({ title: req.body.title, content: req.body.content }));
});

app.delete('/admin/api/notes/:id', requireAdmin, async (req, res) => {
  await Note.findByIdAndDelete(req.params.id);
  res.json({ deleted: true });
});

/* ---------- Pages ---------- */
// api.<domain> shows a small JSON index, backend.<domain> shows the admin dashboard
app.get('/', (req, res) => {
  if ((req.hostname || '').startsWith('api.')) {
    return res.json({ name: 'Notes API', endpoints: ['GET /notes', 'POST /notes', 'DELETE /notes/:id', 'GET /health'] });
  }
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

/* ---------- Start ---------- */
async function start() {
  if (!process.env.ADMIN_SECRET) console.warn('WARNING: ADMIN_SECRET not set, logins reset on restart');
  for (let i = 0; i < 10; i++) {
    try {
      await mongoose.connect(MONGO_URL);
      console.log('MongoDB connected');
      break;
    } catch (e) {
      console.log('Waiting for MongoDB...', e.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  app.listen(PORT, () => console.log('Server on port ' + PORT));
}
start();
