// Shuriken ParticleSystem simulation (2D projection onto XY) from the exported modules
// (InitialModule, EmissionModule bursts/rate, ShapeModule, Size/Color/Rotation/Velocity/Force/UV over lifetime)
// and ParticleSystemRenderer (billboard / stretched, material texture + additive or alpha blend).

const rnd = (a, b) => a + Math.random() * (b - a);

/** live systems; prefab.instantiate registers, main loop updates (only while the GameObject is active) */
const ALL = new Set();
export function registerPS(ps, assets) {
  ALL.add(ps);
  if (ps.mat?.tex) assets.texture(ps.mat.tex).then(t => { ps.tex = t; }).catch(() => {});
}
export function updateParticles(dt) {
  for (const ps of ALL) {
    const go = ps.go;
    let dead = false; for (let t = go.transform; t; t = t.parent) if (t.go.destroyed) dead = true;
    // systems not drawn for a while (removed from the scene) leave the update list until drawn again
    if (dead || (ps.lastDraw && performance.now() - ps.lastDraw > 3000)) { ALL.delete(ps); continue; }
    const active = go.activeInHierarchy;
    if (!active) { if (ps.wasActive) { ps.Clear(); ps.wasActive = false; } continue; }
    if (!ps.wasActive) {
      ps.wasActive = true;
      // ParticleSystem.Play(withChildren = true): a playOnAwake root starts every descendant system
      if (ps.d.playOnAwake) for (const g of go.walk()) if (g.ps) { g.ps.Play(); g.ps.wasActive = true; }
    }
    const w = go.transform.world();
    ps.update(dt, [w[4], w[5]]);
  }
}

/** AnimationCurve [[t, v, inSlope, outSlope]...] hermite evaluation */
export function evalCurve(keys, t) {
  if (!keys || !keys.length) return 0;
  if (t <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (t >= keys[n - 1][0]) return keys[n - 1][1];
  for (let i = 0; i < n - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t > b[0]) continue;
    const dt = b[0] - a[0]; if (dt <= 0) return b[1];
    const s = (t - a[0]) / dt, s2 = s * s, s3 = s2 * s;
    const m0 = isFinite(a[3]) ? a[3] * dt : 0, m1 = isFinite(b[2]) ? b[2] * dt : 0;
    if (!isFinite(a[3]) || !isFinite(b[2])) return a[1];   // constant (stepped) tangents
    return (2 * s3 - 3 * s2 + 1) * a[1] + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * b[1] + (s3 - s2) * m1;
  }
  return keys[n - 1][1];
}
/** MinMaxCurve {s,k,m,c,mc}: t normalized time, r per-particle random */
export function evalMMC(v, t = 0, r = Math.random()) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  switch (v.s) {
    case 0: return v.k;
    case 1: return evalCurve(v.c, t) * v.k;
    case 2: { const a = evalCurve(v.mc, t), b = evalCurve(v.c, t); return (a + (b - a) * r) * v.k; }
    case 3: return v.m + (v.k - v.m) * r;
    default: return v.k;
  }
}
function evalGrad(g, t) {
  if (!g) return [1, 1, 1, 1];
  const lerpKeys = (keys, n) => {
    if (!keys.length) return n === 1 ? [1] : [1, 1, 1];
    if (t <= keys[0][0]) return keys[0].slice(1);
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t <= b[0]) {
        if (g.mode === 1) return a.slice(1);   // fixed
        const k = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return a.slice(1).map((x, j) => x + (b[j + 1] - x) * k);
      }
    }
    return keys[keys.length - 1].slice(1);
  };
  const c = lerpKeys(g.ck, 3), a = lerpKeys(g.ak, 1);
  return [c[0], c[1], c[2], a[0]];
}
/** MinMaxGradient {s, max, min, g, mg} */
export function evalMMG(v, t = 0, r = Math.random()) {
  if (!v) return [1, 1, 1, 1];
  switch (v.s) {
    case 0: return v.max;
    case 1: return evalGrad(v.g, t);
    case 2: { const a = evalGrad(v.mg, t), b = evalGrad(v.g, t); return a.map((x, i) => x + (b[i] - x) * r); }
    case 3: return v.min.map((x, i) => x + (v.max[i] - x) * r);
    case 4: return evalGrad(v.g, Math.random());
    default: return v.max;
  }
}

function eulerDir(rot, d) {
  // Unity euler (degrees, applied Z then X then Y) rotating a direction vector
  const [rx, ry, rz] = [rot.x, rot.y, rot.z].map(a => (a || 0) * Math.PI / 180);
  let [x, y, z] = d;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
  return [x, y, z];
}

