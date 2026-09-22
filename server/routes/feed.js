'use strict';
// Lettura di feed RSS/Atom per la barra notizie, con cache in memoria.
const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { requireAdmin, requireDevice } = require('../auth');

const router = express.Router();
const CACHE_TTL_MS = 5 * 60e3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;
const cache = new Map(); // url -> { titles, at }

function requireAdminOrDevice(req, res, next) {
  if (req.get('authorization')) return requireDevice(req, res, next);
  return requireAdmin(req, res, next);
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('URL non valido'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Sono ammessi solo http e https');
  const host = u.hostname;
  if (host === 'localhost' || host.endsWith('.local')) throw new Error('Host non consentito');
  if (net.isIP(host)) { if (isPrivateIp(host)) throw new Error('Host non consentito'); return u; }
  const addrs = await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error('Host non risolvibile');
  if (addrs.some(a => isPrivateIp(a.address))) throw new Error('Host non consentito');
  return u;
}

function decodeEntities(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
      const l = e.toLowerCase();
      if (l[0] === '#') return String.fromCodePoint(l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[l];
    })
    .replace(/\s+/g, ' ').trim();
}

// Estrae i titoli da RSS 2.0 (<item><title>) o Atom (<entry><title>)
function parseTitles(xml) {
  const titles = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  for (const b of blocks) {
    const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(b);
    if (m) { const t = decodeEntities(m[1]); if (t) titles.push(t.slice(0, 300)); }
  }
  return titles;
}

async function fetchTitles(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  await assertPublicUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'BillBoard/1.0 (+rss ticker)', accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' } });
    if (!r.ok) throw new Error(`Il feed risponde ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('Feed troppo grande');
    const titles = parseTitles(buf.toString('utf8'));
    if (!titles.length) throw new Error('Nessun titolo trovato nel feed');
    const entry = { titles, at: Date.now() };
    cache.set(url, entry);
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return entry;
  } finally { clearTimeout(timer); }
}

router.get('/', requireAdminOrDevice, async (req, res) => {
  const url = String(req.query.url || '').slice(0, 500);
  const max = Math.min(50, Math.max(1, Number(req.query.max) || 10));
  if (!url) return res.status(400).json({ error: 'url mancante' });
  try {
    const { titles, at } = await fetchTitles(url);
    res.json({ titles: titles.slice(0, max), fetched_at: new Date(at).toISOString() });
  } catch (e) {
    res.status(502).json({ error: e.name === 'AbortError' ? 'Il feed non risponde' : e.message });
  }
});

module.exports = router;
