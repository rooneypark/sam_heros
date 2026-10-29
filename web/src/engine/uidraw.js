// UnityEngine.UI.Image draw helpers (Simple / Sliced / Filled) for both world-space and screen-space canvases.
// Units: the caller passes the canvas unit per sprite pixel (world canvas: 1/100, overlay canvas: 1 px of 1440x2560 ref).

export function spriteBorder(assets, name) { return assets.sprites[name]?.border || [0, 0, 0, 0]; }

/** Draw sprite `name` into rect (x0,y0)-(x0+w,y0+h). opts: {color:[r,g,b,a], type:'Simple'|'Sliced', unit, layer, order, fillX} */
/** renderer.draw with an axis-aligned clip rect (uGUI Mask / RectMask2D): x0->u0, top->v0, bottom->v1 */
function drawClipped(renderer, q, clip) {
  if (!clip) { renderer.draw(q); return; }
  const x1 = q.x + q.w, y1 = q.y + q.h;
  const cx0 = Math.max(q.x, clip.x0), cx1 = Math.min(x1, clip.x1), cy0 = Math.max(q.y, clip.y0), cy1 = Math.min(y1, clip.y1);
  if (cx1 <= cx0 || cy1 <= cy0) return;
  const fu = t => q.u0 + (q.u1 - q.u0) * t, fv = t => q.v1 + (q.v0 - q.v1) * t;
  renderer.draw({ ...q, x: cx0, y: cy0, w: cx1 - cx0, h: cy1 - cy0, u0: fu((cx0 - q.x) / q.w), u1: fu((cx1 - q.x) / q.w), v1: fv((cy0 - q.y) / q.h), v0: fv((cy1 - q.y) / q.h) });
}

/**
 * Image.Type Filled / Radial360: a fan from the rect centre over the border points swept from the
 * fill origin (0 bottom, 1 right, 2 top, 3 left) by amount*360 degrees, clockwise or not.
 */
function drawRadial(renderer, base, sp, x0, y0, w, h, { amount, origin = 0, clockwise = true }) {
  amount = Math.max(0, Math.min(1, amount));
  if (amount <= 0) return;
  const start = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][origin];
  const dir = clockwise ? -1 : 1;
  // a point on the unit square border [-1,1]^2 in direction a
  const edge = a => { const c = Math.cos(a), s = Math.sin(a), k = 1 / Math.max(Math.abs(c), Math.abs(s)); return [c * k, s * k]; };
  const pts = [[0, 0]];
  const sweep = amount * Math.PI * 2;
  // corners at 45 + 90k degrees must be included so the fan follows the square
  const angles = [0];
  for (let k = 0; k < 8; k++) {
    const corner = Math.PI / 4 + k * Math.PI / 2;
    let d = ((corner - start) * dir) % (Math.PI * 2); if (d < 0) d += Math.PI * 2;
    if (d > 0 && d < sweep) angles.push(d);
  }
  angles.push(sweep);
  angles.sort((a, b) => a - b);
  for (const d of angles) pts.push(edge(start + d * dir));
  const pos = [], uv = [], tris = [];
  for (const [nx, ny] of pts) {
    const fx = (nx + 1) / 2, fy = (ny + 1) / 2;
    pos.push(fx * w, fy * h);
    uv.push(sp.u0 + (sp.u1 - sp.u0) * fx, sp.v1 + (sp.v0 - sp.v1) * fy);
  }
  for (let i = 1; i + 1 < pts.length; i++) tris.push(0, i, i + 1);
  renderer.draw({ ...base, x: x0, y: y0, sp: { tex: sp.tex, mesh: { n: pts.length, pos, uv, tris } } });
}

