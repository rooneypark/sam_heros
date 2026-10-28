// 1장 황건 소탕 실행 (?pack=samguk). docs/planning/scenarios/1장_구현착수_체크리스트.md P0/P1 순서로 연결:
// 새 게임 프로필 저장 → 인트로 → 마을 → 주모 구출·호송 → 장비 합류 → 소년·노인 구출 → 관우 합류 → 나무·다리·광석·부대 훈련
// → 초소 안개 해제 → 관해 → 소굴 → 장각 → 귀환 선택 → 마을 마무리 → 1장 완료.
// 원작 시스템(유저 EXP·고기 드롭·건물 건설·원작 HUD)은 이 모드에서 쓰지 않는다. 엔진 훅은 G.Chapter 로 분기한다.
import { G } from '../../game/registry.js';
import { Tables } from '../../game/data/Tables.js';
import { Timing } from '../../game/core/Timing.js';
import { TEAM } from '../../game/defs.js';
import { UNIT_STAT } from '../../game/data/UnitData.js';
import { MonsterSpawner } from '../../game/managers/MapManager.js';
import { ResourceSpawner } from '../../game/world/Resources.js';
import { resurrectHero } from '../../game/world/Bonfire.js';
import { worldToCell, cellCenter, MAP_CELL } from '../../game/map/WorldMapView.js';
import { BLOCKING_DECO, BLOCKING_FOOTPRINT } from '../../engine/gridnav.js';
import { TERRAIN } from '../original.js';
import { SAMGUK_ROOT, loadSamgukUnits, loadSamgukTiles } from '../samguk.js';
import { ChapterUI } from './ui.js';
import { playIntro } from './introSplash.js';
import { GuanHaiFight, ZhangJiaoFight } from './bosses.js';
import { MAP_PATH, MAP_NAME, TEST, SPEAKERS, LINES, SCENES, MSG, ZONES as Z, QUEST } from './script.js';

const VERSION = 1;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const inRect = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];
const HERO = { liu: 'SG_U0001', guan: 'SG_U0002', zhang: 'SG_U0003' };
const CIVS = {
  jumo: { key: 'SG_N0005', name: '주모', camp: 'west', home: Z.tavern, homeState: 'Work' },
  boy: { key: 'SG_N0002', name: '소년', camp: 'east', home: Z.boyHome },
  elder: { key: 'SG_N0003', name: '노인', camp: 'east', home: Z.elderHome },
};

function newState() {
  return {
    v: VERSION, introDone: false, villageFound: false, dialogs: {}, tut: {},
    civ: { jumo: 'captive', boy: 'captive', elder: 'captive' },
    westFound: false, eastFound: false, guards: { west: false, east: false },
    zhangJoined: false, guanJoined: false, bridge: false, training: 0, outpostOpen: false,
    guanhai: false, lairOpen: false, zhangjiao: false, reward: {}, returnAsked: false, endDone: false,
    heroes: { [HERO.liu]: { lv: TEST.startLevel, exp: 0 } }, party: [HERO.liu], inv: { TREE: 0, STONE: 0 },
  };
}

export class Chapter1 {
  constructor(opts) {
    this.opts = opts;
    this.profile = opts.params.get('profile') || 'main';
    this.key = `samguk.c1.${this.profile}`;
    this.msg = MSG;
    this.paused = false; this.queue = []; this.running = null; this.queued = new Set();
    this.civ = {}; this.npcs = {}; this.walk = null; this.grains = [];
    this.fights = {}; this.guardUnits = { west: [], east: [] }; this.guardKills = { west: 0, east: 0 };
    this.respawns = []; this.lastCombat = -99;
  }

  // ------------------------------------------------------------ save
  load() { try { const s = JSON.parse(localStorage.getItem(this.key) || 'null'); return s && s.v === VERSION ? s : null; } catch { return null; } }
  save() {
    const s = this.s; if (!s) return;
    for (const u of G.UnitManager.HeroUnits) if (s.heroes[u.Key]) s.heroes[u.Key].lv = u.Level + 1;
    s.inv = { TREE: G.Inventory.count('TREE'), STONE: G.Inventory.count('STONE') };
    // 재접속이 회복 수단이 되지 않게: 장수별 HP 비율·전투 불능, 일반 적 재생성 남은 시간
    if (G.UnitManager.HeroUnits.length) s.hp = Object.fromEntries(G.UnitManager.HeroUnits.map(h => [h.Key, h.IsDead() ? 0 : +h.GetHPRate().toFixed(3)]));
    if (this.respawns) s.respawn = this.respawns.filter(r => !r.done && r.sp.c1Id).map(r => ({ id: r.sp.c1Id, key: r.key, level: r.level, left: +(r.at - Timing.time).toFixed(1) }));
    try { localStorage.setItem(this.key, JSON.stringify(s)); } catch { /* storage blocked */ }
  }

  // ------------------------------------------------------------ boot
  async boot() {
    const ui = this.ui = new ChapterUI(this.opts.stage);
    ui.dimEl.style.transition = 'none'; ui.dimEl.style.opacity = 1;
    if (this.opts.params.has('debug')) ui.setTag(`1장 · 프로필 ${this.profile} · 수치는 개발 테스트값`);
    if (this.opts.params.has('new')) try { localStorage.removeItem(this.key); } catch { /* */ }
    G.UI.hud = null;
    const dbg = document.getElementById('debug'); if (dbg && !this.opts.params.has('debug')) dbg.style.display = 'none';   // 출시 화면: 디버그 글자 숨김
    G.User.isPrologue = false; G.User.instantInvincibility = false; G.User.heroMax = 3;
    await loadSamgukUnits(G.assets);
    const pack = await loadSamgukTiles(G.assets);
    for (const b of pack.blocking) { BLOCKING_DECO.add(b.id); if (b.footprint) BLOCKING_FOOTPRINT.set(b.id, b.footprint); }
    try {
      const uj = await (await fetch(SAMGUK_ROOT + 'content/samguk/units.json')).json();
      this.portraits = Object.fromEntries(uj.units.map(u => [u.id, u.art?.portrait ? SAMGUK_ROOT + u.art.portrait : u.art?.icon ? SAMGUK_ROOT + u.art.icon : null]));
    } catch { this.portraits = {}; }
    this.mapJson = await (await fetch(SAMGUK_ROOT + MAP_PATH)).json();
    // pack art first: the party never shows as an original hero (상세명세 인트로 로딩)
    await Promise.all(Object.values(HERO).concat(Object.values(CIVS).map(c => c.key), ['SG_N0006', 'SG_N0004', 'SG_M0003', 'SG_M0004'])
      .map(k => Tables.unit(k)?.artReady));

    const saved = this.load();
    this.fresh = !saved;
    const s = this.s = saved || newState();
    // 재접속: 동행 중이던 주민은 해당 포로터 안전 지점 대기 (상세명세 실패·재개)
    for (const k of Object.keys(s.civ)) if (s.civ[k] === 'following') s.civ[k] = 'waiting';
    G.Inventory.items.clear();
    G.Inventory.add('TREE', s.inv.TREE || 0); G.Inventory.add('STONE', s.inv.STONE || 0);
    G.Chapter = this;                       // engine hooks (stats, no field revive) apply while the world loads

    const safe = this.safePoint();
    const doc = { ...this.mapJson, Buildings: [], npcs: [], BonfirePos: { x: safe[0] - 1, y: safe[1] } };
    const party = s.party.map(k => ({ key: k, level: (s.heroes[k]?.lv || 1) - 1 }));
    await G.loadWorld(MAP_NAME, party, doc);
    G.UnitManager.WarpHero(safe[0], safe[1]);
    G.CameraManager.position = [...safe];
    // saved HP / 전투 불능 (구버전 저장에 기록이 없으면 전회복 상태 그대로 = 마을 1회 복귀로 이행)
    for (const h of G.UnitManager.HeroUnits) {
      const r = s.hp?.[h.Key];
      if (r === undefined) continue;
      if (r <= 0) h.Damage(h.TotalStat().CurrentHP + 1, false, 0, false, true, false);
      else h.UnitData.CurrentHP = Math.max(1, Math.round(h.UnitData.GetStat(UNIT_STAT.HP) * Math.min(1, r)));
    }

    await this.spawnWorld();
    G.Chapter = this;
    window.__c1 = this;
    this.lastSave = 0;
    // title intro (개발 시안, 디자이너 최종본 전까지). ?nosplash skips it (tests)
    if (!this.opts.params.has('nosplash')) await playIntro(this.opts.stage, { root: SAMGUK_ROOT });
    // not awaited: the frame loop starts while the title / dialog wait for taps
    if (!s.introDone) this.intro();
    else { G.HeroManager.Control = true; ui.dim(0, 0.5); ui.toast(`이어하기 — ${this.objectiveText().text}`); }
  }

