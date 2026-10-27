// Skill pipeline port: SkillCondition, ActorSkill, SkillAction, SkillBase + Skill_* (libil2cpp offsets in comments).
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { G } from '../registry.js';
import { UNIT_STAT, CC_TYPE } from '../data/UnitData.js';
import {
  E, TEAM, ACTOR_TYPE, UNIT_STATE, SKILL_TYPE, CAST_TYPE, ORDER_TYPE, CONDITION_TYPE, SELECT_TYPE, COMPARE_TYPE,
  TARGET_SORT_TYPE, RANGE_TYPE, PIVOT_TYPE,
} from '../defs.js';
import { Random } from '../../engine/unitymath.js';

const EPS = Math.fround(0.001);
const STAT_NAME = UNIT_STAT;

// ---------------------------------------------------------------- SkillCondition (@0x3549698..)
const CC_COND = { 3: CC_TYPE.BLEEDING, 4: CC_TYPE.POISON, 5: CC_TYPE.BURN, 6: CC_TYPE.CURSE, 7: CC_TYPE.FROSTBITE, 8: CC_TYPE.FROZEN, 9: CC_TYPE.STUN, 10: CC_TYPE.BONDAGE };
export class SkillCondition {
  constructor(key, unit, skillKey) {
    this.data = Tables.condition(key);
    this.unit = unit; this.skillKey = skillKey; this.effect = false;
    this.checks = (this.data?.conditionTypes || []).map((t, i) => ({
      type: E(CONDITION_TYPE, t), cmp: E(COMPARE_TYPE, this.data.conditionCompares[i]), value: this.data.conditionValues[i] ?? 0,
    }));
    this.values = this.checks.map(() => 0);
    this.select = E(SELECT_TYPE, this.data?.selectType);
  }
  checkOne(i) {
    const c = this.checks[i];
    if (!c || !this.unit) return false;
    const cur = this.values[i], v = c.value;
    if ((c.cmp & 1) && cur > v) return true;
    if ((c.cmp & 2) && cur === v) return true;
    if ((c.cmp & 4) && cur < v) return true;
    return false;
  }
  /** CheckCondition() @0x3549a64 */
  check() {
    if (this.select === SELECT_TYPE.AND) { for (let i = 0; i < this.checks.length; i++) if (!this.checkOne(i)) return false; return true; }
    for (let i = 0; i < this.checks.length; i++) if (this.checkOne(i)) return true;
    return false;
  }
  /** CheckEffect @0x3546fb4: white flash once the condition becomes true */
  checkEffect() {
    if (this.effect || !this.check()) return;
    this.effect = true;
    this.unit.Body?.SetDamage(1, 1, 1, 1);
  }
  /** AddCondition @0x3549b40 */
  add(type) {
    for (let i = 0; i < this.checks.length; i++) {
      const t = this.checks[i].type;
      if (t !== type) continue;
      if (t <= 13 && ((1 << t) & 0x27fc)) this.update(i);
      else this.values[i] += 1;
    }
    this.checkEffect();
  }
  /** UpdateCondition @0x3549cc4 */
  update(idx = -1) {
    const u = this.unit;
    if (!u) return;
    for (let i = 0; i < this.checks.length; i++) {
      if (idx >= 0 && idx !== i) continue;
      const t = this.checks[i].type;
      if (t === CONDITION_TYPE.DIST) this.values[i] = u.GetTargetPositionDistance();
      else if (CC_COND[t] !== undefined) { if (u.Target?.isUnit) this.values[i] = u.Target.GetCC(CC_COND[t]); }
      else if (t === CONDITION_TYPE.DEAD_COUNT) this.values[i] = G.HeroManager.DeadHeroesCount();
      else if (t === CONDITION_TYPE.SELF_DEAD) this.values[i] = u._currentState === UNIT_STATE.DEAD ? 1 : 0;
      else if (t === CONDITION_TYPE.HP_RATE) this.values[i] = u.GetHPRateNonShield();
    }
    this.checkEffect();
  }
  reset() { this.effect = false; this.values.fill(0); }
}

