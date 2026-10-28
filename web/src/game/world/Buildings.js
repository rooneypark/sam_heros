// BaseBuildingActor (world buildings), fog tiles (CustomFogTile), drop items (UnitActor.CorDropItem) and inventory.
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { loadPrefab, instantiate, spriteNamesInTree, controllerByRef } from '../../engine/prefab.js';
import { Animator, drawTree, SpriteRenderer } from '../../engine/components.js';
import { layoutTree, drawUI, hitTest } from '../../engine/ui.js';
import { perlinNoise } from '../../engine/unitymath.js';
import { MAP_CELL, cellCenter } from '../map/WorldMapView.js';
import { layoutText, drawText } from '../../engine/text.js';
import { actorPrefabPath } from '../managers/UnitManager.js';
import { corDropResource, addUserExp } from './Resources.js';
import { openPub } from '../Pub.js';
import { openTraining } from '../Training.js';
import { openWorldMap } from '../WorldMap.js';
import { openFame } from '../Fame.js';
import { drawPackResident } from './Npc.js';

// completed buildings with an interaction: pub, training school, teleport (opens the world map)
const ENTER = { 14: () => openPub(), 10: () => openTraining(), 9: () => openWorldMap(), 25: () => openFame() };

export class Inventory {
  constructor() { this.items = new Map(); }
  count(k) { return this.items.get(k) || 0; }
  add(k, n = 1) { this.items.set(k, this.count(k) + n); G.UI?.onInventory?.(); }
  use(k, n) { if (this.count(k) < n) return false; this.items.set(k, this.count(k) - n); return true; }
}

/** Fog tilemap (MapGenerator.CreateFog / CorRemoveFog). Collider type Grid: fog cells block movement. */
export class FogMap {
  constructor() { this.cells = new Map(); this.sprites = (G.assets.tiles.fr_0?.f?.m_Sprites || []).map(s => s.sprite); }
  key(x, y) { return x + ',' + y; }
  add(x, y) { this.cells.set(this.key(x, y), { x, y, a: 1 }); }
  has(x, y) { return this.cells.has(this.key(x, y)); }
  blocks(wx, wy) {
    if (!this.cells.size) return false;
    const c = G.MapManager.worldToCell(wx, wy);
    return this.has(c.x, c.y);
  }
  /** CustomFogTile.GetTileData @0x24ae2b4 */
  spriteOf(x, y) {
    const n = this.sprites.length;
    let m = 0;
    if (this.has(x - 1, y)) m |= 1;
    if (this.has(x + 1, y)) m = (m & 1) ? 3 : 2;
    if (this.has(x, y - 1)) m |= 4;
    if (this.has(x, y + 1)) m |= 8;
    const corner = { 5: 0, 6: 2, 9: 1, 10: 3 }[m];
    if (corner !== undefined) return this.sprites[corner];
    const p = perlinNoise((x + 100000) * 0.5, (y + 100000) * 0.5);
    let i = Math.floor(p * (n - 4));
    i = i < 0 ? 4 : Math.min(i, n - 5) + 4;
    return this.sprites[i];
  }
  remove(tiles, onComplete) {
    const self = this;
    Timing.RunCoroutine((function* () {
      for (const t of tiles) { self.cells.delete(self.key(t.x, t.y)); yield 0.03; }
      onComplete?.();
    })(), null);
  }
  draw(renderer, view) {
    for (const c of this.cells.values()) {
      const p = cellCenter(c.x, c.y, MAP_CELL);
      if (p.x < view.x0 - 4 || p.x > view.x1 + 4 || p.y < view.y0 - 4 || p.y > view.y1 + 4) continue;
      const sp = G.assets.sprite(this.spriteOf(c.x, c.y));
      if (sp) renderer.draw({ sp, x: p.x, y: p.y, r: 1, g: 1, b: 1, a: c.a, layer: 0, order: 5, sortY: 0 });
    }
  }
}

export class Buildings {
  constructor() { this.list = []; this.drops = []; this.toasts = []; this.built = new Set(); this.completed = []; }