  safePoint() { return this.s.villageFound ? Z.villageSafe : Z.startSafe; }

  async spawnWorld() {
    const s = this.s, mj = this.mapJson;
    // resources: maker.trees (나무) + map STONE spawners (MapManager)
    const tree = TERRAIN.find(x => x.id === 'tree');
    for (const t of mj.maker?.trees || []) {
      const sp = new ResourceSpawner({ SpawnerType: 1, IncludeTiles: [worldToCell(t.x, t.y, MAP_CELL)], SpawnerDatas: [{ key: tree.resource, level: tree.level }], MaxCount: 1 });
      await sp.SpawnActor();
      const a = sp.ActorList[0]; if (!a) continue;
      a.go.transform.lp = [t.x, t.y, 0];
      sp.started = true; Timing.RunCoroutine(sp.CorSpawner(), sp);   // rebirth loop (MaxCount already met)
      G.MapManager.resourceSpawners.push(sp);
    }
    // enemies: camp guards (지정 경비, no respawn) / bosses (scripted) / everything else (respawning field enemies)
    const mapSpawners = [...G.MapManager.spawners];
    for (const [ui, u] of (mj.maker?.units || []).entries()) {
      if (u.team === 'ally') continue;
      const pos = [u.x, u.y];
      if (u.key === 'SG_M0003' || u.key === 'SG_M0004') { await this.spawnBoss(u); continue; }
      const camp = dist(pos, Z.west.center) <= Z.west.guardR ? 'west' : dist(pos, Z.east.center) <= Z.east.guardR ? 'east' : null;
      if (camp) { if (!s.guards[camp]) this.guardUnits[camp].push(await this.spawnFixed(u, camp)); continue; }
      // 보스 구역 안의 일반 적: 보스전 전에 치르는 접근 전투 (재생성 없음 → 보스전과 겹치지 않음)
      const arena = ['guanhai', 'zhangjiao'].some(b => !s[b] && dist(pos, Z[b].pos) <= Z[b].arena);
      // respawn is scheduled by the chapter from the death time (spawnTime 9999 turns the spawner's own respawn off)
      const sp = new MonsterSpawner({ IncludeTiles: [worldToCell(u.x, u.y, MAP_CELL)], SpawnerDatas: [{ key: u.key, level: u.level - 1 }],
        MaxCount: 1, BaseCount: 999, spawnTime: 9999, EventType: 0 });
      sp.c1Normal = !arena; sp.c1Pos = pos; sp.c1Id = 'u' + ui;
      G.MapManager.spawners.push(sp);
    }
    // the map's own field spawners: same respawn rule, no hidden party-size HP bonus (BaseCount)
    mapSpawners.forEach((sp, i) => { sp.spawnTime = 9999; sp.BaseCount = 999; sp.c1Normal = true; sp.c1Pos = null; sp.c1Id = 'm' + i; });
    // respawns pending at the last save resume with their remaining game time (no instant refill on reconnect)
    for (const r of s.respawn || []) {
      const sp = G.MapManager.spawners.find(x => x.c1Id === r.id);
      if (!sp?.c1Normal) continue;
      sp.MaxCount = Math.max(0, sp.MaxCount - 1);
      this.respawns.push({ sp, key: r.key, level: r.level, at: Timing.time + Math.max(0, r.left) });
    }
    // fog: 초소 (다리 복구 + 기초 훈련) / 소굴 (관해 격파)
    this.fogTiles = {};
    for (const k of ['BRIDGE', 'LAIRGATE']) this.fogTiles[k] = this.building(k)?.IncludeTiles || [];
    if (!s.outpostOpen) for (const t of this.fogTiles.BRIDGE) G.Fog.add(t.x, t.y);
    if (!s.lairOpen) for (const t of this.fogTiles.LAIRGATE) G.Fog.add(t.x, t.y);
    // villagers: 대장장이 (맵 npcs), 마을 대표 (노인 아트 별도 인스턴스), 훈련 담당 병사, 구출 주민
    for (const n of mj.npcs || []) if (n.key !== 'SG_N0005') await G.Npc.spawn(n.key, n.x, n.y, n.animation || 'Idle');
    this.npcs.chief = await G.Npc.spawn('SG_N0003', Z.chief[0], Z.chief[1], 'Idle');
    this.npcs.soldier = await G.Npc.spawn('SG_N0006', Z.soldier[0], Z.soldier[1], 'Work');
    for (const [id, c] of Object.entries(CIVS)) await this.spawnCiv(id);
    if (s.civ.jumo === 'arrived' && !s.zhangJoined) await this.spawnJoiner('zhang');
    if (s.civ.boy === 'arrived' && s.civ.elder === 'arrived' && !s.guanJoined) await this.spawnJoiner('guan');
  }
  async spawnFixed(u, camp) {
    const sp = new MonsterSpawner({ IncludeTiles: [worldToCell(u.x, u.y, MAP_CELL)], SpawnerDatas: [{ key: u.key, level: u.level - 1 }],
      MaxCount: 1, BaseCount: 999, spawnTime: 9999, EventType: 0 });
    sp.spawned = true; sp.active = true; sp.setActive = () => {};
    G.MapManager.spawners.push(sp);
    const a = await G.UnitManager.spawnActor(u.key, u.level - 1, TEAM.ENEMY, u.x, u.y, sp);
    a.Spawner = sp; sp.ActorList.push(a); a.c1Camp = camp;
    return a;
  }
  async spawnBoss(u) {
    const id = u.key === 'SG_M0003' ? 'guanhai' : 'zhangjiao';
    if (this.s[id]) return;                                          // 처치한 필수 보스는 재생성하지 않음
    const a = await this.spawnFixed(u, null);
    const st = TEST.boss[u.key];
    if (st) {
      a.UnitData.AddStat(UNIT_STAT.HP, st.hp - a.UnitData.GetStat(UNIT_STAT.HP));
      a.UnitData.AddStat(UNIT_STAT.DAMAGE, st.dmg - a.UnitData.GetStat(UNIT_STAT.DAMAGE));
      a.UnitData.RestoreHp();
    }
    const cfg = { ...Z[id], pos: [u.x, u.y] };
    const F = id === 'guanhai' ? GuanHaiFight : ZhangJiaoFight;
    this.fights[id] = new F(this, a, cfg);
    a.c1Boss = id;
  }
  async spawnCiv(id) {
    const c = CIVS[id], st = this.s.civ[id];
    const pos = st === 'arrived' ? c.home : st === 'waiting' ? Z[c.camp].safe : this.captivePos(id);
    const npc = await G.Npc.spawn(c.key, pos[0], pos[1], st === 'arrived' ? (c.homeState || 'Idle') : 'Idle');
    if (npc) { npc.agent.speed = id === 'elder' ? 2.6 : 3.2; npc.agent.radius = 0.25; }
    this.civ[id] = { id, ...c, npc, stuck: 0, last: [...pos] };
  }
  captivePos(id) { return id === 'jumo' ? Z.west.captive : Z.east.captives[id]; }
  async spawnJoiner(which) {
    const key = which === 'zhang' ? HERO.zhang : HERO.guan;
    const spot = which === 'zhang' ? Z.zhangSpot : Z.guanSpot;
    if (this.npcs[which]) return;
    this.npcs[which] = await G.Npc.spawn(key, spot[0], spot[1], 'Idle');
  }

