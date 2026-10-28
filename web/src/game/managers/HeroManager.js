// HeroManager port (Update @0x1ed0678, GetHeroCenterPos @0x1ed13b0, JoystickControl @0x1ed1734, ...).
import { G } from '../registry.js';
import { UNIT_STATE } from '../defs.js';
import { GameObject } from '../../engine/scene.js';

export class HeroManager {
  constructor() {
    this.go = new GameObject('HeroManager');
    this.transform = this.go.transform;
    this.groupPoint = new GameObject('HeroGroupPoint');
    this.groupPoint.transform.setParent(this.transform);
    this.heroGroupPointTrans = this.groupPoint.transform;
    this.radius = 0.35;                 // CircleCollider2D
    this.HeroUnits = [];
    this.DeadHeroes = [];
    this.Joystick = { isPointDown: false, Direction: [0, 0] };
    this.control = false;
    this.CameraHold = false;
    this.HoldTimer = 0;
    this.cameraSpeed = 7;               // ctor @0x1ed7904
    this.MaxDist = 25;
    this.IsCamp = false;
    this.IsMoving = false;
    this.AutoMove = false;
    this.heroCenterPos = [0, 0];
    this._moveCount = 0;
    this.dist = 0;
    this.GlobalUnit = null;
    this.arrow = { active: false, pos: [0, 0], rot: 0 };
    this.flags = [];
  }

  get Control() { return this.control; }
  /** set_Control @0x1ecfde0: turning control off stops every hero */
  set Control(v) {
    if (this.control && !v) for (const h of this.HeroUnits) h.Body.Move(0, 0, false);
    this.control = !!v;
  }

  GetHeroCount() { return this.HeroUnits.length; }
  AddHero(u) {
    if (!this.HeroUnits.includes(u)) this.HeroUnits.push(u);
    G.UnitManager.UpdateReturnDist();
  }
  RemoveHero(u) {
    const i = this.HeroUnits.indexOf(u);
    if (i >= 0) this.HeroUnits.splice(i, 1);
    G.UnitManager.UpdateReturnDist();
  }
  AddDeadHero(u) { this.DeadHeroes.push(u); }
  DeadHeroesCount() { return this.DeadHeroes.length; }

  /** GetHeroCenterPos @0x1ed13b0 */
  GetHeroCenterPos() {
    let sx = 0, sy = 0;
    this._moveCount = 0;
    for (const h of this.HeroUnits) {
      if (h.IsDead()) continue;
      const s = h._currentState;
      if (s === UNIT_STATE.TOWN || s === UNIT_STATE.RETURN_BASE || h.IsFrozen()) continue;
      this._moveCount++;
      const p = h.transform.position; sx += p[0]; sy += p[1];
    }
    if (!this._moveCount) return this.transform.position;
    return [sx / this._moveCount, sy / this._moveCount];
  }

  /** JoystickControl @0x1ed1734 */
  JoystickControl() {
    const j = this.Joystick;
    // Joystick pointer up -> SetFlag(false) @0x1ed2198: FlagRange circle (ReturnDist + 1) at the group point
    // (CheckCenter first: the group point snaps to the heroes' centre, so the ring spreads from the party)
    if (this._wasDown && !j.isPointDown && this.GetHeroCount() > 0) {
      const c = this.GetHeroCenterPos();
      if (!(G.Fog && G.Fog.blocks(c[0], c[1]))) this.transform.position = [c[0], c[1]];
      this.FlagEffect(this.transform.position, 0);
    }
    this._wasDown = j.isPointDown;
    this.arrow.active = j.isPointDown;
    if (!j.isPointDown || this.GetHeroCount() < 1) { this.heroGroupPointTrans.lp = [0, 0, 0]; return; }
    let [dx, dy] = j.Direction;
    const L = Math.hypot(dx, dy);
    if (L > 1e-5) { dx /= L; dy /= L; } else { dx = 0; dy = 0; }
    this.heroGroupPointTrans.lp = [dx, dy, 0];
    // Arrow follows the camera at ArrowDist and slerps towards the joystick direction
    const cam = G.CameraManager.position;
    const ad = G.UnitManager.GetArrowDist();
    this.arrow.pos = [cam[0] + dx * ad, cam[1] + dy * ad];
    const target = Math.atan2(dy, dx);
    let diff = target - this.arrow.rot;
    while (diff > Math.PI) diff -= Math.PI * 2; while (diff < -Math.PI) diff += Math.PI * 2;
    this.arrow.rot += diff * Math.min(1, this.cameraSpeed * G.dt);
  }

