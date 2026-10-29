// uGUI renderer for exported UI prefabs: RectTransform layout, Image (Simple/Sliced/Filled, preserveAspect),
// TextMeshProUGUI (SDF), CanvasGroup alpha, Button hit-testing. Canvas units = CanvasScaler reference pixels.
import { drawImage } from './uidraw.js';
import { layoutText, drawText } from './text.js';

export const REF = { w: 1080, h: 2160 };

/** CanvasScaler ScaleWithScreenSize + Expand: returns canvas size in reference units for a screen size. */
export function canvasSize(sw, sh) {
  const s = Math.min(sw / REF.w, sh / REF.h);
  return { w: sw / s, h: sh / s, scale: s };
}

/** Animator bindings on uGUI nodes (CanvasGroup alpha, Graphic color, Image fillAmount, RectTransform anchoredPosition/sizeDelta) */
export function bindUIAnim(root) {
  for (const go of root.walk()) {
    go.onAnimProp = (typeID, name, v) => {
      const r = go.transform.rect;
      if (name === 'alpha') go.uiAlpha = v;
      else if (name === 'fa') go.uiFill = v;
      else if (name === 'apx' && r) r.aPos[0] = v;
      else if (name === 'apy' && r) r.aPos[1] = v;
      else if (name === 'sdx' && r) r.size[0] = v;
      else if (name === 'sdy' && r) r.size[1] = v;
      else if ('rgba'.includes(name) && name.length === 1) {
        const img = scriptOf(go, 'Image') || scriptOf(go, 'TextMeshProUGUI');
        const c0 = img?.f.m_Color || img?.f.m_fontColor || { r: 1, g: 1, b: 1, a: 1 };
        const c = go.uiColor || [c0.r ?? 1, c0.g ?? 1, c0.b ?? 1, c0.a ?? 1];
        c['rgba'.indexOf(name)] = v; go.uiColor = c;
      }
    };
  }
}

// TextMeshProUGUILinkable derives from TextMeshProUGUI (same serialized fields)
const SUBCLASS = { TextMeshProUGUI: ['TextMeshProUGUILinkable'], Image: ['BetterImage'] };
function scriptOf(go, name) {
  const names = [name, ...(SUBCLASS[name] || [])];
  return (go.scripts || []).find(s => names.some(n => s.script === n || s.script.endsWith('.' + n)));
}

const ALIGN = { Upper: 1, Middle: 0.5, Lower: 0, Left: 0, Center: 0.5, Right: 1 };
function alignOf(s) { const m = /^(Upper|Middle|Lower)(Left|Center|Right)$/.exec(s || 'UpperLeft'); return [ALIGN[m[2]], ALIGN[m[1]]]; }
function layoutGroupOf(go) {
  for (const s of go.scripts || []) {
    const n = s.script || '';
    if (s.f?.m_Enabled === 0 || s.enabled === 0 || s.enabled === false) continue;
    if (n.endsWith('HorizontalLayoutGroup')) return { kind: 'H', f: s.f };
    if (n.endsWith('VerticalLayoutGroup')) return { kind: 'V', f: s.f };
    if (n.endsWith('GridLayoutGroup')) return { kind: 'G', f: s.f };
  }
  return null;
}
function sizeFitterOf(go) { return (go.scripts || []).find(s => /ContentSizeFitter$/.test(s.script || '')); }
function fitterSource(go) {
  const n = sizeFitterOf(go)?.f?.source?.node;
  if (n == null) return null;
  let root = go; while (root && !root.nodeById) root = root.transform.parent?.go;
  const src = root?.nodeById.get(n);
  return src && src !== go ? src : null;
}
/** size a parent layout sees for a child it does not control: the child's own ContentSizeFitter result */
function fittedSize(k, ax) {
  const csf = sizeFitterOf(k), r = k.transform.rect;
  const fit = csf?.f && (ax ? csf.f.m_VerticalFit : csf.f.m_HorizontalFit);
  if (fit === 'PreferredSize') return prefSize(k, ax);
  return r ? Math.abs(r.size[ax]) : 0;
}
/**
 * ILayoutElement preferred size of a leaf: LayoutElement.preferred (if set), else Image.preferredWidth/Height
 * (Simple/Filled: sprite rect / (ppu/100); Sliced/Tiled: borders / multiplier), else the rect size.
 */
