// TextMeshPro (SDF) text layout over the exported TMP_FontAsset tables (re/extract/media/fonts.json).
// Glyph quads are expanded by the atlas padding exactly like TMP_Text.GenerateTextMesh.
import { loadJSON } from './assets.js';

let DATA = null;
const FALLBACK = ['NotoSansCJKkr-Medium SDF', 'NotoSansKR-Medium SDF', 'LiberationSans SDF'];

export async function initFonts(assets) {
  DATA = await loadJSON('media/fonts.json');
  for (const [name, f] of Object.entries(DATA.fonts)) {
    const ref = f.atlas?.[0];
    if (!ref) continue;
    const id = ref.ref.split(':')[1];
    f.file = `${ref.n}__${id}.png`;
    f.tex = await assets.texture(f.file).catch(() => null);
    f.name = name;
  }
}

export function fontMaterial(name) { return DATA?.materials?.[name] || null; }

function glyphOf(fontName, ch) {
  const code = ch.codePointAt(0);
  const order = [fontName, ...FALLBACK];
  for (const n of order) {
    const f = DATA?.fonts?.[n];
    if (!f || !f.tex) continue;
    const gi = f.chars[code];
    if (gi === undefined) continue;
    const g = f.glyphs[gi];
    if (g) return { f, g };
  }
  return null;
}

/**
 * Layout a string into SDF quads.
 * opts: {font, size (world/UI units = TMP fontSize), color [r,g,b,a], align: 'center'|'left'|'right',
 *        material (name), lineSpacing, maxWidth}
 * Returns {items, width, height} with items positioned relative to (0,0) = alignment anchor (vertical middle).
 */