  // ------------------------------------------------------------ intro (상세명세 인트로 표)
  async intro() {
    const ui = this.ui;
    G.HeroManager.Control = false;
    await ui.title('1장', '황건 소탕', 1.5);
    await ui.dim(0, 0.5);
    await this.talk('intro');
    this.s.introDone = true; this.save();
    G.HeroManager.Control = true;
    this.moveHintFrom = [...G.HeroManager.heroCenterPos];
    ui.hint(MSG.move);
  }

  // ------------------------------------------------------------ dialog
  lineText(id) { return LINES[id]?.[1] || id; }
  lineOnce(id) { if (this.s.dialogs[id]) return false; this.s.dialogs[id] = true; return true; }
  tutorialOnce(id) { if (this.s.tut[id]) return false; this.s.tut[id] = true; return true; }
  /** play a scene once (C1_DIALOG_DONE). Game time stops; skip ends it with the same completion. */
  async talk(scene, force = false) {
    if (this.s.dialogs[scene] && !force) return 'done';
    const lines = (SCENES[scene] || [scene]).map(id => {
      const [sp, text] = LINES[id]; const who = SPEAKERS[sp];
      return { id, name: who.name, text, portrait: who.unit ? this.portraits[who.unit] : null };
    });
    const was = this.paused;
    this.paused = true;
    G.UI.releaseJoystick(); this.walk = null;
    const r = this.ui.auto ? 'auto' : await this.ui.dialog(lines);
    this.paused = was;
    this.s.dialogs[scene] = true; this.save();
    return r;
  }
  /** camera shows a spot with the game stopped (the hero group point follows the camera, so the party must not run), then returns */
  async showSpot(pos, scene) {
    const was = this.paused, back = [...G.HeroManager.transform.position], cam = G.CameraManager;
    this.paused = true;
    G.UI.releaseJoystick(); this.walk = null;
    if (!this.ui.auto) await cam.CameraMoveZoom(pos, cam.size, 0.7); else cam.position = [...pos];
    if (scene) await this.talk(scene);
    if (!this.ui.auto) await cam.CameraMoveZoom(back, cam.size, 0.5); else cam.position = back;
    G.HeroManager.transform.position = back;
    this.paused = was;
  }
  /** one mandatory event at a time (전멸 복귀 → 저장 → 필수 대화 1개 → 목표 갱신) */
  enqueue(key, fn) { if (this.queued.has(key)) return; this.queued.add(key); this.queue.push({ key, fn }); }
  async runQueue() {
    if (this.running || !this.queue.length || this.wiping || this.ui.busy) return;
    const ev = this.queue.shift();
    this.running = ev.key;
    try { await ev.fn(); } catch (e) { console.error('chapter event', ev.key, e); }
    this.running = null;
    this.queued.delete(ev.key);
  }

  // ------------------------------------------------------------ helpers
  heroes() { return G.UnitManager.HeroUnits; }
  alive() { return this.heroes().filter(h => !h.IsDead()); }
  allAlive() { return this.heroes().length > 0 && this.heroes().every(h => !h.IsDead()); }
  center() { return this.alive().length ? G.HeroManager.GetHeroCenterPos() : G.HeroManager.transform.position; }
  enemiesNear(p, r) { return G.UnitManager.monsters.some(m => !m.IsDead() && !m._invuln && dist(m.transform.position, p) <= r); }
  /** living normal enemies inside a boss arena (cleared before the boss fight starts) */
  arenaEnemies(f) { return G.UnitManager.monsters.filter(m => !m.IsDead() && !m.c1Boss && dist(m.transform.position, f.home) <= f.cfg.arena).length; }
  fighting() { return Object.values(this.fights).some(f => f.state === 'ready' || f.state === 'fight'); }
  heroName(k) { return Tables.unit(k)?.name || k; }

