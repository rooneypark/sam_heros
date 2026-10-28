// Shared engine/game bootstrap used by the game (main.js) and the map maker / simulator (maker/maker.js):
// renderer + assets + tables, every manager on G, the per-frame simulation step and the world draw pass.
import { Renderer, orthoView } from './engine/renderer.js';
import { NavMeshAgent } from './engine/navmesh.js';
import { updateParticles } from './engine/particles.js';
import { Assets } from './engine/assets.js';
import { initPrefabs } from './engine/prefab.js';
import { drawTree } from './engine/components.js';
import { initFonts } from './engine/text.js';
import { G } from './game/registry.js';
import { Tables } from './game/data/Tables.js';
import { Timing } from './game/core/Timing.js';
import { MapManager } from './game/managers/MapManager.js';
import { HeroManager, CameraManager } from './game/managers/HeroManager.js';
import { UnitManager } from './game/managers/UnitManager.js';
import { PrologueManager, GameState } from './game/managers/PrologueManager.js';
import { Effects, Bullets, WorldUI, PackFx } from './game/world/WorldFX.js';
import { Npcs } from './game/world/Npc.js';
import { UIManager } from './game/ui/UIManager.js';
import { Buildings, FogMap, Inventory } from './game/world/Buildings.js';
import { UserTutorial, GameFlow } from './game/GameFlow.js';
import { UserQuest } from './game/Quest.js';
import { UserHero } from './game/Heroes.js';
import { PubState } from './game/Pub.js';
import { Bonfires, resurrectHero } from './game/world/Bonfire.js';
import { TrainingState } from './game/Training.js';
import { HUD } from './game/ui/HUD.js';
import { SoundManager } from './game/core/Sound.js';
import { UserOption } from './game/Option.js';
import { InstantQuests } from './game/InstantQuest.js';
import { FameState, ContributionState } from './game/Fame.js';
import { SleepMode } from './game/SleepMode.js';
import { Drops, Resources, UserData } from './game/world/Resources.js';

/** Physics2D approximations against the walkable mesh (baked navmesh or the maker's grid). */
const Physics = {
  raycastClear(x0, y0, x1, y1) { return G.MapManager.navmesh ? G.MapManager.navmesh.raycastClear(x0, y0, x1, y1) : true; },
  raycastHit(x0, y0, x1, y1) {
    const nav = G.MapManager.navmesh; if (!nav) return null;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.25);
    for (let i = 1; i <= n; i++) { const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k; if (nav.findPoly(x, y) < 0) return [x, y]; }
    return null;
  },
};

/** renderer, assets, tables, fonts and every manager on G. opts.hud = false skips the game HUD canvas. */
export async function bootEngine(canvas, opts = {}) {
  const renderer = new Renderer(canvas);
  const assets = new Assets(renderer);
  await assets.init();
  await initPrefabs();
  await Tables.load(assets);
  await initFonts(assets);
  G.assets = assets;
  G.renderer = renderer;
  G.Physics = Physics;
  G.UI = new UIManager();
  if (opts.hud !== false) await G.UI.initHUD();

  G.GameState = new GameState();
  G.CameraManager = new CameraManager();
  G.HeroManager = new HeroManager();
  G.UnitManager = new UnitManager();
  G.MapManager = new MapManager();
  G.PrologueManager = new PrologueManager();
  G.Effects = new Effects();
  G.Bullets = new Bullets();
  G.WorldUI = new WorldUI();
  G.PackFx = new PackFx();                         // content-pack effects (units.json motion fx)
  G.Npc = new Npcs();
  G.Sound = new SoundManager();
  G.Option = new UserOption();
  G.InstantQuest = new InstantQuests();
  G.Fame = new FameState();
  G.Contribution = new ContributionState();
  G.SleepMode = new SleepMode();
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { if (!G.SleepMode?.open) G.Sound.unlock(); G.SleepMode?.input(); }, true);
  G.Inventory = new Inventory();
  G.Buildings = new Buildings();
  G.Drops = new Drops();
  G.Resources = new Resources();
  G.UserData = new UserData();
  G.Quest = new UserQuest();
  G.UserHero = new UserHero();
  G.Pub = new PubState();
  G.Bonfires = new Bonfires();
  G.Training = new TrainingState();
  G.UnitManager.ResurrectionHero = u => resurrectHero(u, 1);
  G.HUD = new HUD();
  G.GameState.on((msg, ...a) => G.PrologueManager.OnEvent(msg, ...a));
  G.UnitManager.Initialize();
  G.Tutorial = new UserTutorial();
  G.Flow = new GameFlow();
  G.User.heroMax = Tables.define('PROLOGUE_HERO_COUNT');
  NavMeshAgent.blocker = (x, y) => G.Fog && G.Fog.blocks(x, y);
  return { renderer, assets };
}

