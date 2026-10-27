// UnitBody + SpriteBody port (UnitBody @0x3b73488.., SpriteBody @0x35546e8..).
import { Animator, SpriteRenderer, SortingGroup } from '../../engine/components.js';
import { NavMeshAgent } from '../../engine/navmesh.js';
import { Timing } from '../core/Timing.js';
import { G } from '../registry.js';
import { TEAM, UNIT_STATE } from '../defs.js';
import { UNIT_STAT } from '../data/UnitData.js';
import { Tables } from '../data/Tables.js';

const EPS = Math.fround(0.001);
export const DEAD_COLOR = [0.8, 0.8, 0.8, 1]; // ResourceManager.DeadColor = Define_REMAIN_BONE_COLOR

export class UnitBody {
  constructor(actor, root, bodyGo, agentData) {
    this.Actor = actor;
    this.root = root;              // actor root GameObject (NavMeshAgent lives here)
    this.go = bodyGo;              // child with SpriteBody script
    this.animator = bodyGo.get(Animator);
    this.renderer = bodyGo.get(SpriteRenderer);
    this.sortingGroup = bodyGo.get(SortingGroup);
    this.Center = bodyGo.find('CenterPoint')?.transform || bodyGo.transform;
    this.Shoot = bodyGo.find('ShootPoint')?.transform || bodyGo.transform;
    this.LocalOrigin = [...bodyGo.transform.lp];
    this.agent = new NavMeshAgent(root.transform, agentData);
    this.agent.nav = G.MapManager?.navmesh || null;
    this.Team = TEAM.PLAYER;
    this.Scale = 1;
    this.ConstDir = false;
    this.IsAttack = false;
    this.IsDamaged = false;
    this.MoveDir = [0, 0];
    this.MoveDist = 0;
    this.forward = [-1, 0];        // Center.forward projected on XY (CenterLookAt)
    this.AnimKey = '';
    this._animationClips = [];
    this.currentIndex = -1;
    this.OnEvent = null; this.OnEndEvent = null; this.OnDeadEvent = null;
    this.DeadHandle = null; this.DamageHandle = null;
    this.hitBlend = 0; this.hitColor = [1, 0, 0];
    if (this.animator) this.animator.listeners.push((fn, ev) => {
      if (fn === 'OnAttackEvent') this.OnAttackEvent();
      else if (fn === 'OnAttackEnd') this.OnAttackEnd();
      else if (fn === 'OnPackFx') G.PackFx?.spawn(this.Actor, ev.s, ev.i);   // pack effect (units.json motion fx)
    });
  }

  /** UnitBody.SetBody(key) @0x3b73550 */
  SetBody(key) {
    const t = Tables.unit(key);
    if (!t) return;
    this.Scale = t.scale || 1;
    this.go.transform.lp = [...this.LocalOrigin];
    this.go.transform.ls = [this.Scale, this.Scale, this.Scale];
    this.ConstDir = false;
    this.AnimKey = t.prefab + '_Attack';
    // Only this actor's controller receives pack Idle/Move timings.
    if (this.animator) {
      for (const key of this._packMotionKeys || []) delete this.animator.overrides[key];
      this._packMotionKeys = [];
      for (const [state, clip] of Object.entries(t.motionClips || {})) {
        const key = this.animator.controller?.states?.[state]?.clip;
        if (key) { this.animator.overrides[key] = clip; this._packMotionKeys.push(key); }
      }
      this.animator.play(this.animator.state || 'Idle', 0);
    }
    if (!t.prefab.includes('Monster')) this.agent.radius = Tables.define('HERO_COLLIDER_IDLE', 1);
    this.hitBlend = 0;
    if (this.renderer) this.renderer.hit = [1, 0, 0, 0];
  }

  /** SetAnimation(keys) — clips by skill animationKey: [default, gathering, A, B] */
  SetAnimation(keys) {
    // a pack unit with its own clip for the state (units.json motion) plays it instead of the base clip
    const t = Tables.unit(this.Actor?.Key), pre = t ? t.prefab + '_' : null;
    this._animationClips = keys.map(k => {
      const own = k && pre && t.motionClips && k.startsWith(pre) && t.motionClips[k.slice(pre.length)];
      if (own && G.assets.anims[own]) return own;
      return k && G.assets.anims[k] ? k : null;
    });
    this.currentIndex = -1;
  }

  /** SpriteBody.ChangeAnimation(index) @0x3554c28: overrides "<prefab>_Attack" and returns the first event time */
  ChangeAnimation(index) {
    const clip = this._animationClips[index];
    if (!clip) return 0;
    if (this.currentIndex !== index) {
      this.currentIndex = index;
      if (this.animator) this.animator.overrides[this.AnimKey] = clip;
    }
    const ev = G.assets.anims[clip]?.events?.[0];
    return ev ? ev.t : 0;
  }

  get position() { return this.root.transform.position; }
  IsPlayByName(n) { return this.animator?.state === n; }
  IsNavMeshMove() { return !(this.DeadHandle && this.DeadHandle.alive) && this.agent.enabled && this.agent.isOnNavMesh; }