function leafPref(go, axis, base) {
  let img = null, le = null;
  for (const s of go.scripts || []) {
    if (s.enabled === 0 || s.enabled === false) continue;
    const n = s.script || '';
    if (n.endsWith('LayoutElement') && !s.f?.m_IgnoreLayout) le = s.f;
    else if (n === 'UnityEngine.UI.Image') img = s.f;
  }
  const lp = le && (axis ? le.m_PreferredHeight : le.m_PreferredWidth);
  if (lp >= 0 && lp != null) return lp;
  // TMP_Text.preferredWidth/Height: the unwrapped text block plus margins
  const tmp = scriptOf(go, 'TextMeshProUGUI');
  if (tmp && tmp.enabled !== false) {
    const f = tmp.f, str = go.uiText !== undefined ? go.uiText : (f.m_text || '');
    const font = f.m_fontAsset?.n || 'NotoSansCJKkr-Medium SDF';
    const lay = layoutText(str, { font, size: f.m_enableAutoSizing ? f.m_fontSizeMax : f.m_fontSize, material: f.m_sharedMaterial?.n || (font + ' Material') });
    const mg = f.m_margin || { x: 0, y: 0, z: 0, w: 0 };
    return axis ? lay.height + mg.y + mg.w : lay.width + mg.x + mg.z;
  }
  const spName = go.uiSprite ?? img?.m_Sprite?.sprite;
  const m = img && spName && G_assets?.sprites[spName];
  if (m) {
    const k = 100 / (m.ppu || 100);
    if (img.m_Type === 'Sliced' || img.m_Type === 'Tiled') {
      const b = m.border || [0, 0, 0, 0];
      return (axis ? b[1] + b[3] : b[0] + b[2]) * k / (img.m_PixelsPerUnitMultiplier || 1);
    }
    return (m.size ? m.size[axis] : m.rect[axis ? 3 : 2]) * k;   // Sprite.rect = the untrimmed size
  }
  return base;
}
let G_assets = null;
/** sprite metadata for Image preferred sizes (set once by the UI layer) */
export function setLayoutAssets(a) { G_assets = a; }
/** LayoutUtility preferred size along axis (0 x, 1 y): layout groups sum/max their active children, else the leaf size */
function prefSize(go, axis) {
  // BetterContentSizeFitter.source: the preferred size comes from another RectTransform
  const src = fitterSource(go);
  if (src) return prefSize(src, axis);
  const r = go.transform.rect;
  const base = r ? Math.abs(r.size[axis]) : 0;
  const g = layoutGroupOf(go);
  if (!g) return leafPref(go, axis, base);
  const f = g.f, pad = f.m_Padding || { left: 0, right: 0, top: 0, bottom: 0 };
  const kids = go.transform.children.map(c => c.go).filter(k => k.activeSelf);
  const padA = axis ? pad.top + pad.bottom : pad.left + pad.right;
  if (g.kind === 'G') {
    const n = kids.length, cs = axis ? f.m_CellSize.y : f.m_CellSize.x, sp = axis ? f.m_Spacing.y : f.m_Spacing.x;
    let cols, rows;
    if (f.m_Constraint === 'FixedColumnCount') { cols = f.m_ConstraintCount; rows = Math.ceil(n / cols); }
    else if (f.m_Constraint === 'FixedRowCount') { rows = f.m_ConstraintCount; cols = Math.ceil(n / rows); }
    else return base;
    const k = axis ? rows : cols;
    return padA + k * cs + Math.max(k - 1, 0) * sp;
  }
  const main = (g.kind === 'V') === (axis === 1);
  // HorizontalOrVerticalLayoutGroup.CalcAlongAxis: a child the group does not control counts with its own size
  const ctrl = axis ? f.m_ChildControlHeight : f.m_ChildControlWidth;
  const sizes = kids.map(k => (ctrl ? prefSize(k, axis) : fittedSize(k, axis)));
  if (main) return padA + sizes.reduce((a, b) => a + b, 0) + (f.m_Spacing || 0) * Math.max(kids.length - 1, 0);
  return padA + Math.max(0, ...sizes);
}
function aspectFitterOf(go) { return (go.scripts || []).find(s => /AspectRatioFitter$/.test(s.script || '')); }