  // ------------------------------------------------------------ EXP (전투 EXP·공동 수령·자동 레벨업)
  expRate(u) { const h = this.s.heroes[u.Key]; if (!h) return 0; return Math.min(1, h.exp / TEST.needExp(u.Level + 1)); }
  onEnemyDead(u) {
    if (u.c1Camp) this.guardKills[u.c1Camp]++;
    if (u.Spawner?.c1Normal) this.respawns.push({ sp: u.Spawner, key: u.Key, level: u.Level, at: Timing.time + TEST.normalRespawnSec });
    const boss = u.c1Boss;
    if (boss) {
      this.fights[boss]?.onDead();
      this.s[boss] = true;
      if (boss === 'guanhai') this.openLair();
      this.save();
    }
    const lv = u.Level + 1;
    let amount = TEST.expPerKill(lv) * (boss ? TEST.bossExpMul : 1);
    if (boss) { if (this.s.reward[boss]) amount = 0; this.s.reward[boss] = true; }   // C1_BOSS_REWARD_* 중복 방지
    const got = this.heroes().filter(h => TEST.deadGetsExp || !h.IsDead());
    if (!got.length || amount <= 0) return;
    const each = TEST.expSplit === 'split' ? Math.max(1, Math.round(amount / got.length)) : amount;
    const p = u.transform.position;
    for (const h of got) {
      for (let i = 0; i < 3; i++) this.grains.push({ x: p[0] + (Math.random() - 0.5) * 0.6, y: p[1] + 0.4 + Math.random() * 0.4, h, t: -i * 0.08, n: i === 2 ? each : 0 });
    }
    if (!this.s.tut.firstKill) { this.s.tut.firstKill = true; this.ui.toast(MSG.firstKill); }
  }
  addExp(h, n) {
    const d = this.s.heroes[h.Key]; if (!d || !n) return;
    d.exp += n;
    let up = false;
    while (h.Level + 1 < TEST.maxLevel && d.exp >= TEST.needExp(h.Level + 1)) {
      d.exp -= TEST.needExp(h.Level + 1);
      h.Level++; up = true;
    }
    if (up) {
      this.refreshStats(h);
      d.lv = h.Level + 1;
      G.WorldUI?.numText(h, 'LEVEL UP!', [1, 0.86, 0.3, 1], 1, 1);
      G.Sound?.play('SOUND_ETC_0010');
      if (!this.s.tut.firstLevel) { this.s.tut.firstLevel = true; this.ui.toast(MSG.firstLevel); }
      this.save();
    }
  }
  refreshStats(h) {
    const rate = h.IsDead() ? 1 : h.UnitData.CurrentHP / Math.max(1, h.UnitData.GetStat(UNIT_STAT.HP));
    h.SetLvStat();
    h.UnitData.RestoreHp();
    if (!h.IsDead()) h.UnitData.CurrentHP = Math.max(1, Math.round(h.UnitData.GetStat(UNIT_STAT.HP) * rate));
  }
  /** SetLvStat hook (enemy): 삼국 전용 일반 적 능력치. 최종값으로 덮어써 원작 성장(GROWTH_TO_BASE 등)이 남지 않게 한다 */
  applyEnemyStats(u) {
    const e = TEST.enemies[u.Key]; if (!e) return;
    const L = u.Level + 1, d = u.UnitData;
    d.AddStat(UNIT_STAT.HP, e.hp * TEST.enemyHpCurve(L) - d.GetStat(UNIT_STAT.HP));
    d.AddStat(UNIT_STAT.DAMAGE, e.dmg * TEST.enemyDmgCurve(L) - d.GetStat(UNIT_STAT.DAMAGE));
    if (e.speed) d.AddStat(UNIT_STAT.SPEED, e.speed - d.GetStat(UNIT_STAT.SPEED));
  }
  inCombat() { return Timing.time - (this.lastCombat ?? -99) <= TEST.combatWindow; }
  /** skill selection gate: 치유는 전투 중 + 체력 임계치, 버프는 전투 중에만 (CHAPTER1_BALANCE.md 첫 검증안) */
  skillAllowed(u, s) {
    const g = u._tableSkillGroupData; if (!g || s.key === g.defaultSkill || s.key === g.gatheringSkill) return true;
    if (!this.inCombat()) return false;
    if (u.Key !== HERO.liu) return true;
    const rates = this.alive().map(h => h.GetHPRate());
    if (s.key === g.skillA) return rates.some(r => r <= TEST.heal.single);
    if (s.key === g.skillB) return rates.some(r => r <= TEST.heal.allAny) || rates.filter(r => r <= TEST.heal.allTwo).length >= 2;
    return true;
  }
  /** SetLvStat hook: 부대 공통 훈련 효과 */
  applyStats(u) {
    let dmg = 0, hp = 0;
    for (let i = 0; i < (this.s?.training || 0); i++) { dmg += TEST.training[i].damage; hp += TEST.training[i].hp; }
    if (dmg) u.UnitData.AddStat(UNIT_STAT.DAMAGE, u.UnitData.GetStat(UNIT_STAT.DAMAGE) * dmg);
    if (hp) u.UnitData.AddStat(UNIT_STAT.HP, u.UnitData.GetStat(UNIT_STAT.HP) * hp);
  }

  // ------------------------------------------------------------ recruitment
  async join(key) {
    const s = this.s;
    if (s.party.includes(key)) return;
    const lead = this.heroes().find(h => h.Key === HERO.liu);
    const lv = TEST.joinLevel === 'leader' && lead ? lead.Level + 1 : TEST.startLevel;
    s.heroes[key] = { lv, exp: 0 };
    s.party.push(key);
    if (key === HERO.zhang) s.zhangJoined = true; else s.guanJoined = true;
    this.save();
    const which = key === HERO.zhang ? 'zhang' : 'guan';
    const npc = this.npcs[which];
    const at = npc ? npc.go.transform.position : this.center();
    if (npc) { G.Npc.despawn(npc); this.npcs[which] = null; }
    const u = await G.UnitManager.CreateHero(key, lv - 1);
    u.WarpHero(at[0], at[1]);
  }

  // ------------------------------------------------------------ objective (매 프레임 상태에서 재평가)
  guardCount(camp) { return { k: Math.min(this.guardKills[camp], this.guardUnits[camp].length), n: this.guardUnits[camp].length }; }
  objectiveText() {
    const s = this.s, inv = { t: G.Inventory.count('TREE'), st: G.Inventory.count('STONE') };
    if (!s.villageFound) return { q: QUEST.s01, text: '숲길을 따라 마을로 가기' };
    if (!s.dialogs.chief) return { q: QUEST.s02, text: '마을 대표와 이야기하기', target: 'chief' };
    if (s.civ.jumo !== 'arrived') {
      if (s.civ.jumo === 'captive') {
        if (!s.westFound) return { q: QUEST.s03, text: '서쪽 포로터로 가기', target: 'west' };
        if (!s.guards.west) { const g = this.guardCount('west'); return { q: QUEST.s03, text: `주민을 지키는 황건적 처치 ${g.k}/${g.n}`, target: 'west' }; }
        return { q: QUEST.s03, text: '붙잡힌 주모 풀어주기', target: 'civ:jumo' };
      }
      if (s.civ.jumo === 'waiting') return { q: QUEST.s03, text: '기다리는 주모와 다시 만나기', target: 'civ:jumo' };
      return { q: QUEST.s03, text: '주모를 마을로 데려가기 0/1', target: 'village' };
    }
    if (!s.zhangJoined) return { q: QUEST.s04, text: '장비와 이야기하기', target: 'zhang' };
    const east = ['boy', 'elder'];
    const home = east.filter(k => s.civ[k] === 'arrived').length;
    if (home < 2) {
      const freed = east.filter(k => s.civ[k] !== 'captive').length;
      if (!s.eastFound) return { q: QUEST.s05, text: '장비와 동쪽 포로터로 가기', target: 'east' };
      if (!s.guards.east) { const g = this.guardCount('east'); return { q: QUEST.s05, text: `동쪽 포로터의 황건적 처치 ${g.k}/${g.n}`, target: 'east' }; }
      if (freed < 2) return { q: QUEST.s05, text: `붙잡힌 주민 풀어주기 ${freed}/2`, target: 'east' };
      if (east.some(k => s.civ[k] === 'waiting')) return { q: QUEST.s05, text: `기다리는 주민과 다시 만나기 ${home}/2`, target: 'east' };
      return { q: QUEST.s05, text: `주민을 마을로 데려가기 ${home}/2`, target: 'village' };
    }
    if (!s.guanJoined) return { q: QUEST.s06, text: '관우와 이야기하기', target: 'guan' };
    if (!s.dialogs.prep) return { q: QUEST.s07, text: '마을 대표와 이야기하기', target: 'chief' };
    if (!s.bridge) {
      if (inv.t < TEST.bridgeTree) return { q: QUEST.s07, text: `다리 복구에 필요한 나무 모으기 ${inv.t}/${TEST.bridgeTree}`, target: 'tree' };
      return { q: QUEST.s07, text: '나무로 낡은 다리 복구하기', target: 'bridge' };
    }
    if (s.training < 1) {
      const c = TEST.training[0].cost;
      if (inv.st < c) return { q: QUEST.s07, text: `기초 훈련에 필요한 광석 모으기 ${inv.st}/${c}`, target: 'stone' };
      return { q: QUEST.s07, text: '무기고 앞 병사에게 부대 기초 훈련 받기', target: 'soldier' };
    }
    if (!s.guanhai) {
      const f = this.fights.guanhai;
      if (f && (f.state === 'ready' || f.state === 'fight')) return { q: QUEST.s08, text: '관해 처치하기' };
      return { q: QUEST.s07, text: '황건군 초소로 이동하기', target: 'guanhai' };
    }
    if (!s.zhangjiao) {
      const f = this.fights.zhangjiao;
      if (f && (f.state === 'ready' || f.state === 'fight')) return { q: QUEST.s10, text: '장각 처치하기' };
      return { q: QUEST.s09, text: '황건 소굴로 이동하기', target: 'zhangjiao' };
    }
    if (!s.endDone) return { q: QUEST.end, text: '마을로 돌아가기', target: 'village' };
    return { q: QUEST.done, text: '1장 황건 소탕 완료', done: true };
  }

