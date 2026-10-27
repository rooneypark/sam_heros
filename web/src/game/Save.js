// Local save (stand-in for UserDataManager.OnSaveData / server sync): localStorage snapshot of the user data.
import { G } from './registry.js';
import { Timing } from './core/Timing.js';

const KEY = 'rumble_heroes_save_v1';

export function hasSave() { try { return !!localStorage.getItem(KEY); } catch { return false; } }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

export function saveGame() {
  if (G.User.isPrologue) return;
  const data = {
    map: G.MapManager.mapName,
    inventory: [...G.Inventory.items],
    user: { level: G.UserData.Level, exp: G.UserData.Exp, heroMax: G.User.heroMax },
    quest: G.Quest.current,
    heroes: [...G.UserHero.datas.values()],
    party: G.UnitManager.HeroUnits.map(h => h.Key),
    built: [...G.Buildings.built],
    tutorial: [...G.Tutorial.completed],
    pub: { lineup: G.Pub.lineup, drawn: G.Pub.drawn, pubCount: G.Pub.pubCount, confirmIndex: G.Pub.confirmIndex ?? -1, bonusCount: G.Pub.bonusCount, bonusStep: G.Pub.bonusStep, confirmHero: G.Pub.confirmHero, left: G.Pub.resetAt - Timing.time },
    pos: G.HeroManager.transform.position,
    training: { level: G.Training.level },
    instant: G.InstantQuest?.save(),
    fame: G.Fame?.grade ?? 0,
    contribution: G.Contribution?.save(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage blocked */ }
}

export function loadSave() {
  let d;
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { d = null; }
  if (!d) return null;
  G.Inventory.items = new Map(d.inventory);
  G.UserData.Level = d.user.level; G.UserData.Exp = d.user.exp; G.User.heroMax = d.user.heroMax;
  G.Quest.current = d.quest;
  G.UserHero.datas = new Map(d.heroes.map(h => [h.key, h])); G.UserHero.index = d.heroes.length;
  for (const k of d.tutorial) G.Tutorial.completed.add(k);
  Object.assign(G.Pub, { lineup: d.pub.lineup, drawn: d.pub.drawn, pubCount: d.pub.pubCount, confirmIndex: d.pub.confirmIndex ?? -1, bonusCount: d.pub.bonusCount ?? 0, bonusStep: d.pub.bonusStep ?? 0, confirmHero: d.pub.confirmHero ?? '' });
  G.Pub.pendingLeft = d.pub.left;
  if (d.training) G.Training.level = d.training.level;
  G.InstantQuest?.load(d.instant);
  if (G.Fame) G.Fame.grade = d.fame ?? 0;
  G.Contribution?.load(d.contribution);
  return d;
}
