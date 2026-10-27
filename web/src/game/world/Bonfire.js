// BonfireActor (ActiveBonfire @0x39084c4, InactiveBonfire, CorHeal) + hero resurrection
// (UnitActor.<CorField> WORLD_RESURRECTION_TIME, CorResurrectionUnit, UnitManager.ResurrectionHero @0x2241948).
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { Random } from '../../engine/unitymath.js';
import { UNIT_STATE } from '../defs.js';

/** CorResurrectionUnit(hpRate): reset the unit, HP x rate, warp next to the hero group (Random(-1,1) each axis) */
export function resurrectHero(u, hpRate = 1) {
  if (!u.IsDead()) return;
  Timing.KillTag?.('CorField_' + u.Key);
  u.CCClear?.();
  u.Body.OnRebirth();
  u.SetState(UNIT_STATE.IDLE);
  u.UnitData.RestoreHp(); u.AddUnitData.RestoreHp();
  if (hpRate < 1) u.UnitData.CurrentHP = Math.round(u.UnitData.GetStat(0) * hpRate);
  const c = G.HeroManager.GetHeroCenterPos ? G.HeroManager.heroCenterPos : G.HeroManager.transform.position;
  u.WarpHero(c[0] + Random.range(-1, 1), c[1] + Random.range(-1, 1));
  const i = G.HeroManager.DeadHeroes.indexOf(u); if (i >= 0) G.HeroManager.DeadHeroes.splice(i, 1);
  G.HeroManager.AddHero(u);
  u.resurrectAt = 0;
  u.resurrection = null;   // WorldUIResurrection despawn
  G.GameState.send('RSRT_HERO', u.Key);
}

export class Bonfires {
  constructor() { this.list = []; this.current = null; }
  /** a completed bonfire building (category 0) with its town IncludeTiles */
  add(b) {
    const site = G.MapManager.json.Buildings.find(x => x.key === b.key);
    const tiles = new Set((site?.IncludeTiles || []).map(t => `${t.x},${t.y}`));
    this.list.push({ key: b.key, data: b.data, pos: b.pos, tiles, Activate: false });
  }
  /** MapGenerator.SetCurrentMapActive: leader cell inside the bonfire tiles -> ActiveBonfire, else InactiveBonfire */
  check(pos) {
    if (G.User.isPrologue) return;
    const c = G.MapManager.worldToCell(pos[0], pos[1]);
    const k = `${c.x},${c.y}`;
    const inside = this.list.find(b => b.tiles.has(k)) || null;
    if (inside === this.current) return;
    if (this.current) this.inactive(this.current);
    if (inside) this.active(inside);
  }
  active(b) {
    this.current = b; b.Activate = true;
    G.MapManager.BonfireActor = b;
    // ResurrectionHero: everyone dead comes back at the bonfire
    for (const u of [...G.HeroManager.DeadHeroes]) resurrectHero(u, 1);
    const town = Tables.get('TableTown', b.data.town);
    G.UI.toast(Tables.loc(town?.name || 'LocalizeBuildingName000027'));
    // CorHeal: every createTimer s heal createAmount to each hero
    const self = this;
    b.heal = Timing.RunCoroutine((function* () {
      while (b.Activate) {
        for (const u of G.UnitManager.HeroUnits) if (!u.IsDead()) u.Damage(-(b.data.createAmount || 0), false, 0, true, false, false);
        yield b.data.createTimer || 1;
      }
    })(), null);
  }
  inactive(b) { b.Activate = false; this.current = null; G.MapManager.BonfireActor = null; }
}
