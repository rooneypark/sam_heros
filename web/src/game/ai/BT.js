// Behavior tree port (Node/Selector/Sequence + all condition/action nodes) from libil2cpp:
//   Logic_BTFactory.CreateBT* @0x2041f8c.., BT_State.GetState* @0x3e7f914.., node Run() methods @0x3b78760..0x3b7cab0.
// Game singletons are accessed through `G` (managers registry) to mirror MonoSingleton<T>.Instance.
import { UNIT_STATE, TEAM } from '../defs.js';
import { UNIT_STAT } from '../data/UnitData.js';
import { Random } from '../../engine/unitymath.js';
import { G } from '../registry.js';

const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export class Node {
  constructor() { this.unitActor = null; }
  run() { return true; }   // Node$$.ctor used as a no-op child in RunBattle
  clear() {}
  setUnitActor(u) { this.unitActor = u; }
}

export class CompositeNode extends Node {
  constructor() { super(); this.childrens = []; }
  addChild(n) { n.unitActor = this.unitActor; this.childrens.push(n); return n; }
  clear() { this.unitActor = null; for (const c of this.childrens) c.clear(); this.childrens.length = 0; }
  setUnitActor(u) { this.unitActor = u; for (const c of this.childrens) c.setUnitActor(u); }
}

export class Selector extends CompositeNode {
  run() {
    if (!this.unitActor) return true;
    for (const c of this.childrens) if (c.run()) return true;
    return false;
  }
}

export class Sequence extends CompositeNode {
  run() {
    for (const c of this.childrens) if (!c.run()) return false;
    return true;
  }
}

// ---------------------------------------------------------------- conditions

export class CheckDeadCondition extends Node {
  run() { return this.unitActor.IsDead(); }
}

export class CheckTown extends Node {
  run() {
    if (G.MapManager.IsDungeon) return false;
    const s = this.unitActor._currentState;
    return s === UNIT_STATE.TOWN || s === UNIT_STATE.TELEPORT;
  }
}

export class CheckMoveJoystick extends Node {
  run() {
    const u = this.unitActor;
    if (u.IsStun() || u.UnitData.InstantStop) return false;
    const hm = G.HeroManager;
    if (hm.Joystick.isPointDown || hm.IsMoving || hm.AutoMove) { u.SetState(UNIT_STATE.MOVE); return true; }
    return false;
  }
}

export class CheckMoveCenter extends Node {
  run() {
    const u = this.unitActor;
    if (u.IsStun() || u.UnitData.InstantStop) return false;
    this.dist = d2(G.HeroManager.heroGroupPointTrans.position, u.transform.position);
    return this.dist > 5;
  }
}

export class CheckTargetDistance extends Node {
  run() {
    const u = this.unitActor;
    if (u.IsStun() || u.UnitData.InstantStop || u.IsTaunt()) return false;
    if (u._currentState === UNIT_STATE.RETURN_BASE) return true;
    if (!G.MapManager.IsWorld) return false;
    return !!u.Target && !u.CheckTargetDist();
  }
}

export class CheckMapDistance extends Node {
  run() {
    const u = this.unitActor;
    if (u.IsStun() || u.UnitData.InstantStop) return false;
    if (u._currentState === UNIT_STATE.ACTION) return (u.Key || '').includes('Unit000232');
    if (u._currentState === UNIT_STATE.RETURN_BASE) return true;
    return u.GetBasePositionDistance() > u.GetRoamDistSqr();
  }
}

export class CheckRangeCondition extends Node {
  constructor() { super(); this.unit = false; }
  setType(b) { this.unit = !!b; return this; }
  run() {
    const u = this.unitActor;
    if (!u.Target || !u._currentSkill) return false;
    const th = this.unit ? u._currentSkill.GetSkillDistSqrt() : Math.fround(0.95);
    return d2(u.Target.transform.position, u.transform.position) <= th;
  }
}

/** FindEnemyCondition.Run @0x3b7b6ec */
export class FindEnemyCondition extends Node {
  static randomIdx = 0;
  static enemySearchInterval = 7; // FindEnemyCondition$$.cctor @0x3b7c164 stores (randomIdx=0, interval=7)
  constructor(u) { super(); this.unitActor = u; this.findDist = 0; this.searchIndex = 0; }