/** content-pack units with row.quietAttack show no effects on their basic attack (skills keep theirs) */
const quietFx = (u, skill) => !!(u && skill && Tables.unit(u.Key)?.quietAttack && skill.key === u._tableSkillGroupData?.defaultSkill);

// ---------------------------------------------------------------- ActorSkill (@0x35ede9c..)
export class ActorSkill {
  constructor(unit, data) {
    this.Unit = unit;
    this.TableSkillData = data;
    this.key = data.key;
    this._skillKey = data.category * 10 + (data.index % 10);
    this.condition = data.condition ? new SkillCondition(data.condition, unit, this._skillKey) : null;
    this.conditionType = E(SELECT_TYPE, data.conditionType);
    this.castType = E(CAST_TYPE, data.skillCastType);
    this.orderType = E(ORDER_TYPE, data.skillActionType);
    this.actions = (data.skillActions || []).map(k => Tables.skillAction(k)).filter(Boolean).map(a => new SkillAction(this, a));
    this._coolTime = 0; this._delay = 0; this._once = false;
    this._duration = 0; this._interver = 0;
    this.AtkCnt = !!data.atkCnt;
    this._origin = [0, 0];
    this._rate = 1;
  }
  get coolTimeTable() { return this.TableSkillData.skillCoolTime; }
  /** CheckSkill @0x36000dc */
  CheckSkill() {
    const cooling = this.coolTimeTable > 0 && this._coolTime > 0;
    if (this.conditionType !== 0) { // AND
      if (cooling) return false;
      return this.condition ? this.condition.check() : true;
    }
    if (!cooling) return true;
    return this.condition ? this.condition.check() : false;
  }
  IsCoolTime() { return this.coolTimeTable > 0 && this._coolTime > 0; }
  IsDelay() { return this._delay > 0; }
  GetSkillDist() { return this.TableSkillData.skillDistance; }
  GetSkillDistSqrt() { const d = this.GetSkillDist(); return d * d; }
  AddSkillCondition(t) { this.condition?.add(t); }
  UpdateSkillCondition() { this.condition?.update(-1); }
  SetOrigin() { const p = this.Unit.transform.position; this._origin = [p[0], p[1]]; }
  DespawnRange() {}

  /** SetCoolTime @0x36012b0 */
  SetCoolTime(t) {
    if (t === 0) return;
    const ct = this.Unit.GetStat(UNIT_STAT.COOL_TIME);
    if (ct > 0) t -= t * ct;
    this._coolTime = Math.max(t, 0);
    Timing.Kill(this._coolH);
    if (this._coolTime > 0) {
      const self = this;
      this._coolH = Timing.RunCoroutine((function* () {
        while (self._coolTime > 0) { self._coolTime -= Timing.deltaTime; yield -Infinity; }
        if (self.coolTimeTable > 0) self.condition?.checkEffect();
      })(), this.Unit);
    }
  }
  _coolTimeClosure(time) { // <StartSkill>g__CoolTime|0 @0x35459a8
    const d = this.TableSkillData.skillDelay - time;
    if (this.TableSkillData.skillDelay > 0 && d > 0) {
      this._delay += d;
      Timing.Kill(this._delayH);
      if (this._delay > 0) {
        const self = this;
        this._delayH = Timing.RunCoroutine((function* () {
          while (self._delay > 0) { self._delay -= Timing.deltaTime; yield -Infinity; }
        })(), this.Unit);
      }
    }
    this.SetCoolTime(this.TableSkillData.skillCoolTime);
    this._once = true;
  }