  /** SpriteBody.Move(dest, force) @0x35546e8 */
  Move(x, y, force) {
    if (this.Actor.IsDead()) return;
    const an = this.animator;
    if (force) {
      if (!this.IsNavMeshMove()) return;
      if (this.IsAttack) {
        if (an) { an.speed = this.Actor.GetSlow(); an.play('Move'); an.setBool('Attack', false); }
      }
    } else {
      if (this.IsAttack) return;
      if (an && an.state === 'Attack') return;
    }
    const stop = x * x + y * y === 0;
    if (stop && an) an.setFloat('Move', 0);
    this._baseMove(x, y);
    if (!stop && an) an.setFloat('Move', this.MoveDist > EPS ? 1 : 0);
  }

  /** UnitBody.Move @0x3b74928 */
  _baseMove(x, y) {
    if (this.IsAttack) {
      this.IsAttack = false;
      this.Actor.DisableEffect();
      this.Actor.CurrentSkill = null;
    }
    const ag = this.agent;
    const S = G.UnitManagerStatic;
    if (x * x + y * y === 0) {
      ag.isStopped = true;
      ag.velocity = { x: 0, y: 0 };
      if (this.Team === TEAM.PLAYER) ag.radius = S.IdleColliderSize;
      return;
    }
    ag.isStopped = false;
    if (!this._dest || (this._dest[0] - x) ** 2 + (this._dest[1] - y) ** 2 >= 1e-10) {
      ag.setDestination(x, y);
      this._dest = [x, y];
    }
    const p = this.position;
    this.MoveDir = [x - p[0], y - p[1]];
    this.MoveDist = this.MoveDir[0] ** 2 + this.MoveDir[1] ** 2;
    if (this.Team === TEAM.PLAYER) ag.radius = this.MoveDist > 0 ? S.MoveColliderSize : S.IdleColliderSize;
    if (this.MoveDist > EPS) {
      const sx = this.go.transform.ls[0];
      if (this.MoveDir[0] < 0 && sx < 0) this.SetDirection(true);
      else if (this.MoveDir[0] > 0 && sx > 0) this.SetDirection(false);
    }
  }

  MoveDirection(x, y, force) { this.Move(x, y, force); }

  /** SetDirection(l) @0x3b751c0: sprites face left natively; l=true -> unflipped */
  SetDirection(l) {
    const s = this.Scale;
    this.go.transform.ls = (this.ConstDir || l) ? [s, s, s] : [-s, s, s];
  }

  /** CenterLookAt(pos): rotate Center towards pos (XY projection of Transform.LookAt) */
  CenterLookAt(pos) {
    const c = this.Center.position;
    const dx = pos[0] - c[0], dy = pos[1] - c[1], L = Math.hypot(dx, dy);
    if (L > 1e-5) this.forward = [dx / L, dy / L];
  }

  /** UnitBody.SetSpeed @0x3b75f48 */
  SetSpeed(v) { this.agent.speed = this.Actor.IsBondage() ? 0 : this.Actor.GetSlow() * v; }

  /** SpriteBody.OnAttack(onEvent, onEnd) @0x3554e10 */
  OnAttack(onEvent, onEnd) {
    if (this.Actor.IsDead()) return false;
    this.Move(0, 0, false);
    this.OnEvent = onEvent; this.OnEndEvent = onEnd;
    if (this.animator) {
      this.animator.speed = this.Actor.GetStat(UNIT_STAT.ATTACK_SPEED);
      this.animator.setBool('Attack', true);
    }
    this.IsAttack = true;
    return true;
  }
  OnAttackEvent() {
    if (this.Actor.IsDead() || !this.OnEvent) return;
    this.OnEvent(this.animator?.cur?.clip?.length || 0);
  }
  /** SpriteBody.OnAttackEnd @0x3555178 -> UnitBody.OnAttackEnd @0x3b75950 */
  OnAttackEnd() {
    if (this.Actor.IsDead()) return;
    if (this.animator) { this.animator.speed = this.Actor.GetSlow(); this.animator.setBool('Attack', false); }
    this.OnEvent = null;
    this.go.transform.lp = [...this.LocalOrigin];
    const self = this;
    Timing.RunCoroutine((function* () {
      yield -Infinity; yield -Infinity;
      const e = self.OnEndEvent; self.OnEndEvent = null; self.IsAttack = false; e?.();
    })(), this.Actor);
  }
  OnAttackEndFunction() { if (!this.Actor.IsDead()) this.OnAttackEnd(); }
  OnDamaged() { if (this.Actor.ActorType === 0) this.IsDamaged = true; return false; }

  /** SetDamage(color) @0x3b756e0 + CorDamage: _HitEffectBlend 1 -> 0 */
  SetDamage(r, g, b, a) {
    if (!this.renderer) return;
    this.hitColor = [r, g, b];
    this.hitBlend = 1;
    Timing.Kill(this.DamageHandle);
    const self = this;
    this.DamageHandle = Timing.RunCoroutine((function* () {
      while (self.hitBlend > 0) {
        self.renderer.hit = [self.hitColor[0], self.hitColor[1], self.hitColor[2], self.hitBlend];
        yield -Infinity;
        self.hitBlend -= Timing.deltaTime * 4;
      }
      self.hitBlend = 0; self.renderer.hit = [0, 0, 0, 0];
    })(), this.Actor);
  }

