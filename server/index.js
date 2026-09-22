'use strict';
const fs = require('fs');
const path = require('path');

// Carica .env se presente (senza dipendenze esterne)
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

let app_version = '';
const express = require('express');
const cookieParser = require('cookie-parser');
const { db, UPLOAD_DIR, DATA_DIR } = require('./db');
const auth = require('./auth');
const adminRoutes = require('./routes/admin');
const deviceRoutes = require('./routes/device');
const feedRoutes = require('./routes/feed');

const PORT = Number(process.env.PORT || 8080);

// Versione degli asset del player: se cambia, i player si ricaricano da soli
const crypto = require('crypto');
function assetVersion() {
  const h = crypto.createHash('sha1');
  for (const dir of ['player', 'shared']) {
    const full = path.join(__dirname, '..', 'public', dir);
    for (const f of fs.readdirSync(full).sort()) h.update(f).update(fs.readFileSync(path.join(full, f)));
  }
  return h.digest('hex').slice(0, 12);
}
app_version = assetVersion();
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => { res.locals.app_version = app_version; next(); });
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.use('/api/auth', auth.router);
app.use('/api/admin', adminRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/feed', feedRoutes);

app.use('/media', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false }));
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.get('/', (req, res) => res.redirect('/admin/'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint inesistente' }));
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON non valido' });
  console.error(err);
  res.status(500).json({ error: 'Errore interno' });
});

// Pulizia: dispositivi mai associati e non visti da 24h
setInterval(() => {
  const cutoff = new Date(Date.now() - 24 * 3600e3).toISOString();
  db.prepare('DELETE FROM devices WHERE paired = 0 AND last_seen < ?').run(cutoff);
}, 3600e3).unref();

app.listen(PORT, () => {
  console.log(`BillBoard in ascolto su http://0.0.0.0:${PORT}  (dati in ${DATA_DIR})`);
});