  /** StartSkill(time, endSkill, index) @0x3600178 */
  StartSkill(time, endSkill, index) {
    const u = this.Unit;
    const td = this.TableSkillData;
    const dist = u.GetTargetPositionDistance();
    if (dist > this.GetSkillDistSqrt() * Math.fround(1.2) && !td.isAlways) { this.DespawnRange(); return false; }
    this._duration = td.skillDuration; this._interver = td.skillInterver;
    if (index !== 0) { this._endSkill = endSkill; }
    else {
      this._once = false;
      this._rate = 1;
      if (td.startEffect && !quietFx(u, this)) G.Effects?.start(td.startEffect, u, u.Target, this._duration);
      this._endSkill = endSkill;
      this.condition?.reset();
    }
    const ct = this.castType;
    if (ct === CAST_TYPE.AOE || ct === CAST_TYPE.AOE_TARGET || ct === CAST_TYPE.AOE_TARGET_EXPAND) {
      // AoeActor: approximated as an immediate SkillAction at the target/own centre
      this.SkillAction(index);
      this._endSkill?.(); this.DespawnRange();
      if (index === 0) this._coolTimeClosure(time);
      return true;
    }
    if (ct === CAST_TYPE.INSTANT || ct === CAST_TYPE.CASTING) {
      if (td.skillDuration > 0) this._runChanneling(index);
      else this.SkillAction(index);
      if (index === 0) this._coolTimeClosure(time);
      return true;
    }
    // CHANNELING
    this._runChanneling(index);
    if (index === 0) this._coolTimeClosure(time);
    return true;
  }
  _runChanneling(index) {
    const self = this;
    Timing.RunCoroutine((function* () {
      let left = self._duration;
      do { self.SkillAction(index); left -= self._interver || left; if (self._interver > 0) yield self._interver; } while (left > 0);
      self.EndSkill();
    })(), this.Unit);
  }
  EndSkill() { this._endSkill?.(); this.DespawnRange(); }

  /** SkillAction(index) @0x36008c0 — ORDER_TYPE dispatch */
  SkillAction(index) {
    const acts = this.actions;
    if (!acts.length) return;
    const t = this.Unit.Target;
    switch (this.orderType) {
      case ORDER_TYPE.RANDOM: acts[Random.rangeInt(0, acts.length)].StartAction(t); break;
      case ORDER_TYPE.LIST: acts[Math.min(index, acts.length - 1)].StartAction(t); break;
      case ORDER_TYPE.IN_ORDER: {
        const self = this;
        Timing.RunCoroutine((function* () {
          for (const a of acts) { a.StartAction(self.Unit.Target); if (a.data.skillInterver > 0) yield a.data.skillInterver; }
        })(), this.Unit);
        break;
      }
      case ORDER_TYPE.F_ONCE: if (!this._once || index === 0) for (const a of acts) a.StartAction(t); break;
      default: for (const a of acts) a.StartAction(t);
    }
  }
}

// ---------------------------------------------------------------- SkillAction (@0x35470d8..)
export class SkillAction {
  constructor(skill, data) {
    this.skill = skill;
    this.data = data;
    this.range = Tables.range(data.skillRangeKey);
    this.type = E(SKILL_TYPE, data.skillType);
    this.TargetActors = [];
    this.Origin = [0, 0];
  }
  get unit() { return this.skill.Unit; }

  /** GetOrigin @0x3547f80 (TARGET_TYPE flags: MINE 1, OTHER 2, CENTER 4, FRONT 8, BACK 16, RANDOM 32) */
  GetOrigin() {
    const r = this.range, u = this.unit;
    const sp = rangeStart(r?.startPos);
    let actor = u, o = [0, 0];
    if (sp & 2) {
      actor = u.Target;
      if (!actor) { const p = u.transform.position, f = u.GetCenterForward(); o = [p[0] + f[0], p[1] + f[1]]; return this._pivot(o, u); }
    }
    if (sp & 4) o = actor.GetCenterPosition();
    if (sp & 8) { const c = actor.GetCenterPosition(), f = actor.Body.forward; o = [c[0] + f[0], c[1] + f[1]]; }
    if (sp & 16) { const c = actor.GetCenterPosition(), f = actor.Body.forward; o = [c[0] - f[0], c[1] - f[1]]; }
    if (sp & 32) { const c = actor.GetCenterPosition(), f = actor.Body.forward; o = [c[0] + f[0], c[1] + f[1]]; }
    return this._pivot(o, actor);
  }
  _pivot(o, actor) {
    const r = this.range;
    if (r && E(PIVOT_TYPE, r.pivotType) === PIVOT_TYPE.PIVOT) {
      const k = E(RANGE_TYPE, r.rangeType) === RANGE_TYPE.CIRCLE ? r.rangeRadius : r.rangeAngle * 0.5;
      const f = (actor || this.unit).Body.forward;
      o = [o[0] + f[0] * k, o[1] + f[1] * k];
    }
    this.Origin = o;
    return o;
  }