  SetDefaultColor() { if (this.renderer) this.renderer.color = { r: 1, g: 1, b: 1, a: 1 }; }

  /** SpriteBody.OnDead(cb) @0x3554950 + UnitBody.OnDead @0x3b752c8 */
  OnDead(cb) {
    const an = this.animator;
    if (an && an.state !== 'Die' && !(this.DeadHandle && this.DeadHandle.alive)) {
      an.speed = 1;
      an.play('Die', 0);
    }
    G.Sound?.play(this.Actor.TableUnitData?.deathSound);
    this.OnDeadEvent = cb;
    if (this.sortingGroup) this.sortingGroup.order = 1;
    Timing.Kill(this.DeadHandle);
    this.DeadHandle = Timing.RunCoroutine(this._corDead(), this.Actor);
    this.agent.velocity = { x: 0, y: 0 };
    this.agent.isStopped = true;
    this.agent.enabled = false;
    this._baseMove(0, 0);
  }
  OnDeadEnd() { const e = this.OnDeadEvent; this.OnDeadEvent = null; e?.(); }

  /** SpriteBody.<CorDead>d__18 */
  *_corDead() {
    let timer = 0;
    const diff = DEAD_COLOR.map(v => 1 - v);
    if (this.Team === TEAM.PLAYER && !G.MapManager.IsDungeon) { this.OnDeadEnd(); return; }
    yield -Infinity;
    yield -Infinity;
    yield (this.animator?.cur?.clip?.length || 0);
    this.OnDeadEnd();
    while (timer < Math.fround(0.7)) {
      const c = this.renderer.color, dt = Timing.deltaTime;
      this.renderer.color = { r: c.r - diff[0] * dt * 1.425, g: c.g - diff[1] * dt * 1.425, b: c.b - diff[2] * dt * 1.425, a: c.a - diff[3] * dt * 1.425 };
      timer += dt;
      yield -Infinity;
    }
    this.renderer.color = { r: DEAD_COLOR[0], g: DEAD_COLOR[1], b: DEAD_COLOR[2], a: DEAD_COLOR[3] };
  }

  /** Fade(to, time, cb) via DOTween DOFade */
  Fade(to, time, cb) {
    const self = this, from = this.renderer?.color.a ?? 1;
    Timing.RunCoroutine((function* () {
      let t = 0;
      while (t < time) { t += Timing.deltaTime; if (self.renderer) self.renderer.color = { ...self.renderer.color, a: from + (to - from) * Math.min(1, t / time) }; yield -Infinity; }
      cb?.();
    })(), this.Actor);
  }

  /** SpriteBody.OnRebirth @0x355526c + UnitBody.OnRebirth @0x3b75c94 */
  OnRebirth() {
    const an = this.animator;
    if (an) { an.speed = this.Actor.GetSlow(); an.setFloat('Move', 0); an.setBool('Attack', false); an.play('Idle', 0); }
    if (this.renderer) this.renderer.color = { r: 1, g: 1, b: 1, a: 1 };
    Timing.Kill(this.DeadHandle); this.DeadHandle = null;
    this.SetDefaultColor();
    this.SetDamage(1, 1, 1, 1); this.hitBlend = 0; if (this.renderer) this.renderer.hit = [0, 0, 0, 0];
    this.agent.enabled = true; this.agent.velocity = { x: 0, y: 0 }; this.agent.isStopped = false;
    this.OnEvent = this.OnEndEvent = this.OnDeadEvent = null;
    this.IsAttack = false;
    if (this.sortingGroup) this.sortingGroup.order = 3;
  }

  /** SpriteBody.SetIdle @0x3555424 */
  SetIdle() {
    const an = this.animator;
    if (an && an.state === 'Die') return;
    if (this.DeadHandle && this.DeadHandle.alive) return;
    if (this.Actor.IsDead()) return;
    this.SetDefaultColor();
    this.OnEvent = this.OnEndEvent = this.OnDeadEvent = null;
    this.IsAttack = false;
    if (this.sortingGroup) this.sortingGroup.order = 3;
    if (an) { an.speed = this.Actor.GetSlow(); an.setFloat('Move', 0); an.setBool('Attack', false); an.play('Idle'); }
  }

  Warp(x, y) { this.agent.warp(x, y); this._dest = null; }

  PlayAnimation(state) {
    const an = this.animator; if (!an) return;
    if (state === UNIT_STATE.IDLE) an.play('Idle');
    else if (state === UNIT_STATE.MOVE) an.play('Move');
    else if (state === UNIT_STATE.ACTION) an.play('Attack');
    else if (state === UNIT_STATE.DEAD) an.play('Die');
  }

  update(dt, others) {
    this.agent.update(dt, others);
    if (this.animator) this.animator.update(dt);
  }
}
