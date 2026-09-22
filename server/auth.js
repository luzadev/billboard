'use strict';
const crypto = require('crypto');
const express = require('express');
const { db, now } = require('./db');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('ERRORE: la variabile ADMIN_PASSWORD non e\' impostata.');
  process.exit(1);
}
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('AVVISO: SESSION_SECRET non impostato, generato uno casuale (le sessioni admin scadono al riavvio).');
}
const COOKIE = 'bb_session';
const SESSION_DAYS = 30;

function sign(data) {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}
function createSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86400e3 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function verifySession(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function requireAdmin(req, res, next) {
  if (verifySession(req.cookies[COOKIE])) return next();
  res.status(401).json({ error: 'Non autenticato' });
}

const getDeviceByToken = db.prepare('SELECT * FROM devices WHERE token = ?');
function requireDevice(req, res, next) {
  const h = req.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  const device = token ? getDeviceByToken.get(token) : null;
  if (!device) return res.status(401).json({ error: 'Dispositivo sconosciuto' });
  req.device = device;
  next();
}

// Semplice rate limit sui tentativi di login (per IP)
const attempts = new Map();
function loginLimiter(req, res, next) {
  const key = req.ip;
  const rec = attempts.get(key) || { n: 0, until: 0 };
  if (rec.until > Date.now()) return res.status(429).json({ error: 'Troppi tentativi, riprova tra un minuto' });
  req._attempts = rec;
  attempts.set(key, rec);
  next();
}

const router = express.Router();
router.post('/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!password || !safeEqual(password, ADMIN_PASSWORD)) {
    req._attempts.n += 1;
    if (req._attempts.n >= 5) { req._attempts.n = 0; req._attempts.until = Date.now() + 60e3; }
    return res.status(401).json({ error: 'Password errata' });
  }
  req._attempts.n = 0;
  res.cookie(COOKIE, createSession(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 86400e3,
  });
  res.json({ ok: true });
});
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});
router.get('/me', (req, res) => {
  res.json({ authenticated: verifySession(req.cookies[COOKIE]) });
});

module.exports = { router, requireAdmin, requireDevice, now };
