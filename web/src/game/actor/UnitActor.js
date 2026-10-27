// UnitActor port (UnitActor @0x3c317a0..). Field names follow dump.cs so asm cross-references stay readable.
import { UnitData, UNIT_STAT, CC_TYPE, actorGetCC, actorGetSlow, actorGetStat } from '../data/UnitData.js';
import { Tables } from '../data/Tables.js';
import { ActorSkill } from '../skill/Skill.js';
import { createBT, BT_TYPE } from '../ai/BT.js';
import { Timing, waitFrame, waitSecond } from '../core/Timing.js';
import { G } from '../registry.js';
import { tryLoot, monsterExp } from '../world/Resources.js';
import { applyTraining } from '../Training.js';
import { applyFame } from '../Fame.js';
import { E, TEAM, UNIT_STATE, ACTOR_TYPE, CAST_TYPE, CONDITION_TYPE, ELITE_TYPE } from '../defs.js';
import { UnitBody } from './UnitBody.js';
import { SpriteRenderer } from '../../engine/components.js';
import { Random } from '../../engine/unitymath.js';

const EPS = Math.fround(0.001);
const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export class UnitActor {
  constructor(root) {
    this.go = root;
    this.transform = root.transform;
    this.ActorType = ACTOR_TYPE.UNIT;
    this.isUnit = true; this.isResource = false; this.isBuilding = false;
    this.Team = TEAM.PLAYER;
    this.Key = '';
    this.Level = 1;
    this.UnitData = new UnitData();
    this.AddUnitData = new UnitData();
    this.Target = null;
    this.Spawner = null;
    this._currentState = UNIT_STATE.IDLE;
    this._currentSkill = null;
    this._skills = [];
    this.IdleTimer = 0;
    this.Evasion = false;
    this._basePosition = [0, 0];
    this.BuffDatas = [];
    this.ccList = [];
    this._firstAttack = 0;
    this.BT = null;
    // components from the prefab (SpriteBody child, Shadow, UnitUI)
    const bodyGo = [...root.walk()].find(g => (g.scripts || []).some(s => s.script === 'SpriteBody'));
    const agentData = (root.builtins || []).find(c => c.type === 'NavMeshAgent') || {};
    const col = (root.builtins || []).find(c => c.type === 'CircleCollider2D');
    this.colliderRadius = col?.m_Radius ?? 0.5;
    this.Body = new UnitBody(this, root, bodyGo || root, agentData);
    this.UnitBody = this.Body;
    this.ShadowGo = root.find('Shadow');
    this.Shadow = this.ShadowGo ? { go: this.ShadowGo } : null;
    this.UIGo = [...root.walk()].find(g => g.name === 'UnitUI') || root;
    this.hpBar = { show: 0 };
  }

  get CurrentSkill() { return this._currentSkill; }
  set CurrentSkill(v) { this._currentSkill = v; }
  get BasePosition() {
    if (this.Team === TEAM.PLAYER) return G.HeroManager.transform.position;
    return this._basePosition;
  }
  set BasePosition(v) { this._basePosition = [v[0], v[1]]; }

  // ------------------------------------------------------------ init
  /** Initialize(key, level) @0x3c317a0 */
  Initialize(key, level, team) {
    this.Key = key; this.Level = level; this.Team = team;
    this.Body.Team = team;
    this.BuffDatas = []; this.ccList = [];
    this.Evasion = false;
    this.Target = null; this.CurrentSkill = null; this._packTaunt = null;
    this.TableUnitData = Tables.unit(key);
    this._tableUnitStatData = Tables.unitStat(this.TableUnitData.statKey);
    this.Body.SetBody(key);
    this.ResetSkill();
    this.SetLvStat();
    this.AddUnitData = new UnitData();
    this._currentState = -1;
    this.SetState(UNIT_STATE.IDLE);
    this.UnitData.InstantStop = false;
    this.UnitData.RestoreHp(); this.AddUnitData.RestoreHp();
    this.Body.OnRebirth();
    if (this.ShadowGo) {
      this.ShadowGo.setActive(true);
    }
    this._basePosition = this.transform.position;
    if (team !== TEAM.PREVIEW) this.BT = createBT(this, team === TEAM.PLAYER ? BT_TYPE.PLAYER : BT_TYPE.ENEMY);
  }

  /** SetLvStat @0x3c32704 */
  SetLvStat() {
    const st = this._tableUnitStatData;
    this.UnitData = UnitData.fromTable(st);
    this.UnitData.EliteType = E(ELITE_TYPE, st.eliteType);
    const growth = st.growthType === 'GROWTH';
    if ((growth && this.Team === TEAM.PLAYER) || this.Key === 'Unit000624') {
      this.UnitData.AddStat(UNIT_STAT.HP, st.growthHp * this.Level);
      this.UnitData.AddStat(UNIT_STAT.DAMAGE, st.growthDamage * this.Level);
    } else {
      const b = Tables.baseStat(this.Level);
      if (!growth) {
        this.UnitData.AddStat(UNIT_STAT.HP, b.hp * st.growthHp * Math.fround(0.01));
        this.UnitData.AddStat(UNIT_STAT.DAMAGE, b.damage * st.growthDamage * Math.fround(0.01));
      } else {
        this.UnitData.AddStat(UNIT_STAT.HP, b.hp * Tables.define('GROWTH_TO_BASE', 0) * Math.fround(0.01));
        this.UnitData.AddStat(UNIT_STAT.DAMAGE, b.damage * Tables.define('GROWTH_TO_BASE', 1) * Math.fround(0.01));
      }
    }
    // UserHero passive stats (training school ADDITION upgrades) for heroes in the world
    if (this.Team === TEAM.PLAYER && !G.User.isPrologue) { applyTraining(this); applyFame(this); }
    if (this.UnitData.CurrentHP > this.UnitData.MaxHP) this.UnitData.CurrentHP = this.UnitData.MaxHP;
  }

  /** ResetSkill/SetSkill @0x3c34dd8 */
  ResetSkill() {
    const us = Tables.get('TableUnitSkill', this.TableUnitData.skillKey);
    const row = Tables.unitSkillFor(us ? us.category : this.TableUnitData.category, this.Level) || us;
    const g = Tables.skillGroup(row?.skillGroup);
    this._tableSkillGroupData = g;
    this._skills = [];
    const mk = k => { const d = Tables.skill(k); return d ? new ActorSkill(this, d) : null; };
    const A = mk(g?.skillA), B = mk(g?.skillB), D = mk(g?.defaultSkill), Ga = mk(g?.gatheringSkill);
    for (const s of (g?.isFirstB ? [B, A] : [A, B])) if (s) this._skills.push(s);
    if (D) this._skills.push(D);
    if (Ga) this._skills.push(Ga);
    this._gatheringSkill = Ga;
    const anim = s => s?.TableSkillData.animationKey || null;
    this.Body.SetAnimation([anim(D), anim(Ga), anim(A), anim(B)]);
  }

  // ------------------------------------------------------------ stats
  TotalStat() { return UnitData.add(this.UnitData, this.AddUnitData); }
  GetStat(s) { return actorGetStat(this.UnitData, this.AddUnitData, s); }
  /** UnitActor.GetData @0x3c41c18: only DETECT_UNIT_RANGE (unsquared) */
  GetData(s) { return s === UNIT_STAT.DETECT_UNIT_RANGE ? this.UnitData.DetectUnitRange + this.AddUnitData.DetectUnitRange : 0; }
  GetCC(t) { return actorGetCC(this.UnitData, this.AddUnitData, t); }
  GetSlow() { return actorGetSlow(this.UnitData, this.AddUnitData); }
  IsFrozen() { return this.GetCC(CC_TYPE.FROZEN) > EPS; }
  IsStun() { return this.GetCC(CC_TYPE.STUN) > EPS || this.IsFrozen(); }
  IsBondage() { return this.GetCC(CC_TYPE.BONDAGE) > EPS; }
  IsTaunt() {
    const t = this._packTaunt;
    if (!t || Timing.time >= t.until || t.source.IsDead() || t.source.Team === this.Team) { this._packTaunt = null; return false; }
    this.Target = t.source;
    return true;
  }
  IsInVincibility() { return this.TotalStat().Invincibility; }
  IsDead() {
    if (this.UnitData.CurrentHP + this.AddUnitData.CurrentHP <= EPS) return true;
    return this._currentState === UNIT_STATE.DEAD;
  }
  GetHP() { return this.UnitData.CurrentHP + this.AddUnitData.CurrentHP; }
  GetHPRate() { const m = this.GetStat(UNIT_STAT.HP); return m > 0 ? this.GetHP() / m : 0; }
  GetHPRateNonShield() { return this.GetHPRate(); }
  GetShieldRate() { const m = this.GetStat(UNIT_STAT.HP); return m > 0 ? this.GetStat(UNIT_STAT.SHIELD) / m : 0; }
  GetDmg() { return this.GetStat(UNIT_STAT.DAMAGE); }

  // ------------------------------------------------------------ positions
  GetActorPosition() { return this.transform.position; }
  GetCenterPosition() { return this.Body.Center.position; }
  GetCenterForward() { return this.Body.forward; }
  GetBasePositionDistance() { return d2(this.transform.position, this.BasePosition); }
  GetTargetPositionDistance() { return this.Target ? d2(this.transform.position, this.Target.transform.position) : 0; }

  /** GetRoamDist @0x3c3c554 */
  GetRoamDist() {
    const um = G.UnitManager, camp = G.HeroManager.IsCamp;
    if (camp) return this.Team === TEAM.PLAYER ? um.HeroReturnDist_Camp : um.MonsterRoamDist_Camp;
    return this.Team === TEAM.PLAYER ? um.HeroReturnDist_Normal : um.MonsterRoamDist_Normal;
  }
  /** GetRoamDistSqr @0x3c3c5f8 */
  GetRoamDistSqr() {
    const roam = this.GetRoamDist();
    let k = 1;
    const s = this._currentSkill;
    if (s && s.GetSkillDist() < 4 && s.TableSkillData.index !== 1) k = 4;
    return (k + roam) ** 2;
  }
  /** CheckTargetDist @0x3c3c6a4 */
  CheckTargetDist() {
    if (!this.Target) return false;
    let lim;
    if (this.Team !== TEAM.PLAYER) {
      const det = this.UnitData.DetectUnitRange + this.AddUnitData.DetectUnitRange;
      lim = (det + (this._currentSkill ? this._currentSkill.GetSkillDist() : 0)) ** 2;
    } else {
      let sd = 0;
      const s = this._currentSkill;
      if (s) {
        sd = s.GetSkillDist();
        if (sd < 4 && s.TableSkillData.index !== 1 && G.HeroManager.GetHeroCount() >= 7) sd = 4;
      }
      lim = (sd + this.GetRoamDist()) ** 2;
    }
    return this.GetTargetPositionDistance() <= lim;
  }

  /** ResetBasePosition(map) @0x3c36f6c */
  ResetBasePosition(map) {
    const sp = this.Spawner;
    if (!sp || !sp.IncludeTiles.length) return;
    const tile = sp.IncludeTiles[Random.rangeInt(0, sp.IncludeTiles.length)];
    const c = G.MapManager.cellCenter(tile.x, tile.y);
    const cs = G.MapManager.GetCellSize();
    const tx = c[0] + Random.range(-cs[0], cs[0]);
    const ty = c[1] + Random.range(-cs[1], cs[1]);
    const p = this.transform.position;
    let dx = tx - p[0], dy = ty - p[1];
    let target = [tx, ty];
    const um = G.UnitManager;
    if (dx * dx + dy * dy > um.MonsterIdleDistSqrt) {
      const L = Math.hypot(dx, dy); const k = L > 1e-5 ? um.MonsterIdleDist / L : 0;
      target = [p[0] + dx * k, p[1] + dy * k];
    }
    // Physics2D.Raycast against the Block layer: stop at the hit point
    const hit = G.Physics.raycastHit(p[0], p[1], target[0], target[1]);
    if (hit) {
      dx = target[0] - p[0]; dy = target[1] - p[1];
      const L = Math.hypot(dx, dy) || 1;
      target = [hit[0] - dx / L, hit[1] - dy / L];
    }
    this._basePosition = target;
  }

  // ------------------------------------------------------------ skills
  /** SetCurrentSkill @0x3c39570 */
  SetCurrentSkill() {
    const cur = this._currentSkill, g = this._tableSkillGroupData;
    if (cur && g && cur.key !== g.gatheringSkill) return true;
    if (this._currentState === UNIT_STATE.ACTION) return false;
    if (this.Body.IsPlayByName('Attack')) return false;
    if (this.Body.IsAttack) return false;
    const n = this._skills.length - (this.Team === TEAM.PLAYER ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const s = this._skills[i];
      s.UpdateSkillCondition();
      if (!s.CheckSkill()) continue;
      this.CurrentSkill = s;
      let idx = -1;
      if (s.key === g?.defaultSkill) idx = 0;
      else if (s.key === g?.skillA) idx = 2;
      else if (s.key === g?.skillB) idx = 3;
      if (idx >= 0) this._firstAttack = this.Body.ChangeAnimation(idx);
      return true;
    }
    return false;
  }
  SetGatheringSkill() {
    if (this._gatheringSkill) { this.CurrentSkill = this._gatheringSkill; this._firstAttack = this.Body.ChangeAnimation(1); }
  }

  /** OnAttack(onEvent, force) @0x3c39bbc */
  OnAttack(onEvent, force) {
    if (!force) {
      if (this._currentState === UNIT_STATE.ACTION) return;
      if (this.Body.IsPlayByName('Attack')) return;
      if (this.Body.IsAttack) return;
    }
    const s = this._currentSkill;
    if (!s || s.IsDelay()) return;
    if (!force && !s.CheckSkill()) { this.CurrentSkill = null; return; }
    this.SetState(UNIT_STATE.ACTION);
    const bp = this.transform.position;
    const tp = this.Target ? this.Target.transform.position : [0, 0];
    this.Body.SetDirection(bp[0] - (this.Target ? tp[0] : 0) > 0);
    if (this.Target) this.Body.CenterLookAt(this.Target.GetCenterPosition());
    const ctx = { index: 0 };
    const td = s.TableSkillData;
    if (td.startSound) G.Sound?.play(td.startSound);
    s.SetOrigin();
    const ct = s.castType;
    if (ct === CAST_TYPE.INSTANT || ct >= CAST_TYPE.AOE) {
      if (td.skillCastTime > 0) { this.StartCasting(() => this._instantSkill(ctx)); return; }
      this.EnableEffect(td.castEffect, true);
      this._instantSkill(ctx);
      return;
    }
    if (ct === CAST_TYPE.CASTING) {
      this.StartCasting(() => this.Body.OnAttack(t => this._onAttackEvent(ctx, t, null), () => { this.CurrentSkill = null; this.SetState(UNIT_STATE.IDLE); }));
      return;
    }
    // CHANNELING
    this.Body.OnAttack(null, () => { this.CurrentSkill = null; this.SetState(UNIT_STATE.IDLE); });
    if (s.StartSkill(0, () => this.SetIdle(), ctx.index)) this.EnableEffect(td.castEffect, false, td.skillCastTime);
    else { this.SetIdle(); this.DisableEffect(); }
  }

  /** <OnAttack>g__InstantSkill|1 @0x3c3a374 */
  _instantSkill(ctx) {
    const s = this._currentSkill;
    if (!s) return;
    if (s.TableSkillData.skillCastTime === 0) s.DespawnRange();
    const link = Tables.linkSkill(s.key);
    this.Body.OnAttack(t => this._onAttackEvent(ctx, t, link), () => {
      if (link) return;
      this.CurrentSkill = null; this.Target = null; this.SetState(UNIT_STATE.IDLE);
    });
  }
  /** <OnAttack>b__8 @0x3b6ec6c */
  _onAttackEvent(ctx, time, link) {
    const s = this._currentSkill;
    if (!s) { this.ClearTarget(); return; }
    const end = () => {
      if (link) { // b__10: chain into the next linked skill
        const next = Tables.skill(link.nextSkill);
        if (next) { this.CurrentSkill = new ActorSkill(this, next); this.SetIdle(); this.OnAttack(() => {}, true); }
      } else this.ClearTarget();
    };
    if (s.StartSkill(time, end, ctx.index)) this.CheckAttack(ctx.index === 0);
    else if (link) { this.CurrentSkill = null; this.Target = null; this.SetState(UNIT_STATE.IDLE); }
    ctx.index++;
  }

  StartCasting(cb) {
    const t = this._currentSkill?.TableSkillData.skillCastTime || 0;
    Timing.RunCoroutine((function* () { yield t; cb(); })(), this);
  }
  EnableEffect(key, follow, time = 0) { if (key) this._castFx = G.Effects?.start(key, this, this.Target, time); }
  DisableEffect() { if (this._castFx) { G.Effects?.stop(this._castFx); this._castFx = null; } }

  /** CheckAttack(first) @0x3c3ce54 */
  CheckAttack(first) {
    const s = this._currentSkill;
    if (!s || !first) return;
    if (s.AtkCnt) this.AddCondition(CONDITION_TYPE.ATTACK_COUNT);
  }
  /** AddCondition @0x3c37f84 */
  AddCondition(t) { for (const s of this._skills) s.AddSkillCondition(t); }

  ClearTarget() { if (this.Target && this.Target.IsDead()) this.Target = null; }

  // ------------------------------------------------------------ state
  SetIdle() {
    this.CurrentSkill = null;
    this.Target = null;
    if (this.IsDead()) return;
    this.Body.SetIdle();
  }

  /** SetState(state) @0x3c3a764 */
  SetState(st) {
    if (this._currentState === st) return;
    switch (st) {
      case UNIT_STATE.IDLE: this.SetIdle(); break;
      case UNIT_STATE.MOVE: this.CurrentSkill = null; this.Target = null; break;
      case UNIT_STATE.DEAD: this._onDead(); break;
      case UNIT_STATE.RETURN_BASE:
        if (this.Team === TEAM.PLAYER) G.HeroManager.FlagEffect(G.HeroManager.transform.position, 0);
        break;
      case UNIT_STATE.TOWN: this.IdleTimer = 100; break;
      case UNIT_STATE.TELEPORT: this.IdleTimer = 0; break;
    }
    this._currentState = st;
  }
  _onDead() {
    this.IdleTimer = 0; this.Evasion = false;
    this.SetIdle();
    this.hpBar.show = 0;
    if (this.Team === TEAM.ENEMY) {
      G.Quest?.AddQuest('MONSTER', this.Key, 1);
      // UnitActor.SetState(DEAD): daily missions MONSTER, ELITE_KILL (any elite), BOSS (EliteType 4)
      G.InstantQuest?.add('MONSTER', 1);
      if (this.UnitData.EliteType && this.UnitData.EliteType !== 'NORMAL') G.InstantQuest?.add('ELITE_KILL', 1);
      if (this.UnitData.EliteType === 4) G.InstantQuest?.add('BOSS', 1);
      if (G.MapManager.IsWorld) { G.Buildings?.drop(this); tryLoot(this, 2); monsterExp(this); }
      this.CCClear();
      if (G.User.isPrologue) {
        G.PrologueManager.MonsterKill++;
        if (this.Key === 'Unit000710' && this.Spawner) G.PrologueManager.PrologueLog(this.Spawner.index);
      }
    } else {
      this.DeadTalk();
      G.HeroManager.AddDeadHero(this);
      G.HeroManager.RemoveHero(this);
      G.GameState?.send('DEAD_HERO', this.Key);
    }
    this.Body.OnDead(() => this._onDeadEnd());
  }
  /** <SetState>b__83_0 @0x3c41f74 */
  _onDeadEnd() {
    this.CCClear();
    if (this.Team === TEAM.ENEMY) {
      // UserOption.IsDeadBody ("시체 삭제", default on) or outside the world: bones fade after REMAIN_BONE_TIME;
      // in the world with the option off the corpse stays (DisableEffect only)
      if (G.Option && !G.Option.deadBody && G.MapManager.IsWorld) { this.DisableEffect(); return; }
      waitSecond(Tables.define('REMAIN_BONE_TIME'), () => {
        if (this.ShadowGo) this.ShadowGo.setActive(false);
        this.Body.Fade(0, 0.5, () => { this.DisableEffect(); G.UnitManager.despawn(this); });
      });
    } else if (!G.User.isPrologue) {
      Timing.RunCoroutine(this._corField(G.UnitManager.ResurrectionTime), this, 'CorField');
    }
  }
  /** <CorField>: WorldUIResurrection at position + up*0.5, fill = timer/time, then resurrect */
  *_corField(t) {
    const p = this.transform.position;
    const g = this.resurrection = { timer: 0, time: t, x: p[0], y: p[1] + 0.5 };
    while (g.timer < t) { yield -Infinity; g.timer += Timing.deltaTime; }
    G.UnitManager.ResurrectionHero?.(this);
    this.resurrection = null;
  }

  DeadTalk() { G.WorldUI?.simpleTalk(this, Tables.loc(talkKey(3))); }

  // ------------------------------------------------------------ damage
  SetEvasion() {
    if (this.Evasion) return;
    this.Evasion = true;
    waitFrame(1, () => { this.Evasion = false; });
  }

  /** UnitActor.Damage @0x3c375e8 */
  Damage(damage, critical, attribute, show = true, trueDamage = false, addDps = true) {
    if (!this.Key || this._currentState === UNIT_STATE.DEAD) return 0;
    let tot = this.TotalStat();
    if (tot.Invincibility) return 0;
    if (this.Team === TEAM.PLAYER) {
      const bf = G.MapManager.BonfireActor;
      if (bf && bf.Activate && damage > 0) return 0;
    }
    if (damage === 0) return 0;
    if (damage < 0 && tot.CurrentHP >= tot.GetStat(UNIT_STAT.HP)) return 0;
    const S = UNIT_STAT;
    if (damage > 0 && !trueDamage) {
      if (this.Evasion) {
        G.WorldUI?.numText(this, 'MISS', [1, 1, 1, 1], 1, 1);
        this.AddCondition(CONDITION_TYPE.EVASION);
        return 0;
      }
      let ar = tot.GetStat(S.ARMOR) / 100;
      if (attribute) {
        if (attribute & 0x100) ar += tot.GetStat(S.BLD_ARMOR);
        if (attribute & 0x200) ar += tot.GetStat(S.PSN_ARMOR);
        if (attribute & 0x3000) ar += tot.GetStat(S.FST_ARMOR);
        if (attribute & 0x400) ar += tot.GetStat(S.BRN_ARMOR);
      }
      damage = damage - ar * damage;
      damage = damage - tot.GetStat(S.DEFENCE);
      if (damage < 1) damage = 1;
    }
    if (this.Key === 'Unit000624') damage = 1;
    if (this.UnitData.CurrentHP > this.UnitData.GetStat(S.HP)) this.UnitData.RestoreHp();
    if (this.AddUnitData.CurrentHP > this.AddUnitData.GetStat(S.HP)) this.AddUnitData.RestoreHp();
    tot = this.TotalStat();
    let cur = tot.CurrentHP;
    if (damage > cur) damage = cur;
    if (cur - damage > tot.GetStat(S.HP)) damage = cur - tot.GetStat(S.HP);
    if (damage > 0) tryLoot(this, 1);   // LOOT_TYPE.HIT
    this._showDamage(damage, critical, show);
    if (damage > 0) {
      if (this.AddUnitData.CurrentHP + this.AddUnitData.Shield > damage) {
        this.AddUnitData.SetDamage(damage);
      } else {
        const rem = damage - this.AddUnitData.CurrentHP;
        this.AddUnitData.ClearHP();
        this.UnitData.SetDamage(rem);
      }
    } else {
      this.UnitData.SetDamage(damage);
    }
    if (this.UnitData.CurrentHP > this.UnitData.GetStat(S.HP)) this.UnitData.RestoreHp();
    // prologue: boss (UnitStat709000) and invincible heroes never drop below 1 HP
    const keep1 = this.Team !== TEAM.PLAYER
      ? (G.User.isPrologue && this._tableUnitStatData?.key === 'UnitStat709000')
      : G.User.instantInvincibility;
    if (keep1 && this.TotalStat().CurrentHP < 1) this.UnitData.CurrentHP = 1;
    const hp = this.TotalStat().CurrentHP;
    if (hp <= EPS) this.SetState(UNIT_STATE.DEAD);   // same threshold as IsDead
    this.UISetDamage(hp, this.GetStat(S.HP));
    if (damage > EPS && show) this.AddCondition(CONDITION_TYPE.DAMAGE_COUNT);
    return damage;
  }

  /** Actor.Damage @0x1ae43d0 ??hit flash + floating number */
  _showDamage(dmg, critical, show) {
    this.Body.OnDamaged();
    if (!show) return;
    if (dmg > 0) this.Body.SetDamage(1, 0, 0, 1);
    const n = Math.abs(Math.round(dmg));
    if (G.Option && !G.Option.dmgFont) return;   // option "데미지 표시"
    if (critical) G.WorldUI?.numText(this, String(n), [1, Math.fround(0.9215686), Math.fround(0.0156863), 1], 2, 0.5);
    else if (dmg < 0) G.WorldUI?.numText(this, String(n), G.ColorSet.Heal, 1, 1);
    else G.WorldUI?.numText(this, String(n), G.ColorSet.UnitDamage, 1, 1);
  }

  UISetDamage(cur, max) {
    const tot = cur + this.GetStat(UNIT_STAT.SHIELD);
    if (!(cur > EPS) || tot === max || !(tot >= EPS)) { this.hpBar.show = 0; return; }
    this.hpBar.show = Tables.define('HP_BAR_REMAIN_TIME') || 3;
  }

  FullHeal() { this.UnitData.RestoreHp(); this.AddUnitData.RestoreHp(); }

  // ------------------------------------------------------------ buffs / cc (simplified time-based model)
  Buff(stat, value, duration) {
    if (stat === undefined) return;
    const b = { stat, value, BuffTime: duration };
    this.BuffDatas.push(b);
    this.ResetBuff();
  }
  ResetBuff() {
    const a = new UnitData();
    a.CurrentHP = this.AddUnitData.CurrentHP; a.Shield = this.AddUnitData.Shield;
    for (const b of this.BuffDatas) a.AddStat(b.stat, b.value);
    for (const c of this.ccList) a.CcStat.AddCC(c.type, c.value);
    this.AddUnitData = a;
  }
  AddShield(v, dur) { this.AddUnitData.Shield += v; if (dur > 0) waitSecond(dur, () => { this.AddUnitData.Shield = 0; }); }
  RemoveShield() { this.AddUnitData.Shield = 0; }
  AddCC(type, value, duration, from, cc) {
    const c = { type, value: 1, BuffTime: duration, dmg: value, from, t: 0 };
    this.ccList.push(c);
    this.ResetBuff();
  }
  CCClear() { this.ccList = []; this.ResetBuff(); }
  tickBuffs(dt) {
    let changed = false;
    for (let i = this.ccList.length - 1; i >= 0; i--) {
      const c = this.ccList[i]; c.BuffTime -= dt; c.t += dt;
      if (c.t >= 1 && (c.type & (CC_TYPE.BLEEDING | CC_TYPE.POISON | CC_TYPE.BURN))) { c.t -= 1; this.Damage(c.dmg, false, c.type, true, false, true); }
      if (c.BuffTime <= 0) { this.ccList.splice(i, 1); changed = true; }
    }
    if (changed) this.ResetBuff();
  }
  Knockback(dx, dy, time) {
    if (this.IsDead()) return;
    const self = this;
    Timing.RunCoroutine((function* () {
      let t = 0;
      while (t < time) {
        const dt = Timing.deltaTime, k = dt / time; t += dt;
        const p = self.transform.position;
        const q = G.MapManager.navmesh?.closest(p[0] + dx * k, p[1] + dy * k, 2);
        if (q) self.transform.position = [q.x, q.y];
        yield -Infinity;
      }
    })(), this);
  }

  WarpPosition(x, y) { this.transform.position = [x, y]; this.Body.Warp(x, y); }
  /** WarpHero(pos) -> CorWarp */
  WarpHero(x, y) { this.WarpPosition(x, y); this._basePosition = [x, y]; }

  update(dt, agents) {
    this.Body.update(dt, agents);
    if (this.hpBar.show > 0) this.hpBar.show -= dt;
  }
}

function talkKey(type) {
  const L = Tables.t.TableLocalize || {};
  // LocalizeManager.GetTalkText(3): random dead-talk line
  const pre = { 0: 'LocalizeUITownTalk', 1: 'LocalizeUIBattleTalk', 2: 'LocalizeUISmallTalk', 3: 'LocalizeUIDieTalk', 4: 'LocalizeUIHelpTalk' }[type];
  const keys = Object.keys(L).filter(k => k.startsWith(pre));
  return keys.length ? keys[Random.rangeInt(0, keys.length)] : '';
}
