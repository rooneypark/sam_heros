// MapManager / MapGenerator / MonsterSpawner / FootSwitch port (world maps from re/extract/text/<map>.bytes).
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { TEAM } from '../defs.js';
import { loadJSON } from '../../engine/assets.js';
import { NavMesh } from '../../engine/navmesh.js';
import { GridNav } from '../../engine/gridnav.js';
import { WorldMapView, cellCenter, worldToCell, MAP_CELL } from '../map/WorldMapView.js';
import { TileResolver } from '../map/TileResolver.js';
import { Random } from '../../engine/unitymath.js';
import { ResourceSpawner } from '../world/Resources.js';

const NAVMESH_OF = { World_prologue: 'navmesh_prologue', World_1: 'navmesh_world' };

export class MonsterSpawner {
  constructor(d) {
    Object.assign(this, d);
    this.IncludeTiles = d.IncludeTiles;
    this.ActorList = [];
    this.active = false;
    this.spawning = false;
    this.diffCount = 0;
    this.chunk = chunkOf(d.IncludeTiles[0]);
    this.btTimer = 0;
  }
  /** SetActive(true) -> SpawnAllUnit -> CorAllSpawn */
  setActive(v) {
    if (v === this.active) return;
    this.active = v;
    // story spawners (EventType 1) stop once their EventKey building is complete (UserBuilding.CheckSpawnerComplete)
    if (this.EventType === 1 && G.Buildings?.built.has(this.EventKey)) return;
    if (v && !this.spawned) { this.spawned = true; Timing.RunCoroutine(this._corAllSpawn(), this); }
  }
  *_corAllSpawn() {
    this.diffCount = G.UnitManager.HeroUnits.length - this.BaseCount;
    while (this.ActorList.length < this.MaxCount) {
      const d = this.SpawnerDatas[Random.rangeInt(0, this.SpawnerDatas.length)];
      const p = this.randomPos();
      const pending = G.UnitManager.spawnActor(d.key, d.level, TEAM.ENEMY, p[0], p[1], this);
      this.ActorList.push(null);
      const idx = this.ActorList.length - 1;
      let u = null; pending.then(x => { u = x; });
      while (!u) yield -Infinity;
      this.ActorList[idx] = u;
      u.Spawner = this;
      if (this.diffCount >= 1) {
        u.UnitData.AddStat(0, u.UnitData.GetStat(0) * this.diffCount * 0.5);
        u.UnitData.RestoreHp();
      }
      yield -Infinity;
    }
    // <CorSpawner> loop: every 5 s dead actors leave the list; CorWaitSpawn respawns them after SpawnTime
    for (;;) {
      yield 5;
      if (this.EventType === 1 && G.Buildings?.built.has(this.EventKey)) return;
      for (let i = this.ActorList.length - 1; i >= 0; i--) {
        const u = this.ActorList[i];
        if (!u || u.go.destroyed || u.IsDead()) this.ActorList.splice(i, 1);
      }
      // despawned corpses already left the list: respawn whatever is missing and not yet scheduled
      const removed = this.MaxCount - this.ActorList.length - (this.pending || 0);
      if (removed > 0 && this.spawnTime < 9999) Timing.RunCoroutine(this._corWaitSpawn(removed), this);
    }
  }
  *_corWaitSpawn(count) {
    this.pending = (this.pending || 0) + count;
    yield this.spawnTime;
    this.pending -= count;
    this.diffCount = G.UnitManager.HeroUnits.length - this.BaseCount;
    for (let i = 0; i < count && this.ActorList.length < this.MaxCount; i++) {
      const d = this.SpawnerDatas[Random.rangeInt(0, this.SpawnerDatas.length)];
      const p = this.randomPos();
      let u = null; G.UnitManager.spawnActor(d.key, d.level, TEAM.ENEMY, p[0], p[1], this).then(x => { u = x; });
      while (!u) yield -Infinity;
      u.Spawner = this;
      this.ActorList.push(u);
      if (this.diffCount >= 1) { u.UnitData.AddStat(0, u.UnitData.GetStat(0) * this.diffCount * 0.5); u.UnitData.RestoreHp(); }
      yield -Infinity;
    }
  }
  /** MonsterSpawner.SpawnUnit position: random IncludeTile centre + Random(-cell, cell) */
  randomPos() {
    const t = this.IncludeTiles[Random.rangeInt(0, this.IncludeTiles.length)];
    const c = G.MapManager.cellCenter(t.x, t.y);
    const cs = G.MapManager.GetCellSize();
    const x = c[0] + Random.range(-cs[0], cs[0]), y = c[1] + Random.range(-cs[1], cs[1]);
    const q = G.MapManager.navmesh?.closest(x, y, 6);
    return q ? [q.x, q.y] : [x, y];
  }
  /** CorMonsterSpawnBT: every BT_TIME while active and control */
  tick(dt) {
    if (!this.active || !G.HeroManager.control) return;
    this.btTimer -= dt;
    if (this.btTimer > 0) return;
    this.btTimer += G.UnitManagerStatic.BT_TIME;
    for (const u of this.ActorList) {
      if (!u || !u.go.activeInHierarchy) continue;
      for (let i = u.BuffDatas.length - 1; i >= 0; i--) {
        if (u.BuffDatas[i].BuffTime <= 0) { u.BuffDatas.splice(i, 1); u.ResetBuff(); }
        else u.BuffDatas[i].BuffTime -= G.UnitManagerStatic.BT_TIME;
      }
      u.BT?.run();
    }
  }
}