  async spawnAll(defs) {
    for (const d of defs) await this.spawn(d);
  }
  async spawn(d) {
    const data = Tables.get('TableWorldBuilding', d.key);
    if (!data) return;
    const json = await loadPrefab('prefab/actor/building/basebuildingactor');
    const go = instantiate(json, G.assets);
    go.transform.lp = [d.pos.x, d.pos.y, 0];
    // BaseBuildingActor.Initialize @0x1ae8120: enable the body variant for the category
    const cat = data.category % 100;
    const keep = new Set(['UIRoot']);
    const statue = cat === 0x11 || cat === 0x5e;
    if ((cat === 3 || cat === 0x28) && data.heroKey) keep.add('Hero');
    if (statue) keep.add('Statue');
    if (cat === 0x5d) keep.add('Boat');
    // Preview (ui_055 site marker): no statue, no heroKey and not a purify site; or an Object (30) site that is built in place
    if (!statue && ((!data.heroKey && cat !== 0x63) || (data.category === 0x1e && data.isBuild && data.heroKey))) keep.add('Preview');
    for (const ch of go.transform.children) if (!keep.has(ch.go.name)) ch.go.setActive(false);
    const b = { key: d.key, data, go, pos: [d.pos.x, d.pos.y], tiles: d.IncludeTiles || [], done: false, ui: null };
    if (keep.has('Hero') && data.heroKey) {
      const u = Tables.unit(data.heroKey);
      const unitGo = go.find('Hero/hero/PreviewUnit/Unit');
      if (unitGo && u) {
        const pjson = await loadPrefab(actorPrefabPath(u.prefab));
        const ctrlRef = findAnimatorRef(pjson);
        const a = unitGo.get(Animator);
        if (a && ctrlRef) { a.controller = controllerByRef(ctrlRef); a.play('Idle', 0); }
        await preloadAnimator(a);
      }
    }
    await G.assets.preloadSprites(spriteNamesInTree(json));
    if (cat === 0x60 || cat === 0x63) for (const t of b.tiles) G.Fog.add(t.x, t.y);
    // BaseBuildingActor.NpcActor: NPC heroKey (Npc_n) stands at the site
    if (data.heroKey && /^(Npc_|SG_N)/i.test(data.heroKey)) b.npc = await G.Npc.spawn(data.heroKey, d.pos.x, d.pos.y - 0.6);
    if (/^SG_U/.test(data.heroKey || '')) await Tables.unit(data.heroKey)?.artReady;
    // WorldUIBuild interaction button above UIRoot
    const uiJson = await loadPrefab('prefab/worildui/worlduibuild');
    b.ui = instantiate(uiJson, G.assets);
    const s = new Set(); for (const g of b.ui.walk()) for (const sc of g.scripts || []) { const n = sc.f?.m_Sprite?.sprite; if (n) s.add(n); }
    await G.assets.preloadSprites(s);
    this.list.push(b);
  }

  /** MapManager.CorCreateComplete: a building stays hidden until its prevBuilding is built */
  visible(b) { return !b.data.prevBuilding || this.built.has(b.data.prevBuilding); }
  canInteract(b) {
    if ((b.data.rLv || 0) > (G.UserData?.Level ?? 0)) return false;
    return (b.data.needResources || []).every((k, i) => G.Inventory.count(k) >= (b.data.needAmount[i] || 0));
  }
  near(b) {
    const p = G.HeroManager.transform.position;
    return Math.hypot(p[0] - b.pos[0], p[1] - b.pos[1]) < 7;
  }
  _uiRect(b) {
    const root = (b.site || b.go).find('UIRoot').transform.position;
    const s = 0.01; // world canvas: 100 px per unit
    return { x0: root[0] - 75 * s, y0: root[1], w: 150 * s, h: 150 * s };
  }
  /** completed buildings with an 'enter' action (afterMsgKey) open their popup */
  enterable(c) { return !!ENTER[c.data.category % 100]; }
  pointerDown(wx, wy) {
    for (const c of this.completed) {
      if (!this.enterable(c) || !this.near(c)) continue;
      const r = this._uiRect(c);
      if (wx >= r.x0 && wx <= r.x0 + r.w && wy >= r.y0 && wy <= r.y0 + r.h) { G.Sound.play('SOUND_BTN_0001'); ENTER[c.data.category % 100](); return true; }
    }
    for (const b of this.list) {
      if (b.done || !this.visible(b) || !this.near(b)) continue;
      const r = this._uiRect(b);
      if (wx >= r.x0 && wx <= r.x0 + r.w && wy >= r.y0 && wy <= r.y0 + r.h) { this.interact(b); return true; }
    }
    return false;
  }
  /** WorldUIBuilding.OnClick -> consume needs -> BuildingActor.StartEvent (reward) */
  interact(b) {
    if (b.wait || !this.canInteract(b)) return;
    b.wait = true;
    (b.data.needResources || []).forEach((k, i) => G.Inventory.use(k, b.data.needAmount[i] || 0));
    G.Sound?.play(b.data.sound);
    b.done = true;
    this.built.add(b.key);
    G.Quest?.AddQuest('BUILD', b.key, 1);
    if (b.data.exp > 0) addUserExp(b.data.exp, b.pos);
    const types = b.data.buildRewardType || [];
    types.forEach(async (t, i) => {
      if (t === 'HERO') {
        const id = b.data.buildRewardID[i];
        // UserHero.AddHero: a new hero joins the party (HeroLv 0) while there is room; a known hero becomes a part
        const isNew = G.User.isPrologue || G.UserHero.AddHero(id);
        if (!isNew || G.UnitManager.HeroUnits.length >= G.User.heroMax && !G.User.isPrologue) return;
        const u = await G.UnitManager.CreateHero(id, G.User.isPrologue ? 0x3b : 0);
        u.WarpHero(b.pos[0], b.pos[1] - 0.5);
      } else if (t === 'RESOURCE') {
        Timing.RunCoroutine(corDropResource([b.pos[0], b.pos[1]], b.data.buildRewardID[i], b.data.buildRewardAmount[i] || 0), null);
      } else if (t === 'ITEM') {
        G.Inventory.add(b.data.buildRewardID[i], b.data.buildRewardAmount[i] || 0);
      }
    });
    if (b.tiles.length && (b.data.category === 0x60 || b.data.category === 0x63)) G.Fog.remove(b.tiles);
    this.createBuilding(b);
    const self = this;
    Timing.RunCoroutine((function* () { yield 0.5; const i = self.list.indexOf(b); if (i >= 0) self.list.splice(i, 1); })(), null);
  }

