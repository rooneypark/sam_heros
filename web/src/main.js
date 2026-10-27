// Rumble Heroes (local web port) — game bootstrap and frame loop (engine/managers come from boot.js).
import { orthoView } from './engine/renderer.js';
import { G } from './game/registry.js';
import { Tables } from './game/data/Tables.js';
import { Timing } from './game/core/Timing.js';
import { saveGame, loadSave, hasSave, clearSave } from './game/Save.js';
import { bootEngine, loadWorld, stepWorld, drawWorld } from './boot.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const stage = document.getElementById('stage');
const dbg = document.getElementById('debug');
const ASPECT = 9 / 19.5;

function layout(renderer) {
  let h = window.innerHeight, w = Math.round(h * ASPECT);
  if (w > window.innerWidth) { w = window.innerWidth; h = Math.round(w / ASPECT); }
  stage.style.width = w + 'px'; stage.style.height = h + 'px';
  renderer.resize(w, h, window.devicePixelRatio || 1);
  G.UI?.resize(w, h);
  return { w, h };
}

async function main() {
  const { renderer } = await bootEngine(canvas);
  // ?pack=samguk: the planners' table changes (content/samguk/tables/overrides.json) over the original data
  if (params.get('pack') === 'samguk') {
    const { loadSamgukOverrides } = await import('./packs/samguk.js');
    console.info('samguk overrides:', await loadSamgukOverrides());
    G.UnitManager.Initialize();                 // distances read from TableDefine at boot
    G.User.heroMax = Tables.define('PROLOGUE_HERO_COUNT');
  }
  let size = layout(renderer);
  window.addEventListener('resize', () => { size = layout(renderer); });
  G.loadWorld = loadWorld;

  if (params.has('new')) clearSave();
  const save = !params.get('map') && hasSave() ? loadSave() : null;
  const mapName = save ? save.map : (params.get('map') || 'World_prologue');
  G.User.isPrologue = mapName === 'World_prologue';
  G.User.instantInvincibility = G.User.isPrologue;
  if (!G.User.isPrologue && !save) G.User.heroMax = Tables.define('DEFAULT_HERO_COUNT');
  if (save) {
    // party from the saved hero data (levels), buildings restored as completed
    const party = save.party.map(k => ({ key: k, level: G.UserHero.GetHero(k)?.lv ?? 0 }));
    await G.loadWorld(mapName, party);
    await G.Buildings.restoreBuilt(save.built);
    G.Pub.resetAt = Timing.time + (G.Pub.pendingLeft ?? 0);
    if (save.pos) G.UnitManager.WarpHero(save.pos[0], save.pos[1]);
  } else {
    // UserHero.InitData: a new user owns Unit000570 at level 59 for the prologue
    await G.loadWorld(mapName, G.User.isPrologue ? [{ key: params.get('hero') || 'Unit000570', level: +(params.get('lv') || 59) }]
      : [{ key: 'Unit000001', level: +(params.get('lv') || 0) }]);
    if (!G.User.isPrologue) G.UserHero.AddHero('Unit000001', 0, +(params.get('lv') || 0));
  }
  // autosave (UserDataManager.OnSaveData)
  setInterval(saveGame, 10000);
  window.addEventListener('beforeunload', saveGame);
  G.HeroManager.Control = true;
  window.__G = G;

  // ---------------------------------------------------------------- input
  const toCanvas = e => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width * G.UI.canvas.w, (1 - (e.clientY - r.top) / r.height) * G.UI.canvas.h];
  };
  let down = false;
  canvas.addEventListener('pointerdown', e => { down = true; canvas.setPointerCapture(e.pointerId); const [x, y] = toCanvas(e); G.PrologueManager.onTouch();
    const cam = G.CameraManager, k = cam.size * 2 / G.UI.canvas.h;
    const wx = cam.position[0] + (x - G.UI.canvas.w / 2) * k, wy = cam.position[1] + (y - G.UI.canvas.h / 2) * k;
    // an open popup takes the tap: the world (buildings) behind it is not clickable
    if (G.UI.hasModal() || !G.Buildings.pointerDown(wx, wy)) G.UI.pointerDown(x, y); });
  canvas.addEventListener('pointermove', e => { if (down) { const [x, y] = toCanvas(e); G.UI.pointerMove(x, y); } });
  const up = () => { if (down) { down = false; G.UI.pointerUp(); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  // mouse wheel scrolls popup lists (ScrollRect); on the world map it zooms
  canvas.addEventListener('wheel', e => { const [x, y] = toCanvas(e); if (G.UI.wheel(x, y, e.deltaY)) e.preventDefault(); }, { passive: false });
  // keyboard joystick for desktop testing (WASD / arrows)
  const keys = new Set();
  G.keys = keys;
  window.addEventListener('keydown', e => keys.add(e.key.toLowerCase()));
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  let last = performance.now(), fps = 60;
  function step(dt) {
    if (!down) {
      const kx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
      const ky = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const J = G.HeroManager.Joystick;
      J.isPointDown = (kx || ky) && G.HeroManager.control ? true : false;
      J.Direction = [kx, ky];
    }
    stepWorld(dt);
    G.CameraManager.update(dt);
    if (G.UI.hud) { G.HUD.bind(G.UI.hudFind); G.UI.updateHUD(dt); }
  }
  /** debug: advance the simulation synchronously (seconds) */
  G.sim = (sec, dt = 1 / 60) => { for (let t = 0; t < sec; t += dt) step(dt); };
  /** debug autopilot: drive the joystick along the navmesh path towards (x,y) for up to `sec` seconds */
  G.goto = (x, y, sec = 10, stopDist = 1.5) => {
    const dt = 1 / 60;
    for (let t = 0; t < sec; t += dt) {
      const c = G.HeroManager.heroCenterPos;
      if (Math.hypot(x - c[0], y - c[1]) < stopDist) break;
      const p = G.MapManager.navmesh.path(c[0], c[1], x, y) || [{ x, y }];
      const n = p.find(q => Math.hypot(q.x - c[0], q.y - c[1]) > 0.6) || p[p.length - 1];
      const dx = n.x - c[0], dy = n.y - c[1], L = Math.hypot(dx, dy) || 1;
      down = true;
      G.HeroManager.Joystick.isPointDown = G.HeroManager.control;
      G.HeroManager.Joystick.Direction = [dx / L, dy / L];
      step(dt);
    }
    down = false;
    G.HeroManager.Joystick.isPointDown = false;
  };
  let sleepFrame = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fps = fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    step(dt);
    G.SleepMode?.update(dt);
    // UISleepModeView.OnSleepMode: renderFrameInterval 3 and the main camera off
    sleepFrame = (sleepFrame + 1) % 3;
    if (!G.SleepMode?.rendering && sleepFrame) { requestAnimationFrame(frame); return; }

    renderer.clear(0, 0, 0);
    if (G.SleepMode?.rendering !== false) drawWorld(renderer, G.CameraManager, size.w / size.h);
    // ---- UI pass (canvas units)
    renderer.begin();
    G.UI.draw(renderer);
    const cw = G.UI.canvas.w, ch = G.UI.canvas.h;
    renderer.flush(orthoView(cw / 2, ch / 2, ch / 2, cw / ch));

    const hp = G.HeroManager.transform.position;
    dbg.textContent = `${mapName} fps ${fps.toFixed(0)} draws ${renderer.stats.draws}\n` +
      `HM ${hp[0].toFixed(1)},${hp[1].toFixed(1)} heroes ${G.UnitManager.HeroUnits.length} monsters ${G.UnitManager.monsters.length}`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main().catch(e => { dbg.textContent = 'ERROR: ' + e.stack; console.error(e); });