  run() {
    const u = this.unitActor;
    const mm = G.MapManager;
    if (u.GetStat(UNIT_STAT.DETECT_UNIT_RANGE) === 0 || u.IsStun() || u.UnitData.InstantStop) return false;
    const keepCurrent = () => (u.Target == null ? true : !u.Target.isResource);
    if (u.Team === TEAM.PLAYER) {
      const t = u.Target;
      if (t && !t.IsDead() && u._currentState === UNIT_STATE.ACTION) return keepCurrent();
    }
    if (u.IsTaunt()) return u.SetCurrentSkill();
    const pos = u.GetActorPosition();
    let best = u.GetStat(UNIT_STAT.DETECT_UNIT_RANGE);
    if (u.Team === TEAM.PLAYER) {
      const r = u.GetData(UNIT_STAT.DETECT_UNIT_RANGE);
      for (const a of G.UnitManager.overlapUnits(pos[0], pos[1], r)) {
        if (a.IsDead() || a.Team === u.Team || !a.isUnit || a._currentState === UNIT_STATE.TOWN || a._invuln) continue;   // _invuln: 삼국 보스 전투 전
        const ap = a.GetActorPosition();
        const dd = d2(ap, pos);
        if (!(dd < best)) continue;
        if (!G.Physics.raycastClear(pos[0], pos[1], ap[0], ap[1], 'Block')) continue;
        u.Target = a; best = dd;
      }
    } else {
      this.searchIndex++;
      const t = u.Target;
      if (this.searchIndex % FindEnemyCondition.enemySearchInterval !== 0 && t && !t.IsDead()
          && u._currentState !== UNIT_STATE.TOWN) return keepCurrent();
      let th = best;
      for (const h of G.UnitManager.HeroUnits) {
        if (h.IsDead() || h._currentState === UNIT_STATE.TOWN) continue;
        const hp = h.GetActorPosition();
        const dd = d2(hp, pos);
        if (!(dd < th)) continue;
        const fieldSkip = !mm.IsWorld && (mm.CurrentField === 0x10 || mm.CurrentField === 0x200);
        if (!fieldSkip && !G.Physics.raycastClear(pos[0], pos[1], hp[0], hp[1], 'AllBlock')) continue;
        u.Target = h; th = dd;
      }
      if (mm.BonfireActor && mm.BonfireActor.Activate) u.Target = null;
      best = th;
    }
    if (!u.Target) return false;
    if (u.Target.IsDead() || !(best < u.GetStat(UNIT_STAT.DETECT_UNIT_RANGE))) u.Target = null;
    if (mm.IsDungeon && u.Team === TEAM.ENEMY && !u.Target) u.Target = G.DungeonManager?.GetNearTarget(u) ?? null;
    if (u.Team === TEAM.PLAYER && !u.Target) u.Target = G.HeroManager.GetNearTarget(u);
    if (!u.SetCurrentSkill()) return false;
    if (u.Team === TEAM.PLAYER) u.Target = G.HeroManager.CheckTargetDist(u, u.Target);
    return u.Target != null;
  }
}

/** FindResourceCondition.Run @0x3b7c4b8 */
export class FindResourceCondition extends Node {
  run() {
    const u = this.unitActor;
    const s = u._currentState;
    if (s === UNIT_STATE.ACTION || s === UNIT_STATE.DEAD || u.IsStun() || u.UnitData.InstantStop) return false;
    const t = u.Target;
    if (t && !t.IsDead() && s === UNIT_STATE.ACTION) return !!t.isResource;
    let best = u.GetStat(UNIT_STAT.DETECT_RESOURCE_RANGE);
    const pos = u.transform.position;
    for (const sp of G.MapManager.ActiveResourceSpawners) {
      for (const a of sp.ActorList) {
        if (a.IsDead()) continue;
        const ap = a.transform.position;
        const dd = d2(ap, pos);
        if (!(dd < best)) continue;
        const len = Math.max(Math.sqrt(dd) - 1, 0);
        const dx = ap[0] - pos[0], dy = ap[1] - pos[1], L = Math.hypot(dx, dy) || 1;
        if (!G.Physics.raycastClear(pos[0], pos[1], pos[0] + dx / L * len, pos[1] + dy / L * len, 'Block')) continue;
        u.Target = a; best = dd;
      }
    }
    if (!(best < u.GetStat(UNIT_STAT.DETECT_RESOURCE_RANGE))) u.Target = null;
    if (u.Target) u.SetGatheringSkill();
    if (u.Team === TEAM.PLAYER && u.Target) u.Target = G.HeroManager.CheckTargetDist(u, u.Target);
    return u.Target != null;
  }
}

// ---------------------------------------------------------------- actions

