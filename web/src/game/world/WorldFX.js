import { barColor, barSize } from '../../packs/uiDesign.js';
﻿// EffectActor (UtilCraft.StartEffect), BulletActor, WorldUI (WorldUINumText / WorldUISimpleTalk / WorldUIHPBar).
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { loadJSON } from '../../engine/assets.js';
import { loadPrefab, instantiate, spriteNamesInTree } from '../../engine/prefab.js';
import { Animator, drawTree, SpriteRenderer } from '../../engine/components.js';
import { layoutText, drawText } from '../../engine/text.js';
import { drawImage } from '../../engine/uidraw.js';
import { applyBulletHit } from '../skill/Skill.js';

let INDEX = null;
async function prefabPath(name) {
  if (!INDEX) INDEX = await loadJSON('prefab_index.json');
  return INDEX[String(name).toLowerCase()] || null;
}
function clipSprites(assets, go) {
  const s = new Set();
  for (const a of go.getInChildren(Animator)) for (const st of Object.values(a.controller?.states || {})) {
    const c = assets.anims[st.clip];
    for (const tr of c?.sprites || []) for (const [, n] of tr.frames) if (typeof n === 'string') s.add(n);
  }
  return s;
}

/**
 * Pack effects (units.json motion[state].fx, registered by packs/samguk.js as row.motionFx): a PNG sequence started by
 * the clip event OnPackFx. def: { sprites, ms, at, life, loop, offset: [forward px, up px], move: [forward px/s, up px/s],
 * follow, layer: 'front' | 'back' } — forward follows the unit's facing.
 */
export class PackFx {
  constructor() { this.list = []; }
  spawn(actor, state, i) {
    const def = Tables.unit(actor?.Key)?.motionFx?.[state]?.[i];
    if (!def || !def.sprites?.length) return;
    const dir = actor.Body.go.transform.ls[0] >= 0 ? -1 : 1;        // sprites face left; a flipped body faces right
    const p = actor.transform.position;
    this.list.push({ def, actor, dir, t: 0, x: p[0], y: p[1] });
  }
  /** a replaced original effect (units.json skillFx): drawn at the original's spot, `at` re-read each frame when it follows */
  spawnAt(def, pos, dir, at = null) {
    if (!def?.sprites?.length) return;
    this.list.push({ def, actor: null, at, dir, t: 0, x: pos[0], y: pos[1] });
  }
  update(dt) {
    for (const f of this.list) {
      f.t += dt;
      if (f.at) { const p = f.at(); if (p) { f.x = p[0]; f.y = p[1]; } }
      else if (f.def.follow && f.actor && !f.actor.go.destroyed) { const p = f.actor.transform.position; f.x = p[0]; f.y = p[1]; }
    }
    this.list = this.list.filter(f => f.t * 1000 < (f.def.life || f.def.sprites.length * (f.def.ms || 83)));
  }
  draw(renderer) {
    for (const f of this.list) {
      const d = f.def, ms = d.ms || 83, n = d.sprites.length;
      let k = Math.floor(f.t * 1000 / ms);
      k = d.loop ? k % n : Math.min(n - 1, k);
      const sp = G.assets.sprite(d.sprites[k]);
      if (!sp) continue;
      const [ox, oy] = d.offset || [0, 0], [vx, vy] = d.move || [0, 0];
      const x = f.x + f.dir * (ox + vx * f.t) / 100, y = f.y + (oy + vy * f.t) / 100;
      renderer.draw({ sp, x, y, sx: -f.dir, sy: 1, r: 1, g: 1, b: 1, a: 1, layer: 0, order: d.layer === 'back' ? 2 : 4, sortY: f.y });
    }
  }
}