export function drawImage(renderer, assets, name, x0, y0, w, h, opts = {}) {
  const sp = assets.sprite(name);
  if (!sp) return;
  const m = assets.sprites[name];
  const c = opts.color || [1, 1, 1, 1];
  const base = { tex: sp.tex, r: c[0], g: c[1], b: c[2], a: c[3], layer: opts.layer ?? 20, order: opts.order ?? 0, sortY: -1e9, px: 0, py: 0, rot: 0, sx: 1, sy: 1 };
  const rw = m.rect[2], rh = m.rect[3];
  if (opts.radial) { drawRadial(renderer, base, sp, x0, y0, w, h, opts.radial); return; }
  const fill = opts.fillX ?? 1;
  // Image.Type Tiled (sprite without borders): repeat the sprite at its native size from the bottom-left,
  // cutting the last row/column; BetterImage VerticalGradient tints each strip from top to bottom color
  if (opts.type === 'Tiled' && !(m.border && m.border[0] + m.border[1] + m.border[2] + m.border[3])) {
    const unit = opts.unit ?? 0.01, tw = rw * unit, th = rh * unit;
    if (tw <= 0 || th <= 0) return;
    const g = opts.gradient;
    for (let y = 0; y < h - 1e-6; y += th) {
      const hh = Math.min(th, h - y);
      for (let x = 0; x < w - 1e-6; x += tw) {
        const ww = Math.min(tw, w - x);
        const u1 = sp.u0 + (sp.u1 - sp.u0) * (ww / tw), v0 = sp.v1 - (sp.v1 - sp.v0) * (hh / th);
        let col = base;
        if (g) {
          const t = 1 - (y + hh / 2) / h;   // 0 at top, 1 at bottom
          col = { ...base, r: g[0][0] + (g[1][0] - g[0][0]) * t, g: g[0][1] + (g[1][1] - g[0][1]) * t, b: g[0][2] + (g[1][2] - g[0][2]) * t, a: g[0][3] + (g[1][3] - g[0][3]) * t };
        }
        drawClipped(renderer, { ...col, x: x0 + x, y: y0 + y, w: ww, h: hh, u0: sp.u0, u1, v0, v1: sp.v1 }, opts.clip);
      }
    }
    return;
  }
  if (opts.type !== 'Sliced' || !m.border || !(m.border[0] + m.border[1] + m.border[2] + m.border[3])) {
    const u0 = sp.u0, u1 = sp.u0 + (sp.u1 - sp.u0) * fill;
    drawClipped(renderer, { ...base, x: x0, y: y0, w: w * fill, h, u0: opts.flipX ? u1 : u0, u1: opts.flipX ? u0 : u1, v0: sp.v0, v1: sp.v1 }, opts.clip);
    return;
  }
  const unit = opts.unit ?? 0.01;
  let [bl, bb, br, bt] = m.border.map(v => v * unit);
  // shrink borders if the rect is smaller than the borders (Image.GetAdjustedBorders)
  if (bl + br > w) { const k = w / (bl + br); bl *= k; br *= k; }
  if (bb + bt > h) { const k = h / (bb + bt); bb *= k; bt *= k; }
  const xs = [x0, x0 + bl, x0 + w - br, x0 + w];
  const ys = [y0, y0 + bb, y0 + h - bt, y0 + h];
  const du = (sp.u1 - sp.u0) / rw, dv = (sp.v1 - sp.v0) / rh;
  const us = [sp.u0, sp.u0 + m.border[0] * du, sp.u1 - m.border[2] * du, sp.u1];
  const vs = [sp.v1, sp.v1 - m.border[1] * dv, sp.v0 + m.border[3] * dv, sp.v0]; // v increases downward in the PNG
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const w2 = xs[i + 1] - xs[i], h2 = ys[j + 1] - ys[j];
    if (w2 <= 0 || h2 <= 0) continue;
    drawClipped(renderer, { ...base, x: xs[i], y: ys[j], w: w2, h: h2, u0: us[i], u1: us[i + 1], v0: vs[j + 1], v1: vs[j] }, opts.clip);
  }
}
