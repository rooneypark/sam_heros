// ResourceSpawner / ResourceActor / ResourceBody, DropItem (DOTween sequence), UtilCraft.CorDropResource,
// UnitActor.DropResource and the user's resources / level (User.AddResource, User.AddExp).
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { ACTOR_TYPE, TEAM } from '../defs.js';
import { Random } from '../../engine/unitymath.js';
import { loadPrefab, instantiate, spriteNamesInTree } from '../../engine/prefab.js';
import { Animator, SpriteRenderer, SortingGroup, drawTree } from '../../engine/components.js';

export const RESOURCE_TYPE = { NONE: 0, TREE: 1, STONE: 2, MEAT: 3, GOLD: 4, MAP: 5, DIA: 6, EXP: 7 };
const RESOURCE_STATE = { IDLE: 0, DEAD: 2 };
const now = () => Timing.time;   // APIManager.GetNowUnixTime (seconds)

/** TableAccess.GetResourceItemSprite: TableItem row with itemType RESOURCE and itemDetailKey == name */
const itemSpriteCache = new Map();
export function resourceItemSprite(name) {
  if (!itemSpriteCache.has(name)) {
    const r = Object.values(Tables.t.TableItem).find(d => d.itemType === 'RESOURCE' && d.itemDetailKey === name);
    itemSpriteCache.set(name, r ? r.image : null);
  }
  return itemSpriteCache.get(name);
}

async function preloadAnimators(go) {
  const s = new Set();
  for (const a of go.getInChildren(Animator)) for (const st of Object.values(a.controller?.states || {}))
    for (const tr of G.assets.anims[st.clip]?.sprites || []) for (const [, n] of tr.frames) if (typeof n === 'string') s.add(n);
  await G.assets.preloadSprites(s);
}

// ------------------------------------------------------------------ user data
/** User resources + level (User.AddResource / User.AddExp @0x34d6c2c) */
export class UserData {
  constructor() { this.Level = 0; this.Exp = 0; this.ExpBonus = 1; }
  /** User.AddResource @0x34d6f50: EXP goes to AddExp; quest RESOURCE progress */
  AddResource(type, amount) {
    if (type === 'EXP') { addUserExp(amount, G.HeroManager.transform.position); return; }
    G.Inventory.add(type, amount);
    G.Quest?.AddQuest('RESOURCE', type, amount);
    if (type === 'TREE' || type === 'STONE') G.InstantQuest?.add('RESOURCE', amount);   // RESOURCE_TYPE 1..2
  }
  /** returns the number of level-ups; needExp of TableUserLevel(level+1) */
  AddExp(exp) {
    this.Exp += exp;
    let ups = 0, next = levelRow(this.Level + 1);
    while (next && this.Exp >= next.needExp) { this.Level++; this.Exp -= next.needExp; ups++; next = levelRow(this.Level + 1); }
    return ups;
  }
  NeedExp() { return levelRow(this.Level + 1)?.needExp || 0; }
}
function levelRow(lv) { return Object.values(Tables.t.TableUserLevel).find(r => r.category === 0 && r.level === lv) || null; }

/** UserDataManager.AddExp(exp, pos): "EXP n" text (white, scale 0.8, speed 0.3) then User.AddExp */
export function addUserExp(exp, pos) {
  G.WorldUI.numTextAt(pos[0], pos[1], `EXP ${exp}`, [1, 1, 1, 1], 0.8, 0.3);
  const ups = G.UserData.AddExp(exp);
  if (ups > 0) { G.UnitManager.ResetStat?.(); G.GameState.send('Update_User_Level', G.UserData.Level); }
}

/** UnitActor.<SetState>g__GetExp|83_1 @0x3c3b764 */
export function monsterExp(u) {
  const st = u._tableUnitStatData;
  let exp = st.exp * ((u.Level + 1) / 60) * (u.UnitData.EliteType === 0 ? 1 : 5);
  const diff = Math.abs(G.UserData.Level - u.Level) - 5;
  if (diff > 9) exp = 0;
  else if (diff >= 1) exp *= 1 - Tables.define('EXP_LEVEL_PENALTY') * diff;
  const total = Math.round(exp * G.UserData.ExpBonus);
  if (total >= 1) { const p = u.transform.position; addUserExp(total, [p[0], p[1] + 0.3]); }
}