/** HorizontalOrVerticalLayoutGroup / GridLayoutGroup: child rects in parent space (bottom-left origin). */
function layoutGroupRects(g, kids, x0, y0, w, h) {
  const f = g.f, pad = f.m_Padding || { left: 0, right: 0, top: 0, bottom: 0 };
  const [ax, ay] = alignOf(f.m_ChildAlignment);
  const ix0 = x0 + pad.left, iy0 = y0 + pad.bottom, iw = w - pad.left - pad.right, ih = h - pad.top - pad.bottom;
  const res = [];
  if (g.kind === 'G') {
    const cs = f.m_CellSize, sp = f.m_Spacing, n = kids.length;
    let cols, rows;
    if (f.m_Constraint === 'FixedColumnCount') { cols = f.m_ConstraintCount; rows = Math.ceil(n / cols); }
    else if (f.m_Constraint === 'FixedRowCount') { rows = f.m_ConstraintCount; cols = Math.ceil(n / rows); }
    else { cols = Math.max(1, Math.floor((iw + sp.x + 1e-3) / (cs.x + sp.x))); rows = Math.ceil(n / cols); }
    const usedW = Math.min(cols, n) * cs.x + (Math.min(cols, n) - 1) * sp.x, usedH = rows * cs.y + (rows - 1) * sp.y;
    const sx = ix0 + (iw - usedW) * ax, syTop = iy0 + ih - (ih - usedH) * (1 - ay);
    const right = /Right/.test(f.m_StartCorner), lower = /Lower/.test(f.m_StartCorner);
    kids.forEach((k, i) => {
      let c, r;
      if (f.m_StartAxis === 'Vertical') { r = i % rows; c = Math.floor(i / rows); } else { c = i % cols; r = Math.floor(i / cols); }
      if (right) c = Math.min(cols, n) - 1 - c;
      if (lower) r = rows - 1 - r;
      res.push({ x0: sx + c * (cs.x + sp.x), y0: syTop - (r + 1) * cs.y - r * sp.y, w: cs.x, h: cs.y });
    });
    return res;
  }
  const H = g.kind === 'H', sp = f.m_Spacing || 0;
  const ctrlMain = H ? f.m_ChildControlWidth : f.m_ChildControlHeight, ctrlCross = H ? f.m_ChildControlHeight : f.m_ChildControlWidth;
  const expMain = H ? f.m_ChildForceExpandWidth : f.m_ChildForceExpandHeight, expCross = H ? f.m_ChildForceExpandHeight : f.m_ChildForceExpandWidth;
  const mainLen = H ? iw : ih, crossLen = H ? ih : iw;
  const own = fittedSize;
  const pref = kids.map(k => (ctrlMain ? prefSize(k, H ? 0 : 1) : own(k, H ? 0 : 1)));
  const crossPref = kids.map(k => (ctrlCross ? prefSize(k, H ? 1 : 0) : own(k, H ? 1 : 0)));
  let sizes = pref.map(p => (ctrlMain ? Math.max(p, 0) : p));
  const total = sizes.reduce((a, b) => a + b, 0) + sp * Math.max(kids.length - 1, 0);
  if (ctrlMain && expMain && kids.length) { const extra = (mainLen - total) / kids.length; if (extra > 0) sizes = sizes.map(s => s + extra); }
  else if (!ctrlMain && expMain && kids.length) { /* force expand without control: spread the slots */ }
  const used = sizes.reduce((a, b) => a + b, 0) + sp * Math.max(kids.length - 1, 0);
  let slot = expMain && !ctrlMain && kids.length ? (mainLen - (used - sp * (kids.length - 1))) / kids.length : 0;
  if (slot < 0) slot = 0;
  const order = f.m_ReverseArrangement ? [...kids.keys()].reverse() : [...kids.keys()];
  let cur = H ? ix0 + Math.max(0, mainLen - used - slot * kids.length) * ax : iy0 + ih - Math.max(0, mainLen - used - slot * kids.length) * (1 - ay);
  const out = new Array(kids.length);
  for (const i of order) {
    const m = sizes[i] + slot;
    const cs = ctrlCross ? (expCross ? crossLen : Math.min(crossPref[i] || crossLen, crossLen)) : crossPref[i];
    if (H) {
      const cy = iy0 + (crossLen - cs) * ay;
      out[i] = { x0: cur + (m - sizes[i]) * 0.5, y0: cy, w: sizes[i], h: cs };
      cur += m + sp;
    } else {
      const cx = ix0 + (crossLen - cs) * ax;
      out[i] = { x0: cx, y0: cur - m + (m - sizes[i]) * 0.5, w: cs, h: sizes[i] };
      cur -= m + sp;
    }
  }
  return out;
}