  /** save restore: sites already built become their completed building (fog cleared, no rewards) */
  async restoreBuilt(keys) {
    this.built = new Set(keys);
    for (const b of [...this.list]) {
      if (!this.built.has(b.key)) continue;
      b.done = true;
      if (b.tiles.length && (b.data.category === 0x60 || b.data.category === 0x63)) for (const t of b.tiles) G.Fog.cells.delete(G.Fog.key(t.x, t.y));
      await this.createBuilding(b, true);
      this.list.splice(this.list.indexOf(b), 1);
    }
  }

  /** BaseBuildingActor.CorCreateBuilding: the TableBuilding prefab of the category replaces the site (SFX_0003) */
  async createBuilding(b, silent = false) {
    const cat = b.data.category % 100;
    if (b.data.category === 0) G.Bonfires.add(b);
    if ([3, 0x28, 0x1e, 0x60, 0x61, 0x63].includes(cat)) return;
    const tb = Object.values(Tables.t.TableBuilding || {}).find(r => r.category === b.data.category) || Object.values(Tables.t.TableBuilding || {}).find(r => r.category === cat);
    if (!tb) return;
    if (!silent) G.Sound?.play('SFX_0003');
    const json = await loadPrefab('prefab/actor/building/' + tb.prefab.toLowerCase());
    const go = instantiate(json, G.assets);
    go.transform.lp = [b.pos[0], b.pos[1], 0];
    await G.assets.preloadSprites(spriteNamesInTree(json));
    for (const a of go.getInChildren(Animator)) await preloadAnimator(a);
    this.completed.push({ key: b.key, go, site: b.go, data: b.data, pos: b.pos, ui: b.ui, entered: true });
  }

  // ------------------------------------------------------------ drops
  /** CorDropItem: wait 0.1 s, roll TableDropItem, spawn the item icon that flies to the heroes */
  drop(actor) {
    const key = actor._tableUnitStatData?.dropItem;
    const d = key && Tables.get('TableDropItem', key);
    if (!d) return;
    const pos = actor.transform.position;
    const self = this;
    Timing.RunCoroutine((function* () {
      yield 0.1;
      d.itemKeys.forEach((ik, i) => {
        if (Math.random() > (d.itemRates[i] ?? 1)) return;
        const it = Tables.get('TableItem', ik);
        if (!it) return;
        const n = d.itemCount[i] || 1;
        G.Drops.spawn(it.image, n, () => G.Inventory.add(ik, n), true, pos);
        self.toasts.push({ text: `${Tables.loc(it.name)} +${d.itemCount[i] || 1}`, t: 0 });
      });
    })(), null);
  }

  update(dt) {
    for (const b of this.list) for (const a of b.go.getInChildren(Animator)) a.update(dt);
    for (const c of this.completed) for (const a of c.go.getInChildren(Animator)) a.update(dt);
    for (const d of this.drops) {
      d.t += dt;
      if (d.t > 0.6) {
        const h = G.UnitManager.LeaderHero?.GetCenterPosition() || G.HeroManager.transform.position;
        const dx = h[0] - d.x, dy = h[1] - d.y, L = Math.hypot(dx, dy);
        const sp = 12 * dt;
        if (L <= sp) { d.done = true; G.Inventory.add(d.item, d.n); }
        else { d.x += dx / L * sp; d.y += dy / L * sp; }
      }
    }
    this.drops = this.drops.filter(d => !d.done);
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter(t => t.t < 2);
  }