  // ------------------------------------------------------------ per-frame
  update(dt) {
    if (!this.s) return;
    const s = this.s, ui = this.ui;
    if (!this.paused) {
      for (const f of Object.values(this.fights)) f.update(dt);
      this.updateGrains(dt);
      this.updateRespawns();
      this.updateCivs(dt);
      this.updateWalk();
      this.checkProgress();
    }
    this.runQueue();
    const o = this.objectiveText();
    ui.objective(o.q, o.text, o.done);
    ui.resources(G.Inventory.count('TREE'), G.Inventory.count('STONE'));
    const bf = Object.values(this.fights).find(f => f.state === 'ready' || f.state === 'fight');
    ui.boss(bf ? this.heroName(bf.u.Key) : null, bf ? bf.u.GetHPRate() : 0);
    if (this.moveHintFrom && dist(G.HeroManager.heroCenterPos, this.moveHintFrom) > 2) { this.moveHintFrom = null; ui.hint(null); }
    // 저체력 안내 1회 (회복해서 다시 넉넉해지면 다음 출전에 다시 안내)
    const rates = this.alive().map(h => h.GetHPRate());
    if (rates.some(r => r <= TEST.lowHp)) { if (!this.lowHpShown) { this.lowHpShown = true; ui.toast(MSG.lowHp); } }
    else if (rates.every(r => r > 0.6) && !G.HeroManager.DeadHeroes.length) this.lowHpShown = false;
    // first guidance for the preparation targets
    if (o.target === 'tree' && this.tutorialOnce('tree')) ui.toast(MSG.treeHint);
    if (o.target === 'stone' && this.tutorialOnce('stone')) ui.toast(MSG.stoneHint);
    this.lastSave += dt;
    if (this.lastSave > 5) { this.lastSave = 0; this.save(); }
  }

  checkProgress() {
    const s = this.s, c = this.center();
    if (this.wiping) return;
    // 장면 01 → 02
    if (!s.villageFound && inRect(c, Z.villageEnter)) {
      s.villageFound = true; this.save();
      this.ui.toast(MSG.arrivedVillage);
      if (this.tutorialOnce('bonfire')) setTimeout(() => this.ui.toast(MSG.bonfire), 2700);
    }
    // 발견 대화 (경비 전투 전에 예약)
    if (s.dialogs.chief && s.civ.jumo === 'captive' && !s.westFound && dist(c, Z.west.center) <= Z.west.approach)
      this.enqueue('west_found', async () => { await this.talk('west_found'); s.westFound = true; this.save(); });
    if (s.zhangJoined && !s.eastFound && dist(c, Z.east.center) <= Z.east.approach)
      this.enqueue('east_found', async () => { await this.talk('east_found'); s.eastFound = true; this.save(); });
    for (const camp of ['west', 'east']) {
      if (!s.guards[camp] && this.guardUnits[camp].length && this.guardKills[camp] >= this.guardUnits[camp].length) { s.guards[camp] = true; this.save(); }
    }
    // 장비 합류: 주모 도착 후
    if (s.civ.jumo === 'arrived' && !s.zhangJoined) {
      this.enqueue('zhang_join', async () => {
        await this.spawnJoiner('zhang');
        await this.approachNpc(this.npcs.zhang);
        await this.talk('zhang_join');
        await this.join(HERO.zhang);
        this.ui.toast(MSG.zhangJoined);
      });
    }
    // 관우 합류: 소년·노인 모두 도착 후
    if (s.civ.boy === 'arrived' && s.civ.elder === 'arrived' && !s.guanJoined) {
      this.enqueue('guan_join', async () => {
        await this.talk('east_home');
        this.ui.toast(MSG.eastBack);
        await this.spawnJoiner('guan');
        await this.approachNpc(this.npcs.guan);
        await this.talk('guan_join');
        await this.join(HERO.guan);
        this.ui.toast(MSG.guanJoined);
      });
    }
    if (s.guanJoined && !s.dialogs.prep && !this.queued.has('guan_join'))
      this.enqueue('prep', async () => { await this.talk('prep'); this.ui.toast(MSG.grow); });
    // 다리 + 기초 훈련 → 초소 개방
    if (s.bridge && s.training >= 1 && !s.outpostOpen)
      this.enqueue('outpost', async () => {
        s.outpostOpen = true; this.save();
        this.removeFog(this.fogTiles.BRIDGE);
        await this.showSpot([Z.guanhai.pos[0], Z.guanhai.pos[1] - 6], 'outpost_open');
        this.ui.toast(MSG.outpostOpen);
      });
    // 관해
    const gh = this.fights.guanhai;
    if (gh && s.outpostOpen && !s.guanhai && gh.state === 'idle' && dist(c, gh.home) <= Z.guanhai.approach && this.allAlive() && !this.arenaEnemies(gh))
      this.enqueue('guanhai_meet', async () => {
        if (!s.dialogs.guanhai_meet) await this.showSpot(gh.home, 'guanhai_meet');
        gh.start();
      });
    if (s.guanhai && !s.dialogs.guanhai_down && !this.fighting() && this.allAlive())
      this.enqueue('guanhai_down', async () => { this.ui.toast(MSG.guanhaiDown); await this.talk('guanhai_down'); });
    if (s.guanhai && s.dialogs.guanhai_down && !s.dialogs.lair && this.allAlive() && !this.enemiesNear(c, 6))
      this.enqueue('lair', () => this.talk('lair'));
    // 장각
    const zj = this.fights.zhangjiao;
    if (zj && s.lairOpen && !s.zhangjiao && zj.state === 'idle' && dist(c, zj.home) <= Z.zhangjiao.approach && this.allAlive() && !this.arenaEnemies(zj))
      this.enqueue('zhangjiao_meet', async () => {
        if (!s.dialogs.zhangjiao_meet) await this.showSpot(zj.home, 'zhangjiao_meet');
        zj.start();
      });
    if (s.zhangjiao && !s.dialogs.zhangjiao_down && !this.fighting() && this.allAlive())
      this.enqueue('zhangjiao_down', async () => {
        this.ui.toast(MSG.zhangjiaoDown);
        await this.talk('zhangjiao_down');
      });
    if (s.zhangjiao && s.dialogs.zhangjiao_down && !s.returnAsked && !inRect(c, Z.village))
      this.enqueue('return_choice', async () => {
        this.paused = true;
        const i = this.ui.auto ? 0 : await this.ui.choice('마을로 돌아갈까요?', ['돌아가기', '조금 더 둘러보기']);
        this.paused = false;
        s.returnAsked = true; this.save();
        if (i === 0) await this.warpParty(Z.villageSafe);
      });
    if (s.zhangjiao && s.dialogs.zhangjiao_down && !s.endDone && inRect(c, Z.village) && this.allAlive())
      this.enqueue('ending', async () => {
        await this.talk('ending');
        s.endDone = true; this.save();
        this.paused = true;
        if (!this.ui.auto) await this.ui.complete('1장 황건 소탕 완료', '마을 사람들을 구하고 황건적의 소굴을 소탕했어요.', '마을로');
        this.paused = false;
      });
  }