/** Compute world rects for the RectTransform tree. Returns map go -> {x0,y0,w,h,sx,sy}. */
export function layoutTree(root, x0, y0, w, h) {
  const out = new Map();
  const visit = (go, px0, py0, pw, ph, forced = null) => {
    const r = go.transform.rect;
    let rx0 = px0, ry0 = py0, rw = pw, rh = ph;
    if (forced) {
      ({ x0: rx0, y0: ry0, w: rw, h: rh } = forced);
    } else if (r) {
      const ax0 = px0 + r.aMin[0] * pw, ax1 = px0 + r.aMax[0] * pw;
      const ay0 = py0 + r.aMin[1] * ph, ay1 = py0 + r.aMax[1] * ph;
      rw = ax1 - ax0 + r.size[0]; rh = ay1 - ay0 + r.size[1];
      const pivX = ax0 + (ax1 - ax0) * r.pivot[0] + r.aPos[0] + (go.transform.lp[0] || 0) * 0;
      const pivY = ay0 + (ay1 - ay0) * r.pivot[1] + r.aPos[1];
      rx0 = pivX - rw * r.pivot[0]; ry0 = pivY - rh * r.pivot[1];
      const ls = go.transform.ls;
      if (ls[0] !== 1 || ls[1] !== 1) {
        rx0 = pivX - (pivX - rx0) * ls[0]; ry0 = pivY - (pivY - ry0) * ls[1];
        rw *= ls[0]; rh *= ls[1];
      }
    }
    // ContentSizeFitter (PreferredSize): resize around the pivot
    const csf = sizeFitterOf(go);
    if (csf && r) {
      const fit = csf.f || {};
      if (fit.m_VerticalFit === 'PreferredSize') { const nh = prefSize(go, 1); const py = ry0 + rh * r.pivot[1]; rh = nh; ry0 = py - nh * r.pivot[1]; }
      if (fit.m_HorizontalFit === 'PreferredSize') { const nw = prefSize(go, 0); const px = rx0 + rw * r.pivot[0]; rw = nw; rx0 = px - nw * r.pivot[0]; }
    }
    const af = aspectFitterOf(go);
    if (af && r) {
      const mode = af.f.m_AspectMode, ar = af.f.m_AspectRatio || 1;
      const cx = rx0 + rw * r.pivot[0], cy = ry0 + rh * r.pivot[1];
      if (mode === 'HeightControlsWidth') rw = rh * ar;
      else if (mode === 'WidthControlsHeight') rh = rw / ar;
      else if (mode === 'FitInParent') { if (pw / ph > ar) { rh = ph; rw = ph * ar; } else { rw = pw; rh = pw / ar; } }
      rx0 = cx - rw * r.pivot[0]; ry0 = cy - rh * r.pivot[1];
    }
    // ScrollRect: its m_Content is offset by the owner's scroll position (vertical: content moves up)
    if (go.__scrollOwner) { ry0 += go.__scrollOwner.scrollY || 0; rx0 -= go.__scrollOwner.scrollX || 0; }
    const sr = scriptOf(go, 'ScrollRect');
    if (sr && sr.f?.m_Content?.node != null) {
      let root = go; while (root && !root.nodeById) root = root.transform.parent?.go;
      const content = root?.nodeById.get(sr.f.m_Content.node);
      if (content) { content.__scrollOwner = go; go.__scrollContent = content; go.__scrollV = sr.f.m_Vertical !== false && sr.f.m_Vertical !== 0; go.__scrollH = !!sr.f.m_Horizontal && !go.__scrollV; }
    }
    out.set(go, { x0: rx0, y0: ry0, w: rw, h: rh });
    const g = layoutGroupOf(go);
    if (g) {
      const kids = go.transform.children.map(c => c.go).filter(k => k.activeSelf && !(k.scripts || []).some(s => /LayoutElement$/.test(s.script || '') && s.f.m_IgnoreLayout));
      const rects = layoutGroupRects(g, kids, rx0, ry0, rw, rh);
      const forcedOf = new Map(kids.map((k, i) => [k, rects[i]]));
      for (const ch of go.transform.children) visit(ch.go, rx0, ry0, rw, rh, forcedOf.get(ch.go) || null);
      return;
    }
    for (const ch of go.transform.children) visit(ch.go, rx0, ry0, rw, rh);
  };
  visit(root, x0, y0, w, h);
  return out;
}