// ------------------------------------------------------------------ DropItem
/** DropItem.SetImage @0x24af45c: scale-in 0.07s + spin -720 (0.5s) + bezier 0.7s to a random point, 0.1s,
 *  callback (grade fx / gold anim), then (instant) 0.9s wait, fade 0.8s rising 0.75 with a green amount text. */
export class Drops {
  constructor() { this.list = []; }
  async spawn(sprite, amount, onComplete, instant, pos, actor = null, isRandomPosX = true) {
    const json = await loadPrefab('prefab/map/dropitem');
    const go = instantiate(json, G.assets);
    await G.assets.preloadSprites([sprite, ...spriteNamesInTree(json)]);
    const isGold = sprite === 'ui_104';
    G.Sound?.play(isGold ? 'SOUND_ETC_0009' : 'SOUND_ETC_0003');
    const anim = go.get(Animator); if (anim) { anim.enabled = false; await preloadAnimators(go); }
    go.find('trail')?.setActive(false);   // TrailRenderer is not rendered
    const item = go.find('Item'), sr = item.get(SpriteRenderer);
    sr.sprite = sprite; sr.color = { r: 1, g: 1, b: 1, a: 1 };
    const scale = G.MapManager.IsWorld ? 1 : 0.7;
    let dx, dy;
    if (isRandomPosX) { if (actor) { dx = Random.range(Random.range(-4, -2), Random.range(2, 4)); dy = Random.range(-1.5, -0.25); } else { dx = Random.range(-1.66, 1.66); dy = Random.range(-1, 1); } }
    else if (actor) { dx = Random.range(-1, Random.range(0, 1)); dy = Random.range(-1.5, -0.25); }
    else { dx = Random.range(-1.66, 1.66); dy = Random.range(-0.5, 0.5); }
    const base = actor ? actor.transform.position : pos;
    const O = [pos[0], pos[1]], D = [base[0] + dx, base[1] + dy];
    const h = actor ? Math.abs(D[1] - O[1]) + 4 : 4;
    const M = [(O[0] + D[0]) * 0.5, (O[1] + D[1]) * 0.5 + h];
    const d = { go, item, sr, anim, isGold, amount, onComplete, instant, O, M, D, scale, t: 0, done: false, fired: false };
    go.transform.lp = [O[0], O[1], 0];
    item.transform.ls = [0, 0, 1];
    this.list.push(d);
    return d;
  }
  update(dt) {
    for (const d of this.list) {
      d.t += dt;
      const t = d.t, it = d.item.transform;
      // tween 1: bezier (0.7s linear), joined DOScale(scale, 0.07) and DOLocalRotate(-720, 0.5)
      const k = Math.min(t / 0.7, 1), u = 1 - k;
      d.go.transform.lp = [u * u * d.O[0] + 2 * u * k * d.M[0] + k * k * d.D[0], u * u * d.O[1] + 2 * u * k * d.M[1] + k * k * d.D[1], 0];
      const s = d.scale * Math.min(t / 0.07, 1); it.ls = [s, s, 1];
      const ang = -720 * Math.min(t / 0.5, 1) * Math.PI / 180; it.lr = [0, 0, Math.sin(ang / 2), Math.cos(ang / 2)];
      if (t >= 0.8 && !d.cb3) { d.cb3 = true; const sg = d.go.get(SortingGroup); if (sg) sg.order = 2; if (d.isGold && d.anim) d.anim.enabled = true; }  // b__3
      if (!d.instant) continue;
      if (t >= 1.7) {
        if (!d.fired) {   // b__6 (fade OnStart): amount text + OnComplete(pos)
          d.fired = true;
          const p = d.go.transform.position;
          G.WorldUI.numTextAt(p[0], p[1], String(d.amount), [0, 1, 0, 1], 1, 0.4);
          d.onComplete?.(p);
        }
        const f = Math.min((t - 1.7) / 0.8, 1);
        d.sr.color = { r: 1, g: 1, b: 1, a: 1 - f };
        it.lp = [0, 0.75 * f, 0];
        if (f >= 1) d.done = true;    // b__7: despawn
      }
      if (d.anim?.enabled) d.anim.update(dt);
    }
    this.list = this.list.filter(d => !d.done);
  }
  draw(renderer, view) { for (const d of this.list) drawTree(renderer, G.assets, d.go, view); }
}