export class Effects {
  constructor() { this.list = []; }
  /** UtilCraft.StartEffect(TableEffect, owner, target, time) */
  start(key, owner, target, time = 0, pos = null) {
    const e = Tables.effect(key);
    if (!e) return null;
    if (e.sound) G.Sound?.play(e.sound);
    const h = { key, alive: true };
    if (G.Option && !G.Option.fx) return h;   // UserOption.IsFx off: UtilCraft.StartEffect spawns nothing
    const who = e.effectTarget === 'MINE' ? owner : (target || owner);
    if (!who && !pos) return null;
    const at = () => {
      if (pos && e.effectTarget !== 'MINE' && !target) return pos;
      if (!who?.Body) return who?.transform?.position || pos;
      if (e.effectPosition === 'FOOT') return who.transform.position;
      if (e.effectPosition === 'HEAD') return who.UIGo?.transform.position || who.GetCenterPosition();
      return who.GetCenterPosition();
    };
    const dur = (e.isSkillTime && time > 0 ? time : e.effectDuration) / (e.effectSpeed || 1);
    // content pack: units.json skillFx[<original prefab>] replaces the original with PNGs (null hides it)
    const swap = owner?.Key && Tables.unit(owner.Key)?.skillFx;
    if (swap && e.prefab in swap) {
      const def = swap[e.prefab];
      if (def) G.PackFx?.spawnAt(def.loop && !def.life ? { ...def, life: dur * 1000 } : def, at(), owner.Body?.go.transform.ls[0] >= 0 ? -1 : 1, e.effectSpawn === 'TARGET' || def.follow ? at : null);
      return h;
    }
    this._spawn(e.prefab, at(), { follow: e.effectSpawn === 'TARGET' ? at : null, dur, speed: e.effectSpeed,
      flip: e.isDirection && owner ? (owner.Body.go.transform.ls[0] < 0) : false, h });
    return h;
  }
  stop(h) { if (h) h.alive = false; }
  spawnPrefab(name, pos, opts = {}) { return this._spawn(name, pos, { dur: opts.dur ?? 1.5, ...opts }); }

  async _spawn(name, pos, o) {
    const path = await prefabPath(name);
    if (!path) return null;
    const json = await loadPrefab(path);
    const go = instantiate(json, G.assets);
    await G.assets.preloadSprites(spriteNamesInTree(json));
    await G.assets.preloadSprites(clipSprites(G.assets, go));
    go.transform.lp = [pos[0], pos[1], 0];
    if (o.flip) go.transform.ls[0] *= -1;
    if (o.range) go.transform.ls = [o.range, o.range, 1];   // InstantEffectActor.StartEffect(size): FlagRange circle radius
    for (const a of go.getInChildren(Animator)) a.speed = o.speed || 1;
    // EffectActor.Play: every ParticleSystem of the effect starts on spawn
    for (const g of go.walk()) if (g.ps) { g.ps.Play(); g.ps.wasActive = true; g.ps.d.simulationSpeed = (g.ps.d.simulationSpeed || 1); g.ps.speedMul = o.speed || 1; }
    const fx = { go, t: 0, dur: o.dur, follow: o.follow, h: o.h || { alive: true } };
    this.list.push(fx);
    return fx;
  }
  update(dt) {
    for (const fx of this.list) {
      fx.t += dt;
      if (fx.follow) { const p = fx.follow(); if (p) fx.go.transform.lp = [p[0], p[1], 0]; }
      for (const a of fx.go.getInChildren(Animator)) a.update(dt);
    }
    this.list = this.list.filter(fx => { const keep = fx.h.alive && fx.t < Math.max(fx.dur, 0.05); if (!keep) fx.go.destroyed = true; return keep; });
  }
  draw(renderer, view) { for (const fx of this.list) drawTree(renderer, G.assets, fx.go, view); }
}

/** BulletActor: shootType DIRECT/ARC, bulletSpeed, bulletDist, bulletType DEFAULT/PIERCE */
export class Bullets {
  constructor() { this.list = []; }
  async shoot(owner, target, b, value, action) {
    const custom = Tables.unit(owner.Key)?.projectileSprite;
    const path = custom ? null : await prefabPath(b.prefab);
    const sp = owner.Body.Shoot.position;
    let go = null;
    if (path) {
      const json = await loadPrefab(path);
      go = instantiate(json, G.assets);
      await G.assets.preloadSprites(spriteNamesInTree(json));
      await G.assets.preloadSprites(clipSprites(G.assets, go));
      go.transform.lp = [sp[0], sp[1], 0];
    }
    const tp = target.GetCenterPosition();
    this.list.push({ go, custom, owner, target, b, value, x: sp[0], y: sp[1], sx: sp[0], sy: sp[1], tx: tp[0], ty: tp[1], t: 0,
      dist: Math.hypot(tp[0] - sp[0], tp[1] - sp[1]), hit: new Set() });
  }
  update(dt) {
    for (const k of this.list) {
      const t = k.target;
      if (t && !t.IsDead()) { const p = t.GetCenterPosition(); k.tx = p[0]; k.ty = p[1]; }
      const spd = k.b.bulletSpeed;
      const dx = k.tx - k.x, dy = k.ty - k.y, L = Math.hypot(dx, dy);
      const step = spd * dt;
      let nx, ny;
      if (L <= step || L < 0.2) { nx = k.tx; ny = k.ty; k.done = true; }
      else { nx = k.x + dx / L * step; ny = k.y + dy / L * step; }
      k.x = nx; k.y = ny;
      let yOff = 0;
      if (k.b.shootType === 'ARC') {
        const total = Math.max(k.dist, 0.01), cur = Math.hypot(k.x - k.sx, k.y - k.sy);
        const u = Math.min(1, cur / total);
        yOff = Math.sin(u * Math.PI) * total * 0.25;
      }
      k.yOff = yOff; k.angle = Math.atan2(dy,dx);
      if (k.go) {
        k.go.transform.lp = [k.x, k.y + yOff, 0];
        k.go.transform.rotZ = Math.atan2(dy + (k.b.shootType === 'ARC' ? (0.5 - Math.min(1, Math.hypot(k.x - k.sx, k.y - k.sy) / Math.max(k.dist, 0.01))) * k.dist : 0), dx);
        for (const a of k.go.getInChildren(Animator)) a.update(dt);
      }
      if (k.done && t && !t.IsDead()) applyBulletHit(k.owner, t, k.b, k.value);
    }
    this.list = this.list.filter(k => !k.done);
  }
  draw(renderer, view) { for (const k of this.list) {
    if (k.custom) { const sp=G.assets.sprite(k.custom); if(sp) renderer.draw({sp,x:k.x,y:k.y+(k.yOff||0),rot:(k.angle||0)+Math.PI,r:1,g:1,b:1,a:1,layer:0,order:3,sortY:k.y}); }
    else if (k.go) drawTree(renderer, G.assets, k.go, view);
  } }
}

