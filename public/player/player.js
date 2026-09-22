(() => {
  'use strict';
  const TOKEN_KEY = 'billboard_token';
  const stage = document.getElementById('stage');
  const pairingEl = document.getElementById('pairing');
  const idleEl = document.getElementById('idle');
  const netEl = document.getElementById('net');
  const PREVIEW_ID = new URLSearchParams(location.search).get('preview');

  let token = safeGet(TOKEN_KEY);
  let currentVersion = null;
  let items = [];
  let index = -1;
  let current = null;       // { el, stop }
  let advanceTimer = null;
  let pollTimer = null;
  let playbackId = 0;
  let appVersion = null;

  // Se il server e' stato aggiornato, ricarica la pagina per prendere il nuovo codice
  function checkVersion(v) {
    if (!v) return;
    if (appVersion === null) appVersion = v;
    else if (v !== appVersion) location.reload();
  }

  BBRender.loadFonts();

  function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function safeDel(k) { try { localStorage.removeItem(k); } catch {} }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function schedule(seconds) { clearTimeout(pollTimer); pollTimer = setTimeout(poll, seconds * 1000); }

  async function register() {
    const r = await fetch('/api/device/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: `${screen.width}x${screen.height}` }),
    });
    if (!r.ok) throw new Error('register failed');
    token = (await r.json()).token;
    safeSet(TOKEN_KEY, token);
  }

  // In anteprima lo stage assume il formato della playlist (16:9 o 9:16) centrato nella finestra
  let previewOrientation = null;
  function fitStage() {
    if (!previewOrientation) return;
    const ratio = previewOrientation === 'portrait' ? 9 / 16 : 16 / 9;
    const w = Math.min(innerWidth, innerHeight * ratio), h = w / ratio;
    Object.assign(stage.style, { left: (innerWidth - w) / 2 + 'px', top: (innerHeight - h) / 2 + 'px', width: w + 'px', height: h + 'px' });
  }

  // Modalita' anteprima dal pannello: /player/?preview=<playlist id>
  async function pollPreview() {
    try {
      const r = await fetch(`/api/admin/playlists/${PREVIEW_ID}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const p = await r.json();
      hide(netEl);
      checkVersion(p.app_version);
      const version = `${p.id}:${p.updated_at}`;
      if (version !== currentVersion) {
        currentVersion = version;
        previewOrientation = p.orientation || 'landscape';
        fitStage();
        startPlayback(p.items.map(i => ({ ...i, src: i.type === 'url' ? i.url : i.src })), p.name);
      }
    } catch { show(netEl); }
    clearTimeout(pollTimer); pollTimer = setTimeout(pollPreview, 5000);
  }

  async function poll() {
    try {
      if (!token) await register();
      const r = await fetch(`/api/device/state?w=${screen.width}&h=${screen.height}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      if (r.status === 401) {
        safeDel(TOKEN_KEY); token = null; currentVersion = null;
        stopPlayback();
        return schedule(2);
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = await r.json();
      hide(netEl);
      checkVersion(s.app_version);

      if (!s.paired) {
        stopPlayback();
        document.getElementById('code').textContent = s.code || '------';
        document.getElementById('pair-host').textContent = location.host;
        hide(idleEl); show(pairingEl);
        return schedule(s.poll_interval || 5);
      }
      hide(pairingEl);

      const version = s.playlist ? `${s.playlist.id}:${s.playlist.version}` : 'none';
      if (version !== currentVersion) {
        currentVersion = version;
        startPlayback(s.playlist ? s.playlist.items : [], s.name);
      }
      schedule(s.poll_interval || 15);
    } catch (e) {
      show(netEl);
      schedule(10);
    }
  }

  // ---------- Riproduzione ----------
  function stopPlayback() {
    playbackId++;
    clearTimeout(advanceTimer);
    items = []; index = -1;
    if (current) { current.stop(); current.el.remove(); current = null; }
    stage.querySelectorAll('.bb-item').forEach(el => el.remove());
  }

  function startPlayback(list, deviceName) {
    stopPlayback();
    items = list;
    if (!items.length) {
      document.getElementById('idle-name').textContent = deviceName || '';
      show(idleEl);
      return;
    }
    hide(idleEl);
    index = -1;
    next();
  }

  function next() {
    if (!items.length) return;
    index = (index + 1) % items.length;
    play(items[index], ++playbackId);
  }

  function play(item, id) {
    const r = BBRender.build(item, stage);
    const done = () => { if (id !== playbackId) return; playbackId++; next(); };
    const holdFor = seconds => { clearTimeout(advanceTimer); advanceTimer = setTimeout(done, seconds * 1000); };
    const swap = () => {
      if (id !== playbackId) { r.stop(); r.el.remove(); return; }
      stage.appendChild(r.el);
      r.start();
      requestAnimationFrame(() => requestAnimationFrame(() => r.el.classList.add('visible')));
      const prev = current; current = r;
      if (prev) { setTimeout(() => { prev.stop(); prev.el.remove(); }, 700); }
    };

    // Con un solo elemento non si ricomincia da capo ogni N secondi:
    // l'immagine resta fissa e il testo scorrevole continua senza interruzioni.
    const single = items.length === 1;
    const hold = seconds => { if (!single) holdFor(seconds); };

    if (item.type === 'image') {
      const m = r.media;
      m.decode().then(() => { swap(); hold(item.duration); }).catch(() => holdFor(2));
    } else if (item.type === 'video') {
      const v = r.media;
      if (single) v.loop = true; else v.onended = done;
      v.onerror = () => holdFor(2);
      v.oncanplay = () => { v.oncanplay = null; swap(); v.play().catch(() => {}); };
      if (!single) holdFor(600); // sicurezza: stream infiniti
      v.load();
    } else if (item.type === 'url' || item.type === 'text') {
      swap(); hold(item.duration);
    } else {
      holdFor(1);
    }
  }

  // Ricalcola le dimensioni dei testi se cambia la finestra
  addEventListener('resize', () => { fitStage(); if (items.length) { const i = index; index = i - 1; clearTimeout(advanceTimer); next(); } });

  setTimeout(() => location.reload(), 24 * 3600e3);
  if (PREVIEW_ID) { document.body.classList.add('preview'); show(document.getElementById('preview-badge')); pollPreview(); } else { poll(); }
})();
