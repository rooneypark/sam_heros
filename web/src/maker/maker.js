// Map maker / simulator (v3 layout): edit = paused world with the placed actors and free zoom; run = the game's
// simulation step with the game camera (size 13); back to edit restores the placement and the zoom.
import { G } from '../game/registry.js';
import { TEAM } from '../game/defs.js';
import { Timing } from '../game/core/Timing.js';
import { Animator } from '../engine/components.js';
import { GridNav } from '../engine/gridnav.js';
import { WorldMapView, MAP_CELL, DECO_CELL, DECO_OFFSET, worldToCell, cellCenter } from '../game/map/WorldMapView.js';
import { MonsterSpawner } from '../game/managers/MapManager.js';
import { ResourceSpawner } from '../game/world/Resources.js';
import { ActorSkill } from '../game/skill/Skill.js';
import { Tables } from '../game/data/Tables.js';
import { CameraManager } from '../game/managers/HeroManager.js';
import { bootEngine, loadWorld, stepWorld, drawWorld } from '../boot.js';
import { units as originalUnits, skillsAt, TERRAIN, TERRAIN_CATS, terrainCatalog, drawSpriteIcon, MAX_LEVEL, MIRROR } from '../packs/original.js';
import { TileResolver } from '../game/map/TileResolver.js';
import { loadSamgukUnits, loadSamgukTiles, loadSamgukOverrides, saveMapToRepo, FACTIONS } from '../packs/samguk.js';
import { BLOCKING_DECO, BLOCKING_FOOTPRINT } from '../engine/gridnav.js';
import * as D from './mapdoc.js';
import { installReviewControls } from '../packs/reviewMode.js';

installReviewControls();

const $ = id => document.getElementById(id);
const gl = $('gl'), ov = $('ov'), center = $('center'), dbg = $('debug');
const octx = ov.getContext('2d');
const GAME_CAMERA = CameraManager.DEFAULT_CAMERA;
const AUTOSAVE = 'maker.autosave', LIBRARY = 'maker.maps';

const S = {
  doc: null, mode: 'edit', paused: false, tool: 'select',
  pick: { type: 'terrain', id: 'grass' },     // palette selection: terrain brush or unit to place
  place: { team: 'enemy', level: 10 },        // team / level for newly placed units
  selected: null,                             // id of a placed unit / tree
  actors: new Map(),                          // id -> actor in the current world
  editCam: { position: [0, 0], size: 26 },
  snapshot: null, moveTarget: null, hover: null, undo: [], busy: false, kind: '영웅', search: '', shown: 60,
  tcat: '기본', tsearch: '', tshown: 60,
};
let renderer, size = { w: 1, h: 1 }, UNITS = [], BRUSHES = TERRAIN;
const brushOf = id => BRUSHES.find(b => b.id === id);
const TERRAIN_CATS_ALL = [...TERRAIN_CATS];

// ------------------------------------------------------------------ helpers
const toast = (msg, sec = 1.8) => { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast.h); toast.h = setTimeout(() => { t.style.display = 'none'; }, sec * 1000); };
const teamOf = t => t === 'ally' ? TEAM.PLAYER : TEAM.ENEMY;
function screenToWorld(px, py) {
  const cam = G.CameraManager, k = cam.size * 2 / size.h;
  return [cam.position[0] + (px - size.w / 2) * k, cam.position[1] - (py - size.h / 2) * k];
}
function worldToScreen(x, y) {
  const cam = G.CameraManager, k = size.h / (cam.size * 2);
  return [size.w / 2 + (x - cam.position[0]) * k, size.h / 2 - (y - cam.position[1]) * k];
}
const setPic = (el, name, px = 128) => drawSpriteIcon(G.assets, el, name, px).catch(() => false);
/** pack art (png in the collaboration repo) first, else the base unit's atlas sprite */
function setUnitPic(el, def, px = 128) {
  if (!def?.art) return setPic(el, def?.icon, px);
  const img = new Image();
  img.onload = () => {
    el.width = el.height = px;
    const k = px / Math.max(img.width, img.height), c = el.getContext('2d');
    c.drawImage(img, (px - img.width * k) / 2, (px - img.height * k) / 2, img.width * k, img.height * k);
  };
  img.onerror = () => setPic(el, def.icon, px);
  img.src = def.art;
}
const findPlaced = id => S.doc.maker.units.find(u => u.id === id) || S.doc.maker.trees.find(t => t.id === id) || null;
const unitDef = key => UNITS.find(u => u.key === key);
function pushUndo() { S.undo.push(D.clone(S.doc)); if (S.undo.length > 50) S.undo.shift(); }
function autosave() { try { localStorage.setItem(AUTOSAVE, JSON.stringify(S.doc)); } catch { /* storage full / blocked */ } }