export class MoveAction extends Node {
  constructor() { super(); this.force = false; }
  setForce(f) { this.force = !!f; return this; }
  run() { this.unitActor.Body.Move(0, 0, false); return true; }
  /** MoveAction.MoveTarget @0x3b790ec */
  MoveTarget(x, y, speed = 1) {
    const u = this.unitActor;
    if (u.Team === TEAM.PLAYER && u._currentState !== UNIT_STATE.TOWN) u.IdleTimer = 0;
    u.Body.SetSpeed(u.GetStat(UNIT_STAT.SPEED) * speed);
    u.Body.Move(x, y, this.force);
  }
  MoveDirection(x, y, speed = 1) {
    const u = this.unitActor;
    if (u.Team === TEAM.PLAYER && u._currentState !== UNIT_STATE.TOWN) u.IdleTimer = 0;
    u.Body.SetSpeed(u.GetStat(UNIT_STAT.SPEED) * speed);
    u.Body.MoveDirection(x, y, this.force);
  }
}

export class DeadAction extends Node {
  run() { this.unitActor.Body.Move(0, 0, false); return true; }
}

/** MoveCenterAction.Run @0x3b79850 */
export class MoveCenterAction extends MoveAction {
  constructor() { super(); this.speed = 1; }
  run() {
    const u = this.unitActor;
    if (u.Team !== TEAM.PLAYER) this.speed = 1;
    else if (G.HeroManager.IsCamp) this.speed = 1;
    else {
      const bp = u.BasePosition, p = u.transform.position;
      const dd = (bp[0] - p[0]) ** 2 + (bp[1] - p[1]) ** 2;
      this.speed = easingInCubic(dd / 121, 1, 2.5);
      if (!u.UnitBody.go.activeSelf) { u.UnitBody.go.setActive(true); u.Shadow?.go.setActive(true); }
    }
    const bp = u.BasePosition;
    this.MoveTarget(bp[0], bp[1], this.speed);
    return true;
  }
}

/** MoveBasePositionAction.Run @0x3b79a20 */
export class MoveBasePositionAction extends MoveCenterAction {
  run() {
    super.run();
    const u = this.unitActor;
    u.SetState(u.GetBasePositionDistance() > 1 ? UNIT_STATE.RETURN_BASE : UNIT_STATE.IDLE);
    return true;
  }
}

export class MoveTargetAction extends MoveAction {
  run() {
    const u = this.unitActor;
    if (u.Target) { const p = u.Target.transform.position; this.MoveTarget(p[0], p[1], 1); }
    else u.Body.Move(0, 0, false);
    return true;
  }
}

export class AttackAction extends Node {
  run() {
    const u = this.unitActor;
    const t = u.Target;
    if (!t || !(t.isUnit || t.isBuilding)) return false;
    u.OnAttack(() => {}, false);
    return true;
  }
}

export class GatheringAction extends Node {
  run() {
    const u = this.unitActor;
    if (!u.Target || !u.Target.isResource) return false;
    u.OnAttack(() => {}, false);
    return true;
  }
}

/** IdleAction.Run @0x3b79320 */
export class IdleAction extends MoveAction {
  constructor() { super(); this.waitTime = Random.range(4, 6); }
  run() {
    const u = this.unitActor;
    if (u.IsStun() || u.UnitData.InstantStop) { u.Body.Move(0, 0, false); return true; }
    if (u.Team === TEAM.ENEMY) {
      u.Target = null;
      u.CurrentSkill = null;
      u.Body.Move(0, 0, false);
      u.SetState(UNIT_STATE.IDLE);
      if (u.GetBasePositionDistance() > 1) {
        u.IdleTimer += G.UnitManagerStatic.BT_TIME;
        if (u.IdleTimer > this.waitTime) {
          if (u.UnitData.EliteType === 4 && u.GetHPRateNonShield() < 1) u.FullHeal();
          const bp = u.BasePosition;
          this.MoveTarget(bp[0], bp[1], 1);
        }
      } else {
        this.waitTime = Random.range(4, 6);
        u.ResetBasePosition(G.MapManager.IsWorld ? G.MapManager.WorldMap : G.MapManager.DungeonMap);
        u.IdleTimer = 0;
      }
      return true;
    }
    // other teams (heroes): first tick walks to base once, then stops after 0.3s idle
    if (u.IdleTimer === 0) {
      u.IdleTimer = 0;
      const bp = u.BasePosition;
      u.Body.Move(bp[0], bp[1], false);
    } else if (u.IdleTimer > Math.fround(0.3)) {
      u.Body.Move(0, 0, false);
    }
    u.IdleTimer += G.UnitManagerStatic.MY_BT_TIME;
    return true;
  }
}