export class ParticleSystem {
  constructor(data, rendererData) {
    this.d = data; this.r = rendererData || {};
    this.parts = [];
    this.time = 0; this.emitAcc = 0; this.burstsDone = new Set();
    this.playing = !!data.playOnAwake; this.enabled = true;
    const init = data.InitialModule || {};
    this.max = init.maxNumParticles || 1000;
    this.delay = evalMMC(data.startDelay);
    this.duration = data.lengthInSec || 1;
    this.world = data.moveWithTransform === 1;     // simulationSpace World
    const mat = (this.r.materials || [])[0] || {};
    this.mat = mat;
    const sh = (mat.shader || '').toLowerCase();
    this.additive = sh.includes('additive') || (mat._SrcBlend === 1 && mat._DstBlend === 1) || (sh.includes('add') && !sh.includes('alpha'));
    this.tint = mat.color || [1, 1, 1, 1];
    if (mat.colorProp === '_TintColor') this.tint = this.tint.map((c, i) => (i < 3 ? c * 2 : c * 2));
    this.tex = null;
  }
  Play() { this.playing = true; this.time = 0; this.emitAcc = 0; this.burstsDone.clear(); }
  Stop() { this.playing = false; }
  Clear() { this.parts.length = 0; }
  get alive() { return this.playing || this.parts.length > 0; }

  _emit(n, origin) {
    const d = this.d, init = d.InitialModule || {}, sm = d.ShapeModule;
    const tn = (this.time % this.duration) / this.duration;
    for (let i = 0; i < n && this.parts.length < this.max; i++) {
      let pos = [0, 0, 0], dir = [0, 0, 1];
      if (sm && sm.enabled) {
        const rad = sm.radius?.value ?? sm.radius ?? 1;
        const thick = sm.radiusThickness ?? 1;
        const arc = (sm.arc?.value ?? sm.arc ?? 360) * Math.PI / 180;
        const rr = rad * (1 - thick * Math.random());
        switch (sm.type) {
          case 10: case 17: {   // circle / donut (XY plane)
            const a = Math.random() * arc;
            pos = [Math.cos(a) * rr, Math.sin(a) * rr, 0]; dir = [Math.cos(a), Math.sin(a), 0];
            break;
          }
          case 4: case 8: {     // cone: base circle, direction spread by angle around +Z
            const a = Math.random() * arc, ang = (sm.angle || 0) * Math.PI / 180;
            const k = Math.random();
            pos = [Math.cos(a) * rad * k, Math.sin(a) * rad * k, 0];
            const sp = Math.sin(ang) * k;
            dir = [Math.cos(a) * sp, Math.sin(a) * sp, Math.cos(ang * k)];
            break;
          }
          case 5: case 15: case 16: case 18: {   // box / rectangle
            const s = sm.m_Scale || { x: 1, y: 1, z: 1 };
            pos = [rnd(-0.5, 0.5) * s.x, rnd(-0.5, 0.5) * s.y, rnd(-0.5, 0.5) * s.z]; dir = [0, 0, 1];
            break;
          }
          case 12: {            // single sided edge (along X)
            pos = [rnd(-rad, rad), 0, 0]; dir = [0, 1, 0];
            break;
          }
          default: {            // sphere / hemisphere
            const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
            dir = [s * Math.cos(a), s * Math.sin(a), u];
            if (sm.type === 2) dir[2] = Math.abs(u);
            pos = dir.map(c => c * rr);
          }
        }
        if (sm.m_Rotation) { pos = eulerDir(sm.m_Rotation, pos); dir = eulerDir(sm.m_Rotation, dir); }
        if (sm.m_Position) pos = [pos[0] + sm.m_Position.x, pos[1] + sm.m_Position.y, pos[2] + sm.m_Position.z];
        if (sm.randomDirectionAmount) {
          const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
          const rd = [s * Math.cos(a), s * Math.sin(a), u], k = sm.randomDirectionAmount;
          dir = dir.map((c, j) => c * (1 - k) + rd[j] * k);
        }
      }
      const L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      const speed = evalMMC(init.startSpeed, tn);
      const life = Math.max(0.01, evalMMC(init.startLifetime, tn));
      const p = {
        x: pos[0], y: pos[1], vx: dir[0] / L * speed, vy: dir[1] / L * speed,
        age: 0, life, size: evalMMC(init.startSize, tn), sizeY: init.size3D ? evalMMC(init.startSizeY, tn) : null,
        rot: evalMMC(init.startRotation, tn), col: evalMMG(init.startColor, tn),
        r1: Math.random(), r2: Math.random(), r3: Math.random(), frame0: Math.random(),
      };
      if (this.world && origin) { p.x += origin[0]; p.y += origin[1]; }
      this.parts.push(p);
    }
  }

