'use strict';
const express = require('express');
const crypto = require('crypto');
const { db, now } = require('../db');
const { requireDevice } = require('../auth');
const { parseOptions } = require('../style');

const router = express.Router();

// Caratteri senza ambiguita' (niente 0/O, 1/I)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateCode() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const bytes = crypto.randomBytes(6);
    let code = '';
    for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
    if (!db.prepare('SELECT 1 FROM devices WHERE pairing_code = ?').get(code)) return code;
  }
  throw new Error('Impossibile generare un codice univoco');
}

router.post('/register', (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  const code = generateCode();
  const screen = String(req.body?.screen || '').slice(0, 20);
  const t = now();
  db.prepare(`INSERT INTO devices (token, pairing_code, paired, screen, user_agent, ip, last_seen, created_at)
    VALUES (?, ?, 0, ?, ?, ?, ?, ?)`)
    .run(token, code, screen, String(req.get('user-agent') || '').slice(0, 200), req.ip, t, t);
  res.status(201).json({ token, code });
});

router.get('/state', requireDevice, (req, res) => {
  const d = req.device;
  const screen = req.query.w && req.query.h ? `${Number(req.query.w)}x${Number(req.query.h)}` : d.screen;
  db.prepare('UPDATE devices SET last_seen = ?, ip = ?, screen = ? WHERE id = ?').run(now(), req.ip, screen, d.id);

  if (!d.paired) {
    return res.json({ paired: false, code: d.pairing_code, poll_interval: 5, app_version: res.locals.app_version });
  }

  let playlist = null;
  if (d.playlist_id) {
    const p = db.prepare('SELECT id, name, orientation, updated_at FROM playlists WHERE id = ?').get(d.playlist_id);
    if (p) {
      const items = db.prepare(`
        SELECT i.type, i.url, i.text, i.duration, i.options, m.filename, m.mime
        FROM playlist_items i LEFT JOIN media m ON m.id = i.media_id
        WHERE i.playlist_id = ? ORDER BY i.position`).all(p.id)
        .map(i => ({
          type: i.type,
          src: i.type === 'url' ? i.url : i.filename ? `/media/${i.filename}` : null,
          text: i.text,
          mime: i.mime || undefined,
          duration: i.duration,
          options: parseOptions(i),
        }))
        .filter(i => i.type === 'text' || i.src);
      playlist = { id: p.id, name: p.name, orientation: p.orientation, version: p.updated_at, items };
    }
  }

  res.json({ paired: true, name: d.name, poll_interval: 15, playlist, app_version: res.locals.app_version });
});

// ---------- Agente sul Raspberry: telemetria e comandi ----------
const AGENT_KEYS = ['hostname', 'ip', 'wifi_ssid', 'wifi_signal', 'uptime', 'cpu_temp', 'os', 'agent_version',
  'disk_free_mb', 'mem_free_mb', 'player_running', 'user', 'eth', 'mode'];

router.post('/agent', requireDevice, (req, res) => {
  const d = req.device;
  const info = {};
  const src = req.body?.info && typeof req.body.info === 'object' ? req.body.info : {};
  for (const k of AGENT_KEYS) if (src[k] !== undefined && src[k] !== null) info[k] = String(src[k]).slice(0, 200);
  const t = now();
  db.prepare('UPDATE devices SET agent = ?, agent_seen = ? WHERE id = ?').run(JSON.stringify(info), t, d.id);
  const pending = db.prepare(`SELECT id, command, payload FROM device_commands WHERE device_id = ? AND status = 'pending' ORDER BY id`).all(d.id);
  if (pending.length) {
    const mark = db.prepare(`UPDATE device_commands SET status = 'sent', sent_at = ? WHERE id = ?`);
    for (const c of pending) mark.run(t, c.id);
  }
  res.json({
    commands: pending.map(c => ({ id: c.id, command: c.command, payload: c.payload ? JSON.parse(c.payload) : {} })),
    poll_interval: 30,
    paired: !!d.paired,
  });
});

router.post('/agent/result', requireDevice, (req, res) => {
  const id = Number(req.body?.id);
  const ok = !!req.body?.ok;
  const output = String(req.body?.output || '').slice(0, 4000);
  const info = db.prepare(`UPDATE device_commands SET status = ?, result = ?, done_at = ? WHERE id = ? AND device_id = ?`)
    .run(ok ? 'done' : 'failed', output, now(), id, req.device.id);
  res.json({ ok: info.changes > 0 });
});

module.exports = router;