function chunkOf(t) { return t ? [Math.floor(t.x / 10), Math.floor(t.y / 10)] : [0, 0]; }

export class FootSwitch {
  constructor(d) {
    Object.assign(this, d);
    this.EventKey = d.eventKey; this.DetailKey = d.detailKey; this.Detail2Key = d.detail2Key; this.Detail3Key = d.detail3Key;
    this.p = [d.pos.x, d.pos.y];
    this.rot = 2 * Math.atan2(d.rotation.z, d.rotation.w);
    this.hw = Math.abs(d.scale.x) / 2; this.hh = Math.abs(d.scale.y) / 2;   // BoxCollider2D size (1,1) x scale
    this.start = false; this.done = false;
  }
  overlaps(c, r) {
    const dx = c[0] - this.p[0], dy = c[1] - this.p[1];
    const cs = Math.cos(-this.rot), sn = Math.sin(-this.rot);
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
    const qx = Math.max(-this.hw, Math.min(this.hw, lx)), qy = Math.max(-this.hh, Math.min(this.hh, ly));
    return (lx - qx) ** 2 + (ly - qy) ** 2 <= r * r;
  }
}

export class MapManager {
  constructor() {
    this.CurrentField = 1;      // FIELD_TYPE.WORLD
    this.IsWorld = true;
    this.IsDungeon = false;
    this.BonfireActor = null;
    this.ActiveResourceSpawners = [];
    this.spawners = [];
    this.resourceSpawners = [];
    this.footSwitches = [];
    this.buildings = [];
    this.view = null;
    this.navmesh = null;
    this.mapName = null;
  }
  get WorldMap() { return this; }
  cellCenter(x, y) { const p = cellCenter(x, y, MAP_CELL); return [p.x, p.y]; }
  worldToCell(x, y) { return worldToCell(x, y, MAP_CELL); }
  GetCellSize() { return [MAP_CELL.x, MAP_CELL.y]; }

  /** original maps load from re/extract/text/<name>.bytes; maker maps pass their JSON (json.maker set) and walk on a grid */
  async load(name, json = null) {
    this.mapName = name;
    json = json || JSON.parse(await (await fetch(`/re/extract/text/${name}.bytes`)).text());
    this.json = json;
    const resolver = new TileResolver(G.assets.tiles);
    this.resolver = resolver;
    this.view = new WorldMapView(G.assets, json, resolver);
    await G.assets.preloadSprites(this.view.spriteNames());
    if (json.maker) this.navmesh = new GridNav(json);
    else this.navmesh = new NavMesh(await loadJSON(`navmesh/${NAVMESH_OF[name] || 'navmesh_world'}.json`));
    this.spawners = (json.Spawners || []).filter(d => !d.SpawnerType).map(d => new MonsterSpawner(d));
    this.resourceSpawners = (json.Spawners || []).filter(d => d.SpawnerType === 1).map(d => new ResourceSpawner(d));
    this.ActiveResourceSpawners = [];
    this.footSwitches = (json.FootSwitch || []).map(d => new FootSwitch(d));
    this.buildings = (json.Buildings || []).map(b => ({ ...b, data: Tables.get('TableWorldBuilding', b.key) }));
    this.bonfirePos = json.BonfirePos ? [json.BonfirePos.x, json.BonfirePos.y] : [0, 0];
  }

  /** GetStartPosition: bonfire + Vector3.right + Random(-0.1, 0.1) */
  GetStartPosition() {
    const r = Random.range(-0.1, 0.1);
    return [this.bonfirePos[0] + 1 + r, this.bonfirePos[1] + r];
  }

  /** SetCurrentMapActive(pos): chunks around the leader are active (MapGenerator.SetTargetMapActive) */
  SetCurrentMapActive(pos) {
    const c = this.worldToCell(pos[0], pos[1]);
    const ch = chunkOf(c);
    for (const s of this.spawners) {
      const on = Math.abs(s.chunk[0] - ch[0]) <= 1 && Math.abs(s.chunk[1] - ch[1]) <= 1;
      s.setActive(on);
    }
    for (const s of this.resourceSpawners) {
      const on = Math.abs(s.chunk[0] - ch[0]) <= 1 && Math.abs(s.chunk[1] - ch[1]) <= 1;
      if (on !== s.active) s.setActive(on);
    }
  }

  checkFootSwitches(pos, r) {
    for (const f of this.footSwitches) {
      if (f.done || f.start) continue;
      if (!f.overlaps(pos, r)) continue;
      f.start = true;
      if (G.HeroManager.control) this._startEvent(f);
      else Timing.RunCoroutine((function* (self) { yield { until: () => G.HeroManager.control }; self._startEvent(f); })(this), null);
    }
  }
  /** FootSwitch.StartEvent @0x35f5ffc */
  _startEvent(f) {
    f.done = true;
    G.GameState?.send(f.EventKey, f.DetailKey, f.Detail2Key, f.Detail3Key);
    if (f.index >= 1) G.PrologueManager?.PrologueLog(f.index);
  }

  update(dt) {
    for (const s of this.spawners) s.tick(dt);
  }
}
