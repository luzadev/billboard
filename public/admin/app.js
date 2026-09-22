(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  BBRender.loadFonts();

  // ---------- Icone (Lucide, inline SVG) ----------
  const ICON_PATHS = {
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    playlist: '<path d="M12 12H3M16 6H3M12 18H3"/><path d="m16 12 5 3-5 3v-6z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    video: '<rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6h12z"/>',
    play: '<path d="m6 3 14 9-14 9V3z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    key: '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    screen: '<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
    network: '<path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
    landscape: '<rect x="2" y="5" width="20" height="14" rx="2"/>',
    portrait: '<rect x="5" y="2" width="14" height="20" rx="2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4M12 17h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    replace: '<path d="M21 2v6h-6M3 22v-6h6"/><path d="M21 8a9 9 0 0 0-15.5-3.4L3 8M3 16a9 9 0 0 0 15.5 3.4L21 16"/>',
    lowerthird: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 13h8M6 16h5"/><rect x="6" y="8" width="4" height="2" rx=".5" fill="currentColor" stroke="none"/>',
    ticker: '<rect x="2" y="15" width="20" height="6" rx="1"/><path d="M2 5h20M2 9h14"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  };
  function icon(name) { return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`; }
  document.querySelectorAll('i[data-icon]').forEach(el => { el.outerHTML = icon(el.dataset.icon); });
  const serverHost = document.getElementById('server-host'); if (serverHost) serverHost.textContent = location.host;

  // ---------- Utils ----------
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg; t.classList.toggle('err', !!isErr); t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
  }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtSize(b) { return b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB'; }
  function ago(iso) {
    if (!iso) return 'mai';
    const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return `${s}s fa`;
    if (s < 3600) return `${Math.round(s / 60)} min fa`;
    if (s < 86400) return `${Math.round(s / 3600)} h fa`;
    return new Date(iso).toLocaleString('it-IT');
  }
  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    let body = opts.body;
    if (body && !(body instanceof FormData)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const r = await fetch('/api' + path, { ...opts, headers, body });
    if (r.status === 401 && !path.startsWith('/auth/')) { showLogin(); throw new Error('Non autenticato'); }
    const j = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
    if (!r.ok) { toast(j?.error || `Errore ${r.status}`, true); throw new Error(j?.error || r.statusText); }
    return j;
  }
  let uid = 0;

  // ---------- Login ----------
  function showLogin() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); stopDevicePolling(); }
  function showApp() { $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); switchView(currentView); }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    $('#login-error').textContent = '';
    try {
      await api('/auth/login', { method: 'POST', body: { password: $('#login-password').value } });
      $('#login-password').value = '';
      showApp();
    } catch (err) { $('#login-error').textContent = err.message; }
  });
  $('#logout').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); showLogin(); });

  // ---------- Navigazione ----------
  let currentView = 'devices';
  $$('.nav[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  function switchView(v) {
    currentView = v;
    $$('.nav[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    $$('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'view-' + v));
    stopDevicePolling();
    if (v === 'devices') { loadDevices(); devicePoll = setInterval(loadDevices, 8000); }
    if (v === 'playlists') loadPlaylists();
    if (v === 'media') loadMedia();
  }
  $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal').classList.add('hidden')));
  $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.add('hidden'); }));

  // ---------- Schermi ----------
  let devicePoll = null;
  let playlistsCache = [];
  function stopDevicePolling() { clearInterval(devicePoll); devicePoll = null; }
  const ORIENT_LABEL = { landscape: 'orizzontale', portrait: 'verticale' };
  const ORIENT_ICON = { landscape: '▭', portrait: '▯' };
  const ORIENT_SVG = { landscape: icon('landscape'), portrait: icon('portrait') };
  function playlistOptions(selected) {
    return `<option value="">Nessuna playlist</option>` +
      playlistsCache.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${ORIENT_ICON[p.orientation]} ${esc(p.name)}</option>`).join('');
  }
  function screenOrientation(screen) {
    const m = /^(\d+)x(\d+)$/.exec(screen || '');
    return m ? (Number(m[2]) > Number(m[1]) ? 'portrait' : 'landscape') : null;
  }
  function orientationWarning(d) {
    const so = screenOrientation(d.screen);
    const p = playlistsCache.find(x => x.id === d.playlist_id);
    if (!so || !p || p.orientation === so) return '';
    return `<div class="warn">${icon('alert')}<span>Schermo ${ORIENT_LABEL[so]} con playlist ${ORIENT_LABEL[p.orientation]}: i contenuti non saranno impaginati come in anteprima.</span></div>`;
  }

  async function loadDevices() {
    try {
      const [devices, pending, playlists] = await Promise.all([
        api('/admin/devices'), api('/admin/devices/pending'), api('/admin/playlists'),
      ]);
      playlistsCache = playlists;
      $('#nav-devices-count').textContent = devices.length || '';
      const online = devices.filter(d => d.online).length;
      $('#stat-online').textContent = online; $('#stat-offline').textContent = devices.length - online;
      $('#stat-pending').textContent = pending.length; $('#stat-playlists').textContent = playlists.length;

      $('#pending-list').innerHTML = pending.length
        ? pending.map(d => `<div class="chip"><code>${esc(d.pairing_code)}</code>
            <span class="meta">${esc(d.screen || 'schermo')}<br>${ago(d.last_seen)}</span>
            <button class="btn sm primary" data-use-code="${esc(d.pairing_code)}">${icon('link')}Associa</button></div>`).join('')
        : `<span class="none">Nessuno schermo in attesa. Accendi un Raspberry con il player e comparirà qui con il suo codice.</span>`;

      // Non ridisegnare le card se l'utente sta modificando un campo
      if (document.activeElement && $('#devices-grid').contains(document.activeElement)) return;
      $('#devices-grid').innerHTML = devices.map(d => `<div class="dev-card ${d.online ? 'online' : ''}" data-id="${d.id}">
        <div class="dev-top"><span class="status ${d.online ? 'on' : ''}">${d.online ? 'Online' : 'Offline'}</span>
          <div class="dev-actions">${d.agent ? `<button class="btn sm dev-manage">${icon('sliders')}Gestisci</button>` : ''}
          <button class="btn icon ghost dev-delete" title="Rimuovi schermo" aria-label="Rimuovi schermo">${icon('trash')}</button></div></div>
        <input class="dev-name" value="${esc(d.name)}" maxlength="80" title="Clicca per rinominare">
        <label>Playlist<select class="dev-playlist">${playlistOptions(d.playlist_id)}</select></label>
        ${orientationWarning(d)}
        <div class="dev-meta"><span>${ORIENT_SVG[screenOrientation(d.screen)] || icon('screen')}${esc(d.screen || '—')}</span><span>${icon('clock')}${ago(d.last_seen)}</span><span>${icon('network')}${esc(d.ip || '')}</span>${d.agent ? `<span title="Agente sul Raspberry">${icon('monitor')}${d.agent.wifi_ssid ? esc(d.agent.wifi_ssid) + (d.agent.wifi_signal ? ' ' + d.agent.wifi_signal + '%' : '') : d.agent.eth === 'connesso' ? 'Ethernet' : 'Pi'}${d.agent.cpu_temp ? ' · ' + d.agent.cpu_temp + '°C' : ''}</span>` : ''}</div>
      </div>`).join('');
      $('#devices-empty').classList.toggle('hidden', !!devices.length);
    } catch {}
  }

  function openPairModal(code) {
    $('#pair-code').value = code || '';
    $('#pair-name').value = '';
    $('#pair-playlist').innerHTML = playlistOptions(null);
    $('#pair-modal').classList.remove('hidden');
    (code ? $('#pair-name') : $('#pair-code')).focus();
  }
  $('#pair-manual').addEventListener('click', () => openPairModal(''));
  $('#pending-list').addEventListener('click', e => { const b = e.target.closest('[data-use-code]'); if (b) openPairModal(b.dataset.useCode); });
  $('#pair-form').addEventListener('submit', async e => {
    e.preventDefault();
    await api('/admin/devices/pair', { method: 'POST', body: {
      code: $('#pair-code').value, name: $('#pair-name').value, playlist_id: $('#pair-playlist').value || null } });
    $('#pair-modal').classList.add('hidden');
    toast('Schermo associato'); loadDevices();
  });
  $('#devices-grid').addEventListener('change', async e => {
    const card = e.target.closest('.dev-card'); if (!card) return;
    if (e.target.classList.contains('dev-name')) {
      await api(`/admin/devices/${card.dataset.id}`, { method: 'PATCH', body: { name: e.target.value } }); toast('Nome aggiornato');
    } else if (e.target.classList.contains('dev-playlist')) {
      await api(`/admin/devices/${card.dataset.id}`, { method: 'PATCH', body: { playlist_id: e.target.value || null } }); toast('Playlist assegnata');
    }
    e.target.blur();
  });
  $('#devices-grid').addEventListener('click', async e => {
    const mb = e.target.closest('.dev-manage');
    if (mb) return openManage(Number(mb.closest('.dev-card').dataset.id));
    if (!e.target.closest('.dev-delete')) return;
    const card = e.target.closest('.dev-card');
    if (!confirm(`Rimuovere "${card.querySelector('.dev-name').value}"? Lo schermo tornerà a mostrare un codice.`)) return;
    await api(`/admin/devices/${card.dataset.id}`, { method: 'DELETE' });
    toast('Schermo rimosso'); loadDevices();
  });

  // ---------- Gestione remota del Raspberry ----------
  let manageId = null, managePoll = null;
  const CMD_LABEL = { restart_player: 'Riavvio player', reboot: 'Riavvio Raspberry', restart_agent: 'Riavvio agente', update: 'Aggiornamento software', set_server: 'Cambio server', wifi_add: 'Rete Wi‑Fi' };
  const STATUS_LABEL = { pending: 'in coda', sent: 'in esecuzione', done: 'eseguito', failed: 'fallito' };
  function fmtUptime(s) { s = Number(s) || 0; const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}g ${h}h` : h ? `${h}h ${m}m` : `${m} min`; }
  async function openManage(id) {
    manageId = id;
    $('#manage').classList.remove('hidden');
    await renderManage();
    clearInterval(managePoll); managePoll = setInterval(renderManage, 5000);
  }
  $('#manage [data-close]').addEventListener('click', () => { clearInterval(managePoll); manageId = null; });
  async function renderManage() {
    if (manageId === null) return;
    const [devices, cmds] = await Promise.all([api('/admin/devices'), api(`/admin/devices/${manageId}/commands`)]);
    const d = devices.find(x => x.id === manageId); if (!d) { $('#manage').classList.add('hidden'); return; }
    const a = d.agent || {};
    $('#manage-title').textContent = d.name;
    const info = [
      ['Stato', d.online ? 'Online' : 'Offline'], ['Agente', d.agent_online ? 'attivo · v' + (a.agent_version || '?') : 'non raggiungibile (' + ago(d.agent_seen) + ')'],
      ['Hostname', a.hostname], ['IP', a.ip || d.ip], ['Wi‑Fi', a.wifi_ssid ? `${a.wifi_ssid} · ${a.wifi_signal || '?'}%` : '—'], ['Ethernet', a.eth === 'connesso' ? 'collegato' : 'no'],
      ['Acceso da', a.uptime ? fmtUptime(a.uptime) : '—'], ['Temperatura CPU', a.cpu_temp ? a.cpu_temp + ' °C' : '—'],
      ['Sistema', a.os], ['Spazio libero', a.disk_free_mb ? Math.round(a.disk_free_mb / 1024 * 10) / 10 + ' GB' : '—'], ['RAM libera', a.mem_free_mb ? a.mem_free_mb + ' MB' : '—'],
      ['Player', a.player_running === 'yes' ? 'in esecuzione' : 'fermo'], ['Risoluzione', d.screen], ['Ultimo contatto', ago(d.last_seen)],
    ];
    const cmdList = cmds.length ? cmds.map(c => `<li><span class="st ${c.status}">${STATUS_LABEL[c.status] || c.status}</span>
        <span>${CMD_LABEL[c.command] || c.command}${c.payload && c.payload.url ? ' → ' + esc(c.payload.url) : ''}${c.payload && c.payload.ssid ? ' → ' + esc(c.payload.ssid) : ''}<div class="out">${esc((c.result || '').slice(-300))}</div></span>
        <span class="muted small">${ago(c.created_at)}</span></li>`).join('') : '<li class="muted">Nessun comando inviato.</li>';
    // conserva i valori digitati nei campi se il pannello si ridisegna
    const keep = {}; $$('#manage-body input').forEach(i => keep[i.name] = i.value);
    $('#manage-body').innerHTML = `
      <div class="info-grid">${info.map(([k, v]) => `<div class="info"><div class="k">${k}</div><div class="v">${esc(v || '—')}</div></div>`).join('')}</div>
      <div class="manage-section"><h4>Azioni</h4><div class="cmd-grid">
        <button class="btn" data-cmd="restart_player">${icon('play')}Riavvia player</button>
        <button class="btn" data-cmd="reboot">${icon('replace')}Riavvia Raspberry</button>
        <button class="btn" data-cmd="update">${icon('upload')}Aggiorna software</button>
        <button class="btn" data-cmd="restart_agent">${icon('sliders')}Riavvia agente</button>
      </div></div>
      <div class="manage-section"><h4>Rete Wi‑Fi per una prossima sede</h4>
        <form class="row" data-form="wifi_add"><input name="ssid" placeholder="Nome rete" value="${esc(keep.ssid || '')}" required><input name="password" type="password" placeholder="Password (vuota se aperta)" value="${esc(keep.password || '')}">
        <label class="check" style="flex:0 0 auto"><input type="checkbox" name="connect"> Collega subito</label><button class="btn primary" type="submit">Salva sul Pi</button></form>
        <p class="muted small">La rete viene memorizzata sul Raspberry e usata automaticamente quando quella attuale non è disponibile.</p></div>
      <div class="manage-section"><h4>Cambia server</h4>
        <form class="row" data-form="set_server"><input name="url" placeholder="https://billboard.tuodominio.it" value="${esc(keep.url || '')}" required><button class="btn primary" type="submit">Applica</button></form>
        <p class="muted small">Il Raspberry si collegherà al nuovo server e dovrà essere associato di nuovo là.</p></div>
      <div class="manage-section"><h4>Comandi recenti</h4><ul class="cmd-list">${cmdList}</ul></div>`;
  }
  $('#manage-body').addEventListener('click', async e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    if (b.dataset.cmd === 'reboot' && !confirm('Riavviare il Raspberry? Lo schermo resterà nero per circa un minuto.')) return;
    await api(`/admin/devices/${manageId}/commands`, { method: 'POST', body: { command: b.dataset.cmd } });
    toast('Comando inviato: verrà eseguito entro 30 secondi'); renderManage();
  });
  $('#manage-body').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target; const payload = {};
    new FormData(f).forEach((v, k) => payload[k] = v);
    if (f.dataset.form === 'wifi_add') payload.connect = !!f.querySelector('[name=connect]').checked;
    await api(`/admin/devices/${manageId}/commands`, { method: 'POST', body: { command: f.dataset.form, payload } });
    toast('Comando inviato: verrà eseguito entro 30 secondi'); f.reset(); renderManage();
  });

  // ---------- Playlist ----------
  let editing = null;          // { id, name, items:[...] }
  let mediaCache = [];
  const openKeys = new Set();  // elementi con pannello opzioni aperto
  const previews = new Map();  // key -> renderer attivo

  const WD = BBRender.WIDGET_DEFAULTS;
  function normalizeItem(it) {
    it._key = it._key || ++uid;
    const o = it.options || {};
    const list = Array.isArray(o.overlays) ? o.overlays : o.overlay && o.overlay.text ? [o.overlay] : [];
    const overlays = list.map(ov => ({ ...(WD[ov.kind] || WD.text), ...ov, kind: ov.kind || 'text' }));
    if (it.type === 'text') it.options = { ...BBRender.TEXT_DEFAULTS, ...o, overlays };
    else if (it.type === 'image' || it.type === 'video') it.options = { fit: o.fit || 'contain', box: { ...BBRender.FULL_BOX, ...(o.box || {}) }, overlays };
    else it.options = { overlays };
    return it;
  }
  function itemPayload(it) {
    return { type: it.type, media_id: it.media_id, url: it.url, text: it.text, duration: it.duration, options: it.options };
  }
  function renderItem(it) {
    return { type: it.type, text: it.text, src: it.type === 'url' ? it.url : it.src, options: it.options };
  }

  async function loadPlaylists() {
    const list = await api('/admin/playlists');
    playlistsCache = list;
    $('#playlist-list').innerHTML = list.length
      ? list.map(p => `<li data-id="${p.id}" class="${editing?.id === p.id ? 'active' : ''}" title="${ORIENT_LABEL[p.orientation]}">
          ${ORIENT_SVG[p.orientation]}<span class="name">${esc(p.name)}</span><span class="count">${p.item_count} el · ${p.device_count} sch</span></li>`).join('')
      : `<li class="none">Nessuna playlist</li>`;
  }
  $('#playlist-create').addEventListener('submit', async e => {
    e.preventDefault();
    const p = await api('/admin/playlists', { method: 'POST', body: { name: $('#playlist-name').value, orientation: $('#playlist-orientation').value } });
    $('#playlist-name').value = '';
    await loadPlaylists(); openPlaylist(p.id);
  });
  $('#playlist-list').addEventListener('click', e => {
    const li = e.target.closest('li[data-id]'); if (li) openPlaylist(Number(li.dataset.id));
  });

  async function openPlaylist(id) {
    const p = await api(`/admin/playlists/${id}`);
    editing = { id: p.id, name: p.name, orientation: p.orientation || 'landscape', items: p.items.map(normalizeItem) };
    openKeys.clear();
    setOrientationUI();
    $('#playlist-placeholder').classList.add('hidden');
    $('#playlist-editor').classList.remove('hidden');
    $('#edit-name').value = p.name;
    $('#edit-meta').textContent = `${p.device_count} schermi usano questa playlist · ultima modifica ${ago(p.updated_at)}`;
    $$('#playlist-list li').forEach(li => li.classList.toggle('active', Number(li.dataset.id) === id));
    $('#add-url-form').classList.add('hidden');
    renderItems();
  }

  function setOrientationUI() {
    $$('#edit-orientation button').forEach(b => b.classList.toggle('on', b.dataset.v === editing.orientation));
    $('#edit-duplicate span').textContent = editing.orientation === 'portrait' ? 'Copia in orizzontale' : 'Copia in verticale';
    $$('#items .preview').forEach(p => p.classList.toggle('portrait', editing.orientation === 'portrait'));
  }
  $('#edit-orientation').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !editing) return;
    editing.orientation = b.dataset.v;
    setOrientationUI();
    // le dimensioni dei testi dipendono dalla larghezza: ricalcola le anteprime
    $$('#items li').forEach(li => { if (openKeys.has(Number(li.dataset.key))) updatePreview(li); });
  });
  $('#edit-duplicate').addEventListener('click', async () => {
    const target = editing.orientation === 'portrait' ? 'landscape' : 'portrait';
    const p = await api(`/admin/playlists/${editing.id}/duplicate`, { method: 'POST', body: { orientation: target } });
    toast(`Creata "${p.name}" con i testi riadattati`);
    await loadPlaylists(); openPlaylist(p.id);
  });
  const TYPE_LABEL = { image: 'Immagine', video: 'Video', url: 'Pagina web', text: 'Testo' };
  function itemLabel(it) { return it.type === 'url' ? it.url : it.type === 'text' ? it.text : (it.original_name || '(file)'); }
  function itemThumb(it) {
    if (it.type === 'image') return `<img class="thumb" src="${esc(it.src)}" alt="">`;
    return `<div class="thumb t-${it.type}">${icon({ video: 'video', url: 'globe', text: 'type' }[it.type])}</div>`;
  }
  function itemBadges(it) {
    const b = [];
    const arrow = st => ({ left: '←', right: '→', up: '↑', down: '↓' }[st.direction || 'left']);
    if (it.type === 'text' && it.options.scroll) b.push('scorrevole ' + arrow(it.options));
    const ovs = it.options.overlays || [];
    if (ovs.length === 1) {
      const ov = ovs[0];
      b.push(ov.kind === 'text' ? (ov.scroll ? 'testo scorrevole ' + arrow(ov) : 'testo') : BBRender.WIDGET_LABELS[ov.kind].toLowerCase());
    } else if (ovs.length > 1) b.push(`${ovs.length} widget`);
    return b.map(x => `<span class="badge">${x}</span>`).join('');
  }

  function fontSelect(path, value) {
    return `<label>Carattere<select data-path="${path}">${BBRender.FONTS.map(f =>
      `<option value="${f.id}" ${f.id === value ? 'selected' : ''} style="font-family:${f.css}">${f.label}</option>`).join('')}</select></label>`;
  }
  function seg(path, value, opts) {
    return `<div class="seg" data-seg="${path}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === value ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  function boxFields(prefix, b, presets) {
    const f = (k, l) => `<label>${l}<input type="number" min="0" max="100" step="0.5" value="${b[k]}" data-path="${prefix}${k}" data-box></label>`;
    return `<div class="opts-section">Posizione e dimensione <span class="muted">· in % dello schermo, oppure trascina nell'anteprima</span></div>
      <div class="full box-grid">${f('x', 'Da sinistra')}${f('y', "Dall'alto")}${f('w', 'Larghezza')}${f('h', 'Altezza')}</div>
      <div class="full presets">${presets.map(([l, v]) => `<button type="button" class="btn sm" data-preset="${prefix}|${v}">${l}</button>`).join('')}</div>`;
  }
  const TEXT_PRESETS = [['Schermo intero', '0,0,100,100'], ['Fascia in alto', '0,0,100,18'], ['Fascia centrale', '0,41,100,18'], ['Fascia in basso', '0,82,100,18'], ['Bordo sinistro', '0,0,8,100'], ['Bordo destro', '92,0,8,100'], ['Riquadro centrale', '20,30,60,40']];
  const MEDIA_PRESETS = [['Schermo intero', '0,0,100,100'], ['Metà sinistra', '0,0,50,100'], ['Metà destra', '50,0,50,100'], ['Parte alta', '0,0,100,80'], ['Senza bordi laterali', '8,0,84,100'], ['Centrato 70%', '15,15,70,70']];
  function styleFields(prefix, st, overlay) {
    return `
      ${fontSelect(prefix + 'font', st.font)}
      <label>Dimensione testo<div class="range"><input type="range" min="1" max="25" step="0.5" value="${st.size}" data-path="${prefix}size"><output>${st.size}%</output></div></label>
      <label class="wide">Colori<div class="colors">
        <span>Testo</span><input type="color" value="${st.color}" data-path="${prefix}color">
        <span>Sfondo</span><input type="color" value="${st.bg}" data-path="${prefix}bg">
      </div></label>
      <label>Opacità sfondo<div class="range"><input type="range" min="0" max="100" value="${st.bgOpacity}" data-path="${prefix}bgOpacity"><output>${st.bgOpacity}%</output></div></label>
      <label>Allineamento${seg(prefix + 'align', st.align, [['left', 'Sinistra'], ['center', 'Centro'], ['right', 'Destra']])}</label>
      <label class="check"><input type="checkbox" ${st.bold ? 'checked' : ''} data-path="${prefix}bold"> Grassetto</label>
      <label class="check"><input type="checkbox" ${st.scroll ? 'checked' : ''} data-path="${prefix}scroll"> Testo scorrevole</label>
      <label class="wide">Direzione di scorrimento${seg(prefix + 'direction', st.direction || 'left', [['left', '← Sinistra'], ['right', '→ Destra'], ['up', '↑ Alto'], ['down', '↓ Basso']])}</label>
      <label>Velocità scorrimento<div class="range"><input type="range" min="20" max="600" step="10" value="${st.speed}" data-path="${prefix}speed"><output>${st.speed}</output></div></label>
      <label class="wide"><span>Rotazione testo <span class="muted" style="font-weight:400">· per le fasce laterali</span></span>${seg(prefix + 'rotate', st.rotate || 'none', [['none', 'Normale'], ['cw', 'Ruotato a destra'], ['ccw', 'Ruotato a sinistra']])}</label>
      ${boxFields(prefix, st, TEXT_PRESETS)}`;
  }
  const LT_PRESETS = [['Basso a sinistra', '4,72,62,15'], ['Basso largo', '4,72,92,15'], ['Alto a sinistra', '4,6,62,15'], ['Compatto', '4,76,40,11']];
  const TICKER_PRESETS = [['Barra in basso', '0,91,100,7'], ['Barra in alto', '0,0,100,7'], ['Barra alta', '0,88,100,10']];
  const CORNER_PRESETS = [['Alto destra', '85,3,12,10'], ['Alto sinistra', '3,3,12,10'], ['Basso destra', '85,86,12,10'], ['Basso sinistra', '3,86,12,10']];
  const CLOCK_PRESETS = [['Alto destra', '85,3,12,8'], ['Alto sinistra', '3,3,12,8'], ['Basso destra', '85,88,12,8'], ['Basso sinistra', '3,88,12,8']];
  const WIDGET_HINTS = {
    lowerthird: 'La fascia con nome e ruolo tipica dei telegiornali. Le dimensioni dei testi seguono l\'altezza del riquadro.',
    ticker: 'Barra con testata, categoria, orologio e titoli che scorrono. Scrivi una notizia per riga.',
    clock: 'Ora e/o data aggiornate in tempo reale sullo schermo.',
    logo: 'Un\'immagine (PNG con trasparenza consigliato) in un angolo dello schermo.',
  };
  const colorField = (path, value, label) => `<span>${label}</span><input type="color" value="${value}" data-path="${path}">`;
  const opacityField = (path, value, label = 'Opacità sfondo') => `<label>${label}<div class="range"><input type="range" min="0" max="100" value="${value}" data-path="${path}"><output>${value}%</output></div></label>`;
  function imageField(path, value, label) {
    return `<label class="wide"><span>${label}</span><div class="img-pick">
      ${value ? `<img src="${esc(value)}" alt="">` : `<span class="img-empty">${icon('image')}</span>`}
      <button type="button" class="btn sm" data-pick="${path}">${icon('image')}${value ? 'Cambia' : 'Scegli immagine'}</button>
      ${value ? `<button type="button" class="btn sm ghost" data-clear="${path}">${icon('x')}Rimuovi</button>` : ''}
    </div></label>`;
  }
  function widgetForm(ov, i) {
    const p = `options.overlays.${i}.`;
    if (ov.kind === 'text') return `<label class="full">Testo<textarea data-path="${p}text" maxlength="500">${esc(ov.text)}</textarea></label>${styleFields(p, ov, true)}`;
    if (ov.kind === 'lowerthird') return `
      <label>Etichetta<input value="${esc(ov.label)}" maxlength="40" data-path="${p}label" placeholder="IN DIRETTA"></label>
      <label class="wide">Titolo<input value="${esc(ov.title)}" maxlength="120" data-path="${p}title" placeholder="Nome Cognome"></label>
      <label class="full">Sottotitolo<input value="${esc(ov.subtitle)}" maxlength="160" data-path="${p}subtitle" placeholder="Ruolo o descrizione"></label>
      ${fontSelect(p + 'font', ov.font)}
      <label class="wide">Colori<div class="colors">${colorField(p + 'color', ov.color, 'Testo')}${colorField(p + 'labelBg', ov.labelBg, 'Etichetta')}${colorField(p + 'labelColor', ov.labelColor, 'Testo etich.')}${colorField(p + 'bg', ov.bg, 'Sfondo')}${colorField(p + 'bg2', ov.bg2, 'Sfumatura')}</div></label>
      ${opacityField(p + 'bgOpacity', ov.bgOpacity)}
      ${imageField(p + 'bgImage', ov.bgImage, 'Immagine di sfondo (opzionale, sostituisce i colori)')}
      ${boxFields(p, ov, LT_PRESETS)}`;
    if (ov.kind === 'ticker') return `
      <label>Testata<input value="${esc(ov.label)}" maxlength="40" data-path="${p}label" placeholder="NEWS"></label>
      <label>Categoria<input value="${esc(ov.tag)}" maxlength="40" data-path="${p}tag" placeholder="MONDO"></label>
      <label class="check"><input type="checkbox" ${ov.showClock ? 'checked' : ''} data-path="${p}showClock"> Mostra orologio</label>
      <label class="wide"><span>Feed RSS <span class="muted" style="font-weight:400">· opzionale, i titoli si aggiornano ogni 5 minuti</span></span><input type="url" value="${esc(ov.feedUrl || '')}" maxlength="500" data-path="${p}feedUrl" placeholder="https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml"></label>
      <label>Titoli dal feed<input type="number" min="1" max="50" value="${ov.feedMax || 10}" data-path="${p}feedMax"></label>
      <div class="full feed-status muted small" data-feed-status="${i}"></div>
      <label class="full"><span>Notizie scritte a mano <span class="muted" style="font-weight:400">· una per riga; se c'è un feed vengono mostrate dopo i suoi titoli</span></span><textarea data-path="${p}text" maxlength="4000" rows="3">${esc(ov.text)}</textarea></label>
      ${fontSelect(p + 'font', ov.font)}
      <label class="wide">Colori<div class="colors">${colorField(p + 'color', ov.color, 'Testo')}${colorField(p + 'labelBg', ov.labelBg, 'Testata')}${colorField(p + 'labelColor', ov.labelColor, 'Testo testata')}${colorField(p + 'tagBg', ov.tagBg, 'Categoria')}${colorField(p + 'bg', ov.bg, 'Sfondo')}</div></label>
      ${opacityField(p + 'bgOpacity', ov.bgOpacity)}
      <label>Velocità scorrimento<div class="range"><input type="range" min="20" max="600" step="10" value="${ov.speed}" data-path="${p}speed"><output>${ov.speed}</output></div></label>
      ${imageField(p + 'bgImage', ov.bgImage, 'Immagine di sfondo (opzionale)')}
      ${boxFields(p, ov, TICKER_PRESETS)}`;
    if (ov.kind === 'clock') return `
      <label>Formato<select data-path="${p}format">
        ${[['time', 'Ora (16:15)'], ['seconds', 'Ora con secondi'], ['date', 'Data (martedì 22 settembre)'], ['datetime', 'Data e ora']].map(([v, l]) => `<option value="${v}" ${ov.format === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      ${fontSelect(p + 'font', ov.font)}
      <label>Dimensione testo<div class="range"><input type="range" min="1" max="25" step="0.5" value="${ov.size}" data-path="${p}size"><output>${ov.size}%</output></div></label>
      <label class="wide">Colori<div class="colors">${colorField(p + 'color', ov.color, 'Testo')}${colorField(p + 'bg', ov.bg, 'Sfondo')}</div></label>
      ${opacityField(p + 'bgOpacity', ov.bgOpacity)}
      <label>Allineamento${seg(p + 'align', ov.align, [['left', 'Sinistra'], ['center', 'Centro'], ['right', 'Destra']])}</label>
      <label class="check"><input type="checkbox" ${ov.bold ? 'checked' : ''} data-path="${p}bold"> Grassetto</label>
      ${boxFields(p, ov, CLOCK_PRESETS)}`;
    if (ov.kind === 'logo') return `
      ${imageField(p + 'src', ov.src, 'Immagine del logo')}
      ${opacityField(p + 'opacity', ov.opacity, 'Opacità')}
      ${boxFields(p, ov, CORNER_PRESETS)}`;
    return '';
  }
  function widgetsSection(it) {
    const ovs = it.options.overlays;
    return `<div class="opts-section">Widget in sovraimpressione <span class="muted">· testi, terzo inferiore, barra notizie, orologio, logo</span></div>
      ${ovs.map((ov, i) => `<div class="overlay-block full">
        <div class="overlay-head"><span class="opts-section">${icon({ text: 'type', lowerthird: 'lowerthird', ticker: 'ticker', clock: 'clock', logo: 'image' }[ov.kind])} ${BBRender.WIDGET_LABELS[ov.kind]} <span class="muted">${i + 1} di ${ovs.length}</span></span>
          <button type="button" class="btn sm danger" data-remove-overlay="${i}">${icon('x')}Rimuovi</button></div>
        ${WIDGET_HINTS[ov.kind] ? `<p class="muted small" style="margin-bottom:10px">${WIDGET_HINTS[ov.kind]}</p>` : ''}
        <div class="opts-form">${widgetForm(ov, i)}</div></div>`).join('')}
      <div class="full add-widgets">
        <span class="muted small">Aggiungi widget</span>
        ${['text', 'lowerthird', 'ticker', 'clock', 'logo'].map(k => `<button type="button" class="btn soft sm" data-add-overlay="${k}">${icon({ text: 'type', lowerthird: 'lowerthird', ticker: 'ticker', clock: 'clock', logo: 'image' }[k])}${BBRender.WIDGET_LABELS[k]}</button>`).join('')}
      </div>`;
  }
  function optionsForm(it) {
    if (it.type === 'text') {
      return `<label class="full">Testo<textarea data-path="text" maxlength="2000" rows="2">${esc(it.text)}</textarea></label>${styleFields('options.', it.options, false)}${widgetsSection(it)}`;
    }
    if (it.type === 'image' || it.type === 'video') {
      return `<label>Adattamento<select data-path="options.fit">
          <option value="contain" ${it.options.fit === 'contain' ? 'selected' : ''}>Intero (bande nere)</option>
          <option value="cover" ${it.options.fit === 'cover' ? 'selected' : ''}>Riempi schermo (ritaglia)</option></select></label>
        ${boxFields('options.box.', it.options.box, MEDIA_PRESETS)}
        ${widgetsSection(it)}`;
    }
    return widgetsSection(it);
  }

  function renderItems() {
    for (const r of previews.values()) r.stop();
    previews.clear();
    const ol = $('#items');
    ol.innerHTML = editing.items.map((it, i) => `<li class="item" data-key="${it._key}" data-i="${i}">
      <div class="item-main">
        <div class="item-num">${i + 1}</div>
        ${itemThumb(it)}
        <div class="item-label"><div class="name" title="${esc(itemLabel(it))}">${esc(itemLabel(it))}</div>
          <div class="type">${TYPE_LABEL[it.type]}${itemBadges(it)}</div></div>
        <div class="dur">${it.type === 'video' ? 'fino alla fine' : `<input type="number" min="1" max="3600" value="${it.duration}" data-dur> sec`}</div>
        <div class="ctrl">
          ${it.type === 'image' || it.type === 'video' ? `<button class="btn icon sm" data-replace title="Sostituisci immagine o video" aria-label="Sostituisci file">${icon('replace')}</button>` : ''}
          <button class="btn sm ${openKeys.has(it._key) ? 'on' : ''}" data-toggle>${icon('sliders')}${it.type === 'url' ? 'Opzioni' : 'Stile'}</button>
          <button class="btn icon sm" data-move="-1" title="Sposta su" aria-label="Sposta su" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
          <button class="btn icon sm" data-move="1" title="Sposta giù" aria-label="Sposta giù" ${i === editing.items.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
          <button class="btn icon sm danger" data-remove title="Rimuovi" aria-label="Rimuovi">${icon('x')}</button>
        </div>
      </div>
      ${openKeys.has(it._key) ? `<div class="item-opts">
        <div class="preview-wrap"><div class="preview ${editing.orientation === 'portrait' ? 'portrait' : ''}" data-preview></div><div class="preview-cap">Anteprima dal vivo · schermo ${ORIENT_LABEL[editing.orientation]} · trascina testi e immagine, ridimensiona dall'angolo</div></div>
        <div class="opts-form">${optionsForm(it)}</div>
      </div>` : ''}
    </li>`).join('');
    $('#items-empty').classList.toggle('hidden', editing.items.length > 0);
    ol.querySelectorAll('li').forEach(li => {
      if (!openKeys.has(Number(li.dataset.key))) return;
      updatePreview(li);
      itemOf(li).options.overlays.forEach((ov, i) => { if (ov.kind === 'ticker' && ov.feedUrl) checkFeed(li, i); });
    });
  }

  function itemOf(li) { return editing.items[Number(li.dataset.i)]; }
  function updatePreview(li) {
    const it = itemOf(li), box = li.querySelector('[data-preview]');
    if (!box) return;
    const old = previews.get(it._key); if (old) old.stop();
    box.innerHTML = '';
    const r = BBRender.build(renderItem(it), box, { loopVideo: true });
    box.appendChild(r.el); r.start();
    previews.set(it._key, r);
    if (r.textEl) makeInteractive(li, r.textEl, 'options.', box);
    r.overlayEls.forEach((el, i) => { if (el) makeInteractive(li, el, `options.overlays.${i}.`, box); });
    if (r.mediaBox && it.type !== 'url') makeInteractive(li, r.mediaBox, 'options.box.', box);
    // aggiorna etichetta e badge senza ridisegnare tutto
    li.querySelector('.name').textContent = itemLabel(it);
    li.querySelector('.type').innerHTML = TYPE_LABEL[it.type] + itemBadges(it);
  }
  function setPath(obj, path, value) {
    const parts = path.split('.'); let o = obj;
    for (const p of parts.slice(0, -1)) o = o[p];
    o[parts.at(-1)] = value;
  }
  // Trascina per spostare, angolo in basso a destra per ridimensionare
  function makeInteractive(li, el, prefix, stage) {
    const it = itemOf(li);
    el.classList.add('bb-edit');
    const handle = document.createElement('div'); handle.className = 'bb-handle'; el.appendChild(handle);
    const get = k => Number(el.style[k === 'x' ? 'left' : k === 'y' ? 'top' : k === 'w' ? 'width' : 'height'].replace('%', ''));
    const round = v => Math.round(v * 2) / 2;
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const resizing = e.target === handle;
      const rect = stage.getBoundingClientRect();
      const start = { px: e.clientX, py: e.clientY, x: get('x'), y: get('y'), w: get('w'), h: get('h') };
      const cur = { ...start };
      const move = ev => {
        const dx = (ev.clientX - start.px) / rect.width * 100, dy = (ev.clientY - start.py) / rect.height * 100;
        if (resizing) {
          cur.w = round(Math.min(100 - start.x, Math.max(2, start.w + dx)));
          cur.h = round(Math.min(100 - start.y, Math.max(2, start.h + dy)));
        } else {
          cur.x = round(Math.min(100 - start.w, Math.max(0, start.x + dx)));
          cur.y = round(Math.min(100 - start.h, Math.max(0, start.y + dy)));
        }
        el.style.left = cur.x + '%'; el.style.top = cur.y + '%'; el.style.width = cur.w + '%'; el.style.height = cur.h + '%';
      };
      const up = () => {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up);
        for (const k of ['x', 'y', 'w', 'h']) {
          setPath(it, prefix + k, cur[k]);
          const input = li.querySelector(`[data-path="${prefix}${k}"]`); if (input) input.value = cur[k];
        }
        updatePreview(li);
      };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    });
  }
  function applyPreset(li, prefix, values) {
    const it = itemOf(li);
    const [x, y, w, h] = values.split(',').map(Number);
    const vals = { x, y, w, h };
    for (const k of ['x', 'y', 'w', 'h']) {
      setPath(it, prefix + k, vals[k]);
      const input = li.querySelector(`[data-path="${prefix}${k}"]`); if (input) input.value = vals[k];
    }
    updatePreview(li);
  }
  // Verifica del feed RSS della barra notizie: mostra quanti titoli arrivano o l'errore
  const feedTimers = new Map();
  function checkFeed(li, i) {
    const ov = itemOf(li).options.overlays[i];
    const box = li.querySelector(`[data-feed-status="${i}"]`); if (!box) return;
    if (!ov.feedUrl) { box.textContent = ''; return; }
    box.textContent = 'Verifica del feed…';
    clearTimeout(feedTimers.get(li.dataset.key + ':' + i));
    feedTimers.set(li.dataset.key + ':' + i, setTimeout(async () => {
      try {
        const r = await fetch(`/api/feed?url=${encodeURIComponent(ov.feedUrl)}&max=3`, { cache: 'no-store' });
        const j = await r.json();
        box.textContent = r.ok ? `Feed ok · esempio: ${j.titles.join(' • ')}` : `Feed non leggibile: ${j.error}`;
      } catch { box.textContent = 'Feed non raggiungibile'; }
    }, 600));
  }
  const previewTimers = new Map();
  function schedulePreview(li) {
    const k = li.dataset.key;
    clearTimeout(previewTimers.get(k));
    previewTimers.set(k, setTimeout(() => updatePreview(li), 120));
  }

  $('#items').addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    const i = Number(li.dataset.i), it = editing.items[i];
    const pb = e.target.closest('[data-preset]');
    if (pb) { const [prefix, v] = pb.dataset.preset.split('|'); return applyPreset(li, prefix, v); }
    const ab = e.target.closest('[data-add-overlay]');
    if (ab) {
      const kind = ab.dataset.addOverlay || 'text';
      const n = it.options.overlays.filter(o => o.kind === kind).length;
      const ov = { ...WD[kind] };
      // ogni nuovo widget dello stesso tipo parte in una posizione diversa per non sovrapporsi
      if (kind === 'text') { ov.text = `Testo ${n + 1}`; ov.y = Math.max(0, 82 - n * 20); }
      else if (kind === 'clock' || kind === 'logo') { ov.x = Math.max(0, ov.x - n * 14); }
      else { ov.y = Math.max(0, ov.y - n * 18); }
      it.options.overlays.push(ov);
      return renderItems();
    }
    const pk = e.target.closest('[data-pick]');
    if (pk) {
      return openPicker(true, m => { setPath(it, pk.dataset.pick, m.src); renderItems(); });
    }
    const cl = e.target.closest('[data-clear]');
    if (cl) { setPath(it, cl.dataset.clear, null); return renderItems(); }
    const rb = e.target.closest('[data-remove-overlay]');
    if (rb) { it.options.overlays.splice(Number(rb.dataset.removeOverlay), 1); return renderItems(); }
    const segBtn = e.target.closest('.seg button');
    if (segBtn) {
      const seg = segBtn.parentElement;
      setPath(it, seg.dataset.seg, segBtn.dataset.v);
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === segBtn));
      return schedulePreview(li);
    }
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.hasAttribute('data-replace')) {
      // Cambia solo il file: durata, posizione e widget restano
      return openPicker(false, m => {
        it.media_id = m.id; it.src = m.src; it.original_name = m.original_name;
        it.type = m.mime.startsWith('video/') ? 'video' : 'image';
        renderItems(); toast('File sostituito: ricorda di salvare');
      });
    }
    if (btn.hasAttribute('data-toggle')) {
      openKeys.has(it._key) ? openKeys.delete(it._key) : openKeys.add(it._key);
      renderItems();
    } else if (btn.dataset.move) {
      const j = i + Number(btn.dataset.move);
      [editing.items[i], editing.items[j]] = [editing.items[j], editing.items[i]];
      renderItems();
    } else if (btn.hasAttribute('data-remove')) {
      editing.items.splice(i, 1); openKeys.delete(it._key); renderItems();
    }
  });
  $('#items').addEventListener('input', e => {
    const li = e.target.closest('li'); if (!li) return;
    const it = itemOf(li);
    if (e.target.hasAttribute('data-dur')) { it.duration = Number(e.target.value) || 10; return; }
    const path = e.target.dataset.path; if (!path) return;
    let v = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'range' || e.target.type === 'number') ? Number(e.target.value) : e.target.value;
    if (e.target.hasAttribute('data-box')) { if (!Number.isFinite(v)) return; v = Math.min(100, Math.max(0, v)); }
    setPath(it, path, v);
    if (path.endsWith('.feedUrl')) checkFeed(li, Number(path.split('.')[2]));
    if (e.target.type === 'range') e.target.nextElementSibling.textContent = v + (path.endsWith('size') || path.endsWith('bgOpacity') ? '%' : '');
    schedulePreview(li);
  });

  $('#edit-preview').addEventListener('click', () => window.open(`/player/?preview=${editing.id}`, '_blank'));
  $('#edit-save').addEventListener('click', async () => {
    const name = $('#edit-name').value.trim() || editing.name;
    await api(`/admin/playlists/${editing.id}`, { method: 'PATCH', body: { name, orientation: editing.orientation } });
    editing.name = name;
    const p = await api(`/admin/playlists/${editing.id}/items`, { method: 'PUT', body: { items: editing.items.map(itemPayload) } });
    // conserva le chiavi client per mantenere aperti i pannelli
    p.items.forEach((it, i) => { it._key = editing.items[i]?._key; });
    editing.items = p.items.map(normalizeItem);
    toast('Playlist salvata: gli schermi si aggiornano entro pochi secondi');
    loadPlaylists(); renderItems();
    $('#edit-meta').textContent = `${p.device_count} schermi usano questa playlist · salvata adesso`;
  });
  $('#edit-delete').addEventListener('click', async () => {
    if (!confirm(`Eliminare la playlist "${editing.name}"? Gli schermi che la usano resteranno senza contenuti.`)) return;
    await api(`/admin/playlists/${editing.id}`, { method: 'DELETE' });
    editing = null;
    $('#playlist-editor').classList.add('hidden'); $('#playlist-placeholder').classList.remove('hidden');
    toast('Playlist eliminata'); loadPlaylists();
  });

  function addItem(it) {
    normalizeItem(it); editing.items.push(it); openKeys.add(it._key); renderItems();
    $('#items li:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('#add-url').addEventListener('click', () => { $('#add-url-form').classList.remove('hidden'); $('#add-url-value').focus(); });
  $$('[data-cancel]').forEach(b => b.addEventListener('click', () => b.closest('form').classList.add('hidden')));
  $('#add-url-form').addEventListener('submit', e => {
    e.preventDefault();
    addItem({ type: 'url', url: $('#add-url-value').value.trim(), duration: 30 });
    $('#add-url-value').value = ''; $('#add-url-form').classList.add('hidden');
  });
  $('#add-text').addEventListener('click', () => addItem({ type: 'text', text: 'Il tuo testo qui', duration: 10 }));
  let pickerCallback = null;
  async function openPicker(onlyImages, cb) {
    mediaCache = await api('/admin/media');
    const list = onlyImages ? mediaCache.filter(m => m.mime.startsWith('image/')) : mediaCache;
    pickerCallback = cb;
    $('#picker-grid').innerHTML = list.map(m => mediaTile(m, true)).join('');
    $('#picker-empty').classList.toggle('hidden', list.length > 0);
    $('#picker').classList.remove('hidden');
  }
  $('#add-media').addEventListener('click', () => openPicker(false, m => {
    const isVideo = m.mime.startsWith('video/');
    addItem({ type: isVideo ? 'video' : 'image', media_id: m.id, original_name: m.original_name, src: m.src, duration: 10 });
  }));
  $('#picker-grid').addEventListener('click', e => {
    const tile = e.target.closest('.tile'); if (!tile) return;
    const m = mediaCache.find(x => x.id === Number(tile.dataset.id));
    $('#picker').classList.add('hidden');
    if (pickerCallback) pickerCallback(m);
  });

  // ---------- Media ----------
  function mediaTile(m, clickable) {
    const isVideo = m.mime.startsWith('video/');
    return `<div class="tile ${clickable ? 'clickable' : ''}" data-id="${m.id}">
      <div class="pv"><span class="kind">${icon(isVideo ? 'video' : 'image')}${isVideo ? 'VIDEO' : 'IMG'}</span>${isVideo
        ? `<video src="${esc(m.src)}" muted preload="metadata"></video>`
        : `<img src="${esc(m.src)}" alt="" loading="lazy">`}</div>
      <div class="info"><span class="name" title="${esc(m.original_name)}">${esc(m.original_name)}</span>
        ${clickable ? `<span class="size">${fmtSize(m.size)}</span>` : `<button class="btn icon sm danger del" data-del title="Elimina" aria-label="Elimina">${icon('trash')}</button>`}</div></div>`;
  }
  async function loadMedia() {
    mediaCache = await api('/admin/media');
    $('#media-grid').innerHTML = mediaCache.length ? mediaCache.map(m => mediaTile(m, false)).join('')
      : `<div class="empty" style="grid-column:1/-1"><div class="empty-art">${icon('image')}</div><h3>Nessun file caricato</h3><p class="muted">Trascina immagini o video nell'area qui sopra.</p></div>`;
  }
  async function uploadFiles(files) {
    files = Array.from(files).filter(f => /^(image|video)\//.test(f.type));
    if (!files.length) return toast('Nessun file valido', true);
    const fd = new FormData(); files.forEach(f => fd.append('files', f));
    $('#upload-progress').classList.remove('hidden');
    try { await api('/admin/media', { method: 'POST', body: fd }); toast(`${files.length} file caricati`); loadMedia(); }
    finally { $('#upload-progress').classList.add('hidden'); }
  }
  $('#upload-input').addEventListener('change', e => { uploadFiles(e.target.files); e.target.value = ''; });
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => uploadFiles(e.dataTransfer.files));
  $('#media-grid').addEventListener('click', async e => {
    if (!e.target.closest('[data-del]')) return;
    const m = mediaCache.find(x => x.id === Number(e.target.closest('.tile').dataset.id));
    if (!confirm(`Eliminare "${m.original_name}"? Verrà rimosso anche dalle playlist che lo usano.`)) return;
    await api(`/admin/media/${m.id}`, { method: 'DELETE' });
    toast('File eliminato'); loadMedia();
  });

  // ---------- Avvio ----------
  api('/auth/me').then(r => r.authenticated ? showApp() : showLogin()).catch(showLogin);
})();