  /** CheckTargetActor @0x3547d78 */
  CheckTargetActor(target) {
    this.TargetActors = [];
    if (rangeStart(this.range?.startPos) === 64) {
      const t = target || this.unit.Target;
      if (t) this.TargetActors.push(t);
      return;
    }
    const o = this.GetOrigin();
    this.SetTarget(o[0], o[1]);
  }

  /** SetTarget @0x3548264 */
  SetTarget(ox, oy) {
    const r = this.range, u = this.unit;
    const count = this.data.skillTargetCount;
    const radius = r.rangeRadius;
    const rtype = E(RANGE_TYPE, r.rangeType);
    const fwd = u.Body.forward;
    const cands = G.UnitManager.allActors();
    const out = [];
    for (const a of cands) {
      if (a.IsDead()) continue;
      const ap = a.transform.position, cr = a.colliderRadius || 0.5;
      let hit;
      if (rtype === RANGE_TYPE.CIRCLE) {
        hit = (ap[0] - ox) ** 2 + (ap[1] - oy) ** 2 <= (radius + cr) ** 2;
        if (hit && r.rangeAngle < 360) {
          const up = u.transform.position;
          let dx = ap[0] - up[0], dy = ap[1] - up[1];
          const L = Math.hypot(dx, dy);
          if (L > 1e-5) { dx /= L; dy /= L; } else { dx = 0; dy = 0; }
          if (!(dx * fwd[0] + dy * fwd[1] > Math.cos(r.rangeAngle * 0.5 * Math.PI / 180))) hit = false;
        }
      } else {
        // BoxCastAll(origin, size=(radius, angle), rotation aligning local up with Center.forward)
        const px = ap[0] - ox, py = ap[1] - oy;
        const along = px * fwd[0] + py * fwd[1], side = px * -fwd[1] + py * fwd[0];
        hit = Math.abs(side) <= radius / 2 + cr && Math.abs(along) <= r.rangeAngle / 2 + cr;
      }
      if (hit && this.CheckTarget(a)) out.push(a);
    }
    this.TargetActors = out;
    this.SortTargets(E(TARGET_SORT_TYPE, this.data.skillTargetSort), E(COMPARE_TYPE, this.data.skillTargetSortCompare), count);
  }

  /** CheckTarget @0x3548b68 */
  CheckTarget(a) {
    const tt = getTargetType(this.unit, a);
    const want = this.data.skillTarget;
    if (E(SELECT_TYPE, this.data.selectType) === SELECT_TYPE.OR) return (want & tt) !== 0;
    return (want & tt) === want;
  }

  /** SortTargets @0x3548c18 */
  SortTargets(sort, cmp, count) {
    const up = this.unit.transform.position;
    const val = a => {
      switch (sort) {
        case TARGET_SORT_TYPE.DIST: { const p = a.transform.position; return (p[0] - up[0]) ** 2 + (p[1] - up[1]) ** 2; }
        case TARGET_SORT_TYPE.HP: return a.GetHP ? a.GetHP() : 0;
        case TARGET_SORT_TYPE.HP_RATE: return a.GetHPRate ? a.GetHPRate() : 0;
        case TARGET_SORT_TYPE.DMG: return a.GetStat ? a.GetStat(UNIT_STAT.DAMAGE) : 0;
        default: return 0;
      }
    };
    if (sort === TARGET_SORT_TYPE.RANDOM) {
      const l = this.TargetActors;
      for (let i = l.length - 1; i > 0; i--) { const j = Random.rangeInt(0, i + 1); [l[i], l[j]] = [l[j], l[i]]; }
    } else if (sort >= 0 && sort <= 4) {
      const asc = cmp === COMPARE_TYPE.LOWER;
      this.TargetActors.sort((a, b) => { const x = val(a), y = val(b); return x === y ? 0 : (x > y) === asc ? 1 : -1; });
    }
    if (this.TargetActors.length > count) this.TargetActors.length = count;
  }