/** UtilCraft.CorDropResource(pos, type, amount, rsn, toast) @0x369bf64 */
export function* corDropResource(pos, typeName, amount, toast = false) {
  if (!typeName || typeName === 'NONE') return;
  let unit = 3;
  if (toast) G.UI.toast?.(`${typeName} +${amount}`);
  const instants = !!G.MapManager.IsWorld;
  const rate = 1;   // TotalGlobalStat.GetDropResourceRate (max(v,1))
  const sprite = resourceItemSprite(typeName);
  const give = (n) => () => G.UserData.AddResource(typeName, n * rate);
  if (amount > unit) {
    let repeat = Math.ceil(amount / unit);
    if (repeat >= 8) { repeat = 7; unit = Math.round(amount / 7); }
    let sum = 0;
    for (let i = 0; i < repeat; i++) {
      let n = unit;
      if (amount <= sum + unit) { n = amount - sum; sum = amount; } else sum += unit;
      if (n < 1) continue;
      G.Sound?.play('SOUND_ETC_0004');
      G.Drops.spawn(sprite, n * rate, give(n), instants, pos);
      yield 0.1;
    }
    yield -Infinity;
  } else {
    G.Sound?.play('SOUND_ETC_0004');
    G.Drops.spawn(sprite, amount * rate, give(amount), instants, pos);
  }
}

/** UnitActor.DropResource @0x3c381d8 (world path): one DropItem with lootAmount x rate */
export function unitDropResource(u) {
  const type = u.UnitData.LootResource, amount = Math.round(u.UnitData.LootAmount * 1);
  if (!type || type === 'NONE' || amount < 1) return;
  G.Sound?.play('SOUND_ETC_0004');
  const sprite = resourceItemSprite(type);
  G.Drops.spawn(sprite, amount, () => G.UserData.AddResource(type, amount), !!G.MapManager.IsWorld, u.transform.position, u.Key === 'Unit000624' ? u : null);
}

/** lootType HIT (1): per hit, DEAD (2): on death ??Random(0,1) <= lootRate */
export function tryLoot(u, lootType) {
  const st = u._tableUnitStatData;
  const lt = { NONE: 0, HIT: 1, DEAD: 2 }[st?.lootType] ?? st?.lootType;
  if (!st || lt !== lootType) return;
  if (Random.range(0, 1) <= st.lootRate) unitDropResource(u);
}

