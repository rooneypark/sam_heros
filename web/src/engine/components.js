// SpriteRenderer, SortingGroup and Animator (sprite-frame/curve playback of the extracted AnimationClips).
import { Component } from './scene.js';

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; }
  return t;
})();
export function crc32(str) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) c = crcTable[(c ^ str.charCodeAt(i)) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// binding attribute hashes (crc32 of property path)
const ATTR = {
  2086281974: 'm_IsActive', 2526845255: 'r', 4215373228: 'g', 2334886179: 'b', 304273561: 'a',
  3305885265: 'm_Enabled', 3762991556: 'm_SortingOrder', 4197328169: 'sizeX', 2368279999: 'sizeY',
  1460864421: 'apx', 538195251: 'apy', 1967290853: 'sdx', 38095219: 'sdy', 4185109675: 'fa', 1574349066: 'alpha',
};

export class SpriteRenderer extends Component {
  constructor(data = {}) {
    super();
    this.sprite = data.sprite || null;      // sprite name
    this.color = data.color ? { ...data.color } : { r: 1, g: 1, b: 1, a: 1 };
    this.flipX = !!data.flipX; this.flipY = !!data.flipY;
    this.layer = data.layer || 0;
    this.order = data.order || 0;
    this.enabled = data.enabled !== false;
    this.flash = null; // {r,g,b,a} solid tint override
  }
}

export class SortingGroup extends Component {
  constructor(data = {}) { super(); this.layer = data.layer || 0; this.order = data.order || 0; this.enabled = data.enabled !== false; }
}

/** Collects draw items from a GameObject tree (Unity SortingGroup semantics). */
export function drawTree(renderer, assets, root, view) {
  // content packs replace a unit's sprites by their own art (root.spriteRemap: base sprite name -> sprite name)
  const remap = root.spriteRemap, remapFlip = root.spriteRemapFlip ? -1 : 1;   // pack art drawn facing right
  const visit = (t, group) => {
    const go = t.go;
    if (!go.activeSelf) return;
    let g = group;
    const sg = go.components.find(c => c instanceof SortingGroup && c.enabled);
    if (sg) g = { layer: sg.layer, order: sg.order, y: t.position[1] };
    for (const c of go.components) {
      if (!(c instanceof SpriteRenderer) || !c.enabled || !c.sprite) continue;
      const own = remap && remap(c.sprite, c.animationClip);
      const sp = assets.sprite(own || c.sprite);
      if (!sp) continue;
      const w = t.world();
      const x = w[4], y = w[5];
      if (view && (x < view.x0 - 6 || x > view.x1 + 6 || y < view.y0 - 6 || y > view.y1 + 8)) continue;
      const sx = Math.hypot(w[0], w[1]) * Math.sign(w[0] || 1) * (c.flipX ? -1 : 1) * (own ? remapFlip : 1);
      const sy = Math.hypot(w[2], w[3]) * Math.sign(w[3] || 1) * (c.flipY ? -1 : 1);
      const col = c.color;
      const it = { sp, x, y, sx, sy, rot: Math.atan2(w[1], w[0]) * (w[0] < 0 ? 0 : 1),
        r: col.r, g: col.g, b: col.b, a: col.a };
      if (c.materials && c.materials.includes('UnitShadow')) {
        it.sp = null; it.tex = null; it.u0 = 0; it.v0 = 0; it.u1 = 1; it.v1 = 1; it.w = sp.w; it.h = sp.h; it.px = 0.5; it.py = 0.5; it.mode = 3;
      }
      if (c.hit && c.hit[3] > 0) it.hit = c.hit;
      if (c.flash) { it.mode = 1; it.r = c.flash.r; it.g = c.flash.g; it.b = c.flash.b; it.a = col.a * (c.flash.a ?? 1); }
      if (g) { it.layer = g.layer; it.order = g.order; it.sortY = g.y; it.sub = c.order; }
      else { it.layer = c.layer; it.order = c.order; it.sortY = y; it.sub = 0; }
      renderer.draw(it);
    }
    if (go.ps && go.ps.rendererEnabled && go.ps.parts.length) {
      const w = t.world();
      const sc = [Math.hypot(w[0], w[1]), Math.hypot(w[2], w[3])];
      const layer = g ? g.layer : go.ps.layer, order = g ? g.order : go.ps.order, sy = g ? g.y : w[5];
      go.ps.draw(renderer, [w[4], w[5]], sc, layer, order, sy, go.ps.tex);
    }
    for (const ch of t.children) visit(ch, g);
  };
  visit(root.transform, null);
}

/**
 * Animator: plays controller states (by name or hash) using the extracted clips (sprite tracks, curves, events).
 * Override map (state clip name -> clip name) mirrors AnimatorOverrideController.ApplyOverrides.
 */
export class Animator extends Component {
  constructor(assets, controller) {
    super();
    this.assets = assets;
    this.controller = controller;    // {states:{name:{clip,speed,loop}}, default}
    this.overrides = {};
    this.speed = 1;
    this.state = null;
    this.time = 0;
    this.listeners = [];             // fn(eventName, event)
    this._bindCache = new Map();
  }
  awake() { if (this.controller?.default) this.play(this.controller.default); }

  hasState(name) { return !!this.controller?.states?.[name]; }

  clipOf(stateName) {
    const st = this.controller?.states?.[stateName];
    if (!st) return null;
    const name = this.overrides[st.clip] || st.clip;
    return { name, clip: this.assets.anims[name], speed: st.speed ?? 1, loop: st.loop };
  }

  /** Animator.Play(stateName, layer=-1, normalizedTime=-inf): restarts only if a different state or forced */
  play(stateName, normalizedTime = null) {
    const c = this.clipOf(stateName);
    if (!c) return;
    if (this.state === stateName && normalizedTime === null) return;
    this.state = stateName;
    this.cur = c;
    this.time = normalizedTime !== null && c.clip ? normalizedTime * (c.clip.length || 0) : 0;
    this.prevTime = -1e-6;
    this.sample();
  }

  get normalizedTime() { const L = this.cur?.clip?.length || 1; return this.time / L; }

  setFloat(n, v) { (this.params ||= {})[n] = v; }
  setBool(n, v) { (this.params ||= {})[n] = !!v; }
  setTrigger(n) { (this.params ||= {})[n] = true; (this.triggers ||= new Set()).add(n); }
  getBool(n) { return !!this.params?.[n]; }

  _condOk(c) {
    const v = this.params?.[c.param];
    switch (c.mode) {
      case 'If': return !!v;
      case 'IfNot': return !v;
      case 'Greater': return (v ?? 0) > c.th;
      case 'Less': return (v ?? 0) < c.th;
      case 'Equals': return (v ?? 0) === c.th;
      case 'NotEqual': return (v ?? 0) !== c.th;
      default: return true;
    }
  }

  /** Unity AnimatorStateMachine transition evaluation (AnyState first, then current state, in order). */
  _evalTransitions() {
    const states = this.controller?.states;
    if (!states || !this.state) return;
    const cands = [...(this.controller.any || []), ...(states[this.state]?.trans || [])];
    for (const tr of cands) {
      if (tr.hasExit && this.normalizedTime < tr.exitTime) continue;
      if (!tr.conds.every(c => this._condOk(c))) continue;
      if (tr.to === this.state && tr.canSelf === false) continue;
      for (const c of tr.conds) if (this.triggers?.has(c.param)) { this.params[c.param] = false; this.triggers.delete(c.param); }
      this.play(tr.to, 0);
      return;
    }
  }

  update(dt) {
    if (!this.cur || !this.cur.clip || !this.go.activeInHierarchy) return;
    this._evalTransitions();
    const clip = this.cur.clip;
    const L = clip.length || 0;
    const prev = this.time;
    this.time += dt * this.speed * this.cur.speed;
    // events (fire once per crossing; looping clips wrap)
    if (clip.events?.length && L > 0) {
      const loop = clip.loop;
      const from = prev, to = this.time;
      for (const ev of clip.events) {
        if (loop) {
          const n0 = Math.floor((from - ev.t) / L), n1 = Math.floor((to - ev.t) / L);
          if (n1 > n0) this._emit(ev);
        } else if (ev.t > from && ev.t <= to) this._emit(ev);
        else if (from === 0 && ev.t === 0 && to > 0 && prev === 0) this._emit(ev);
      }
    }
    this.sample();
  }

  _emit(ev) { for (const f of this.listeners) f(ev.fn, ev); }

  _target(pathHash) {
    if (this._bindCache.has(pathHash)) return this._bindCache.get(pathHash);
    let found = null;
    if (pathHash === 0) found = this.go;
    else {
      const walk = (t, prefix) => {
        for (const ch of t.children) {
          const p = prefix ? `${prefix}/${ch.go.name}` : ch.go.name;
          if (crc32(p) === pathHash) { found = ch.go; return; }
          walk(ch, p);
          if (found) return;
        }
      };
      walk(this.transform, '');
    }
    this._bindCache.set(pathHash, found);
    return found;
  }

  sample() {
    const clip = this.cur?.clip;
    if (!clip) return;
    const L = clip.length || 0;
    let t = this.time;
    if (clip.loop && L > 0) t = ((t % L) + L) % L;
    else if (t > L) t = L;
    for (const tr of clip.sprites || []) {
      const go = this._target(tr.pathHash);
      if (!go) continue;
      let name = tr.frames[0]?.[1];
      for (const [ft, sn] of tr.frames) { if (ft <= t + 1e-5) name = sn; else break; }
      const sr = go.components.find(c => c instanceof SpriteRenderer);
      if (sr && typeof name === 'string') {
        sr.sprite = name;
        sr.animationClip = this.cur.name;
      }
    }
    for (const b of clip.bound || []) {
      const go = this._target(b.pathHash);
      if (!go) continue;
      const v = b.keys.map(k => sampleKeys(k, t));
      if (b.typeID === 4) {
        const tf = go.transform;
        if (b.attr === 1) { tf.lp[0] = v[0]; tf.lp[1] = v[1]; }
        else if (b.attr === 3) { tf.ls[0] = v[0]; tf.ls[1] = v[1]; tf.ls[2] = v[2]; }
        else if (b.attr === 4 || b.attr === 2) {
          if (b.attr === 4) tf.rotZ = v[2] * Math.PI / 180;
          else tf.lr = [v[0], v[1], v[2], v[3]];
        }
        continue;
      }
      const name = ATTR[b.attr];
      if (!name || v[0] === undefined) continue;
      if (b.typeID === 1 && name === 'm_IsActive') { go.activeSelf = v[0] > 0.5; continue; }
      if (b.typeID === 212) {
        const sr = go.components.find(c => c instanceof SpriteRenderer);
        if (!sr) continue;
        if (name in sr.color) sr.color[name] = v[0];
        else if (name === 'm_SortingOrder') sr.order = Math.round(v[0]);
        else if (name === 'm_Enabled') sr.enabled = v[0] > 0.5;
        continue;
      }
      // UI / MonoBehaviour bindings are routed to an optional handler on the GameObject
      go.onAnimProp?.(b.typeID, name, v[0]);
    }
  }
}

function sampleKeys(keys, t) {
  if (!keys || !keys.length) return undefined;
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      const k = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
      return v0 + (v1 - v0) * k;
    }
  }
  return keys[keys.length - 1][1];
}
