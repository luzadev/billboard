'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'billboard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    original_name TEXT NOT NULL,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image','video','url','text')),
    media_id INTEGER REFERENCES media(id) ON DELETE CASCADE,
    url TEXT,
    text TEXT,
    duration INTEGER NOT NULL DEFAULT 10
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    token TEXT NOT NULL UNIQUE,
    pairing_code TEXT,
    paired INTEGER NOT NULL DEFAULT 0,
    playlist_id INTEGER REFERENCES playlists(id) ON DELETE SET NULL,
    last_seen TEXT,
    screen TEXT,
    user_agent TEXT,
    ip TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_playlist ON playlist_items(playlist_id, position);
  CREATE INDEX IF NOT EXISTS idx_devices_code ON devices(pairing_code);
`);

// Migrazioni leggere
const cols = db.prepare('PRAGMA table_info(playlist_items)').all().map(c => c.name);
if (!cols.includes('options')) db.exec('ALTER TABLE playlist_items ADD COLUMN options TEXT');
const dcols = db.prepare('PRAGMA table_info(devices)').all().map(c => c.name);
if (!dcols.includes('agent')) db.exec('ALTER TABLE devices ADD COLUMN agent TEXT');
if (!dcols.includes('agent_seen')) db.exec('ALTER TABLE devices ADD COLUMN agent_seen TEXT');
db.exec(`
  CREATE TABLE IF NOT EXISTS device_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    done_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_commands_device ON device_commands(device_id, status);
`);
const pcols = db.prepare('PRAGMA table_info(playlists)').all().map(c => c.name);
if (!pcols.includes('orientation')) db.exec("ALTER TABLE playlists ADD COLUMN orientation TEXT NOT NULL DEFAULT 'landscape'");

const now = () => new Date().toISOString();

module.exports = { db, DATA_DIR, UPLOAD_DIR, now };