// ------------------------------------------------------------------ ResourceActor
export class ResourceActor {
  constructor(go) {
    this.go = go; this.transform = go.transform;
    this.isResource = true; this.isUnit = false; this.isBuilding = false;
    this.ActorType = ACTOR_TYPE.RESOURCE; this.Team = TEAM.PLAYER;
    this.colliderRadius = 0.2358;
    this.Body = go.find(go.name + 'Body') || go.transform.children[0].go;
    this.Image = this.Body.find('Image');
    this.sr = this.Image.get(SpriteRenderer);
    this.anim = this.Body.get(Animator);
    this.UIGo = go.find('UIRoot');
    this._state = -1; this.hit = 0; this.colliderOn = true;
  }
  /** Initialize(key, level) @0x35f8c00 */
  Initialize(key) {
    this.Key = key;
    this._tableData = Tables.get('TableResource', key);
    const t = this._tableData;
    this.ResourceType = RESOURCE_TYPE[t.resourceType] ?? 0;
    this.CurrentHP = this.MaxHP = t.hp; this.Amount = t.amount; this.RebirthSec = t.rebirth;
    this.SetState(RESOURCE_STATE.IDLE, true);
    this.OnRebirth();
  }
  IsDead() { return this.CurrentHP <= 0 || this._state === RESOURCE_STATE.DEAD; }
  GetHP() { return this.CurrentHP; }
  GetHPRate() { return this.CurrentHP / (this.MaxHP || 1); }
  GetCenterPosition() { const p = this.transform.position; return [p[0], p[1] + 0.25]; }
  /** SetState @0x35f8d18 */
  SetState(st, force = false) {
    if (this._state === st && !force) return;
    this._state = st;
    if (st === RESOURCE_STATE.DEAD) {
      this.sr.sprite = this._tableData.destroyImg;
      this.colliderOn = false; this.hit = 0; this.sr.hit = [1, 1, 1, 0];   // ResourceBody.OnDead
      this.RebirthTime = now() + this.RebirthSec;
    } else if (st === RESOURCE_STATE.IDLE) {
      this.sr.sprite = this._tableData.idleImg;
      this.RebirthTime = 0; this.CurrentHP = this.MaxHP;
    }
  }
  /** ResourceBody.OnRebirth: collider on, Animator.Play(REBIRTH) */
  OnRebirth() { this.colliderOn = true; if (this.go.activeInHierarchy !== false) this.anim?.play('Rebirth', 0); }
  /** ResourceActor.Damage @0x35f8e14 */
  Damage(damage) {
    if (this._state === RESOURCE_STATE.DEAD) return 0;
    this.SetDamage();                 // Actor.Damage -> Body.SetDamage(white)
    const done = Math.min(this.CurrentHP, damage);
    this.CurrentHP -= done;
    if (this.CurrentHP <= 0) {
      this.SetState(RESOURCE_STATE.DEAD);
      Timing.RunCoroutine(corDropResource(this.transform.position, this._tableData.resourceType, this._tableData.amount), null);
    }
    return done;
  }
  /** ResourceBody.SetDamage @0x35f96d4: sound by type, Damaged anim, white hit blend 1 -> 0 at 5/s */
  SetDamage() {
    if (this.ResourceType === RESOURCE_TYPE.TREE) G.Sound?.play('SOUND_ACTION_0000');
    else if (this.ResourceType === RESOURCE_TYPE.STONE) G.Sound?.play('SOUND_ACTION_0001');
    // SoundManager.Haptic(preset 8) outside camp: AndroidHaptic.PlayConstant(0.13, 0.03 s) when 진동 is on
    if (!G.HeroManager.IsCamp && G.Option?.haptic && !G.SleepMode?.open) navigator.vibrate?.(30);
    this.anim?.play('Damaged', 0);
    this.hit = 1;
  }
  update(dt) {
    if (this.hit > 0) { this.hit = Math.max(0, this.hit - dt * 5); }
    this.sr.hit = [1, 1, 1, this.hit];
    this.anim?.update(dt);
  }
}