  draw(renderer, view) {
    const drawBuilding=b=>{
      if (/^SG_N/.test(b.data.heroKey || '')) return; // resident is drawn by Npcs
      if (/^SG_U/.test(b.data.heroKey || '')) {
        if (!b.done) drawPackResident(renderer,Tables.unit(b.data.heroKey),b.pos[0],b.pos[1]);
        return;
      }
      const name=G.MapManager.json?.environmentArt?.buildings?.[b.key];
      const sp=name && G.assets.sprite(name);
      if(sp){const p=b.go.transform.position;renderer.draw({sp,x:p[0],y:p[1],r:1,g:1,b:1,a:1,layer:0,order:0,sortY:p[1]});}
      else drawTree(renderer,G.assets,b.go,view);
    };
    for (const c of this.completed) drawBuilding(c);
    for (const b of this.list) if (this.visible(b)) drawBuilding(b);
    for (const c of this.completed) {
      if (!this.enterable(c) || !this.near(c) || !c.ui) continue;
      const r = this._uiRect(c);
      const rects = layoutTree(c.ui, r.x0 * 100, r.y0 * 100, r.w * 100, r.h * 100);
      const scaled = new Map([...rects].map(([g, q]) => [g, { x0: q.x0 / 100, y0: q.y0 / 100, w: q.w / 100, h: q.h / 100 }]));
      const inter = c.ui.find('Interaction'); if (inter) inter.uiColor = [1, 1, 1, 1];
      drawUI(renderer, G.assets, c.ui, scaled, { layer: 8 });
      const lay = layoutText(Tables.loc(c.data.afterMsgKey), { font: 'NotoSansCJKkr-Medium SDF', size: 0.3, material: 'NotoSansCJKkr-Medium SDF Material_ShadowOutLine' });
      drawText(renderer, lay, r.x0 + r.w / 2, r.y0 - 0.2, { layer: 8, order: 100 });
    }
    for (const b of this.list) {
      if (b.done || !this.visible(b) || !this.near(b) || !b.ui) continue;
      const r = this._uiRect(b);
      const rects = layoutTree(b.ui, r.x0 * 100, r.y0 * 100, r.w * 100, r.h * 100);
      // render in world units: scale the UI tree by 1/100
      const scaled = new Map([...rects].map(([g, q]) => [g, { x0: q.x0 / 100, y0: q.y0 / 100, w: q.w / 100, h: q.h / 100 }]));
      const ok = this.canInteract(b);
      const inter = b.ui.find('Interaction');
      if (inter) inter.uiColor = ok ? [1, 1, 1, 1] : [0.5, 0.5, 0.5, 1];
      drawUI(renderer, G.assets, b.ui, scaled, { layer: 8 });
      const need = (b.data.needResources || []).map((k, i) => `${G.Inventory.count(k)}/${b.data.needAmount[i]}`).join(' ');
      const lay = layoutText(Tables.loc(b.data.prevMsgKey) + (need ? `  ${need}` : ''), { font: 'NotoSansCJKkr-Medium SDF', size: 0.3, material: 'NotoSansCJKkr-Medium SDF Material_ShadowOutLine' });
      drawText(renderer, lay, r.x0 + r.w / 2, r.y0 - 0.2, { layer: 8, order: 100 });
    }
    for (const d of this.drops) {
      const sp = G.assets.sprite(d.sprite);
      if (!sp) continue;
      const hop = d.t < 0.6 ? Math.sin(d.t / 0.6 * Math.PI) * 0.8 : 0;
      renderer.draw({ sp, x: d.x, y: d.y + hop + 0.5, sx: 0.6, sy: 0.6, r: 1, g: 1, b: 1, a: 1, layer: 0, order: 6, sortY: d.y });
    }
    const h = G.UnitManager.LeaderHero;
    if (h) this.toasts.forEach((t, i) => {
      const p = h.UIGo.transform.position;
      const lay = layoutText(t.text, { font: 'NotoSansCJKkr-Medium SDF', size: 0.35, material: 'NotoSansCJKkr-Medium SDF Material_ShadowOutLine' });
      drawText(renderer, lay, p[0], p[1] + 1.2 + i * 0.45 + t.t * 0.3, { alpha: t.t > 1.5 ? (2 - t.t) / 0.5 : 1, layer: 11 });
    });
  }
}

function findAnimatorRef(json) {
  let ref = null;
  const walk = n => { for (const c of n.comps || []) if (c.type === 'Animator' && c.m_Controller) ref = ref || c.m_Controller; for (const ch of n.children || []) walk(ch); };
  walk(json);
  return ref;
}
async function preloadAnimator(a) {
  if (!a?.controller) return;
  const s = new Set();
  for (const st of Object.values(a.controller.states || {})) for (const tr of G.assets.anims[st.clip]?.sprites || []) for (const [, n] of tr.frames) if (typeof n === 'string') s.add(n);
  await G.assets.preloadSprites(s);
}