/** Draw a UI tree. state: {texts: {nodeName: string}, sprites: {nodeName: spriteName}, alpha} */
export function drawUI(renderer, assets, root, rects, opts = {}) {
  let order = opts.order ?? 0;
  const layer = opts.layer ?? 30;
  const visit = (go, alpha, clip) => {
    if (!go.activeSelf) return;
    const cg = scriptOf(go, 'CanvasGroup');
    let a = alpha;
    if (cg) a *= cg.f.m_Alpha ?? 1;
    const cgb = go.builtins?.find(b => b.type === 'CanvasGroup');
    if (cgb && go.uiAlpha === undefined) a *= cgb.f?.m_Alpha ?? cgb.m_Alpha ?? 1;
    if (go.uiAlpha !== undefined) a *= go.uiAlpha;
    const R = rects.get(go);
    const img = scriptOf(go, 'Image');
    const maskHidden = (go.scripts || []).some(s => /\.Mask$/.test(s.script || '') && s.f?.m_ShowMaskGraphic === false);
    if (img && img.enabled !== false && img.enabled !== 0 && R && !maskHidden) {
      const f = img.f;
      const spName = go.uiSprite !== undefined ? go.uiSprite : f.m_Sprite?.sprite;
      const c = go.uiColor || [f.m_Color?.r ?? 1, f.m_Color?.g ?? 1, f.m_Color?.b ?? 1, f.m_Color?.a ?? 1];
      if (spName) {
        let { x0, y0, w, h } = R;
        if (w < 0) { x0 += w; w = -w; }
        if (h < 0) { y0 += h; h = -h; }
        // Image.GetDrawingDimensions: Simple / Filled images keep the sprite's transparent padding (packed sprites are
        // trimmed: the visible rect sits at `offset` inside the full `size`), preserveAspect uses the full size
        const m = assets.sprites[spName];
        if (m && f.m_Type !== 'Sliced' && f.m_Type !== 'Tiled') {
          const full = m.size || [m.rect[2], m.rect[3]];
          if (f.m_PreserveAspect) {
            const ar = full[0] / full[1];
            if (w / h > ar) { const nw = h * ar; x0 += (w - nw) * 0.5; w = nw; } else { const nh = w / ar; y0 += (h - nh) * 0.5; h = nh; }
          }
          const off = m.offset || [0, 0];
          if (full[0] > m.rect[2] + 0.5 || full[1] > m.rect[3] + 0.5) {
            const l = (R.w < 0 ? full[0] - off[0] - m.rect[2] : off[0]) / full[0], b = off[1] / full[1];   // mirrored rect: padding swaps sides
            x0 += w * l; y0 += h * b; w *= m.rect[2] / full[0]; h *= m.rect[3] / full[1];
          }
        }
        const mul = f.m_PixelsPerUnitMultiplier || 1;
        const fillX = f.m_Type === 'Filled' && f.m_FillMethod === 'Horizontal' ? (go.uiFill ?? f.m_FillAmount ?? 1) : 1;
        // BetterImage.colorMode VerticalGradient: m_Color at the top, secondColor at the bottom
        const sc = f.colorMode === 'VerticalGradient' && f.secondColor;
        const gradient = sc ? [[c[0], c[1], c[2], c[3] * a], [sc.r, sc.g, sc.b, (sc.a ?? 1) * a]] : null;
        drawImage(renderer, assets, spName, x0, y0, w, h, { type: f.m_Type, unit: 1 / mul, color: [c[0], c[1], c[2], c[3] * a], layer, order: order++, fillX, flipX: R.w < 0, clip, gradient });
      } else if (c[3] * a > 0) {
        renderer.draw({ x: R.x0, y: R.y0, w: R.w, h: R.h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, r: c[0], g: c[1], b: c[2], a: c[3] * a, layer, order: order++, sortY: -1e9 });
      }
    }
    const tmp = scriptOf(go, 'TextMeshProUGUI');
    if (tmp && R) {
      const f = tmp.f;
      const str = go.uiText !== undefined ? go.uiText : (f.m_text || '');
      if (str) {
        const fc = go.uiTextColor || [f.m_fontColor?.r ?? 1, f.m_fontColor?.g ?? 1, f.m_fontColor?.b ?? 1, f.m_fontColor?.a ?? 1];
        const font = f.m_fontAsset?.n || 'NotoSansCJKkr-Medium SDF';
        const mat = f.m_sharedMaterial?.n || (font + ' Material');
        const mg = f.m_margin || { x: 0, y: 0, z: 0, w: 0 };
        const bw = Math.abs(R.w) - mg.x - mg.z, bh = Math.abs(R.h) - mg.y - mg.w;
        let size = f.m_fontSize;
        let lay = layoutText(str, { font, size, material: mat, align: alignH(f), maxWidth: f.m_enableWordWrapping ? bw : 0 });
        if (f.m_enableAutoSizing) {
          size = f.m_fontSizeMax;
          for (let i = 0; i < 20; i++) {
            lay = layoutText(str, { font, size, material: mat, align: alignH(f), maxWidth: f.m_enableWordWrapping ? bw : 0 });
            if ((lay.width <= bw + 0.5 && lay.height <= bh + 0.5) || size <= f.m_fontSizeMin) break;
            size = Math.max(f.m_fontSizeMin, size - Math.max(1, size * 0.06));
          }
        }
        const cx = alignH(f) === 'left' ? R.x0 + mg.x : alignH(f) === 'right' ? R.x0 + R.w - mg.z : R.x0 + mg.x + bw / 2;
        let cy = R.y0 + mg.w + bh / 2;
        const v = f.m_VerticalAlignment;
        if (v === 'Top') cy = R.y0 + R.h - mg.y - lay.height / 2;
        else if (v === 'Bottom') cy = R.y0 + mg.w + lay.height / 2;
        drawText(renderer, lay, cx, cy, { color: [fc[0], fc[1], fc[2], fc[3] * a], layer, order: order++, clip });
      }
    }
    // UIParticle (Coffee.UIExtensions): child ParticleSystems drawn in canvas space at m_Scale3D pixels per unit;
    // a zero transform scale hides them (the open animations scale it up)
    const uip = scriptOf(go, 'UIParticle');
    if (uip && R && uip.enabled !== false && go.transform.ls[0] !== 0) {
      const S = uip.f.m_Scale3D?.x ?? 1;
      const cx = R.x0 + R.w / 2, cy = R.y0 + R.h / 2;
      for (const g of go.walk()) {
        // the ParticleSystemRenderer is disabled under UIParticle (it bakes the mesh itself)
        if (!g.ps || !g.activeInHierarchy) continue;
        g.ps.world = false;   // canvas space has no world simulation frame: keep particles local to the emitter
        const lp = g === go ? [0, 0] : g.transform.lp;
        g.ps.draw(renderer, [cx + lp[0] * S, cy + lp[1] * S], [S, S], layer, order++, -1e9, g.ps.tex);
      }
    }
    // custom content drawn in the node's rect before its children (e.g. a RawImage fed by a preview camera)
    if (go.drawHook && R) order = go.drawHook(renderer, R, { layer, order, alpha: a }) ?? order;
    // Mask / RectMask2D: children are clipped to this rect
    let cc = clip;
    if (R && (go.scripts || []).some(s => /(\.Mask|RectMask2D)$/.test(s.script || ''))) {
      const m = { x0: Math.min(R.x0, R.x0 + R.w), x1: Math.max(R.x0, R.x0 + R.w), y0: Math.min(R.y0, R.y0 + R.h), y1: Math.max(R.y0, R.y0 + R.h) };
      cc = clip ? { x0: Math.max(m.x0, clip.x0), x1: Math.min(m.x1, clip.x1), y0: Math.max(m.y0, clip.y0), y1: Math.min(m.y1, clip.y1) } : m;
    }
    for (const ch of go.transform.children) visit(ch.go, a, cc);
  };
  visit(root, opts.alpha ?? 1, null);
  return order;
}

