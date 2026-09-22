'use strict';
// Validazione delle opzioni grafiche degli elementi di playlist.
// Deve restare coerente con public/shared/render.js

const FONTS = ['system-ui', 'Inter', 'Roboto', 'Montserrat', 'Oswald', 'Bebas Neue',
  'Playfair Display', 'Lobster', 'Pacifico', 'Courier Prime'];
const ALIGN = ['left', 'center', 'right'];
const DIRECTION = ['left', 'right', 'up', 'down'];
const ROTATE = ['none', 'cw', 'ccw'];
const FIT = ['contain', 'cover'];
const KINDS = ['text', 'lowerthird', 'ticker', 'clock', 'logo'];
const CLOCK_FORMATS = ['time', 'seconds', 'date', 'datetime'];

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v !== null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const color = (v, d) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : d);

// Riquadro in percentuale dello schermo: x,y = angolo in alto a sinistra, w,h = dimensioni
function cleanBox(b, d) {
  b = b && typeof b === 'object' ? b : {};
  const w = clamp(num(b.w, d.w), 2, 100);
  const h = clamp(num(b.h, d.h), 2, 100);
  return {
    x: Math.round(clamp(num(b.x, d.x), 0, 100 - w) * 10) / 10,
    y: Math.round(clamp(num(b.y, d.y), 0, 100 - h) * 10) / 10,
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10,
  };
}

function cleanStyle(s, defaults) {
  s = s && typeof s === 'object' ? s : {};
  return {
    ...cleanBox(s, defaults.box),
    font: oneOf(s.font, FONTS, 'system-ui'),
    size: clamp(num(s.size, defaults.size), 1, 25),
    color: color(s.color, '#ffffff'),
    bg: color(s.bg, defaults.bg),
    bgOpacity: clamp(Math.round(num(s.bgOpacity, defaults.bgOpacity)), 0, 100),
    align: oneOf(s.align, ALIGN, 'center'),
    scroll: !!s.scroll,
    direction: oneOf(s.direction, DIRECTION, 'left'),
    rotate: oneOf(s.rotate, ROTATE, 'none'),
    speed: clamp(Math.round(num(s.speed, 120)), 20, 600),
    bold: s.bold !== false,
  };
}

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const mediaSrc = v => (/^\/media\/[a-z0-9._-]+$/i.test(String(v || '')) ? String(v) : null);

// Widget sovrapponibili: testo libero, terzo inferiore, barra notizie, orologio, logo
function cleanOverlay(ov) {
  if (!ov || typeof ov !== 'object') return null;
  const kind = oneOf(ov.kind, KINDS, 'text');
  if (kind === 'text') {
    const text = str(ov.text, 500);
    if (!text) return null;
    return { kind, text, ...cleanStyle(ov, { size: 3.5, bg: '#000000', bgOpacity: 60, box: { x: 0, y: 82, w: 100, h: 18 } }) };
  }
  if (kind === 'lowerthird') {
    return {
      kind, ...cleanBox(ov, { x: 4, y: 72, w: 62, h: 15 }),
      label: str(ov.label, 40), title: str(ov.title, 120), subtitle: str(ov.subtitle, 160),
      font: oneOf(ov.font, FONTS, 'Inter'), color: color(ov.color, '#ffffff'),
      labelBg: color(ov.labelBg, '#d61f26'), labelColor: color(ov.labelColor, '#ffffff'),
      bg: color(ov.bg, '#12307a'), bg2: color(ov.bg2, '#071240'), bgOpacity: clamp(Math.round(num(ov.bgOpacity, 94)), 0, 100),
      bgImage: mediaSrc(ov.bgImage),
    };
  }
  if (kind === 'ticker') {
    return {
      kind, ...cleanBox(ov, { x: 0, y: 91, w: 100, h: 7 }),
      label: str(ov.label, 40), tag: str(ov.tag, 40), text: str(ov.text, 4000),
      font: oneOf(ov.font, FONTS, 'Inter'), color: color(ov.color, '#ffffff'),
      labelBg: color(ov.labelBg, '#d61f26'), labelColor: color(ov.labelColor, '#ffffff'),
      tagBg: color(ov.tagBg, '#1d4ed8'), bg: color(ov.bg, '#0a1a3f'), bgOpacity: clamp(Math.round(num(ov.bgOpacity, 96)), 0, 100),
      speed: clamp(Math.round(num(ov.speed, 120)), 20, 600), showClock: ov.showClock !== false,
      bgImage: mediaSrc(ov.bgImage),
      feedUrl: /^https?:\/\/\S+$/i.test(str(ov.feedUrl, 500)) ? str(ov.feedUrl, 500) : '',
      feedMax: clamp(Math.round(num(ov.feedMax, 10)), 1, 50),
    };
  }
  if (kind === 'clock') {
    return {
      kind, ...cleanBox(ov, { x: 85, y: 3, w: 12, h: 8 }),
      format: oneOf(ov.format, CLOCK_FORMATS, 'time'), font: oneOf(ov.font, FONTS, 'Inter'),
      size: clamp(num(ov.size, 3), 1, 25), color: color(ov.color, '#ffffff'),
      bg: color(ov.bg, '#000000'), bgOpacity: clamp(Math.round(num(ov.bgOpacity, 45)), 0, 100),
      align: oneOf(ov.align, ALIGN, 'center'), bold: ov.bold !== false,
    };
  }
  if (kind === 'logo') {
    const src = mediaSrc(ov.src);
    if (!src) return null;
    return { kind, ...cleanBox(ov, { x: 85, y: 3, w: 12, h: 10 }), src, opacity: clamp(Math.round(num(ov.opacity, 100)), 5, 100) };
  }
  return null;
}
function cleanOverlays(o) {
  // accetta anche il vecchio formato con un solo "overlay"
  const list = Array.isArray(o.overlays) ? o.overlays : o.overlay ? [o.overlay] : [];
  return list.map(cleanOverlay).filter(Boolean).slice(0, 12);
}

function cleanOptions(type, o) {
  o = o && typeof o === 'object' ? o : {};
  const overlays = cleanOverlays(o);
  if (type === 'text') return { ...cleanStyle(o, { size: 6, bg: '#111827', bgOpacity: 100, box: { x: 0, y: 0, w: 100, h: 100 } }), overlays };
  if (type === 'image' || type === 'video') {
    return { fit: oneOf(o.fit, FIT, 'contain'), box: cleanBox(o.box, { x: 0, y: 0, w: 100, h: 100 }), overlays };
  }
  return { overlays };
}

function parseOptions(row) {
  let o = {};
  try { o = row.options ? JSON.parse(row.options) : {}; } catch { o = {}; }
  return cleanOptions(row.type, o);
}

module.exports = { FONTS, cleanOptions, parseOptions };