  async approachNpc(npc) {
    if (!npc) return;
    // 합류 연출: 마을 길에서 다가온다 (최대 3초)
    const c = this.center();
    npc.agent.isStopped = false; npc.agent.setDestination(c[0] + 1.2, c[1]);
    for (let t = 0; t < 3 && dist(npc.go.transform.position, this.center()) > 1.8; t += 0.1) await new Promise(r => setTimeout(r, 100));
    npc.agent.isStopped = true;
  }

  openLair() {
    if (this.s.lairOpen) return;
    this.s.lairOpen = true;
    this.removeFog(this.fogTiles.LAIRGATE);
  }
  removeFog(tiles) {
    const fog = G.Fog, list = [...tiles];
    const c = this.center();
    list.sort((a, b) => { const p = cellCenter(a.x, a.y, MAP_CELL), q = cellCenter(b.x, b.y, MAP_CELL); return Math.hypot(p.x - c[0], p.y - c[1]) - Math.hypot(q.x - c[0], q.y - c[1]); });
    Timing.RunCoroutine((function* () {
      for (let i = 0; i < list.length; i += 60) { for (const t of list.slice(i, i + 60)) fog.cells.delete(fog.key(t.x, t.y)); yield -Infinity; }
    })(), null);
  }

  // ------------------------------------------------------------ field enemy respawn (사망 시점 + 20초, 마을·부대·주민 근처 제외)
  spawnSafe(p) {
    if (inRect(p, [Z.village[0] - 3, Z.village[1] - 3, Z.village[2] + 3, Z.village[3] + 3])) return false;
    if (G.Fog.blocks(p[0], p[1])) return false;
    if (dist(p, this.center()) < TEST.respawnSafeDist) return false;
    for (const v of Object.values(this.civ)) if (this.s.civ[v.id] === 'following' && v.npc && dist(p, v.npc.go.transform.position) < TEST.respawnSafeDist) return false;
    return true;
  }
  updateRespawns() {
    const now = Timing.time;
    for (const r of this.respawns) {
      if (r.busy || now < r.at) continue;
      const sp = r.sp;
      let p = null;
      for (let k = 0; k < 6 && !p; k++) {
        let q = sp.c1Pos ? [sp.c1Pos[0] + (k ? (Math.random() - 0.5) * 4 : 0), sp.c1Pos[1] + (k ? (Math.random() - 0.5) * 4 : 0)] : sp.randomPos();
        const c = G.MapManager.navmesh.closest(q[0], q[1], 3); if (c) q = [c.x, c.y];
        if (this.spawnSafe(q)) p = q;
      }
      if (!p) { r.at = now + TEST.respawnRetrySec; continue; }      // 지연: 재생성 횟수는 누적되지 않음
      r.busy = true;
      G.UnitManager.spawnActor(r.key, r.level, TEAM.ENEMY, p[0], p[1], sp).then(a => {
        a.Spawner = sp; sp.ActorList.push(a); r.done = true;
      });
    }
    this.respawns = this.respawns.filter(r => !r.done);
  }

  // ------------------------------------------------------------ civilians (호송)
  updateCivs(dt) {
    const s = this.s, c = this.center();
    const following = Object.values(this.civ).filter(v => s.civ[v.id] === 'following');
    following.forEach((v, i) => {
      const n = v.npc; if (!n) return;
      const p = n.go.transform.position;
      // arrival
      if (inRect(p, Z.village)) {
        s.civ[v.id] = 'arrived'; this.save();
        n.agent.isStopped = false; n.agent.setDestination(v.home[0], v.home[1]);
        n.restingState = v.homeState || 'Idle';
        if (v.id === 'jumo') this.enqueue('jumo_home', async () => { await this.talk('jumo_home'); this.ui.toast(MSG.jumoBack); });
        else if (['boy', 'elder'].some(k => s.civ[k] !== 'arrived')) this.ui.toast(MSG.partial);
        return;
      }
      // 전투 중 잠시 멈춤
      if (this.enemiesNear(c, 6) || this.enemiesNear(p, 4)) { n.agent.isStopped = true; v.stuck = 0; return; }
      // 부대 후방
      const lead = G.HeroManager.transform.position;
      let bx = c[0] - lead[0], by = c[1] - lead[1]; const L = Math.hypot(bx, by);
      if (L > 0.3) { bx /= L; by /= L; } else { bx = 0; by = -1; }
      const side = (i - (following.length - 1) / 2) * 0.9;
      const tx = c[0] + bx * 1.6 - by * side, ty = c[1] + by * 1.6 + bx * side;
      const d = dist(p, c);
      if (d > 22) { this.warpBehind(n, c, bx, by); v.stuck = 0; return; }
      if (d > 1.8) { n.agent.isStopped = false; n.agent.setDestination(tx, ty); }
      else n.agent.isStopped = true;
      // 막힘 복구: 4초간 거의 못 움직이면 부대 후방으로 재배치
      const moved = dist(p, v.last); v.last = [...p];
      v.stuck = d > 3 && moved < 0.02 ? v.stuck + dt : 0;
      if (v.stuck > 4) { this.warpBehind(n, c, bx, by); v.stuck = 0; }
    });
  }
  warpBehind(n, c, bx, by) {
    const nav = G.MapManager.navmesh;
    for (const k of [1.5, 1, 2.5, 0.5]) {
      const x = c[0] + bx * k, y = c[1] + by * k;
      const q = nav.closest(x, y, 3);
      if (q && !G.Fog.blocks(q.x, q.y)) { n.agent.warp(q.x, q.y); return; }
    }
    n.agent.warp(c[0], c[1]);
  }
  freeCiv(id) {
    const s = this.s, v = this.civ[id];
    if (s.civ[id] === 'captive') {
      const camp = CIVS[id].camp;
      if (!s.guards[camp]) { this.ui.toast(MSG.guardsFirst); return; }
      const scene = id === 'jumo' ? 'jumo_free' : `${id}_free`;
      this.enqueue(scene, async () => {
        await this.talk(scene);
        s.civ[id] = 'following'; this.save();
        this.ui.toast(MSG.following);
      });
    } else if (s.civ[id] === 'waiting') {
      s.civ[id] = 'following'; this.save();
      this.ui.toast(MSG.following);
    }
    if (v?.npc) v.stuck = 0;
  }

  // ------------------------------------------------------------ EXP grains
  updateGrains(dt) {
    for (const g of this.grains) {
      g.t += dt;
      if (g.t < 0) continue;
      const hp = g.h.transform.position, tx = hp[0], ty = hp[1] + 0.5;
      const k = Math.min(1, dt * (4 + g.t * 10));
      g.x += (tx - g.x) * k; g.y += (ty - g.y) * k;
      if (Math.hypot(tx - g.x, ty - g.y) < 0.15 || g.t > 1.5) { g.done = true; if (g.n) this.addExp(g.h, g.n); }
    }
    this.grains = this.grains.filter(g => !g.done);
  }