  /** Update @0x1ed0678 (field gameplay part) */
  update(dt) {
    if (!this.control || this.IsCamp) {
      this.heroGroupPointTrans.lp = [0, 0, 0];
      return;
    }
    this.heroCenterPos = this.GetHeroCenterPos();
    if (this.HoldTimer > 0) this.HoldTimer -= dt;
    const cam = G.CameraManager;
    // camera lerp: factor = clamp01(fixedDeltaTime * cameraSpeed) applied per rendered frame
    const k = Math.min(1, Math.max(0, 0.02 * this.cameraSpeed)) * Math.min(3, dt * 60);
    let target;
    if (this.CameraHold) { this.cameraSpeed = 15; target = G.UnitManager.LeaderHero?.transform.position || this.transform.position; }
    else if (this.Joystick.isPointDown) target = this.heroCenterPos;
    else target = this.transform.position;
    cam.position = [cam.position[0] + (target[0] - cam.position[0]) * Math.min(1, k), cam.position[1] + (target[1] - cam.position[1]) * Math.min(1, k)];
    const gp = this.heroGroupPointTrans.position;
    this.dist = (this.heroCenterPos[0] - gp[0]) ** 2 + (this.heroCenterPos[1] - gp[1]) ** 2;
    this.JoystickControl();
    if (this._moveCount >= 1) {
      if (this.dist <= 16) this.CameraHold = false;
      const lp = this.heroGroupPointTrans.lp;
      const rd = G.UnitManager.GetReturnDist();
      const f = this.HoldTimer > 0 ? 1.5 : 1.25;
      let nx = cam.position[0] + lp[0] * rd * f, ny = cam.position[1] + lp[1] * rd * f;
      // Rigidbody2D.MovePosition against Block colliders: keep the group point on walkable ground
      const nav = G.MapManager.navmesh;
      if (nav && nav.findPoly(nx, ny) < 0) { const q = nav.closest(nx, ny, 6); if (q) { nx = q.x; ny = q.y; } }
      if (!(G.Fog && G.Fog.blocks(nx, ny))) this.transform.position = [nx, ny];
    }
    G.MapManager.checkFootSwitches(this.transform.position, this.radius);
  }

  /** GetNearTarget(u) @0x1ed3004 */
  GetNearTarget(u) {
    let best = null, bd = 3.4028235e38;
    const hp = this.transform.position;
    for (const h of this.HeroUnits) {
      const t = h.Target;
      if (!t || !t.isUnit || t.IsDead()) continue;
      const p = t.transform.position;
      const d = (p[0] - hp[0]) ** 2 + (p[1] - hp[1]) ** 2;
      if (!(d < bd)) continue;
      const lim = (u.GetRoamDist() + (u._currentSkill ? u._currentSkill.GetSkillDist() : 0)) ** 2;
      if (d > lim) continue;
      best = t; bd = d;
    }
    return best;
  }
  /** CheckTargetDist(u, target) @0x1ed3278 */
  CheckTargetDist(u, t) {
    if (!t) return null;
    const p = t.transform.position, hp = this.transform.position;
    const d = (p[0] - hp[0]) ** 2 + (p[1] - hp[1]) ** 2;
    let sd = 0;
    const s = u._currentSkill;
    if (s) {
      sd = s.GetSkillDist();
      if (sd < 4 && s.TableSkillData.index !== 1 && this.GetHeroCount() >= 7) sd = 4;
    }
    return d > (sd + u.GetRoamDist()) ** 2 ? null : t;
  }

  /** FlagEffect(pos, range) @0x1ed2718: "FlagRange" effect, default range = ReturnDist + 1 */
  FlagEffect(pos, range) {
    const r = range === 0 ? G.UnitManager.GetReturnDist() + 1 : range;
    G.Effects?.spawnPrefab('FlagRange', [pos[0], pos[1]], { range: r });
  }
}

export class CameraManager {
  constructor() { this.position = [0, 0]; this.size = 13; this.tween = null; }
  static DEFAULT_CAMERA = 13;
  /** CameraMoveZoom(pos, ?, size, time) awaitable */
  CameraMoveZoom(pos, size, time) {
    const from = [...this.position], fromS = this.size;
    return new Promise(res => {
      this.tween = { t: 0, time, from, to: [pos[0], pos[1]], fromS, toS: size, res };
    });
  }
  update(dt) {
    const tw = this.tween;
    if (!tw) return;
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.time);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; // DOTween default ease (OutQuad-ish) approximated
    this.position = [tw.from[0] + (tw.to[0] - tw.from[0]) * e, tw.from[1] + (tw.to[1] - tw.from[1]) * e];
    this.size = tw.fromS + (tw.toS - tw.fromS) * e;
    if (k >= 1) { this.tween = null; tw.res(); }
  }
}