const BAR_MARGIN = 0.24;                        // gap between the head and the EXP bar (world units)
/** world y of a pack unit's head top: its body sprite node + the first opaque row of its Idle frame (null until measured) */
const HEAD = new Map();
function headTop(u) {
  const row = Tables.unit(u.Key);
  const name = row?.npcArt?.frames?.Idle?.[0];
  if (!name) return null;
  if (HEAD.has(u.Key)) {
    const v = HEAD.get(u.Key); if (v == null) return null;
    // the body SpriteRenderer the pack art replaces (drawn below the unit origin in most prefabs)
    if (!u._headNode) u._headNode = findPackBody(u.go.transform, u.go.spriteRemap) || u.go.transform;
    const w = u._headNode.world();
    return w[5] + v * Math.hypot(w[2], w[3]);
  }
  HEAD.set(u.Key, null);
  const sp = G.assets.sprites[name];
  if (!sp?.tex) return null;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, c.width, c.height).data;
    // first row at least ~36 px wide: a raised spear / glaive blade or a feather tip is not the head
    let top = c.height;
    for (let y = 0; y < c.height; y++) {
      let n = 0;
      for (let x = 0; x < c.width; x++) if (a[(y * c.width + x) * 4 + 3] > 40) n++;
      if (n >= 36) { top = y; break; }
    }
    HEAD.set(u.Key, (c.height * (1 - sp.pivot[1]) - top) / (sp.ppu || 100));
  };
  img.src = encodeURI(sp.tex);
  return null;
}

function findPackBody(t, remap) {
  if (!remap) return null;
  for (const c of t.go.components) if (c instanceof SpriteRenderer && c.sprite && remap(c.sprite, c.animationClip)) return t;
  for (const ch of t.children) { const f = findPackBody(ch, remap); if (f) return f; }
  return null;
}