// ------------------------------------------------------------------ ResourceSpawner
export class ResourceSpawner {
  constructor(d) {
    Object.assign(this, d);
    this.ActorList = [];
    this.active = false; this.started = false;
    this.chunk = d.IncludeTiles[0] ? [Math.floor(d.IncludeTiles[0].x / 10), Math.floor(d.IncludeTiles[0].y / 10)] : [0, 0];
  }
  /** SetActive @0x2c72a50: registers in MapManager.ActiveResourceSpawners */
  setActive(v) {
    this.active = v;
    const list = G.MapManager.ActiveResourceSpawners;
    if (v && !list.includes(this)) list.push(this);
    if (v && !this.started) { this.started = true; Timing.RunCoroutine(this.CorSpawner(), this); }
  }
  /** GetResourceData(key=resourceType name, level) */
  GetResourceData(key, level) {
    return Object.values(Tables.t.TableResource).find(r => r.resourceType === key && r.level === level) || null;
  }
  /** SpawnActor @0x2c723c0 */
  async SpawnActor() {
    const sd = this.SpawnerDatas[Random.rangeInt(0, this.SpawnerDatas.length)];
    const data = this.GetResourceData(sd.key, sd.level);
    if (!data) { console.error(`Resource Data is Null : ${sd.key} : ${sd.level}`); return false; }
    const json = await loadPrefab(`prefab/actor/resource/${data.prefab.toLowerCase()}`);
    const go = instantiate(json, G.assets);
    await G.assets.preloadSprites([...spriteNamesInTree(json), data.idleImg, data.destroyImg]);
    await preloadAnimators(go);
    // random tile; random point inside the isometric cell (0.97 x cell) at least 0.5 away from the others
    const t = this.IncludeTiles[Random.rangeInt(0, this.IncludeTiles.length)];
    const c = G.MapManager.cellCenter(t.x, t.y), cs = G.MapManager.GetCellSize();
    const rx = cs[0] * 0.97, ry = cs[1] * 0.97;
    let p = [-500, -500], overlap = false;
    for (let guard = 0; guard < 200; guard++) {
      const inside = Math.abs(p[0] - c[0]) / (rx * 0.5) + Math.abs(p[1] - c[1]) / (ry * 0.5) <= 1;
      if (inside && !overlap) break;
      p = [c[0] + Random.range(-cs[0], cs[0]), c[1] + Random.range(-cs[1], cs[1])];
      overlap = this.ActorList.some(a => { const q = a.transform.position; return (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < 0.25; });
    }
    go.transform.lp = [p[0], p[1], 0];
    const a = new ResourceActor(go);
    a.Spawner = this;
    a.Initialize(data.key);
    this.ActorList.push(a);
    return true;
  }
  /** <CorSpawner>d__0 @0x2c72dc0: fill to MaxCount one per frame, then every 5 s rebirth dead ones whose time passed */
  *CorSpawner() {
    while (this.ActorList.length < this.MaxCount) {
      let ok = null; this.SpawnActor().then(r => { ok = r; });
      while (ok === null) yield -Infinity;
      if (!ok) return;
      yield -Infinity;
    }
    for (;;) {
      yield { until: () => this.active };
      for (let i = this.ActorList.length - 1; i >= 0; i--) {
        const a = this.ActorList[i];
        if (a._state === RESOURCE_STATE.DEAD && a.RebirthTime <= now()) { a.SetState(RESOURCE_STATE.IDLE); a.OnRebirth(); }
      }
      yield 5;
    }
  }
}

/** All resource actors (for skill target search) + per-frame update/draw */
export class Resources {
  actors() { const out = []; for (const s of G.MapManager.resourceSpawners || []) for (const a of s.ActorList) out.push(a); return out; }
  update(dt) { for (const s of G.MapManager.ActiveResourceSpawners) for (const a of s.ActorList) a.update(dt); }
  draw(renderer, view) {
    for (const s of G.MapManager.resourceSpawners || []) for (const a of s.ActorList) {
      const p = a.transform.position;
      if (p[0] < view.x0 - 2 || p[0] > view.x1 + 2 || p[1] < view.y0 - 2 || p[1] > view.y1 + 3) continue;
      const art=G.MapManager.json?.environmentArt;
      const custom=a.ResourceType===RESOURCE_TYPE.TREE ? art?.[a.IsDead()?'resourceStump':'resourceTree'] :
        a.ResourceType===RESOURCE_TYPE.STONE ? art?.[a.IsDead()?'resourceRubble':'resourceStone'] : null;
      const sp=custom && G.assets.sprite(custom);
      if(sp){renderer.draw({sp,x:p[0],y:p[1],r:1,g:1,b:1,a:1,layer:0,order:0,sortY:p[1]});continue;}
      drawTree(renderer, G.assets, a.go, view);
    }
  }
}