  /** StartAction @0x35465bc */
  StartAction(target) {
    const u = this.unit;
    if (!u || u.IsDead()) return;
    this.CheckTargetActor(target);
    if (this.data.startEffect && !quietFx(u, this.skill)) G.Effects?.start(this.data.startEffect, u, this.TargetActors[0] || u.Target, 0, this.Origin);
    const rateType = STAT_NAME[this.data.skillRateType] ?? -1;
    const rate = rateType >= 0 ? u.GetStat(rateType) * this.data.skillRateValue * this.skill._rate : 0;
    const value = this.data.skillAdditional + rate;
    const sb = makeSkill(this.type, u);
    sb.OnSkill(value, this, this.TargetActors.slice(), this.data.skillDuration, this.data.skillInterver);
  }
}

function rangeStart(v) {
  const M = { MINE: 1, OTHER: 2, CENTER: 4, FRONT: 8, BACK: 16, RANDOM: 32, MINE_CENTER: 5, MINE_FRONT: 9, MINE_BACK: 17,
    MINE_RANDOM: 33, OTHER_CENTER: 6, OTHER_FRONT: 10, OTHER_BACK: 18, OTHER_RANDOM: 34, TARGET: 64 };
  return typeof v === 'number' ? v : (M[v] || 0);
}

/** UtilCraft.GetTargetType(unit, actor) @0x3b18848 */
export function getTargetType(unit, a) {
  let t = 0;
  if (a === G.HeroManager?.GlobalUnit) return 0;
  if (unit === a && a.ActorType === ACTOR_TYPE.UNIT) t = 1;
  if (unit !== a && unit.Team === a.Team && a.ActorType === ACTOR_TYPE.UNIT) t |= 2;
  if (unit.Team !== a.Team) {
    if (a.ActorType === ACTOR_TYPE.UNIT) t |= 4;
    else if (G.MapManager.CurrentField === 0x80 && a.ActorType === ACTOR_TYPE.BUILDING) t |= 4;
  }
  if (a.ActorType === ACTOR_TYPE.RESOURCE) t |= 8;
  else if (a.ActorType === ACTOR_TYPE.BUILDING) t |= 16;
  if (a.isUnit && a.TableUnitData) {
    const at = a.TableUnitData.attribute;
    if (at === 'STR') t |= 32; else if (at === 'DEX') t |= 64; else if (at === 'INT') t |= 128;
  }
  if (a.ActorType === ACTOR_TYPE.UNIT && a.isUnit) {
    if (a.GetCC(CC_TYPE.BLEEDING) > EPS) t |= 0x100;
    const tot = a.TotalStat();
    if (tot.GetCC(CC_TYPE.POISON) > EPS) t |= 0x200;
    if (tot.GetCC(CC_TYPE.BURN) > EPS) t |= 0x400;
    if (tot.GetCC(CC_TYPE.CURSE) < Math.fround(0.999)) t += 0x800;
    if (tot.GetCC(CC_TYPE.FROSTBITE) > EPS) t += 0x1000;
    if (tot.GetCC(CC_TYPE.FROZEN) > EPS) t += 0x2000;
    if (tot.GetCC(CC_TYPE.STUN) > EPS) t += 0x4000;
    if (tot.GetCC(CC_TYPE.BONDAGE) > EPS) t += 0x8000;
  }
  if (a.IsDead()) t += 0x10000;
  return t;
}

// ---------------------------------------------------------------- SkillBase + subclasses (@0x3548e68..)
class SkillBase {
  constructor(unit) { this.UnitActor = unit; }
  /** OnSkill @0x3548e68 */
  OnSkill(value, action, targets, duration, interval) {
    this.skillAction = action; this.targets = targets;
    this.actionValue = { Value: value, Duration: duration, Interval: interval };
    if (action?.data?.sound) G.Sound?.play(action.data.sound);
    if (duration > 0 && this.usesCorAction) {
      const self = this;
      Timing.RunCoroutine((function* () {
        while (self.actionValue.Duration > 0) {
          self.Action();
          self.actionValue.Duration -= self.actionValue.Interval;
          yield self.actionValue.Interval > 0 ? self.actionValue.Interval : -Infinity;
          if (!(self.actionValue.Interval > 0)) break;
        }
      })(), this.UnitActor);
    } else this.Action();
  }
  get usesCorAction() { return true; }
  /** SkillBase.Action @0x354ac78: evasion roll for enemy unit targets, otherwise HitEffect */
  Action() {
    const u = this.UnitActor;
    for (const t of this.targets) {
      if (!t || !t.isUnit) continue;
      if (t.Team !== u.Team) {
        const ev = t.TotalStat().GetStat(UNIT_STAT.EVASION_RATE);
        const ar = u.TotalStat().GetStat(UNIT_STAT.ATTACK_RATE);
        if (1 - ev - ar < Random.range(0, 1)) { t.SetEvasion(); continue; }
      }
      this.HitEffect(t);
    }
  }
  HitEffect(t) {
    const he = this.skillAction?.data?.hitEffect;
    if (he && !quietFx(this.UnitActor, this.skillAction?.skill)) G.Effects?.start(he, this.UnitActor, t, 0);
  }
}