/** World-space UI: floating numbers, simple talk bubbles, HP bars. */
export class WorldUI {
  constructor() { this.nums = []; this.talks = []; }
  /** WorldUINumText.SetValue: clip WorldUINumText (scale 0->1 in 0.2s, hold to 1.4s, fade to 1.6s, rise 0.05) */
  numText(actor, text, color, scale = 1, speed = 1) {
    const p = actor.UIGo.transform.position;
    this.nums.push({ text, color, scale, speed, x: p[0], y: p[1] + 0.3, t: 0,
      lay: layoutText(text, { font: 'soupofjustice SDF', size: 0.4, material: 'soupofjustice SDF_Outline_Black_Shadow' }) });
  }
  /** WorldUINumText spawned at a world position (drops, EXP) */
  numTextAt(x, y, text, color, scale = 1, speed = 1) {
    this.nums.push({ text, color, scale, speed, x, y, t: 0,
      lay: layoutText(text, { font: 'soupofjustice SDF', size: 0.4, material: 'soupofjustice SDF_Outline_Black_Shadow' }) });
  }
  simpleTalk(actor, text, dur = 2.5) {
    if (!text) return;
    this.talks.push({ actor, t: 0, dur, lay: layoutText(text, { font: 'NotoSansCJKkr-Medium SDF', size: 0.3, material: 'NotoSansCJKkr-Medium SDF Material' }) });
  }
  update(dt) {
    for (const n of this.nums) n.t += dt * n.speed;
    this.nums = this.nums.filter(n => n.t < 1.6);
    for (const k of this.talks) k.t += dt;
    this.talks = this.talks.filter(k => k.t < k.dur);
  }
  draw(renderer) {
    // HP bars (WorldUIHPBar: 0.75 x 0.12 at scale 0.5, red fill, cyan shield); 삼국 챕터는 머리 끝 바로 위
    const barAt = u => {
      if (G.Chapter) { const top = headTop(u); if (top != null) return [u.transform.position[0], top + BAR_MARGIN + 0.03]; }
      const p = u.UIGo.transform.position; return [p[0], p[1] + 1];
    };
    for (const u of G.UnitManager.all) {
      if (!(u.hpBar.show > 0) || u.IsDead()) continue;
      const p = barAt(u);
      const w = barSize('hpWidth', 0.375), h = barSize('hpHeight', 0.06), x0 = p[0] - w / 2, y0 = p[1] - h / 2;
      const rate = Math.max(0, Math.min(1, u.GetHPRate()));
      renderer.draw({ x: x0, y: y0, w, h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, ...barColor('background', [0.1,0.1,0.1]), a: 1, layer: 9, order: 0, sortY: -1e9 });
      renderer.draw({ x: x0, y: y0, w: w * rate, h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, ...barColor('hp', [1,0,0]), a: 1, layer: 9, order: 1, sortY: -1e9 });
      const sr = u.GetShieldRate();
      if (sr > 0.001) renderer.draw({ x: x0 + w * rate, y: y0, w: w * Math.min(sr, 1 - rate), h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, ...barColor('shield', [0,0.909,1]), a: 1, layer: 9, order: 2, sortY: -1e9 });
    }
    // 삼국 챕터: hero EXP bar under the HP bar (always shown for heroes)
    if (G.Chapter) for (const u of G.UnitManager.HeroUnits) {
      if (u.IsDead()) continue;
      const p = barAt(u), rate = G.Chapter.expRate(u);
      const w = barSize('hpWidth', 0.375), h = barSize('expHeight', 0.05), x0 = p[0] - w / 2, y0 = p[1] - barSize('hpHeight', 0.06) / 2 - h - barSize('expGap', 0.012);
      renderer.draw({ x: x0, y: y0, w, h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, ...barColor('background', [0.1,0.1,0.1]), a: 1, layer: 9, order: 0, sortY: -1e9 });
      renderer.draw({ x: x0, y: y0, w: w * rate, h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, ...barColor('exp', [1,0.82,0.2]), a: 1, layer: 9, order: 1, sortY: -1e9 });
    }
    // WorldUIResurrection (1.5 x scale 0.5): white circle BG + green Radial360 fill from the top, clockwise
    for (const u of G.UnitManager.HeroUnits.concat(G.HeroManager.DeadHeroes)) {
      const g = u.resurrection;
      if (!g || !u.IsDead()) continue;
      const s = 0.75, x0 = g.x - s / 2, y0 = g.y - s / 2;
      drawImage(renderer, G.assets, 'circle', x0, y0, s, s, { layer: 9, order: 0 });
      drawImage(renderer, G.assets, 'circle', x0, y0, s, s, { layer: 9, order: 1, color: [0, 0.906, 0.369, 1], radial: { amount: g.timer / g.time, origin: 2, clockwise: true } });
    }
    for (const k of this.talks) {
      if (k.actor.IsDead && !k.actor.go || k.actor.go?.destroyed) continue;
      const p = k.actor.UIGo.transform.position;
      const bw = k.lay.width + 0.5, bh = 0.75;
      const x0 = p[0] - bw / 2, y0 = p[1] + 0.113 - bh / 2 + 0.6;
      drawImage(renderer, G.assets, 'ui_007', x0, y0, bw, bh, { type: 'Sliced', unit: 0.01, layer: 10, order: 0 });
      drawImage(renderer, G.assets, 'ui_177', p[0] - 0.17, y0 - 0.2 + 0.0525, 0.34, 0.3, { layer: 10, order: 1 });
      drawText(renderer, k.lay, p[0], y0 + bh / 2, { color: [0, 0, 0, 1], layer: 10, order: 2 });
    }
    for (const n of this.nums) {
      const t = n.t;
      const sc = t < 0.2 ? t / 0.2 : t < 1.4 ? 1 : 1 - (t - 1.4) / 0.2 * 0.2;
      const al = t < 0.2 ? t / 0.2 : t < 1.4 ? 1 : 1 - (t - 1.4) / 0.2;
      const rise = Math.min(t, 1) * 0.05;
      drawText(renderer, n.lay, n.x, n.y + rise, { color: n.color, alpha: al, scale: sc * n.scale, layer: 11 });
    }
  }
}