/** TownAction.Run @0x3b787e4 (village wandering) */
export class TownAction extends MoveAction {
  constructor() { super(); this.waitTime = Random.range(8, 12); this.fastTime = 0; this.basePos = [0, 0, 0]; }
  run() {
    const u = this.unitActor;
    if (u._currentState === UNIT_STATE.TELEPORT) { u.Body.Move(0, 0, false); return true; }
    u.IdleTimer += G.UnitManagerStatic.MY_BT_TIME;
    if (this.fastTime > 0) this.fastTime -= G.UnitManagerStatic.MY_BT_TIME;
    if (u.IdleTimer > 100) this.fastTime = 2.5;
    if (u.IdleTimer > this.waitTime) {
      const p = u.transform.position;
      const bx = p[0] + Random.range(1.25, 3) * (Random.range(0, 1) > 0.5 ? 1 : -1);
      const by = p[1] + Random.range(0.65, 2) * (Random.range(0, 1) > 0.5 ? 1 : -1);
      this.basePos = [bx, by, 0];
      this.waitTime = Random.range(8, 12);
      u.IdleTimer = 0;
    }
    this.MoveTarget(this.basePos[0], this.basePos[1], this.fastTime > 0 ? 1 : 0.5);
    return true;
  }
}

export class MoveRunTargetAction extends MoveAction {
  run() {
    const u = this.unitActor;
    const t = u.Target;
    if (!t) return false;
    const p = u.transform.position, q = t.transform.position;
    const dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1;
    this.MoveTarget(p[0] + dx / L * 3, p[1] + dy / L * 3, 1);
    return true;
  }
}

// PlayCore.Easing.InCubic(t, b, c) as used by MoveCenterAction (t clamped by the curve itself)
export function easingInCubic(t, b, c) {
  const k = Math.min(Math.max(t, 0), 1);
  return b + (c - b) * k * k * k;
}

// ---------------------------------------------------------------- factory (Logic_BTFactory / BT_State)

const BT = {
  dead: () => seq(new CheckDeadCondition(), new DeadAction()),
  town: () => seq(new CheckTown(), new TownAction()),
  joystickMove: () => seq(new CheckMoveJoystick(), new MoveCenterAction()),
  centerMove: () => seq(new CheckMoveCenter(), new MoveCenterAction()),
  idle: () => new IdleAction(),
  battle: u => {
    const s = new Sequence(); s.unitActor = u;
    s.addChild(new FindEnemyCondition(u));
    const sel = s.addChild(new Selector());
    const inner = sel.addChild(new Sequence());
    sel.addChild(new MoveTargetAction().setForce(false));
    inner.addChild(new CheckRangeCondition().setType(true));
    inner.addChild(new AttackAction());
    return s;
  },
  gathering: u => {
    const s = new Sequence(); s.unitActor = u;
    s.addChild(new FindResourceCondition());
    const sel = s.addChild(new Selector());
    const inner = sel.addChild(new Sequence());
    sel.addChild(new MoveTargetAction().setForce(false));
    inner.addChild(new CheckRangeCondition().setType(false));
    inner.addChild(new GatheringAction());
    return s;
  },
  baseMove: u => (u.Team !== TEAM.PLAYER
    ? seq(new CheckTargetDistance(), new IdleAction())
    : seq(new CheckMapDistance(), new MoveBasePositionAction().setForce(true))),
  runBattle: u => {
    const s = new Sequence(); s.unitActor = u;
    s.addChild(new FindEnemyCondition(u));
    s.addChild(new MoveRunTargetAction());
    s.addChild(new Node());
    s.addChild(new MoveRunTargetAction());
    return s;
  },
};

function seq(...nodes) { const s = new Sequence(); for (const n of nodes) s.addChild(n); return s; }

export const BT_TYPE = { PLAYER: 0, ENEMY: 1, GOLD_GOBLIN: 2, PREVIEW_MONSTER: 3 };

export function createBT(owner, type) {
  const root = new Selector();
  root.unitActor = owner;
  const add = n => { root.addChild(n); };
  switch (type) {
    case BT_TYPE.PLAYER:
      add(BT.dead()); add(BT.town()); add(BT.joystickMove()); add(BT.baseMove(owner));
      add(BT.battle(owner)); add(BT.gathering(owner)); add(BT.centerMove()); add(BT.idle());
      break;
    case BT_TYPE.ENEMY:
      add(BT.dead()); add(BT.baseMove(owner)); add(BT.battle(owner)); add(BT.idle());
      break;
    case BT_TYPE.GOLD_GOBLIN:
      add(BT.dead()); add(BT.baseMove(owner)); add(BT.runBattle(owner));
      break;
    default:
      add(BT.town()); add(BT.baseMove(owner)); add(BT.joystickMove()); add(BT.centerMove()); add(BT.idle());
  }
  root.setUnitActor(owner);
  return root;
}

/** Same gathering branch used by the player AI, exposed for the in-engine motion test. */
export function createGatheringBT(owner) { return BT.gathering(owner); }