/** Skill_Damage.Action @0x354b198 (Skill_TrueDamage shares it with trueDmg=true) */
class Skill_Damage extends SkillBase {
  constructor(u, trueDmg = false) { super(u); this.trueDmg = trueDmg; }
  get usesCorAction() { return true; }
  Action() {
    super.Action();
    const u = this.UnitActor;
    if (!u) return;
    const S = UNIT_STAT;
    const tot = u.TotalStat();
    const attr = this.skillAction?.data?.skillAttribute || 0;
    let attrMul = 1;
    if (attr) {
      if (attr & 0x100) attrMul = tot.GetStat(S.BLD_DMG) + 1;
      if (attr & 0x200) attrMul += tot.GetStat(S.PSN_DMG);
      if (attr & 0x3000) attrMul += tot.GetStat(S.FST_DMG);
      if (attr & 0x400) attrMul += tot.GetStat(S.BRN_DMG);
    }
    const base = Math.max(this.actionValue.Value, 1);
    let anyCrit = false;
    for (const t of this.targets) {
      if (!t) continue;
      if (t.ActorType === ACTOR_TYPE.RESOURCE) {
        const v = tot.GetStat(t.ResourceType === 1 ? S.TREE_DAMAGE : S.STONE_DAMAGE);
        t.Damage(this.actionValue.Value + v, false, attr, true, false, true);
        continue;
      }
      const tu = t.isUnit ? t : null;
      let boss = 1;
      if (tu && tu.UnitData.EliteType === 4) boss = tot.GetStat(S.BS_DMG) + 1;
      let crit = false, dmg = base;
      if (tu && tu.Team !== u.Team) {
        const cr = tot.GetStat(S.CRITICAL_RATE), ic = tu.GetStat(S.IMMUNE_CRITICAL);
        if (cr - ic >= Random.range(0, 1)) { crit = true; dmg = base * tot.GetStat(S.CRITICAL_DAMAGE); }
      }
      const enemy = t.Team !== u.Team;
      const done = t.Damage(attrMul * dmg * boss, crit, attr, true, this.trueDmg, enemy);
      if (done > 0 && tu && tu.Team !== u.Team) {
        anyCrit = anyCrit || crit;
        const vamp = tot.GetStat(S.VAMPIRIC);
        if (vamp > 0) u.Damage(-(done * vamp), false, 0, false, false, false);
        const thorn = tu.TotalStat().GetStat(S.THORN);
        if (thorn > EPS) u.Damage(thorn * tu.GetStat(S.DAMAGE), false, 0, true, false, true);
      }
    }
    if (anyCrit) u.AddCondition(CONDITION_TYPE.CRITICAL);
    this.skillAction?.onComplete?.(true);
  }
}

class Skill_Heal extends SkillBase {
  Action() {
    for (const t of this.targets) if (t && !t.IsDead() && t.isUnit) { t.Damage(-this.actionValue.Value, false, 0, true, false, false); this.HitEffect(t); }
  }
}

class Skill_Buff extends SkillBase {
  get usesCorAction() { return false; }
  Action() {
    const st = STAT_NAME[this.skillAction.data.skillRateType];
    for (const t of this.targets) if (t && t.isUnit) { t.Buff(st, this.actionValue.Value, this.actionValue.Duration); this.HitEffect(t); }
  }
}