/** TMP rich text: <size=N%|N>, <color=#hex|name>, <b>, <br>; returns [{ch, k (size mul), c (rgba|null)}] */
const NAMED = { white: [1, 1, 1, 1], black: [0, 0, 0, 1], red: [1, 0, 0, 1], green: [0, 1, 0, 1], blue: [0, 0, 1, 1], yellow: [1, 0.92, 0.016, 1], orange: [1, 0.5, 0, 1] };
function parseRich(str, size) {
  const out = [], sizes = [1], colors = [null];
  const re = /<(\/?)(size|color|b|i|u|br)(?:=([^>]*))?>/gi;
  let last = 0, m;
  const push = t => { for (const ch of t) out.push({ ch, k: sizes[sizes.length - 1], c: colors[colors.length - 1] }); };
  while ((m = re.exec(str))) {
    push(str.slice(last, m.index)); last = re.lastIndex;
    const close = m[1] === '/', tag = m[2].toLowerCase(), v = m[3];
    if (tag === 'br') { out.push({ ch: '\n', k: 1, c: null }); continue; }
    if (tag === 'size') {
      if (close) { if (sizes.length > 1) sizes.pop(); }
      else sizes.push(v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v) / size);
    } else if (tag === 'color') {
      if (close) { if (colors.length > 1) colors.pop(); }
      else {
        let c = NAMED[v.toLowerCase().replace(/[\x22']/g, '')] || null;
        const h = v.replace(/[\x22'#]/g, '');
        if (!c && /^[0-9a-f]{6,8}$/i.test(h)) c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).concat(h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1);
        colors.push(c);
      }
    }
  }
  push(str.slice(last));
  return out;
}

export function layoutText(str, opts) {
  const fontName = opts.font || 'NotoSansCJKkr-Medium SDF';
  const base = DATA?.fonts?.[fontName] || DATA?.fonts?.[FALLBACK[0]];
  if (!base) return { items: [], width: 0, height: 0 };
  const mat = fontMaterial(opts.material) || {};
  const size = opts.size || 1;
  const lines = [];
  let cur = [], w = 0;
  const lineH = base.faceInfo.m_LineHeight / base.faceInfo.m_PointSize * size * (1 + (opts.lineSpacing || 0) / 100);
  for (const { ch, k, c } of parseRich(String(str), size)) {
    if (ch === '\n') { lines.push({ g: cur, w }); cur = []; w = 0; continue; }
    const gg = glyphOf(fontName, ch);
    const sc = gg ? size * k / gg.f.faceInfo.m_PointSize * (gg.f.faceInfo.m_Scale || 1) : 0;
    const adv = gg ? gg.g.m[4] * sc : size * k * 0.3;
    if (opts.maxWidth && w + adv > opts.maxWidth && cur.length) { lines.push({ g: cur, w }); cur = []; w = 0; }
    cur.push({ gg, x: w, sc, ch, c });
    w += adv;
  }
  lines.push({ g: cur, w });
  const items = [];
  const totalH = lines.length * lineH;
  const asc = base.faceInfo.m_AscentLine / base.faceInfo.m_PointSize * size;
  const desc = base.faceInfo.m_DescentLine / base.faceInfo.m_PointSize * size;
  let maxW = 0;
  lines.forEach((ln, li) => {
    maxW = Math.max(maxW, ln.w);
    const ox = opts.align === 'left' ? 0 : opts.align === 'right' ? -ln.w : -ln.w / 2;
    // vertical middle of the text block at y=0
    const baseY = totalH / 2 - li * lineH - (asc - (asc - desc - lineH) / 2) + (lineH - (asc - desc)) / 2;
    for (const it of ln.g) {
      if (!it.gg) continue;
      const { f, g } = it.gg;
      const pad = f.padding || 0;
      const [rx, ry, rw, rh] = g.rect;
      if (rw === 0 || rh === 0) continue;
      const sc = it.sc;
      const W = f.w, H = f.h;
      const x0 = ox + it.x + (g.m[2] - pad) * sc;
      const y1 = baseY + (g.m[3] + pad) * sc;
      const qw = (rw + pad * 2) * sc, qh = (rh + pad * 2) * sc;
      items.push({
        tex: f.tex,
        u0: (rx - pad) / W, u1: (rx + rw + pad) / W,
        v0: (H - (ry + rh + pad)) / H, v1: (H - (ry - pad)) / H,
        w: qw, h: qh, px: 0, py: 0, lx: x0, ly: y1 - qh,
        gs: mat._GradientScale || (pad + 1), texW: W, c: it.c,
      });
    }
  });
  return { items, width: maxW, height: totalH, material: mat };
}

/**
 * Queue text into the renderer at (x,y). style: {color, alpha, scale, outline:'black'|'white'|null, underlay:bool, order, layer}
 */
export function drawText(renderer, layout, x, y, style = {}) {
  const m = layout.material || {};
  const s = style.scale ?? 1;
  const col = style.color || [1, 1, 1, 1];
  const a = (style.alpha ?? 1) * (col[3] ?? 1);
  const ra = m._ScaleRatioA ?? 1, rc = m._ScaleRatioC ?? 1;
  const weight = ((m._WeightNormal || 0) / 4 + (m._FaceDilate || 0)) * ra * 0.5;
  const outline = (m._OutlineWidth || 0) * ra * 0.5;
  const outlineMode = style.outline === 'white' || (m._OutlineColor && m._OutlineColor.r > 0.5) ? 5 : 4;
  const common = { layer: style.layer ?? 10, order: style.order ?? 0, sortY: -1e9, rot: 0 };
  if (m._UnderlayColor && (m._UnderlayDilate || m._UnderlayOffsetY)) {
    const uw = weight + (m._UnderlayDilate || 0) * rc * 0.5;
    for (const q of layout.items) {
      const wpt = q.w / Math.max(1e-6, (q.u1 - q.u0) * q.texW);      // world units per atlas texel
      const offX = (m._UnderlayOffsetX || 0) * q.gs * wpt, offY = (m._UnderlayOffsetY || 0) * q.gs * wpt;
      renderer.draw({ ...q, ...common, x: x + (q.lx + offX) * s, y: y + (q.ly + offY) * s, sx: s, sy: s,
        r: 0, g: 0, b: 0, a: a * (m._UnderlayColor.a ?? 1), mode: 6, hit: [0, uw, q.gs, q.texW] });
    }
  }
  const clip = style.clip;
  for (const q of layout.items) {
    if (clip) { const cx = x + (q.lx + q.w / 2) * s, cy = y + (q.ly + q.h / 2) * s; if (cx < clip.x0 || cx > clip.x1 || cy < clip.y0 || cy > clip.y1) continue; }
    renderer.draw({ ...q, ...common, x: x + q.lx * s, y: y + q.ly * s, sx: s, sy: s,
      r: q.c ? q.c[0] : col[0], g: q.c ? q.c[1] : col[1], b: q.c ? q.c[2] : col[2], a: q.c ? a * q.c[3] : a, mode: outlineMode, hit: [outline, weight, q.gs, q.texW] });
  }
}