  // ------------------------------------------------------------ input: NPC / 시설 클릭
  interactables() {
    const s = this.s, list = [], o = this.objectiveText();
    const hl = t => o.target === t ? 'hl' : '';
    const npcPos = n => n?.go.transform.position;
    if (s.villageFound) {
      const chiefTalk = !s.dialogs.chief || (s.guanJoined && !s.dialogs.prep);
      if (chiefTalk) list.push({ id: 'chief', pos: npcPos(this.npcs.chief), text: '❗ 마을 대표', kind: 'hl', act: () => this.talkChief() });
      list.push({ id: 'bonfire', pos: Z.bonfire, text: '🔥 휴식', kind: '', act: () => this.openRest() });
      list.push({ id: 'soldier', pos: npcPos(this.npcs.soldier), text: s.bridge ? '⚔ 훈련' : '🔒 훈련', kind: s.bridge ? (hl('soldier') || (s.training >= 1 ? 'check' : '')) : 'lock', act: () => this.openTraining() });
    }
    if (s.guanJoined && s.dialogs.prep && !s.bridge) list.push({ id: 'bridge', pos: Z.bridgeMarker, text: '🔨 복구', kind: hl('bridge') || hl('tree'), act: () => this.openBridge() });
    for (const v of Object.values(this.civ)) {
      const st = s.civ[v.id];
      const discovered = v.camp === 'west' ? s.westFound || s.dialogs.chief : s.eastFound || s.zhangJoined;
      if (st === 'captive' && discovered) {
        const locked = !s.guards[v.camp];
        list.push({ id: 'civ:' + v.id, pos: npcPos(v.npc), text: (locked ? '🔒 구출 ' : '🔓 구출 ') + v.name, kind: locked ? 'lock' : 'hl', act: () => this.freeCiv(v.id) });
      } else if (st === 'waiting') list.push({ id: 'civ:' + v.id, pos: npcPos(v.npc), text: '🤝 동행 ' + v.name, kind: 'hl', act: () => this.freeCiv(v.id) });
      else if (st === 'following') list.push({ id: 'civ:' + v.id, pos: npcPos(v.npc), text: '마을로 동행 중', kind: '', act: null });
    }
    for (const w of ['zhang', 'guan']) if (this.npcs[w]) list.push({ id: w, pos: npcPos(this.npcs[w]), text: '❗ ' + (w === 'zhang' ? '장비' : '관우'), kind: 'hl', act: null });
    if (s.outpostOpen && !s.zhangjiao) list.push({ id: 'lair', pos: Z.lairGate, text: s.guanhai ? '➡ 진입' : '🔒 진입', kind: s.guanhai ? hl('zhangjiao') : 'lock',
      act: () => { if (!s.guanhai) this.ui.toast(MSG.lairLocked); else this.walkTo([Z.lairGate[0], Z.lairGate[1] + 3], null); } });
    // 첫 채집 안내: 가까운 접근 가능한 나무·바위 1곳 강조
    if (o.target === 'tree' || o.target === 'stone') {
      const r = this.nearestResource(o.target === 'tree' ? 1 : 2);
      if (r) list.push({ id: 'res', pos: r.transform.position, text: o.target === 'tree' ? '🪵 나무' : '⛏ 광석', kind: 'hl', act: () => this.walkTo(r.transform.position, null, 1.2) });
    }
    return list.filter(m => m.pos && !G.Fog.blocks(m.pos[0], m.pos[1]));
  }
  nearestResource(type) {
    const c = this.center(); let best = null, bd = 1e9;
    for (const sp of G.MapManager.resourceSpawners) for (const a of sp.ActorList) {
      if (a.ResourceType !== type || a.IsDead()) continue;
      const p = a.transform.position; if (G.Fog.blocks(p[0], p[1])) continue;
      const d = dist(p, c); if (d < bd) { bd = d; best = a; }
    }
    return best;
  }
  /** world tap: an interactable under the finger -> walk there and use it once */
  pointerDown(wx, wy) {
    if (this.paused || this.ui.busy || !G.HeroManager.control) return false;
    const hit = this.interactables().filter(m => m.act).find(m => Math.hypot(m.pos[0] - wx, m.pos[1] + 0.6 - wy) < 1.1);
    if (!hit) { this.walk = null; return false; }
    this.useInteractable(hit);
    return true;
  }
  useInteractable(m) {
    if (!m.act || this.ui.busy) return;
    const near = dist(this.center(), m.pos) <= 2.6;
    if (near || m.id === 'lair' || m.id === 'res' || !this.s.villageFound) { m.act(); return; }
    this.walkTo(m.pos, m.act);
  }
  walkTo(pos, fn, stop = 2.2) {
    const c = this.center();
    if (G.Fog.blocks(pos[0], pos[1]) || !G.MapManager.navmesh.path(c[0], c[1], pos[0], pos[1])) { this.ui.toast(MSG.unreachable); return; }
    this.walk = { pos, fn, stop, t: 0 };
  }
  updateWalk() {
    const w = this.walk; if (!w) return;
    const J = G.HeroManager.Joystick;
    if (G.UI.joy.active) { this.walk = null; return; }        // 플레이어가 직접 조작하면 취소
    const c = G.HeroManager.heroCenterPos;
    w.t += G.dt || 0.016;
    if (dist(c, w.pos) <= w.stop || w.t > 25) {
      this.walk = null; J.isPointDown = false; J.Direction = [0, 0];
      if (dist(c, w.pos) <= w.stop + 0.6) w.fn?.(); else this.ui.toast(MSG.unreachable);
      return;
    }
    const p = G.MapManager.navmesh.path(c[0], c[1], w.pos[0], w.pos[1]) || [{ x: w.pos[0], y: w.pos[1] }];
    const n = p.find(q => Math.hypot(q.x - c[0], q.y - c[1]) > 0.6) || p[p.length - 1];
    const dx = n.x - c[0], dy = n.y - c[1], L = Math.hypot(dx, dy) || 1;
    J.isPointDown = G.HeroManager.control; J.Direction = [dx / L, dy / L];
  }

