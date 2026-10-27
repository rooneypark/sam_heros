// UnitManager port (UnitManager @0x22400bc.., CorUnitManagerBT @0x224ab64).
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { TEAM, UNIT_STATE } from '../defs.js';
import { UnitActor } from '../actor/UnitActor.js';
import { loadPrefab, instantiate, spriteNamesInTree } from '../../engine/prefab.js';
import { Animator } from '../../engine/components.js';

/** Addressable folder of a unit prefab (Hero_/Mercenary_/NPC_/monsters) */
export function actorPrefabPath(prefab) {
  const p = prefab.toLowerCase();
  const folder = p.startsWith('hero') ? 'hero' : p.startsWith('mercenary') ? 'mercenary' : p.startsWith('npc') ? 'npc' : 'monster';
  return `prefab/actor/${folder}/${p}`;
}

export class UnitManager {
  constructor() {
    this.HeroUnits = [];
    this.LeaderHero = null;
    this.monsters = [];
    this.all = [];
  }

  /** Initialize @0x22406xx: distances from TableDefine */
  Initialize() {
    const D = k => Tables.define(k);
    this.HeroReturnDist_Camp = D('CAMPING_RETURN_DIST');
    this.MonsterRoamDist_Normal = D('MONSTER_ROAMING_DIST');
    this.MonsterRoamDist_Camp = D('CAMPING_ROAM_DIST');
    this.MonsterFindDist_Normal = D('HERO_RETURN_DIST') + D('MONSTER_ROAMING_DIST');
    this.MonsterFindDist_Camp = D('CAMPING_RETURN_DIST') + D('CAMPING_ROAM_DIST');
    this.MonsterIdleDist = D('MONSTER_MOVE_DIST');
    this.MonsterIdleDistSqrt = this.MonsterIdleDist * this.MonsterIdleDist;
    this.ResurrectionTime = D('WORLD_RESURRECTION_TIME');
    this.ArrowDist = D('ARROW_DIST_RATE');
    this.UpdateReturnDist();
  }

  /** UpdateReturnDist @0x22400bc */
  UpdateReturnDist() {
    const D = k => Tables.define(k);
    this.HeroReturnDist_Normal = D('HERO_RETURN_DIST');
    const def = Math.round(D('HERO_RETURN_DIST_DEFAULT'));
    const n = G.HeroManager ? G.HeroManager.GetHeroCount() : 0;
    const max = Math.round(D('HERO_RETURN_DIST_MAX'));
    if (n > def) {
      const k = Math.min(n - def, max);
      for (let i = 0; i < k; i++) this.HeroReturnDist_Normal += D('HERO_RETURN_DIST_ADD');
    }
  }
  GetReturnDist() { return this.HeroReturnDist_Normal; }
  GetArrowDist() { return (this.HeroReturnDist_Normal + 1) * this.ArrowDist; }

  allActors() { return G.Resources ? this.all.concat(G.Resources.actors()) : this.all; }
  /** Physics2D.OverlapCircle on the unit layer (collider radius included) */
  overlapUnits(x, y, r) {
    return this.all.filter(u => { const p = u.transform.position; const rr = r + u.colliderRadius; return (p[0] - x) ** 2 + (p[1] - y) ** 2 <= rr * rr; });
  }

  async spawnActor(key, level, team, x, y, spawner = null) {
    const t = Tables.unit(key);
    const json = await loadPrefab(actorPrefabPath(t.prefab));
    const go = instantiate(json, G.assets);
    await G.assets.preloadSprites(spriteNamesInTree(json));
    // preload all animation frames used by its controller and skill clips
    const names = new Set();
    for (const a of go.getInChildren(Animator)) {
      for (const st of Object.values(a.controller?.states || {})) addClip(names, st.clip);
    }
    const us = Tables.get('TableUnitSkill', t.skillKey);
    const row = Tables.unitSkillFor(us ? us.category : t.category, level) || us;
    const g = Tables.skillGroup(row?.skillGroup);
    for (const k of [g?.defaultSkill, g?.skillA, g?.skillB, g?.gatheringSkill]) {
      const s = Tables.skill(k); if (s) addClip(names, s.animationKey);
    }
    await G.assets.preloadSprites(names);
    go.transform.lp = [x, y, 0];
    if (t.spriteRemap) { go.spriteRemap = t.spriteRemap; go.spriteRemapFlip = !!t.artFlip; await t.artReady; }   // content-pack art (packs/samguk.js)
    const u = new UnitActor(go);
    u.Spawner = spawner;
    u.Initialize(key, level, team);
    u.Body.Warp(x, y);
    this.all.push(u);
    if (team === TEAM.ENEMY) this.monsters.push(u);
    return u;
  }

  /** CreateHero(key, skin, level, ...) */
  async CreateHero(key, level) {
    const p = G.HeroManager.transform.position;
    const u = await this.spawnActor(key, level, TEAM.PLAYER, p[0], p[1]);
    this.HeroUnits.push(u);
    G.HeroManager.AddHero(u);
    if (!this.LeaderHero) this.LeaderHero = u;
    return u;
  }

  despawn(u) {
    const rm = (l) => { const i = l.indexOf(u); if (i >= 0) l.splice(i, 1); };
    rm(this.all); rm(this.monsters); rm(this.HeroUnits);
    if (u.Spawner) rm(u.Spawner.ActorList);
    Timing.KillOwner(u);
    u.go.destroyed = true;
    if (this.LeaderHero === u) this.LeaderHero = this.HeroUnits[0] || null;
  }

  /** WarpHero(pos, all) */
  WarpHero(x, y) {
    G.HeroManager.transform.position = [x, y];
    for (const h of this.HeroUnits) { const a = Math.random() * Math.PI * 2; h.WarpHero(x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3); }
  }

  /** CorUnitManagerBT: heroes every MY_BT_TIME while control */
  *CorUnitManagerBT() {
    const S = G.UnitManagerStatic;
    for (;;) {
      if (!G.HeroManager.control) { yield -Infinity; continue; }
      for (const h of [...this.HeroUnits]) {
        if (!G.HeroManager.control) break;
        if (!h.go.activeInHierarchy) continue;
        for (let i = h.BuffDatas.length - 1; i >= 0; i--) {
          if (h.BuffDatas[i].BuffTime <= 0) { h.BuffDatas.splice(i, 1); h.ResetBuff(); }
          else h.BuffDatas[i].BuffTime -= S.MY_BT_TIME;
        }
        h.BT?.run();
      }
      yield S.MY_BT_TIME;
    }
  }

  update(dt) {
    const agents = this.all.map(u => u.Body.agent);
    for (const u of this.all) u.update(dt, agents);
    for (const u of this.all) if (u.ccList.length) u.tickBuffs(dt);
  }
}

function addClip(set, clip) {
  const a = G.assets.anims[clip];
  if (!a) return;
  for (const tr of a.sprites || []) for (const [, n] of tr.frames) if (typeof n === 'string') set.add(n);
}