/** remove every actor / effect / building of the current map (MapManager.Initialize clean-up) */
export function clearWorld() {
  Timing.KillTag('UnitManagerBT');
  for (const s of [...G.MapManager.spawners, ...G.MapManager.resourceSpawners]) Timing.KillOwner(s);
  G.Drops.list.length = 0;
  for (const u of [...G.UnitManager.all]) G.UnitManager.despawn(u);
  G.UnitManager.HeroUnits.length = 0; G.UnitManager.LeaderHero = null;
  G.HeroManager.HeroUnits.length = 0; G.HeroManager.DeadHeroes.length = 0;
  G.Npc.list.length = 0; G.Effects.list.length = 0; G.Bullets.list.length = 0;
  G.WorldUI.nums.length = 0; G.WorldUI.talks.length = 0;   // damage / EXP numbers and speech bubbles
  G.PackFx.list.length = 0;
  G.Buildings.list.length = 0; G.Buildings.drops.length = 0; G.Buildings.completed.length = 0; G.Buildings.built.clear(); G.Bonfires.list.length = 0; G.Bonfires.current = null;
  G.UI.popups.length = 0;
}

/** MapManager.Initialize: (re)load a world map (name or parsed map JSON), its buildings/fog, and the party */
export async function loadWorld(name, party, json = null) {
  clearWorld();
  // content-pack maps carry their own TableWorldBuilding rows (rescue sites, hero joins, fog gates): "buildingDefs"
  for (const [k, row] of Object.entries(json?.buildingDefs || {})) Tables.t.TableWorldBuilding[k] = { ...row, key: k };
  await G.MapManager.load(name, json);
  const world = Object.values(Tables.t.TableWorld).find(w => w.mapName === name);
  if (world?.bgm) G.Sound.bgm(world.bgm);
  G.Fog = new FogMap();
  await G.Buildings.spawnAll(G.MapManager.json.Buildings || []);
  for (const n of G.MapManager.json.npcs || []) await G.Npc.spawn(n.key,n.x,n.y);
  const start = G.MapManager.GetStartPosition();
  G.HeroManager.transform.position = start;
  G.CameraManager.position = [...start];
  for (const p of party) await G.UnitManager.CreateHero(p.key, p.level);
  Timing.RunCoroutine(G.UnitManager.CorUnitManagerBT(), null, 'UnitManagerBT');
}

/** one simulation step (the frame order of the game) */
export function stepWorld(dt) {
  G.dt = dt;
  Timing.update(dt);
  G.MapManager.resolver.time += dt;
  G.HeroManager.update(dt);
  G.Flow.update();
  const lead = G.UnitManager.LeaderHero;
  if (lead) { G.MapManager.SetCurrentMapActive(lead.transform.position); G.Bonfires.check(lead.transform.position); }
  G.MapManager.update(dt);
  G.UnitManager.update(dt);
  G.Npc.update(dt);
  G.Buildings.update(dt);
  G.Resources.update(dt);
  G.Drops.update(dt);
  G.Effects.update(dt);
  G.PackFx.update(dt);
  updateParticles(dt);
  G.Bullets.update(dt);
  G.WorldUI.update(dt);
}

/** world pass: map, fog, buildings, resources, units, effects, bullets, drops, world UI (+ extra(renderer, view)) */
export function drawWorld(renderer, cam, aspect, extra = null, options = {}) {
  const halfH = cam.size, halfW = cam.size * aspect;
  const view = { x0: cam.position[0] - halfW, x1: cam.position[0] + halfW, y0: cam.position[1] - halfH, y1: cam.position[1] + halfH };
  renderer.begin();
  G.MapManager.view.draw(renderer, view);
  if (options.showFog !== false) G.Fog?.draw(renderer, view);
  G.Buildings.draw(renderer, view);
  G.Resources.draw(renderer, view);
  for (const u of G.UnitManager.all) drawTree(renderer, G.assets, u.go, view);
  G.Npc.draw(renderer, view);
  G.Effects.draw(renderer, view);
  G.PackFx.draw(renderer);
  G.Bullets.draw(renderer, view);
  G.Drops.draw(renderer, view);
  G.WorldUI.draw(renderer);
  extra?.(renderer, view);
  renderer.flush(orthoView(cam.position[0], cam.position[1], cam.size, aspect));
  return view;
}