  update(dt, origin) {
    const d = this.d;
    dt *= d.simulationSpeed || 1;
    if (this.playing) {
      this.time += dt;
      const t = this.time - this.delay;
      if (t >= 0) {
        if (!d.looping && t > this.duration) this.playing = false;
        else {
          const lt = d.looping ? t % this.duration : t, tn = lt / this.duration;
          const em = d.EmissionModule;
          if (em && em.enabled !== false) {
            this.emitAcc += evalMMC(em.rateOverTime, tn) * dt;
            const n = Math.floor(this.emitAcc); this.emitAcc -= n;
            if (n > 0) this._emit(n, origin);
            const cycle = d.looping ? Math.floor(t / this.duration) : 0;
            (em.m_Bursts || []).forEach((b, bi) => {
              const cycles = b.cycleCount || 1;
              for (let c = 0; c < cycles; c++) {
                const bt = b.time + c * (b.repeatInterval || 0);
                const key = `${cycle}:${bi}:${c}`;
                if (lt >= bt && !this.burstsDone.has(key)) {
                  this.burstsDone.add(key);
                  if (Math.random() <= (b.probability ?? 1)) this._emit(Math.round(evalMMC(b.countCurve, tn)), origin);
                }
              }
            });
          }
        }
      }
    }
    const init = d.InitialModule || {}, grav = evalMMC(init.gravityModifier) * 9.81;
    const vel = d.VelocityModule, force = d.ForceModule, clamp = d.ClampVelocityModule;
    for (const p of this.parts) {
      p.age += dt;
      const tn = p.age / p.life;
      p.vy -= grav * dt;
      if (force) { p.vx += evalMMC(force.x, tn, p.r1) * dt; p.vy += evalMMC(force.y, tn, p.r1) * dt; }
      if (clamp && clamp.dampen) {
        const lim = evalMMC(clamp.magnitude, tn, p.r2), sp = Math.hypot(p.vx, p.vy);
        if (sp > lim) { const k = 1 - clamp.dampen * (1 - lim / sp) * dt * 30; p.vx *= Math.max(0, k); p.vy *= Math.max(0, k); }
      }
      let vx = p.vx, vy = p.vy;
      if (vel) { vx += evalMMC(vel.x, tn, p.r1); vy += evalMMC(vel.y, tn, p.r1); }
      p.x += vx * dt; p.y += vy * dt;
      if (d.RotationModule) p.rot += evalMMC(d.RotationModule.curve, tn, p.r2) * dt;
    }
    this.parts = this.parts.filter(p => p.age < p.life);
  }

  /** queue billboards; origin = emitter world position, scale = emitter lossy scale (scalingMode local) */
  draw(renderer, origin, scale, layer, order, sortY, texture) {
    this.lastDraw = performance.now(); ALL.add(this);
    if (!texture) return;
    const d = this.d, rm = this.r.m_RenderMode || 0;
    const tiles = d.UVModule && d.UVModule.enabled !== false ? d.UVModule : null;
    const mode = this.additive ? 7 : 0;
    for (const p of this.parts) {
      const tn = p.age / p.life;
      let size = p.size * (d.SizeModule ? evalMMC(d.SizeModule.curve, tn, p.r3) : 1);
      let col = p.col;
      if (d.ColorModule) { const c = evalMMG(d.ColorModule.gradient, tn, p.r3); col = col.map((x, i) => x * c[i]); }
      const tint = this.tint;
      const px = this.world ? p.x : origin[0] + p.x * scale[0], py = this.world ? p.y : origin[1] + p.y * scale[1];
      let w = size * Math.abs(scale[0]), h = (p.sizeY ?? size) * Math.abs(scale[1]);
      if (d.SizeModule && p.sizeY != null) h = p.sizeY * evalMMC(d.SizeModule.y || d.SizeModule.curve, tn, p.r3) * Math.abs(scale[1]);
      let u0 = 0, v0 = 0, u1 = 1, v1 = 1;
      if (tiles) {
        const tx = tiles.tilesX || 1, ty = tiles.tilesY || 1, n = tx * ty;
        let f = evalMMC(tiles.frameOverTime, tn, p.frame0) * (tiles.cycles || 1);
        f = Math.floor((f % 1) * n + evalMMC(tiles.startFrame, 0, p.frame0)) % n;
        const cx = f % tx, cy = Math.floor(f / tx);
        u0 = cx / tx; u1 = (cx + 1) / tx; v0 = cy / ty; v1 = (cy + 1) / ty;
      }
      let rot = -p.rot;
      if (rm === 1) {   // stretched billboard: along velocity
        const sp = Math.hypot(p.vx, p.vy);
        rot = Math.atan2(p.vy, p.vx) - Math.PI / 2;
        h = h * (this.r.m_LengthScale || 1) + sp * (this.r.m_VelocityScale || 0);
      }
      renderer.draw({
        tex: texture, u0, v0, u1, v1, w, h, px: 0.5, py: 0.5, x: px, y: py, rot,
        r: col[0] * tint[0], g: col[1] * tint[1], b: col[2] * tint[2], a: Math.min(1, col[3] * tint[3]),
        mode, layer, order, sortY,
      });
    }
  }
}