function layout() {
  const r = center.getBoundingClientRect();
  size = { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  const dpr = window.devicePixelRatio || 1;
  for (const c of [gl, ov]) { c.style.width = size.w + 'px'; c.style.height = size.h + 'px'; }
  renderer.resize(size.w, size.h, dpr);
  ov.width = size.w * dpr; ov.height = size.h * dpr;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ------------------------------------------------------------------ world building
async function spawnUnitActor(u, spawner = null) {
  const a = await G.UnitManager.spawnActor(u.key, Math.max(0, u.level - 1), teamOf(u.team), u.x, u.y, spawner);
  S.actors.set(u.id, a);
  return a;
}
async function spawnTreeActor(t) {
  const c = worldToCell(t.x, t.y, MAP_CELL);
  const b = TERRAIN.find(x => x.id === 'tree');
  const sp = new ResourceSpawner({ SpawnerType: 1, IncludeTiles: [c], SpawnerDatas: [{ key: b.resource, level: b.level }], MaxCount: 1 });
  await sp.SpawnActor();
  const a = sp.ActorList[0];
  if (!a) return null;
  a.go.transform.lp = [t.x, t.y, 0];
  a.makerSpawner = sp;
  G.MapManager.resourceSpawners.push(sp);
  S.actors.set(t.id, a);
  return a;
}
function removeActor(id) {
  const a = S.actors.get(id);
  if (!a) return;
  S.actors.delete(id);
  if (a.makerSpawner) {
    const sp = a.makerSpawner, MM = G.MapManager;
    Timing.KillOwner(sp);
    MM.resourceSpawners = MM.resourceSpawners.filter(s => s !== sp);
    MM.ActiveResourceSpawners = MM.ActiveResourceSpawners.filter(s => s !== sp);
  } else G.UnitManager.despawn(a);
}
function moveActor(id, x, y) {
  const a = S.actors.get(id);
  if (!a) return;
  if (a.makerSpawner) a.go.transform.lp = [x, y, 0];
  else { a.Body.Warp(x, y); a.go.transform.lp = [x, y, 0]; }
}

/** map tiles changed: new map view + walk grid (actors stay) */
let syncing = null, syncAgain = false;
async function syncMap() {
  if (syncing) { syncAgain = true; return syncing; }
  syncing = (async () => {
    do {
      syncAgain = false;
      const MM = G.MapManager;
      MM.json = S.doc;
      MM.view = new WorldMapView(G.assets, S.doc, MM.resolver);
      MM.navmesh = new GridNav(S.doc);
      await G.assets.preloadSprites(MM.view.spriteNames());
    } while (syncAgain);
  })();
  await syncing; syncing = null;
}

async function buildEditWorld() {
  S.busy = true;
  S.actors.clear();
  await loadWorld(S.doc.name, [], S.doc);
  G.HeroManager.Control = false;
  for (const u of S.doc.maker.units) await spawnUnitActor(u);
  for (const t of S.doc.maker.trees) await spawnTreeActor(t);
  Object.assign(G.CameraManager, { position: [...S.editCam.position], size: S.editCam.size, tween: null });
  S.busy = false;
}

// ------------------------------------------------------------------ run mode
async function startRun() {
  if (S.busy) return;
  S.busy = true;
  S.snapshot = D.clone(S.doc);
  S.editCam = { position: [...G.CameraManager.position], size: G.CameraManager.size };
  S.mode = 'run'; S.paused = false; S.moveTarget = null; S.ended = false;
  document.body.classList.add('run'); document.body.classList.remove('paused');
  $('btnPause').textContent = '일시정지';
  layout();
  const allies = S.doc.maker.units.filter(u => u.team === 'ally');
  const enemies = S.doc.maker.units.filter(u => u.team !== 'ally');
  const pts = allies.length ? allies : [{ x: S.editCam.position[0], y: S.editCam.position[1] }];
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const doc = D.clone(S.doc);
  doc.BonfirePos = { x: cx - 1, y: cy };          // GetStartPosition = bonfire + (1, 0)
  S.actors.clear();
  await loadWorld(doc.name, allies.map(u => ({ key: u.key, level: Math.max(0, u.level - 1) })), doc);
  G.UnitManager.HeroUnits.forEach((h, i) => { h.WarpHero(allies[i].x, allies[i].y); S.actors.set(allies[i].id, h); });
  G.HeroManager.transform.position = [cx, cy];
  // enemies: one MonsterSpawner each (already spawned, kept active) so the monster BT ticks; no respawn
  for (const u of enemies) {
    const sp = new MonsterSpawner({ IncludeTiles: [worldToCell(u.x, u.y, MAP_CELL)], SpawnerDatas: [{ key: u.key, level: u.level - 1 }],
      MaxCount: 1, BaseCount: 999, spawnTime: 9999, EventType: 0 });
    sp.spawned = true; sp.active = true; sp.setActive = () => {};
    G.MapManager.spawners.push(sp);
    const a = await spawnUnitActor(u, sp);
    a.Spawner = sp; sp.ActorList.push(a);
  }
  for (const t of S.doc.maker.trees) { const a = await spawnTreeActor(t); a?.makerSpawner.setActive(true); }
  Object.assign(G.CameraManager, { position: [cx, cy], size: GAME_CAMERA, tween: null });
  S.allyCount = allies.length; S.enemyCount = enemies.length;
  skillLog.length = 0; renderSkillLog();
  G.HeroManager.Control = true;
  S.busy = false;
}
async function backToEdit() {
  if (S.busy) return;
  S.mode = 'edit'; S.paused = false;
  document.body.classList.remove('run', 'paused');
  layout();
  S.doc = S.snapshot || S.doc;
  await buildEditWorld();
  renderInspector();
}
// run-mode skill log (maker only): who used which named skill at which level — the original triggers are often
// conditional (e.g. 도끼 강타 after 7 basic attacks), so the log shows that they do fire
const skillLog = [];
const startSkill = ActorSkill.prototype.StartSkill;
ActorSkill.prototype.StartSkill = function (...a) {
  const ok = startSkill.apply(this, a);
  const d = this.TableSkillData, u = this.Unit;
  if (ok && S.mode === 'run' && d.name && u) {
    const def = unitDef(u.Key);
    skillLog.unshift({ t: performance.now(), team: u.Team, text: `${def?.name || u.Key} Lv${u.Level + 1} · ${Tables.loc(d.name)}` });
    skillLog.length = Math.min(skillLog.length, 8);
    renderSkillLog();
  }
  return ok;
};
function renderSkillLog() {
  const box = $('skillLog'); if (!box) return;
  box.innerHTML = skillLog.map(l => `<div class="${l.team === TEAM.PLAYER ? 'ally' : 'enemy'}">${l.text}</div>`).join('');
}
function runStep(dt) {
  const J = G.HeroManager.Joystick, c = G.HeroManager.heroCenterPos;
  const keys = S.keys;
  const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
  // while the button is held the target follows the cursor (the camera moves, so re-project every frame)
  if (S.steer) S.moveTarget = screenToWorld(S.steer[0], S.steer[1]);
  if (kx || ky) { S.moveTarget = null; J.isPointDown = true; J.Direction = [kx, ky]; }
  else if (S.moveTarget && G.UnitManager.HeroUnits.length) {
    const [x, y] = S.moveTarget;
    if (Math.hypot(x - c[0], y - c[1]) < 1.2) { S.moveTarget = null; J.isPointDown = false; }
    else {
      const p = G.MapManager.navmesh.path(c[0], c[1], x, y) || [{ x, y }];
      const n = p.find(q => Math.hypot(q.x - c[0], q.y - c[1]) > 0.6) || p[p.length - 1];
      const dx = n.x - c[0], dy = n.y - c[1], L = Math.hypot(dx, dy) || 1;
      J.isPointDown = true; J.Direction = [dx / L, dy / L];
    }
  } else J.isPointDown = false;
  stepWorld(dt);
  G.CameraManager.update(dt);
  if (!S.ended) {
    const heroes = G.UnitManager.HeroUnits.filter(h => !h.IsDead()).length;
    const foes = G.UnitManager.monsters.filter(m => !m.IsDead()).length;
    if (S.allyCount && !heroes) { S.ended = true; toast('아군 전멸', 3); }
    else if (S.enemyCount && !foes) { S.ended = true; toast('적군 전멸 — 승리', 3); }
  }
}

// ------------------------------------------------------------------ edit input
function hitActor(wx, wy) {
  let best = null, bd = 0.9;
  for (const [id, a] of S.actors) {
    const p = a.transform.position, d = Math.hypot(p[0] - wx, p[1] + 0.45 - wy);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}
let drag = null;
function onDown(e) {
  if (S.busy) return;
  ov.setPointerCapture?.(e.pointerId);
  const r = gl.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const [wx, wy] = screenToWorld(px, py);
  if (e.button === 1 || e.button === 2 || (S.mode === 'edit' && e.button === 0 && e.altKey)) {
    if (S.mode === 'edit') drag = { kind: 'pan', px, py, cam: [...G.CameraManager.position] };
    e.preventDefault(); return;
  }
  // run: holding the button steers the party towards the cursor (like the game's joystick); a short click
  // sends it to that point
  if (S.mode === 'run') { S.moveTarget = [wx, wy]; drag = { kind: 'steer', px, py, moved: 0 }; S.steer = [px, py]; return; }
  const brush = Number($('brushSize').value);
  if (S.tool === 'select') {
    const id = hitActor(wx, wy);
    if (id) { const o = findPlaced(id); pushUndo(); select(id); drag = { kind: 'move', id, dx: o.x - wx, dy: o.y - wy }; }
    else { select(null); drag = { kind: 'pan', px, py, cam: [...G.CameraManager.position] }; }
  } else if (S.tool === 'erase') {
    pushUndo();
    const id = hitActor(wx, wy);
    if (id) { D.removeById(S.doc, id); removeActor(id); if (S.selected === id) select(null); autosave(); drag = { kind: 'erase' }; }
    else { if (D.erase(S.doc, wx, wy, brush)) syncMap(); drag = { kind: 'erase', last: [wx, wy] }; }
  } else if (S.tool === 'draw') {
    pushUndo();
    if (S.pick.type === 'unit') placeUnit(S.pick.id, wx, wy);
    else if (S.pick.id === 'tree') placeTree(wx, wy);
    else { if (D.paint(S.doc, brushOf(S.pick.id), wx, wy, brush)) syncMap(); drag = { kind: 'paint', last: [wx, wy] }; }
  }
}
function onMove(e) {
  const r = gl.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const [wx, wy] = screenToWorld(px, py);
  S.hover = [wx, wy];
  if (!drag) return;
  if (drag.kind === 'steer') { drag.moved = Math.max(drag.moved, Math.hypot(px - drag.px, py - drag.py)); S.steer = [px, py]; return; }
  const brush = Number($('brushSize').value);
  if (drag.kind === 'pan') {
    const k = G.CameraManager.size * 2 / size.h;
    G.CameraManager.position = [drag.cam[0] - (px - drag.px) * k, drag.cam[1] + (py - drag.py) * k];
  } else if (drag.kind === 'move') {
    const o = findPlaced(drag.id); if (!o) return;
    o.x = wx + drag.dx; o.y = wy + drag.dy; moveActor(drag.id, o.x, o.y);
  } else if (drag.kind === 'paint') {
    // every cell along the drag (fast moves skip cells; road lines must stay edge-connected)
    const b = brushOf(S.pick.id); let ch = false;
    D.strokeCells(drag.last[0], drag.last[1], wx, wy, b?.layer === 'decoData', (x, y) => { ch = D.paint(S.doc, b, x, y, brush) || ch; });
    drag.last = [wx, wy]; if (ch) syncMap();
  }
  else if (drag.kind === 'erase') {
    const id = hitActor(wx, wy);
    if (id) { D.removeById(S.doc, id); removeActor(id); if (S.selected === id) select(null); }
    else { let ch = false; D.strokeCells(drag.last?.[0] ?? wx, drag.last?.[1] ?? wy, wx, wy, false, (x, y) => { ch = D.erase(S.doc, x, y, brush) || ch; }); drag.last = [wx, wy]; if (ch) syncMap(); }
  }
}
function onUp() {
  if (drag?.kind === 'steer') {
    S.steer = null;
    if (drag.moved > 8) S.moveTarget = null;      // released after steering: the party stops
    drag = null; return;
  }
  if (drag && drag.kind !== 'pan') autosave();
  drag = null;
}
function onWheel(e) {
  e.preventDefault();
  if (S.mode !== 'edit') return;
  const r = gl.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const before = screenToWorld(px, py);
  zoomTo(G.CameraManager.size * Math.exp(e.deltaY * 0.0012));
  const after = screenToWorld(px, py);
  G.CameraManager.position = [G.CameraManager.position[0] + before[0] - after[0], G.CameraManager.position[1] + before[1] - after[1]];
}
function zoomTo(s) { G.CameraManager.size = Math.min(80, Math.max(3, s)); }
function fitAll() {
  const b = D.bounds(S.doc), aspect = size.w / size.h;
  G.CameraManager.position = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  zoomTo(Math.max((b.y1 - b.y0) / 2, (b.x1 - b.x0) / 2 / aspect) * 1.08);
}

async function placeUnit(key, x, y) {
  const u = D.addUnit(S.doc, key, S.place.team, S.place.level, x, y);
  await spawnUnitActor(u);
  select(u.id); autosave();
}
async function placeTree(x, y) {
  const t = D.addTree(S.doc, x, y);
  await spawnTreeActor(t);
  autosave();
}
async function undo() {
  if (S.mode !== 'edit' || !S.undo.length || S.busy) return;
  S.doc = S.undo.pop();
  S.editCam = { position: [...G.CameraManager.position], size: G.CameraManager.size };
  await buildEditWorld();
  select(null); autosave();
}
async function respawn(u) { removeActor(u.id); await spawnUnitActor(u); }

// ------------------------------------------------------------------ overlay (grid, brush, selection)
function diamond(cx, cy, cell, off, fill, stroke) {
  const c = cellCenter(cx, cy, cell, off);
  const pts = [[c.x, c.y + cell.y / 2], [c.x + cell.x / 2, c.y], [c.x, c.y - cell.y / 2], [c.x - cell.x / 2, c.y]].map(p => worldToScreen(p[0], p[1]));
  octx.beginPath(); pts.forEach((p, i) => i ? octx.lineTo(p[0], p[1]) : octx.moveTo(p[0], p[1])); octx.closePath();
  if (fill) { octx.fillStyle = fill; octx.fill(); }
  if (stroke) { octx.strokeStyle = stroke; octx.stroke(); }
}
function drawOverlay() {
  octx.clearRect(0, 0, size.w, size.h);
  const k = size.h / (G.CameraManager.size * 2);
  if (S.mode === 'edit') {
    if (k > 12) { octx.lineWidth = 1; for (const t of S.doc.mapData) diamond(t.x, t.y, MAP_CELL, undefined, null, '#ffffff14'); }
    // auto-tile cells the original rules leave empty (a lone road cell, a water/sand area under 2x2): red dashes
    const MM = G.MapManager;
    if (MM.view && MM.resolver) {
      octx.setLineDash([4, 3]); octx.lineWidth = 1.5;
      for (const c of MM.view.cells) {
        if ((c.layer === 'roadData' || c.layer === 'waterData') && !MM.resolver.tileSprite(c)) diamond(c.x, c.y, MAP_CELL, undefined, '#ff5a5a22', '#ff5a5acc');
      }
      octx.setLineDash([]);
    }
    if (S.hover && !drag?.kind?.startsWith('pan')) {
      const brush = brushOf(S.pick.id);
      const [wx, wy] = S.hover, n = Math.max(Number($('brushSize').value), S.tool === 'draw' && brush?.rule === 'pond' ? 2 : 1), r = Math.floor((n - 1) / 2);
      if (S.tool === 'erase' || (S.tool === 'draw' && S.pick.type === 'terrain' && !brush?.resource)) {
        const deco = S.tool === 'draw' ? brush.layer === 'decoData' : false;
        const cell = deco ? DECO_CELL : MAP_CELL, off = deco ? DECO_OFFSET : undefined, c = worldToCell(wx, wy, cell, off);
        octx.lineWidth = 2;
        for (let dx = -r; dx < n - r; dx++) for (let dy = -r; dy < n - r; dy++)
          diamond(c.x + dx, c.y + dy, cell, off, S.tool === 'erase' ? '#ff5a5a33' : '#2ee6b033', S.tool === 'erase' ? '#ff5a5a' : '#2ee6b0');
      } else if (S.tool === 'draw') {
        const [sx, sy] = worldToScreen(wx, wy);
        octx.setLineDash([5, 4]); octx.lineWidth = 2; octx.strokeStyle = '#ffffffcc';
        octx.beginPath(); octx.ellipse(sx, sy, 0.6 * k, 0.32 * k, 0, 0, Math.PI * 2); octx.stroke(); octx.setLineDash([]);
      }
    }
    // team markers under placed units, selection ring
    for (const u of S.doc.maker.units) {
      const [sx, sy] = worldToScreen(u.x, u.y);
      octx.lineWidth = u.id === S.selected ? 3 : 1.5;
      octx.strokeStyle = u.id === S.selected ? '#2ee6b0' : (u.team === 'ally' ? '#2ee6b099' : '#ff5a5a99');
      octx.beginPath(); octx.ellipse(sx, sy, 0.5 * k, 0.26 * k, 0, 0, Math.PI * 2); octx.stroke();
    }
    const t = S.doc.maker.trees.find(x => x.id === S.selected);
    if (t) { const [sx, sy] = worldToScreen(t.x, t.y); octx.lineWidth = 3; octx.strokeStyle = '#2ee6b0'; octx.beginPath(); octx.ellipse(sx, sy, 0.7 * k, 0.36 * k, 0, 0, Math.PI * 2); octx.stroke(); }
  } else {
    const lead = G.UnitManager.LeaderHero;
    if (lead && !lead.IsDead()) {
      const [sx, sy] = worldToScreen(lead.transform.position[0], lead.transform.position[1]);
      octx.lineWidth = 3; octx.strokeStyle = '#2ee6b0'; octx.beginPath(); octx.ellipse(sx, sy, 0.55 * k, 0.28 * k, 0, 0, Math.PI * 2); octx.stroke();
    }
    if (S.moveTarget) {
      const [sx, sy] = worldToScreen(S.moveTarget[0], S.moveTarget[1]);
      octx.lineWidth = 2; octx.strokeStyle = '#ffffffcc'; octx.setLineDash([5, 4]);
      octx.beginPath(); octx.ellipse(sx, sy, 0.5 * k, 0.26 * k, 0, 0, Math.PI * 2); octx.stroke(); octx.setLineDash([]);
    }
  }
}

// ------------------------------------------------------------------ panels
// terrain palette: 기본 (6 quick brushes) + every original tile by category, searchable, 60 per page
function buildTerrainTabs() {
  const box = $('terrainTabs'); box.innerHTML = '';
  for (const c of TERRAIN_CATS_ALL) {
    const b = document.createElement('button'); b.textContent = c; b.className = S.tcat === c ? 'on' : '';
    b.onclick = () => { S.tcat = c; S.tshown = 60; buildTerrainTabs(); buildTerrain(); };
    box.appendChild(b);
  }
}
function buildTerrain() {
  const q = S.tsearch.trim().toLowerCase();
  const list = BRUSHES.filter(b => (q ? true : b.cat === S.tcat) && (!q || b.name.toLowerCase().includes(q) || (b.tile || '').includes(q)));
  const box = $('terrain'); box.innerHTML = '';
  $('terrainCount').textContent = `${list.length}`;
  for (const b of list.slice(0, S.tshown)) {
    const el = document.createElement('div');
    el.className = 'tile'; el.dataset.id = b.id; el.title = b.tile ? `${b.name} (${b.layer})` : b.name;
    el.innerHTML = `<canvas class="pic"></canvas><span>${b.name}</span>`;
    setPic(el.firstChild, b.icon);
    el.onclick = () => { S.pick = { type: 'terrain', id: b.id }; setTool('draw'); refreshPicks(); renderInspector(); };
    if (b.tile && MIRROR.has(b.tile)) {
      // ⟲: the same piece facing the other way (the original keeps mirrored pairs as separate tiles)
      const r = document.createElement('button'); r.className = 'rot'; r.textContent = '⟲'; r.title = '방향 전환 (R)';
      // the icon stands for the pair: ⟲ turns the current brush when it is this piece (either way), else picks the
      // other direction; the icon keeps the selection and shows the direction in use
      const pair = brushOfTile(MIRROR.get(b.tile));
      if (pair) el.dataset.pair = pair.id;
      r.onclick = e => {
        e.stopPropagation();
        if (S.pick.id === b.id || S.pick.id === pair?.id) rotatePick();
        else if (pair) { S.pick = { type: 'terrain', id: pair.id }; setTool('draw'); refreshPicks(); renderInspector(); }
      };
      el.appendChild(r);
    }
    box.appendChild(el);
  }
  $('moreTerrain').style.display = list.length > S.tshown ? 'block' : 'none';
  refreshPicks();
}
// a tile's brush: the one in the open palette tab first (기본 울타리 <-> its pair round-trips), else the catalog entry
const brushOfTile = tile => BRUSHES.find(b => b.tile === tile && b.cat === S.tcat)
  || BRUSHES.find(b => b.tile === tile && b.cat !== '기본') || BRUSHES.find(b => b.tile === tile);
/** R / ⟲ on the palette: switch the brush to its mirrored partner tile */
function rotatePick() {
  const b = brushOf(S.pick.id), partner = b?.tile && MIRROR.get(b.tile);
  const nb = partner && brushOfTile(partner);
  if (!nb) return false;
  S.pick = { type: 'terrain', id: nb.id }; setTool('draw');
  toast(`방향 전환: ${nb.name}`, 1);
  refreshPicks(); renderInspector();
  return true;
}
/** R over a placed piece: swap that deco / block cell to the mirrored tile */
function rotatePlaced(wx, wy) {
  for (const [layer, cell, off] of [['decoData', DECO_CELL, DECO_OFFSET], ['blockData', MAP_CELL, undefined]]) {
    const c = worldToCell(wx, wy, cell, off);
    const t = S.doc[layer].find(q => q.x === c.x && q.y === c.y && MIRROR.has(q.n));
    if (t) { pushUndo(); t.n = MIRROR.get(t.n); syncMap(); autosave(); return true; }
  }
  return false;
}
// unit palette: game tabs (우르르 용병단 = original units, 삼국히어로즈 = the pack), then kind / faction tabs
const GAMES = [
  { id: 'samguk', name: '삼국히어로즈', kinds: FACTIONS },
];
const gameOf = id => GAMES.find(g => g.id === id);
function buildKindTabs() {
  const games = $('gameTabs'); games.innerHTML = '';
  for (const g of GAMES) {
    const b = document.createElement('button'); b.textContent = g.name; b.className = S.game === g.id ? 'on' : '';
    b.onclick = () => { S.game = g.id; S.kind = g.kinds.find(k => UNITS.some(u => u.source === g.id && u.kind === k)) || g.kinds[0]; S.shown = 60; buildKindTabs(); buildUnits(); };
    games.appendChild(b);
  }
  const box = $('kindTabs'); box.innerHTML = '';
  for (const k of gameOf(S.game).kinds) {
    const b = document.createElement('button'); b.textContent = k; b.className = S.kind === k ? 'on' : '';
    b.onclick = () => { S.kind = k; S.shown = 60; buildKindTabs(); buildUnits(); };
    box.appendChild(b);
  }
}
function filteredUnits() {
  const q = S.search.trim().toLowerCase();
  const main = ['영웅', '용병', '몬스터'];
  return UNITS.filter(u => u.source === S.game &&
    (S.game === 'original' && S.kind === '기타' ? !main.includes(u.kind) : u.kind === S.kind) &&
    (!q || u.name.toLowerCase().includes(q) || u.key.toLowerCase().includes(q)));
}
function buildUnits() {
  const list = filteredUnits(), box = $('units');
  box.innerHTML = '';
  $('unitCount').textContent = `${list.length}`;
  for (const u of list.slice(0, S.shown)) {
    const el = document.createElement('div');
    el.className = 'tile'; el.dataset.key = u.key; el.title = `${u.name} (${u.key}) ${u.grade}`;
    el.innerHTML = `<canvas class="pic"></canvas><span>${u.name}</span>`;
    setUnitPic(el.firstChild, u);
    el.onclick = () => { S.pick = { type: 'unit', id: u.key }; setTool('draw'); select(null); refreshPicks(); renderInspector(); };
    box.appendChild(el);
  }
  $('moreUnits').style.display = list.length > S.shown ? 'block' : 'none';
  refreshPicks();
}
function refreshPicks() {
  for (const el of document.querySelectorAll('#terrain .tile')) {
    const own = S.pick.type === 'terrain' && S.pick.id === el.dataset.id;
    const turned = S.pick.type === 'terrain' && el.dataset.pair && S.pick.id === el.dataset.pair;
    el.classList.toggle('sel', own || turned);
    // a pair icon draws the direction in use (its partner while turned)
    const want = turned ? el.dataset.pair : el.dataset.id;
    if (el.dataset.pair && el.dataset.shown !== want) {
      el.dataset.shown = want;
      const b = brushOf(want);
      setPic(el.querySelector('.pic'), b?.icon);
      el.querySelector('span').textContent = brushOf(el.dataset.id)?.name + (turned ? ' ⟲' : '');
    }
  }
  for (const el of document.querySelectorAll('#units .tile')) el.classList.toggle('sel', S.pick.type === 'unit' && S.pick.id === el.dataset.key);
}
function setTool(t) {
  S.tool = t;
  for (const b of document.querySelectorAll('#tools [data-tool]')) b.classList.toggle('on', b.dataset.tool === t);
}
function select(id) { S.selected = id; renderInspector(); }

function skillCard(title, s, extra = '', locked = false, tag = '') {
  if (!s) return '';
  const esc = v => String(v ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<div class="card${locked ? ' locked' : ''}">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}<b>${esc(title)}${s.name ? ' · ' + esc(s.name) : ''}</b>` +
    `${extra ? `<small>${esc(extra)}</small>` : ''}<small>${esc(s.desc)}</small>` +
    `<small>재사용 ${s.cool ?? '-'}초 · 사거리 ${s.range ?? '-'}</small></div>`;
}
function renderInspector() {
  const box = $('inspector');
  const placed = S.selected ? findPlaced(S.selected) : null;
  if (placed && !placed.key) {
    box.innerHTML = `<h3>선택한 오브젝트</h3><div class="portrait"><canvas class="pic"></canvas></div><div class="uname">나무</div>
      <div class="umeta">자원 · 공격하면 나무 자원을 떨어뜨림</div><button id="delSel" style="width:100%">삭제 (Delete)</button>`;
    setPic(box.querySelector('.pic'), 'tree_0');
    $('delSel').onclick = deleteSelected;
    return;
  }
  const key = placed ? placed.key : S.pick.type === 'unit' ? S.pick.id : null;
  if (!key) {
    const b = brushOf(S.pick.id);
    box.innerHTML = `<h3>선택한 지형</h3>${b ? `<div class="portrait"><canvas class="pic"></canvas></div><div class="uname">${b.name}</div>
      <div class="umeta">${b.resource ? '나무 자원(클릭마다 1그루)' : `원작 타일 ${b.tile} · ${b.layer}`}</div>
      ${b.tile && MIRROR.has(b.tile) ? '<button id="rotPick" style="width:100%;margin-bottom:6px">⟲ 방향 전환 (R)</button>' : ''}` : ''}
      <div class="empty">그리기 도구로 칠하고, 지우기 도구로 지웁니다.<br>왼쪽 유닛을 고르면 클릭한 곳에 배치됩니다.</div>`;
    if (b) setPic(box.querySelector('.pic'), b.icon);
    if ($('rotPick')) $('rotPick').onclick = rotatePick;
    return;
  }
  const def = unitDef(key) || { name: key, kind: '', grade: '' };
  const team = placed ? placed.team : S.place.team, level = placed ? placed.level : S.place.level;
  const sk = skillsAt(key, level);
  const tiers = sk.tiers.map(t => skillCard(`스킬 ${t.slot}`, t, '', !t.unlocked, t.unlocked ? `Lv ${t.unlock} 해금됨` : `Lv ${t.unlock} 해금`)).join('');
  box.innerHTML = `<h3>${placed ? '선택한 유닛' : '배치할 유닛'}</h3>
    <div class="portrait"><canvas class="pic"></canvas></div>
    <div class="uname">${def.name}</div><div class="umeta">${def.kind} · ${def.grade} · ${key}</div>
    <h3>진영</h3><div class="seg"><button data-team="ally" class="${team === 'ally' ? 'on' : ''}">아군</button><button data-team="enemy" class="enemy ${team === 'enemy' ? 'on' : ''}">적군</button></div>
    <h3>레벨</h3><div class="lv"><button data-lv="-1">−</button><input id="lvInput" type="number" min="1" max="${MAX_LEVEL}" value="${level}"><button data-lv="1">+</button></div>
    <h3>공격 · 스킬</h3>
    ${skillCard('기본 공격', sk.basic, '캐릭터 레벨에 따라 반영') || '<div class="card"><b>기본 공격</b><small>없음</small></div>'}
    ${sk.passive ? `<div class="card"><b>패시브</b><small>${sk.passive}</small></div>` : ''}
    <h3>해금된 스킬 <small style="color:var(--dim);font-weight:400">조건 충족 시 자동 발동</small></h3>
    ${tiers || '<div class="card"><small>스킬 없음</small></div>'}
    ${skillCard('채집', sk.gathering)}
    ${placed ? '<button id="delSel" style="width:100%;margin-top:6px">삭제 (Delete)</button>' : ''}`;
  setUnitPic(box.querySelector('.pic'), def);
  const apply = async (patch) => {
    if (placed) { pushUndo(); Object.assign(placed, patch); await respawn(placed); autosave(); }
    else Object.assign(S.place, patch);
    renderInspector();
  };
  for (const b of box.querySelectorAll('[data-team]')) b.onclick = () => apply({ team: b.dataset.team });
  for (const b of box.querySelectorAll('[data-lv]')) b.onclick = () => apply({ level: Math.min(MAX_LEVEL, Math.max(1, level + Number(b.dataset.lv))) });
  $('lvInput').onchange = e => apply({ level: Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(e.target.value) || 1))) });
  if (placed) $('delSel').onclick = deleteSelected;
}
function deleteSelected() {
  if (!S.selected || S.mode !== 'edit') return;
  pushUndo();
  D.removeById(S.doc, S.selected); removeActor(S.selected); select(null); autosave();
}

// ------------------------------------------------------------------ save / load
function download() {
  const blob = new Blob([JSON.stringify(S.doc, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${S.doc.name}.map.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function saveLibrary() {
  try {
    const lib = JSON.parse(localStorage.getItem(LIBRARY) || '{}');
    lib[S.doc.name] = S.doc; localStorage.setItem(LIBRARY, JSON.stringify(lib));
  } catch { /* storage blocked */ }
}
async function openDoc(doc, fit = true) {
  S.doc = D.normalize(doc); S.undo = []; S.selected = null;
  // units whose key no longer exists (e.g. removed prototypes SG_P*) are dropped instead of breaking the world
  const gone = S.doc.maker.units.filter(u => !Tables.unit(u.key));
  if (gone.length) {
    S.doc.maker.units = S.doc.maker.units.filter(u => Tables.unit(u.key));
    toast(`없는 유닛 ${gone.length}개를 뺐습니다: ${[...new Set(gone.map(u => u.key))].join(', ')}`, 4);
  }
  $('mapName').value = S.doc.name;
  if (fit) { const b = D.bounds(S.doc); S.editCam = { position: [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], size: 20 }; }
  await buildEditWorld();
  if (fit) fitAll();
  renderInspector(); autosave();
}

// ------------------------------------------------------------------ boot
async function main() {
  ({ renderer } = await bootEngine(gl, { hud: false }));
  layout();
  new ResizeObserver(layout).observe(center);
  G.User.isPrologue = false; G.User.instantInvincibility = false; G.User.heroMax = 999;
  G.Flow.defeat = true;                                    // the maker reports wipes itself (no defeat popup / map reload)
  G.UnitManager.ResurrectionHero = () => {};               // no bonfire revive in the simulator
  G.loadWorld = (name, party, json) => loadWorld(name, party, json);
  window.__G = G; window.__maker = S;
  const overridden = await loadSamgukOverrides();  // planners' table changes apply before units are listed
  if (overridden) { console.info(`samguk overrides: ${overridden} rows`); G.UnitManager.Initialize(); }
  UNITS = [...await loadSamgukUnits(G.assets)];
  S.game = UNITS.some(u => u.source === 'samguk') ? 'samguk' : 'original';
  S.kind = gameOf(S.game).kinds.find(k => UNITS.some(u => u.source === S.game && u.kind === k)) || gameOf(S.game).kinds[0];

  // map components of the 삼국 pack (content/samguk/tiles.json) join the original tiles; blocking ones stop movement
  const pack = await loadSamgukTiles(G.assets);
  for (const b of pack.blocking) { BLOCKING_DECO.add(b.id); if (b.footprint) BLOCKING_FOOTPRINT.set(b.id, b.footprint); }
  const resolver = new TileResolver(G.assets.tiles);
  BRUSHES = [...terrainCatalog(G.assets, resolver), ...pack.brushes.map(b => ({ ...b, icon: resolver.spritesOf(b.tile)[b.rule === 'pond' ? 12 : b.rule === 'road' ? 0 : 0] || resolver.spritesOf(b.tile)[0] }))];
  if (pack.brushes.length) TERRAIN_CATS_ALL.splice(1, 0, '삼국');
  buildTerrainTabs(); buildTerrain(); buildKindTabs(); buildUnits();
  $('terrainSearch').oninput = e => { S.tsearch = e.target.value; S.tshown = 60; buildTerrain(); };
  $('moreTerrain').onclick = () => { S.tshown += 60; buildTerrain(); };
  $('unitSearch').oninput = e => { S.search = e.target.value; S.shown = 60; buildUnits(); };
  $('moreUnits').onclick = () => { S.shown += 60; buildUnits(); };
  for (const b of document.querySelectorAll('#tools [data-tool]')) b.onclick = () => setTool(b.dataset.tool);
  $('zIn').onclick = () => zoomTo(G.CameraManager.size / 1.25);
  $('zOut').onclick = () => zoomTo(G.CameraManager.size * 1.25);
  $('zFit').onclick = fitAll;
  $('mapName').onchange = e => { S.doc.name = e.target.value.trim() || '맵'; autosave(); };
  $('btnNew').onclick = () => openDoc(D.newDoc($('mapName').value.trim() || '새 맵', Number($('mapSize').value)));
  // 저장: collaboration repo (content/samguk/maps) when the dev server mounts it, else a downloaded file
  $('btnSave').onclick = async () => {
    saveLibrary();
    const path = await saveMapToRepo(S.doc);
    if (path) toast(`저장: sam_heros/${path}`, 2.5); else { download(); toast(`다운로드: ${S.doc.name}.map.json`); }
  };
  $('btnLoad').onclick = () => $('file').click();
  $('file').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { await openDoc(D.normalize(JSON.parse(await f.text()), f.name.replace(/\.(map\.json|json|bytes)$/, ''))); toast(`불러옴: ${f.name}`); }
    catch (err) { toast('불러오기 실패: ' + err.message, 3); }
    e.target.value = '';
  };
  $('btnRun').onclick = startRun;
  $('btnPause').onclick = () => { S.paused = !S.paused; document.body.classList.toggle('paused', S.paused); $('btnPause').textContent = S.paused ? '계속' : '일시정지'; $('runState').textContent = S.paused ? '일시정지' : '실행 중'; };
  $('btnEdit').onclick = backToEdit;

  ov.style.pointerEvents = 'auto';
  ov.addEventListener('pointerdown', onDown);
  ov.addEventListener('pointermove', onMove);
  ov.addEventListener('pointerup', onUp); ov.addEventListener('pointercancel', onUp);
  ov.addEventListener('pointerleave', () => { S.hover = null; });
  ov.addEventListener('wheel', onWheel, { passive: false });
  ov.addEventListener('contextmenu', e => e.preventDefault());
  S.keys = new Set();
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    S.keys.add(e.key.toLowerCase());
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
    else if (S.mode === 'edit' && e.key === '1') setTool('select');
    else if (S.mode === 'edit' && e.key === '2') setTool('draw');
    else if (S.mode === 'edit' && e.key === '3') setTool('erase');
    // R: over a placed fence / wall -> turn it; otherwise turn the brush
    else if (S.mode === 'edit' && e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
      if (!(S.tool !== 'draw' && S.hover && rotatePlaced(S.hover[0], S.hover[1]))) rotatePick() || (S.hover && rotatePlaced(S.hover[0], S.hover[1]));
    }
  });
  window.addEventListener('keyup', e => S.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => S.keys.clear());

  // start: ?map=<original map name> | autosave | new map
  const params = new URLSearchParams(location.search);
  let doc = null;
  if (params.get('samgukMap')) {
    const name = params.get('samgukMap');
    const response = await fetch(`/samguk/content/samguk/maps/${encodeURIComponent(name)}.map.json`);
    if (!response.ok) throw new Error(`맵 불러오기 실패: ${name}`);
    doc = D.normalize(await response.json(), name);
  }
  else if (params.get('map')) doc = D.normalize(JSON.parse(await (await fetch(`/re/extract/text/${params.get('map')}.bytes`)).text()), params.get('map'));
  else { try { doc = JSON.parse(localStorage.getItem(AUTOSAVE) || 'null'); } catch { doc = null; } }
  await openDoc(doc || D.newDoc('새 맵', 12));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!S.busy) {
      if (S.mode === 'run' && !S.paused) runStep(dt);
      else if (S.mode === 'edit') {
        // paused world: only the idle animations play
        for (const a of S.actors.values()) for (const an of a.go.getInChildren(Animator)) an.update(dt);
      }
      renderer.clear(0.03, 0.06, 0.09);
      drawWorld(renderer, G.CameraManager, size.w / size.h);
      drawOverlay();
    }
    if (S.mode === 'edit') $('zPct').textContent = `${Math.round(GAME_CAMERA / G.CameraManager.size * 100)}%`;
    dbg.textContent = `${S.doc?.name || ''} · 유닛 ${S.doc?.maker.units.length || 0} · 나무 ${S.doc?.maker.trees.length || 0}` +
      (S.mode === 'run' ? ` · 아군 ${G.UnitManager.HeroUnits.filter(h => !h.IsDead()).length} · 적군 ${G.UnitManager.monsters.filter(m => !m.IsDead()).length}` : '');
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch(e => { dbg.textContent = 'ERROR: ' + e.stack; console.error(e); });