function alignH(f) {
  const h = f.m_HorizontalAlignment;
  return h === 'Left' ? 'left' : h === 'Right' ? 'right' : 'center';
}

/** deepest active ScrollRect under the point, or null */
export function scrollAt(root, rects, x, y) {
  let hit = null;
  const visit = go => {
    if (!go.activeSelf) return;
    const R = rects.get(go);
    if (R && go.__scrollContent) {
      const x0 = Math.min(R.x0, R.x0 + R.w), x1 = Math.max(R.x0, R.x0 + R.w), y0 = Math.min(R.y0, R.y0 + R.h), y1 = Math.max(R.y0, R.y0 + R.h);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) hit = go;
    }
    for (const ch of go.transform.children) visit(ch.go);
  };
  visit(root);
  return hit;
}
/** move a ScrollRect by (dx, dy) canvas units, clamped to the content overflow (ScrollRect.MovementType Clamped) */
export function scrollBy(sr, rects, dx, dy) {
  const view = rects.get(sr), content = rects.get(sr.__scrollContent);
  if (!view || !content) return;
  if (sr.__scrollV) {
    const max = Math.max(0, Math.abs(content.h) - Math.abs(view.h));
    sr.scrollY = Math.max(0, Math.min(max, (sr.scrollY || 0) + dy));
  } else if (sr.__scrollH) {
    const max = Math.max(0, Math.abs(content.w) - Math.abs(view.w));
    sr.scrollX = Math.max(0, Math.min(max, (sr.scrollX || 0) - dx));
  }
}

/** Find the deepest active node with a Button under point (canvas units). */
export function hitTest(root, rects, x, y) {
  let hit = null;
  const visit = go => {
    if (!go.activeSelf) return;
    const R = rects.get(go);
    if (R && (scriptOf(go, 'Button') || scriptOf(go, 'UIButtonBase') || scriptOf(go, 'Toggle'))) {
      const x0 = Math.min(R.x0, R.x0 + R.w), x1 = Math.max(R.x0, R.x0 + R.w);
      const y0 = Math.min(R.y0, R.y0 + R.h), y1 = Math.max(R.y0, R.y0 + R.h);
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1) hit = go;
    }
    for (const ch of go.transform.children) visit(ch.go);
  };
  visit(root);
  return hit;
}