/** Skill_CC: stacks a CC (TableCC) on enemy targets for the action duration. */
class Skill_CC extends SkillBase {
  get usesCorAction() { return false; }
  Action() {
    super.Action();
    const cc = Tables.get('TableCC', this.skillAction.data.ccKey);
    if (!cc) return;
    for (const t of this.targets) if (t && t.isUnit && !t.IsDead()) t.AddCC(E(CC_TYPE, cc.type), this.actionValue.Value, this.actionValue.Duration, this.UnitActor, cc);
  }
}

class Skill_Knockback extends SkillBase {
  get usesCorAction() { return false; }
  Action() {
    const u = this.UnitActor, up = u.transform.position;
    for (const t of this.targets) {
      if (!t || !t.isUnit || t.IsDead() || t.UnitData.immuneKnock) continue;
      const p = t.transform.position;
      let dx = p[0] - up[0], dy = p[1] - up[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      t.Knockback(dx * this.actionValue.Value, dy * this.actionValue.Value, 0.2);
    }
  }
}

class Skill_Bullet extends SkillBase {
  get usesCorAction() { return false; }
  Action() {
    const bk = this.skillAction.data.bulletKey;
    const b = Tables.get('TableBullet', bk);
    if (!b) return;
    for (const t of this.targets) if (t) G.Bullets?.shoot(this.UnitActor, t, b, this.actionValue.Value, this.skillAction);
  }
}

class Skill_Shield extends SkillBase {
  get usesCorAction() { return false; }
  Action() { for (const t of this.targets) if (t && t.isUnit) t.AddShield(this.actionValue.Value, this.actionValue.Duration); }
}

class Skill_Noop extends SkillBase { Action() { super.Action(); } }

class Skill_PackTaunt extends SkillBase {
  get usesCorAction() { return false; }
  Action() {
    // Explicit opt-in: preserve unimplemented original taunts outside this pack.
    if (!this.skillAction.data.packTaunt) return;
    // bosses (EliteType 4) ignore the taunt (삼국 장비 포효: 보스 제외, 2026-10-24 사용자 결정)
    for (const t of this.targets) if (t?.isUnit && !t.IsDead() && t.Team !== this.UnitActor.Team && t.UnitData.EliteType !== 4) {
      t._packTaunt = { source: this.UnitActor, until: Timing.time + this.actionValue.Duration };
      t.Target = this.UnitActor;
      this.HitEffect(t);
    }
  }
}

export function makeSkill(type, u) {
  switch (type) {
    case SKILL_TYPE.ATTACK: return new Skill_Damage(u, false);
    case SKILL_TYPE.TRUE_ATTACK: return new Skill_Damage(u, true);
    case SKILL_TYPE.HEAL: return new Skill_Heal(u);
    case SKILL_TYPE.BUFF: case SKILL_TYPE.BUFF_TARGET: return new Skill_Buff(u);
    case SKILL_TYPE.CC: return new Skill_CC(u);
    case SKILL_TYPE.KNOCKBACK: return new Skill_Knockback(u);
    case SKILL_TYPE.BULLET: return new Skill_Bullet(u);
    case SKILL_TYPE.SHIELD: return new Skill_Shield(u);
    case SKILL_TYPE.TAUNT: return new Skill_PackTaunt(u);
    default: return new Skill_Noop(u);
  }
}

/** Damage application for a bullet's own skill on hit (BulletActor -> its TableBullet.skill). */
export function applyBulletHit(owner, target, bullet, mulValue) {
  const sk = Tables.skill(bullet.skill);
  if (!sk || !owner || owner.IsDead?.() && false) return;
  for (const ak of sk.skillActions || []) {
    const a = Tables.skillAction(ak);
    if (!a) continue;
    const fake = { data: a, unit: owner, skill: { _rate: 1 }, onComplete: null };
    const rateType = STAT_NAME[a.skillRateType] ?? -1;
    const v = (a.skillAdditional + (rateType >= 0 ? owner.GetStat(rateType) * a.skillRateValue : 0)) * (mulValue || 1);
    const sb = makeSkill(E(SKILL_TYPE, a.skillType), owner);
    sb.OnSkill(v, fake, [target], 0, 0);
  }
  if (bullet.hitEffect) G.Effects?.start(bullet.hitEffect, owner, target, 0);
}
