'use strict';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { db, UPLOAD_DIR, now } = require('../db');
const { requireAdmin } = require('../auth');
const { cleanOptions, parseOptions } = require('../style');

const router = express.Router();
router.use(requireAdmin);

const ONLINE_WINDOW_MS = 90e3;
const PENDING_WINDOW_MS = 15 * 60e3;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 300);

const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp|avif|svg\+xml)|video\/(mp4|webm|ogg|quicktime))$/;

function deviceView(d) {
  const { token, ...rest } = d;
  const lastSeen = d.last_seen ? Date.parse(d.last_seen) : 0;
  return { ...rest, online: Date.now() - lastSeen < ONLINE_WINDOW_MS };
}
function bad(res, msg) { return res.status(400).json({ error: msg }); }
function notFound(res) { return res.status(404).json({ error: 'Non trovato' }); }
function cleanName(s, max = 80) { return String(s || '').trim().slice(0, max); }
const ORIENTATIONS = ['landscape', 'portrait'];
function cleanOrientation(v, d = 'landscape') { return ORIENTATIONS.includes(v) ? v : d; }

// ---------- Dispositivi ----------
router.get('/devices', (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, p.name AS playlist_name
    FROM devices d LEFT JOIN playlists p ON p.id = d.playlist_id
    WHERE d.paired = 1 ORDER BY LOWER(d.name)`).all();
  res.json(rows.map(deviceView));
});

router.get('/devices/pending', (req, res) => {
  const since = new Date(Date.now() - PENDING_WINDOW_MS).toISOString();
  const rows = db.prepare(`SELECT id, pairing_code, screen, last_seen, ip, created_at
    FROM devices WHERE paired = 0 AND last_seen >= ? ORDER BY last_seen DESC`).all(since);
  res.json(rows);
});

router.post('/devices/pair', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = cleanName(req.body?.name);
  const playlistId = req.body?.playlist_id ? Number(req.body.playlist_id) : null;
  if (!code) return bad(res, 'Codice mancante');
  if (!name) return bad(res, 'Nome dispositivo mancante');
  if (playlistId && !db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(playlistId)) return bad(res, 'Playlist inesistente');
  const device = db.prepare('SELECT * FROM devices WHERE pairing_code = ? AND paired = 0').get(code);
  if (!device) return notFound(res);
  db.prepare('UPDATE devices SET paired = 1, name = ?, pairing_code = NULL, playlist_id = ? WHERE id = ?')
    .run(name, playlistId, device.id);
  res.json(deviceView(db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id)));
});

router.patch('/devices/:id', (req, res) => {
  const id = Number(req.params.id);
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND paired = 1').get(id);
  if (!device) return notFound(res);
  const updates = [];
  const params = [];
  if (req.body?.name !== undefined) {
    const name = cleanName(req.body.name);
    if (!name) return bad(res, 'Nome non valido');
    updates.push('name = ?'); params.push(name);
  }
  if (req.body?.playlist_id !== undefined) {
    const pid = req.body.playlist_id ? Number(req.body.playlist_id) : null;
    if (pid && !db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(pid)) return bad(res, 'Playlist inesistente');
    updates.push('playlist_id = ?'); params.push(pid);
  }
  if (updates.length) db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
  res.json(deviceView(db.prepare('SELECT * FROM devices WHERE id = ?').get(id)));
});

router.delete('/devices/:id', (req, res) => {
  const info = db.prepare('DELETE FROM devices WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return notFound(res);
  res.json({ ok: true });
});

// ---------- Playlist ----------
const playlistSummary = `
  SELECT p.*,
    (SELECT COUNT(*) FROM playlist_items i WHERE i.playlist_id = p.id) AS item_count,
    (SELECT COUNT(*) FROM devices d WHERE d.playlist_id = p.id AND d.paired = 1) AS device_count
  FROM playlists p`;

function playlistItems(playlistId) {
  return db.prepare(`
    SELECT i.id, i.type, i.media_id, i.url, i.text, i.duration, i.options,
           m.original_name, m.mime, m.filename
    FROM playlist_items i LEFT JOIN media m ON m.id = i.media_id
    WHERE i.playlist_id = ? ORDER BY i.position`).all(playlistId)
    .map(i => ({ ...i, options: parseOptions(i), src: i.filename ? `/media/${i.filename}` : null, filename: undefined }));
}

router.get('/playlists', (req, res) => {
  res.json(db.prepare(`${playlistSummary} ORDER BY LOWER(p.name)`).all());
});

router.post('/playlists', (req, res) => {
  const name = cleanName(req.body?.name);
  if (!name) return bad(res, 'Nome mancante');
  const t = now();
  const info = db.prepare('INSERT INTO playlists (name, orientation, updated_at, created_at) VALUES (?, ?, ?, ?)')
    .run(name, cleanOrientation(req.body?.orientation), t, t);
  res.status(201).json(db.prepare(`${playlistSummary} WHERE p.id = ?`).get(info.lastInsertRowid));
});

router.get('/playlists/:id', (req, res) => {
  const p = db.prepare(`${playlistSummary} WHERE p.id = ?`).get(Number(req.params.id));
  if (!p) return notFound(res);
  res.json({ ...p, items: playlistItems(p.id), app_version: res.locals.app_version });
});

router.patch('/playlists/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  if (!p) return notFound(res);
  const name = req.body?.name !== undefined ? cleanName(req.body.name) : p.name;
  if (!name) return bad(res, 'Nome mancante');
  const orientation = cleanOrientation(req.body?.orientation, p.orientation);
  // Cambiare orientamento cambia versione: i player ricaricano il layout
  db.prepare('UPDATE playlists SET name = ?, orientation = ?, updated_at = CASE WHEN orientation = ? THEN updated_at ELSE ? END WHERE id = ?')
    .run(name, orientation, orientation, now(), id);
  res.json(db.prepare(`${playlistSummary} WHERE p.id = ?`).get(id));
});

// Duplica una playlist nell'altro orientamento, riadattando la dimensione dei testi
router.post('/playlists/:id/duplicate', (req, res) => {
  const src = db.prepare('SELECT * FROM playlists WHERE id = ?').get(Number(req.params.id));
  if (!src) return notFound(res);
  const orientation = cleanOrientation(req.body?.orientation, src.orientation === 'portrait' ? 'landscape' : 'portrait');
  const factor = orientation === src.orientation ? 1 : orientation === 'portrait' ? 16 / 9 : 9 / 16;
  const label = orientation === 'portrait' ? 'verticale' : 'orizzontale';
  const name = cleanName(req.body?.name) || `${src.name.replace(/ \((verticale|orizzontale)\)$/, '')} (${label})`;
  const t = now();
  const newId = db.transaction(() => {
    const info = db.prepare('INSERT INTO playlists (name, orientation, updated_at, created_at) VALUES (?, ?, ?, ?)').run(name, orientation, t, t);
    const ins = db.prepare(`INSERT INTO playlist_items (playlist_id, position, type, media_id, url, text, duration, options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const it of db.prepare('SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position').all(src.id)) {
      const o = parseOptions(it);
      const scale = st => (st.size ? { ...st, size: Math.min(25, Math.max(1, Math.round(st.size * factor * 10) / 10)) } : st);
      const adapted = { ...(it.type === 'text' ? scale(o) : o), overlays: (o.overlays || []).map(scale) };
      ins.run(info.lastInsertRowid, it.position, it.type, it.media_id, it.url, it.text, it.duration, JSON.stringify(cleanOptions(it.type, adapted)));
    }
    return info.lastInsertRowid;
  })();
  res.status(201).json({ ...db.prepare(`${playlistSummary} WHERE p.id = ?`).get(newId), items: playlistItems(newId) });
});

