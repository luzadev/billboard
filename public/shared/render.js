// Motore di rendering condiviso tra player e anteprima del pannello.
// Coerente con server/style.js
window.BBRender = (() => {
  'use strict';
  const FONTS = [
    { id: 'system-ui', label: 'Predefinito (sistema)', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
    { id: 'Inter', label: 'Inter (moderno)', css: '"Inter", sans-serif' },
    { id: 'Roboto', label: 'Roboto', css: '"Roboto", sans-serif' },
    { id: 'Montserrat', label: 'Montserrat (geometrico)', css: '"Montserrat", sans-serif' },
    { id: 'Oswald', label: 'Oswald (condensato)', css: '"Oswald", sans-serif' },
    { id: 'Bebas Neue', label: 'Bebas Neue (titoli)', css: '"Bebas Neue", sans-serif' },
    { id: 'Playfair Display', label: 'Playfair Display (elegante)', css: '"Playfair Display", serif' },
    { id: 'Lobster', label: 'Lobster (corsivo)', css: '"Lobster", cursive' },
    { id: 'Pacifico', label: 'Pacifico (calligrafico)', css: '"Pacifico", cursive' },
    { id: 'Courier Prime', label: 'Courier Prime (macchina da scrivere)', css: '"Courier Prime", monospace' },
  ];
  const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Roboto:wght@400;700&family=Montserrat:wght@400;700&family=Oswald:wght@400;700&family=Bebas+Neue&family=Playfair+Display:wght@400;700&family=Lobster&family=Pacifico&family=Courier+Prime:wght@400;700&display=swap';

  const FULL_BOX = { x: 0, y: 0, w: 100, h: 100 };
  const TEXT_DEFAULTS = { font: 'system-ui', size: 6, color: '#ffffff', bg: '#111827', bgOpacity: 100, align: 'center', scroll: false, direction: 'left', rotate: 'none', speed: 120, bold: true, ...FULL_BOX };
  const OVERLAY_DEFAULTS = { kind: 'text', text: '', font: 'system-ui', size: 3.5, color: '#ffffff', bg: '#000000', bgOpacity: 60, align: 'center', scroll: true, direction: 'left', rotate: 'none', speed: 120, bold: true, x: 0, y: 82, w: 100, h: 18 };
  // Widget "televisivi": valori predefiniti coerenti con server/style.js
  const WIDGET_DEFAULTS = {
    text: OVERLAY_DEFAULTS,
    lowerthird: { kind: 'lowerthird', x: 4, y: 72, w: 62, h: 15, label: 'IN DIRETTA', title: 'Nome Cognome', subtitle: 'Ruolo o descrizione',
      font: 'Inter', color: '#ffffff', labelBg: '#d61f26', labelColor: '#ffffff', bg: '#12307a', bg2: '#071240', bgOpacity: 94, bgImage: null },
    ticker: { kind: 'ticker', x: 0, y: 91, w: 100, h: 7, label: 'NEWS', tag: '', text: 'Prima notizia\nSeconda notizia\nTerza notizia',
      font: 'Inter', color: '#ffffff', labelBg: '#d61f26', labelColor: '#ffffff', tagBg: '#1d4ed8', bg: '#0a1a3f', bgOpacity: 96, speed: 120, showClock: true, bgImage: null, feedUrl: '', feedMax: 10 },
    clock: { kind: 'clock', x: 85, y: 3, w: 12, h: 8, format: 'time', font: 'Inter', size: 3, color: '#ffffff', bg: '#000000', bgOpacity: 45, align: 'center', bold: true },
    logo: { kind: 'logo', x: 85, y: 3, w: 12, h: 10, src: '', opacity: 100 },
  };
  const WIDGET_LABELS = { text: 'Testo', lowerthird: 'Terzo inferiore', ticker: 'Barra notizie', clock: 'Orologio', logo: 'Logo' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function clockText(format) {
    const d = new Date();
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (format === 'seconds') return `${time}:${pad(d.getSeconds())}`;
    const date = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    if (format === 'date') return date;
    if (format === 'datetime') return `${date} · ${time}`;
    return time;
  }
  function liveClock(el, format) {
    el.textContent = clockText(format);
    const id = setInterval(() => { el.textContent = clockText(format); }, 1000);
    return () => clearInterval(id);
  }
  function surface(st) {
    return st.bgImage ? `url("${st.bgImage}") center / cover no-repeat`
      : st.bg2 ? `linear-gradient(90deg, ${rgba(st.bg, st.bgOpacity)}, ${rgba(st.bg2, st.bgOpacity)})` : rgba(st.bg, st.bgOpacity);
  }
  function el(cls, text) { const d = document.createElement('div'); d.className = cls; if (text != null) d.textContent = text; return d; }

  function buildLowerThird(st, container) {
    const layer = el('bb-lt'); applyBox(layer, st);
    const H = container.clientHeight * st.h / 100;
    Object.assign(layer.style, { fontFamily: fontFamily(st.font), color: st.color, background: surface(st), borderLeft: `${Math.max(2, H * 0.09)}px solid ${st.labelBg}` });
    if (st.label) { const l = el('bb-lt-label', st.label); Object.assign(l.style, { background: st.labelBg, color: st.labelColor, fontSize: H * 0.2 + 'px' }); layer.appendChild(l); }
    if (st.title) { const t = el('bb-lt-title', st.title); t.style.fontSize = H * (st.subtitle ? 0.34 : 0.42) + 'px'; layer.appendChild(t); }
    if (st.subtitle) { const t = el('bb-lt-sub', st.subtitle); t.style.fontSize = H * 0.23 + 'px'; layer.appendChild(t); }
    return { el: layer, start() {}, stop() {} };
  }

  // Chi ospita il renderer (player o pannello) puo' sostituirlo per aggiungere l'autenticazione
  let feedFetcher = async (url, max) => {
    const r = await fetch(`/api/feed?url=${encodeURIComponent(url)}&max=${max}`, { cache: 'no-store' });
    if (!r.ok) throw new Error('feed');
    return (await r.json()).titles;
  };
  const FEED_REFRESH_MS = 5 * 60e3;

  function buildTicker(st, container) {
    const layer = el('bb-tk'); applyBox(layer, st);
    const H = container.clientHeight * st.h / 100;
    Object.assign(layer.style, { fontFamily: fontFamily(st.font), color: st.color, background: surface(st), fontSize: H * 0.5 + 'px' });
    let clockEl = null;
    if (st.showClock) { clockEl = el('bb-tk-clock'); layer.appendChild(clockEl); }
    if (st.label) { const l = el('bb-tk-label', st.label); Object.assign(l.style, { background: st.labelBg, color: st.labelColor }); layer.appendChild(l); }
    if (st.tag) { const t = el('bb-tk-tag', st.tag); t.style.background = st.tagBg; layer.appendChild(t); }
    const track = el('bb-tk-track'); const text = el('bb-tk-text');
    const manual = String(st.text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    let lines = manual.slice();
    text.textContent = lines.join('      •      ');
    track.appendChild(text); layer.appendChild(track);
    let anim = null, stopClock = null, feedTimer = null, running = false;
    const animate = () => {
      if (anim) anim.cancel(); anim = null;
      if (!lines.length || !running) return;
      const w = text.scrollWidth, cw = track.clientWidth;
      anim = text.animate([{ transform: `translateX(${cw}px)` }, { transform: `translateX(${-w}px)` }],
        { duration: (cw + w) / (st.speed || 120) * 1000, iterations: Infinity, easing: 'linear' });
    };
    // Feed RSS: i titoli del feed vengono prima, le notizie scritte a mano dopo (o da sole se il feed fallisce)
    const loadFeed = async () => {
      if (!st.feedUrl) return;
      try {
        const titles = await feedFetcher(st.feedUrl, st.feedMax || 10);
        if (!running || !titles.length) return;
        lines = titles.concat(manual);
        text.textContent = lines.join('      •      ');
        animate();
      } catch { /* resta il testo manuale */ }
    };
    return {
      el: layer,
      start() {
        running = true;
        if (clockEl) stopClock = liveClock(clockEl, 'time');
        animate();
        if (st.feedUrl) { loadFeed(); feedTimer = setInterval(loadFeed, FEED_REFRESH_MS); }
      },
      stop() { running = false; if (anim) anim.cancel(); if (stopClock) stopClock(); clearInterval(feedTimer); },
    };
  }

  function buildClock(st, container) {
    const layer = el('bb-clock'); applyBox(layer, st);
    Object.assign(layer.style, { fontFamily: fontFamily(st.font), color: st.color, background: rgba(st.bg, st.bgOpacity),
      fontSize: Math.max(6, container.clientWidth * (st.size ?? 3) / 100) + 'px', fontWeight: st.bold === false ? '400' : '700', justifyContent: JUSTIFY[st.align] || 'center' });
    layer.textContent = clockText(st.format);
    let stopClock = null;
    return { el: layer, start() { stopClock = liveClock(layer, st.format); }, stop() { if (stopClock) stopClock(); } };
  }

  function buildLogo(st) {
    const layer = el('bb-logo'); applyBox(layer, st);
    const img = document.createElement('img'); img.src = st.src; img.alt = ''; img.draggable = false; img.style.opacity = (st.opacity ?? 100) / 100;
    layer.appendChild(img);
    return { el: layer, start() {}, stop() {} };
  }

  function buildOverlay(ov, container) {
    const kind = ov.kind || 'text';
    const st = { ...(WIDGET_DEFAULTS[kind] || OVERLAY_DEFAULTS), ...ov };
    if (kind === 'text') return st.text ? buildText(st.text, st, container) : null;
    if (kind === 'lowerthird') return buildLowerThird(st, container);
    if (kind === 'ticker') return buildTicker(st, container);
    if (kind === 'clock') return buildClock(st, container);
    if (kind === 'logo') return st.src ? buildLogo(st) : null;
    return null;
  }

  function loadFonts() {
    if (document.getElementById('bb-fonts')) return;
    const l = document.createElement('link');
    l.id = 'bb-fonts'; l.rel = 'stylesheet'; l.href = GOOGLE_FONTS_URL;
    document.head.appendChild(l);
  }
  function fontFamily(id) { return (FONTS.find(f => f.id === id) || FONTS[0]).css; }
  function rgba(hex, opacityPct) {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#000000') || [0, '00', '00', '00'];
    return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${(opacityPct ?? 100) / 100})`;
  }
  function applyBox(el, b) {
    el.style.left = (b.x ?? 0) + '%'; el.style.top = (b.y ?? 0) + '%';
    el.style.width = (b.w ?? 100) + '%'; el.style.height = (b.h ?? 100) + '%';
  }
  const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end' };

  function buildText(content, st, container) {
    const layer = document.createElement('div');
    layer.className = 'bb-text';
    applyBox(layer, st);
    const fs = Math.max(6, container.clientWidth * (st.size ?? 6) / 100);
    Object.assign(layer.style, {
      fontFamily: fontFamily(st.font), fontSize: fs + 'px', color: st.color || '#fff',
      fontWeight: st.bold === false ? '400' : '700', textAlign: st.align || 'center',
      justifyContent: JUSTIFY[st.align] || 'center',
      background: rgba(st.bg || '#000000', st.bgOpacity ?? 100),
    });
    const dir = st.direction || 'left';
    const vertical = dir === 'up' || dir === 'down';
    if (st.scroll) layer.classList.add(vertical ? 'bb-scroll-y' : 'bb-scroll-x');
    const inner = document.createElement('div');
    inner.className = 'bb-text-inner';
    inner.textContent = content;
    // Testo ruotato (per le fasce laterali): cw = si legge dall'alto in basso, ccw = dal basso in alto
    const base = st.rotate === 'ccw' ? 'rotate(180deg)' : '';
    if (st.rotate === 'cw' || st.rotate === 'ccw') { inner.classList.add('bb-rotated'); inner.style.transform = base; }
    layer.appendChild(inner);

    let anim = null;
    return {
      el: layer,
      start() {
        if (!st.scroll) return;
        const w = inner.scrollWidth, h = inner.scrollHeight, cw = layer.clientWidth, ch = layer.clientHeight;
        const tx = v => `translateX(${v}px) ${base}`, ty = v => `translateY(${v}px) ${base}`;
        const frames = {
          left: [tx(cw), tx(-w)], right: [tx(-w), tx(cw)],
          up: [ty(ch), ty(-h)], down: [ty(-h), ty(ch)],
        }[dir];
        const distance = vertical ? ch + h : cw + w;
        const duration = distance / (st.speed || 120) * 1000;
        anim = inner.animate([{ transform: frames[0] }, { transform: frames[1] }],
          { duration, iterations: Infinity, easing: 'linear' });
      },
      stop() { if (anim) anim.cancel(); anim = null; },
    };
  }

  // Costruisce l'elemento di un item. Chiamare start() DOPO averlo inserito nel DOM.
  function build(item, container, opts = {}) {
    const o = item.options || {};
    const el = document.createElement('div');
    el.className = 'bb-item';
    let media = null, mediaBox = null;
    if (item.type === 'image') {
      media = document.createElement('img');
      media.src = item.src; media.alt = ''; media.draggable = false;
    } else if (item.type === 'video') {
      media = document.createElement('video');
      media.src = item.src; media.muted = true; media.playsInline = true; media.preload = 'auto';
      media.loop = !!opts.loopVideo; media.autoplay = !!opts.loopVideo;
    } else if (item.type === 'url') {
      media = document.createElement('iframe');
      media.src = item.src;
      media.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
      media.setAttribute('allow', 'autoplay; fullscreen');
    }
    if (media) {
      media.className = 'bb-media';
      media.style.objectFit = o.fit || 'contain';
      mediaBox = document.createElement('div');
      mediaBox.className = 'bb-media-box';
      applyBox(mediaBox, item.type === 'url' ? FULL_BOX : { ...FULL_BOX, ...(o.box || {}) });
      mediaBox.appendChild(media);
      el.appendChild(mediaBox);
    }

    const layers = [];
    let textEl = null;
    if (item.type === 'text') { const t = buildText(item.text || '', { ...TEXT_DEFAULTS, ...o }, container); layers.push(t); textEl = t.el; }
    const list = Array.isArray(o.overlays) ? o.overlays : o.overlay ? [o.overlay] : [];
    // overlayEls mantiene gli indici allineati a "overlays" (null dove il widget non e' renderizzabile)
    const overlayEls = list.map(ov => { const r = ov ? buildOverlay(ov, container) : null; if (r) layers.push(r); return r ? r.el : null; });
    for (const l of layers) el.appendChild(l.el);

    return {
      el, media, mediaBox, textEl, overlayEls,
      start: () => layers.forEach(l => l.start()),
      stop: () => layers.forEach(l => l.stop()),
    };
  }

  return { FONTS, FULL_BOX, TEXT_DEFAULTS, OVERLAY_DEFAULTS, WIDGET_DEFAULTS, WIDGET_LABELS, loadFonts, build,
    setFeedFetcher(fn) { feedFetcher = fn; } };
})();