  // ------------------------------------------------------------ facilities
  async talkChief() {
    const s = this.s;
    if (!s.dialogs.chief) this.enqueue('chief', async () => { await this.talk('chief'); this.ui.toast(MSG.rescueSpot); });
    else if (s.guanJoined && !s.dialogs.prep) this.enqueue('prep', async () => { await this.talk('prep'); this.ui.toast(MSG.grow); });
  }
  openRest() {
    const heal = () => {
      for (const u of [...G.HeroManager.DeadHeroes]) resurrectHero(u, 1);
      for (const h of this.heroes()) { h.UnitData.RestoreHp(); h.UISetDamage?.(h.TotalStat().CurrentHP, h.GetStat(UNIT_STAT.HP)); }
      w.close(); this.ui.toast('부대가 회복했어요.');
    };
    const rows = this.heroes().map(h => [`${this.heroName(h.Key)} Lv${h.Level + 1}`, h.IsDead() ? '전투 불능' : `HP ${Math.round(h.GetHPRate() * 100)}%`]);
    const w = this.ui.window({ screen: 'rest', title: '모닥불 휴식', text: '회복하고 재정비하기', rows,
      buttons: [{ label: '회복하기', onClick: heal }, { label: '닫기', sub: true, onClick: () => w.close() }] });
  }
  openBridge() {
    const s = this.s;
    if (s.bridge) return;
    const render = () => {
      const have = G.Inventory.count('TREE'), need = TEST.bridgeTree, ok = have >= need;
      return { screen: 'bridge', title: '낡은 다리 복구', text: '나무로 초소로 가는 다리를 고쳐요.', rows: [['필요한 나무', `${need}`], ['보유한 나무', `${have}`]],
        note: ok ? '' : MSG.lack,
        buttons: [{ label: '복구하기', disabled: !ok, onClick: () => {
          if (s.bridge || !G.Inventory.use('TREE', need)) return;      // 연속 클릭 중복 차감 방지
          s.bridge = true; this.save();
          w.close(); this.ui.toast('✓ ' + MSG.bridgeDone);
          this.enqueue('bridge_done', () => this.talk('bridge_done'));
        } }, { label: '닫기', sub: true, onClick: () => w.close() }] };
    };
    const w = this.ui.window(render());
  }
  trainUnlocked(i) {
    const u = TEST.training[i]?.unlock;
    return u === 'bridge' ? this.s.bridge : u === 'guanhai' ? this.s.guanhai : u === 'zhangjiao' ? this.s.zhangjiao : false;
  }
  async openTraining() {
    const s = this.s, n = this.npcs.soldier;
    if (this.trainingOpen) return;                                        // 겹친 클릭으로 두 번 열리지 않게
    this.trainingOpen = true;
    if (n) { n.restingState = 'Idle'; }                                   // 손질·살피기 중단 → 응대
    try {
      if (!s.bridge) { await this.talk('TRAIN_NPC_LOCKED', true); this.ui.toast(MSG.trainLocked); return; }
      await this.talk(this.tutorialOnce('trainFirst') ? 'TRAIN_NPC_FIRST' : 'TRAIN_NPC_REPEAT', true);
      await new Promise(res => {
        let note = '';
        const spec = () => {
          const lv = s.training, next = TEST.training[lv], have = G.Inventory.count('STONE');
          const unlocked = next && this.trainUnlocked(lv);
          const rows = [['현재 단계', `${lv}단계`], ['다음 단계', next ? `${lv + 1}단계` : '-']];
          if (next) rows.push(['효과 (부대 공통)', `공격력 +${Math.round(next.damage * 100)}% · 체력 +${Math.round(next.hp * 100)}%`], ['필요 광석', `${next.cost}`]);
          rows.push(['보유 광석', `${have}`]);
          const can = unlocked && have >= next.cost;
          const lack = unlocked && have < next.cost;
          return { screen: 'training', title: '부대 훈련', rows,
            note: note || (!unlocked ? MSG.trainMax + ' (' + LINES.TRAIN_NPC_MAX[1] + ')' : lack ? LINES.TRAIN_NPC_LACK[1] : ''),
            buttons: [{ label: '훈련하기', disabled: !can, onClick: () => {
              const cur = TEST.training[s.training];
              if (!cur || !this.trainUnlocked(s.training) || !G.Inventory.use('STONE', cur.cost)) return;
              s.training++; this.save();
              for (const h of this.heroes()) this.refreshStats(h);
              note = LINES.TRAIN_NPC_DONE[1];
              this.ui.toast((s.training === 1 ? '✓ ' : '') + MSG.trainingDone);
              w.update(spec());
            } }, { label: '닫기', sub: true, onClick: () => { w.close(); res(); } }] };
        };
        const w = this.ui.window(spec());
        this.paused = true;
      });
    } finally {
      this.paused = false; this.trainingOpen = false;
      if (n) { n.restingState = 'Work'; n.elapsed = 0; }               // 창 닫기 후 기본 대기
    }
  }

  // ------------------------------------------------------------ wipe (전멸 복귀)
  async onWipe() {
    this.wiping = true;
    this.walk = null;
    for (const f of Object.values(this.fights)) if (f.state === 'ready' || f.state === 'fight') f.reset(false);
    this.ui.toast(MSG.wipe);
    await this.ui.dim(1, 0.6);
    const safe = this.safePoint();
    G.UnitManager.WarpHero(safe[0], safe[1]);
    for (const u of [...G.HeroManager.DeadHeroes]) { resurrectHero(u, 1); u.WarpHero(safe[0] + Math.random() - 0.5, safe[1] + Math.random() - 0.5); }
    G.CameraManager.position = [...safe];
    // 해방·미귀환 주민은 포로터 안전 지점에서 대기
    for (const v of Object.values(this.civ)) if (this.s.civ[v.id] === 'following') {
      this.s.civ[v.id] = 'waiting'; v.npc?.agent.warp(...Z[v.camp].safe); if (v.npc) v.npc.agent.isStopped = true;
    }
    this.save();
    await this.ui.dim(0, 0.6);
    this.wiping = false;
  }
  async warpParty(pos) {
    await this.ui.dim(1, 0.5);
    G.UnitManager.WarpHero(pos[0], pos[1]);
    G.CameraManager.position = [...pos];
    await this.ui.dim(0, 0.5);
  }

  // ------------------------------------------------------------ drawing
  /** map Buildings site by short name (keys are SG_WB_C1_<NAME>) */
  building(k) { return this.mapJson.Buildings.find(b => b.key === k || b.key === 'SG_WB_C1_' + k); }
  drawWorld(renderer) {
    const art = this.mapJson.environmentArt?.buildings || {};
    const put = (name, x, y, a = 1, tint = 1) => { const sp = name && G.assets.sprite(name); if (sp) renderer.draw({ sp, x, y, r: tint, g: tint, b: tint, a, layer: 0, order: 0, sortY: y }); };
    const site = k => { const b = this.building(k); return b ? { p: b.pos, sp: art[b.key] } : null; };
    for (const k of ['BONFIRE', 'TRAINING', 'LAIRGATE']) { const b = site(k); if (b) put(b.sp, b.p.x, b.p.y); }
    const br = site('BRIDGE'); if (br) put(br.sp, br.p.x, br.p.y, this.s.bridge ? 1 : 0.55, this.s.bridge ? 1 : 0.55);
  }
  drawOverlay() {
    const ui = this.ui, ctx = ui.ctx, cam = G.CameraManager;
    ctx.clearRect(0, 0, ui.w, ui.h);
    const k = ui.h / (cam.size * 2);
    const S = (x, y) => [ui.w / 2 + (x - cam.position[0]) * k, ui.h / 2 - (y - cam.position[1]) * k];
    for (const f of Object.values(this.fights)) f.draw(ctx, S, k);
    ctx.fillStyle = '#ffe066';
    for (const g of this.grains) { if (g.t < 0) continue; const [sx, sy] = S(g.x, g.y); ctx.beginPath(); ctx.arc(sx, sy, 0.09 * k, 0, Math.PI * 2); ctx.fill(); }
    ui.markers(this.interactables().map(m => ({ id: m.id, x: m.pos[0], y: m.pos[1] + 1.25, text: m.text, kind: m.kind, onClick: () => this.useInteractable(m) })), S);
  }
}

export async function startChapter1(opts) {
  const ch = new Chapter1(opts);
  await ch.boot();
  return ch;
}