router.put('/playlists/:id/items', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM playlists WHERE id = ?').get(id)) return notFound(res);
  const items = Array.isArray(req.body?.items) ? req.body.items : null;
  if (!items) return bad(res, 'items deve essere un array');

  const rows = [];
  for (const [i, it] of items.entries()) {
    const duration = Math.min(3600, Math.max(1, Math.round(Number(it.duration) || 10)));
    const row = { position: i, type: it.type, media_id: null, url: null, text: null, duration, options: null };
    if (it.type === 'image' || it.type === 'video') {
      const m = db.prepare('SELECT id, mime FROM media WHERE id = ?').get(Number(it.media_id));
      if (!m) return bad(res, `Elemento ${i + 1}: media inesistente`);
      if (!m.mime.startsWith(it.type + '/')) return bad(res, `Elemento ${i + 1}: il media non e' un ${it.type}`);
      row.media_id = m.id;
    } else if (it.type === 'url') {
      const url = String(it.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return bad(res, `Elemento ${i + 1}: URL non valido`);
      row.url = url.slice(0, 2000);
    } else if (it.type === 'text') {
      const text = String(it.text || '').trim();
      if (!text) return bad(res, `Elemento ${i + 1}: testo vuoto`);
      row.text = text.slice(0, 2000);
    } else {
      return bad(res, `Elemento ${i + 1}: tipo non valido`);
    }
    row.options = JSON.stringify(cleanOptions(it.type, it.options));
    rows.push(row);
  }

  db.transaction(() => {
    db.prepare('DELETE FROM playlist_items WHERE playlist_id = ?').run(id);
    const ins = db.prepare(`INSERT INTO playlist_items (playlist_id, position, type, media_id, url, text, duration, options)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const r of rows) ins.run(id, r.position, r.type, r.media_id, r.url, r.text, r.duration, r.options);
    db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(now(), id);
  })();

  res.json({ ...db.prepare(`${playlistSummary} WHERE p.id = ?`).get(id), items: playlistItems(id) });
});

router.delete('/playlists/:id', (req, res) => {
  const info = db.prepare('DELETE FROM playlists WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return notFound(res);
  res.json({ ok: true });
});

// ---------- Media ----------
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10);
    cb(null, `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo di file non supportato: ${file.mimetype}`));
  },
});

function mediaView(m) { return { ...m, src: `/media/${m.filename}` }; }

router.get('/media', (req, res) => {
  res.json(db.prepare('SELECT * FROM media ORDER BY created_at DESC').all().map(mediaView));
});

router.post('/media', (req, res) => {
  upload.array('files', 20)(req, res, err => {
    if (err) return bad(res, err.message);
    if (!req.files?.length) return bad(res, 'Nessun file');
    const ins = db.prepare('INSERT INTO media (filename, original_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?)');
    const created = req.files.map(f => {
      const info = ins.run(f.filename, f.originalname, f.mimetype, f.size, now());
      return mediaView(db.prepare('SELECT * FROM media WHERE id = ?').get(info.lastInsertRowid));
    });
    res.status(201).json(created);
  });
});

router.delete('/media/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM media WHERE id = ?').get(id);
  if (!m) return notFound(res);
  db.transaction(() => {
    // Le playlist che lo usavano cambiano versione, cosi' i player ricaricano
    db.prepare(`UPDATE playlists SET updated_at = ? WHERE id IN (SELECT playlist_id FROM playlist_items WHERE media_id = ?)`).run(now(), id);
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
  })();
  fs.unlink(path.join(UPLOAD_DIR, m.filename), () => {});
  res.json({ ok: true });
});

module.exports = router;
