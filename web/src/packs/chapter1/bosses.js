// 1장 보스 전투 (docs/planning/units/관해.md, 장각.md 첫 검증용 패턴 값). 보스는 원작 BT 대신 이 스크립트로 움직인다:
// 지면 예고(원·부채꼴·직선) → 승인 모션(ChangeAnimation + OnAttack, animation hits = 타격 시점) → 판정 → 빈틈.
// 시전 1회당 대상별 최대 1회 피해. 이탈 3초·전멸 시 초기화, HP 0 시 예고·투사체·예약 피해 전부 제거.
import { G } from '../../game/registry.js';
import { UNIT_STAT } from '../../game/data/UnitData.js';

const ANIM = { attack: 0, skill1: 2, skill2: 3 };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const norm = (x, y) => { const L = Math.hypot(x, y) || 1; return [x / L, y / L]; };
const rot = (v, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; };

class BossFight {
  constructor(ch, unit, cfg) {
    this.ch = ch; this.u = unit; this.cfg = cfg;
    this.home = [...cfg.pos];
    this.state = 'idle';         // idle (대기·무적) → ready → fight → dead
    this.tele = []; this.proj = []; this.flash = [];
    this.leashT = 0; this.phase2 = false;
    unit._invuln = true; unit.BT = null;
    unit.hpBar.show = 0;
  }
  get A() { return this.u.GetStat(UNIT_STAT.DAMAGE); }
  heroes() { return G.UnitManager.HeroUnits.filter(h => !h.IsDead()); }
  partyCenter() { const hs = this.heroes(); if (!hs.length) return null; return [hs.reduce((s, h) => s + h.transform.position[0], 0) / hs.length, hs.reduce((s, h) => s + h.transform.position[1], 0) / hs.length]; }
  nearest() {
    const p = this.u.transform.position; let best = null, bd = 1e9;
    for (const h of this.heroes()) { const d = dist(h.transform.position, p); if (d < bd && dist(h.transform.position, this.home) <= this.cfg.leash) { bd = d; best = h; } }
    return best;
  }
  hit(h, amount) { if (h && !h.IsDead()) h.Damage(amount, false, 0, true, false, true); }
  talk(id) { if (this.ch.lineOnce(id)) G.WorldUI?.simpleTalk(this.u, this.ch.lineText(id)); }

  start() {
    this.state = 'ready'; this.t = 0; this.u._invuln = false; this.u.hpBar.show = 1;
    this.fightTime = 0; this.busy = null; this.lastBasic = -9;
    this.onStart?.();
  }
  /** 이탈·전멸: 추적 중단, HP 전회복, 대기 복귀, 위험 표시 제거 */
  reset(msg = true) {
    if (this.state === 'dead') return;
    this.clear();
    const u = this.u;
    u.UnitData.RestoreHp(); u.AddUnitData.RestoreHp();
    u.WarpPosition(this.home[0], this.home[1]);
    u.Body.Move(0, 0, false);
    this.state = 'idle'; u._invuln = true; this.phase2 = false; this.leashT = 0;
    if (msg) this.ch.ui.toast(this.ch.msg.bossReset);
    this.onReset?.();
  }
  clear() {
    this.tele.length = 0; this.proj.length = 0; this.busy = null;
    const b = this.u.Body; b.OnEvent = null; b.OnEndEvent = null;
    if (b.IsAttack && !this.u.IsDead()) b.OnAttackEnd();
  }
  onDead() { this.clear(); this.state = 'dead'; this.flash.length = 0; }

  update(dt) {
    const u = this.u;
    if (this.state === 'dead' || u.IsDead()) return;
    // flashes fade even while idle
    for (const f of this.flash) f.t += dt;
    this.flash = this.flash.filter(f => f.t < f.dur);
    if (this.state === 'idle') { if (dist(u.transform.position, this.home) > 0.5) u.WarpPosition(this.home[0], this.home[1]); return; }
    // leash: the party outside the leave radius for 3 s
    const c = this.partyCenter();
    if (!c) return;          // wipe handled by the chapter
    this.leashT = dist(c, this.home) > this.cfg.leash ? this.leashT + dt : 0;
    if (this.leashT >= 3) { this.reset(); return; }
    if (this.state === 'ready') { this.t += dt; u.Body.Move(0, 0, false); if (this.t >= 1.5) this.state = 'fight'; return; }
    this.fightTime += dt;
    if (!this.phase2 && u.GetHPRate() <= 0.5) { this.phase2 = true; this.onPhase2(); }
    this.updateProjectiles(dt);
    for (const t of this.tele) t.t += dt;
    if (this.busy) {
      this.busyT = (this.busyT || 0) + dt;
      if (this.busyT < 8) { this.busy(dt); return; }
      this.busy = null;                                   // safety: a motion that never reported its end
    }
    this.busyT = 0;
    this.think(dt);
  }
  /** chase within the arena; returns the target when in range */
  approach(t, range) {
    const u = this.u, p = u.transform.position, tp = t.transform.position;
    if (dist(p, tp) <= range) { u.Body.Move(0, 0, false); return true; }
    let [x, y] = tp;
    const d = dist([x, y], this.home);
    if (d > this.cfg.arena) { const k = this.cfg.arena / d; x = this.home[0] + (x - this.home[0]) * k; y = this.home[1] + (y - this.home[1]) * k; }
    u.Body.SetSpeed(u.GetStat(UNIT_STAT.SPEED));
    u.Body.Move(x, y, false);
    return false;
  }
  face(pt) { const p = this.u.transform.position; this.u.Body.SetDirection(p[0] - pt[0] > 0); this.u.Body.CenterLookAt(pt); }
  /** play a motion; onHit at the clip's hit time, onEnd after the clip */
  play(index, onHit, onEnd) {
    const b = this.u.Body;
    b.ChangeAnimation(index);
    const ok = b.OnAttack(() => { if (this.state === 'fight') onHit?.(); }, () => { if (this.state === 'fight') onEnd?.(); });
    if (!ok) { onHit?.(); onEnd?.(); }
  }
  /** wait sec then call next (as the busy step) */
  wait(sec, next) { let t = 0; this.busy = dt => { t += dt; this.u.Body.Move(0, 0, false); if (t >= sec) { this.busy = null; next?.(); } }; }
  updateProjectiles(dt) {
    for (const p of this.proj) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (dist([p.x, p.y], this.home) > this.cfg.arena + 3) p.life = 0;
      for (const h of this.heroes()) {
        if (p.life <= 0) break;
        const hp = h.transform.position;
        if (Math.hypot(hp[0] - p.x, hp[1] - (p.y - 0.25)) <= p.r + 0.3) {
          if (!p.cast.has(h)) { p.cast.add(h); this.hit(h, p.dmg); }
          p.life = 0;
        }
      }
    }
    this.proj = this.proj.filter(p => p.life > 0);
  }

  // ------------------------------------------------------------ drawing (overlay canvas)
  draw(ctx, S, k) {
    for (const t of this.tele) {
      const fill = Math.min(1, t.t / t.dur);
      ctx.save();
      if (t.type === 'circle') {
        const [sx, sy] = S(t.x, t.y);
        ctx.beginPath(); ctx.ellipse(sx, sy, t.r * k, t.r * k, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,${t.color === 'violet' ? 60 : 120},${t.color === 'violet' ? 255 : 20},0.22)`; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = t.color === 'violet' ? '#c8a0ff' : '#ff9a2a'; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sx, sy, t.r * k * fill, t.r * k * fill, 0, 0, Math.PI * 2);
        ctx.fillStyle = t.color === 'violet' ? 'rgba(170,110,255,0.25)' : 'rgba(255,110,20,0.28)'; ctx.fill();
      } else if (t.type === 'fan') {
        const [sx, sy] = S(t.x, t.y), a = Math.atan2(-t.dir[1], t.dir[0]), h = t.angle / 2 * Math.PI / 180;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, t.r * k, a - h, a + h); ctx.closePath();
        ctx.fillStyle = 'rgba(255,80,40,0.25)'; ctx.fill(); ctx.strokeStyle = '#ff6a3a'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (t.type === 'lines') {
        for (const d of t.dirs) {
          const [ax, ay] = S(t.x, t.y), [bx, by] = S(t.x + d[0] * t.len, t.y + d[1] * t.len);
          ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,220,60,0.35)'; ctx.lineWidth = t.w * k; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,240,120,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        }
      }
      ctx.restore();
    }
    for (const p of this.proj) {
      const [sx, sy] = S(p.x, p.y);
      ctx.save();
      if (p.kind === 'talisman') {
        ctx.translate(sx, sy); ctx.rotate(Math.atan2(-p.vy, p.vx));
        ctx.fillStyle = '#ffe36a'; ctx.strokeStyle = '#a3141a'; ctx.lineWidth = 2;
        ctx.fillRect(-0.32 * k, -0.18 * k, 0.64 * k, 0.36 * k); ctx.strokeRect(-0.32 * k, -0.18 * k, 0.64 * k, 0.36 * k);
        ctx.fillStyle = '#a3141a'; ctx.fillRect(-0.05 * k, -0.12 * k, 0.1 * k, 0.24 * k);
      } else {
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * k * 1.6);
        g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#b98cff'); g.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, p.r * k * 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    for (const f of this.flash) {
      const [sx, sy] = S(f.x, f.y), a = 1 - f.t / f.dur;
      ctx.save(); ctx.globalAlpha = a;
      if (f.kind === 'bolt') {
        ctx.strokeStyle = '#e9f4ff'; ctx.lineWidth = 4; ctx.shadowColor = '#8fc8ff'; ctx.shadowBlur = 16;
        ctx.beginPath(); let x = sx, y = sy - 9 * k; ctx.moveTo(x, y);
        for (let i = 1; i <= 6; i++) { x = sx + (i % 2 ? 1 : -1) * 0.35 * k; y = sy - 9 * k + i * 1.5 * k; ctx.lineTo(i === 6 ? sx : x, y); }
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sx, sy, f.r * k, f.r * k, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(200,230,255,0.45)'; ctx.fill();
      } else {
        ctx.beginPath(); ctx.ellipse(sx, sy, f.r * k, f.r * k, 0, 0, Math.PI * 2); ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 6; ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ---------------------------------------------------------------- 관해: 대검 베기 / 길막 대회전
export class GuanHaiFight extends BossFight {
  constructor(ch, unit, cfg) {
    super(ch, unit, cfg);
    this.R = 1.8;                // 기본 공격 논리 거리 (테스트: 원작 근접 사거리 수준)
    this.cool = 8;               // 스킬 재사용 (50% 이하 6)
  }
  onStart() { this.nextSkill = 5; }
  onPhase2() { this.cool = 6; this.talk('C1_08_06'); }
  think() {
    const t = this.nearest();
    if (!t) { this.u.Body.Move(0, 0, false); return; }
    const skillReady = this.fightTime >= this.nextSkill;
    if (skillReady) {
      if (!this.approach(t, this.R * 1.6 * 0.85)) return;
      return this.skill();
    }
    if (!this.approach(t, this.R * 0.9)) return;
    if (this.fightTime - this.lastBasic < 1.8) { this.u.Body.Move(0, 0, false); return; }
    this.basic(t);
  }
  basic(t) {
    this.lastBasic = this.fightTime;
    const p = this.u.transform.position, tp = t.transform.position;
    const dir = norm(tp[0] - p[0], tp[1] - p[1]);      // 예비 동작 시작에 고정
    this.face(tp);
    const tele = { type: 'fan', x: p[0], y: p[1], dir, angle: 100, r: this.R, t: 0, dur: 0.42 };
    this.tele.push(tele);
    let done = false;
    this.busy = () => { if (done) { this.busy = null; } };
    this.play(ANIM.attack, () => {
      this.tele = this.tele.filter(x => x !== tele);
      const cast = new Set();
      for (const h of this.heroes()) {
        const hp = h.transform.position, dx = hp[0] - p[0], dy = hp[1] - p[1], d = Math.hypot(dx, dy);
        if (d > this.R + 0.35 || cast.has(h)) continue;
        if (d > 0.01 && (dx * dir[0] + dy * dir[1]) / d < Math.cos(50 * Math.PI / 180)) continue;
        cast.add(h); this.hit(h, this.A * 1.0);
      }
    }, () => { this.tele = this.tele.filter(x => x !== tele); done = true; });
  }
  skill() {
    const u = this.u, p = [...u.transform.position], r = this.R * 1.6;
    this.talk('C1_08_05');
    if (this.ch.tutorialOnce('danger')) this.ch.ui.toast(this.ch.msg.dangerHint);
    const tele = { type: 'circle', x: p[0], y: p[1], r, t: 0, dur: 1.2 };
    this.tele.push(tele);
    let phase = 'warn';
    this.busy = () => {
      u.Body.Move(0, 0, false);                         // 예고 중 이동 안 함
      if (phase === 'warn' && tele.t >= tele.dur) {
        phase = 'swing';
        this.play(ANIM.skill1, () => {
          this.tele = this.tele.filter(x => x !== tele);
          const c = u.transform.position;
          for (const h of this.heroes()) if (dist(h.transform.position, c) <= r + 0.3) this.hit(h, this.A * 1.8);
          this.flash.push({ kind: 'ring', x: c[0], y: c[1], r, t: 0, dur: 0.3 });
        }, () => {
          this.tele = this.tele.filter(x => x !== tele);
          this.wait(1.0, () => { this.nextSkill = this.fightTime + this.cool; });   // 재사용은 시전 완료부터
        });
      }
    };
  }
}

// ---------------------------------------------------------------- 장각: 도술탄 / 흩날리는 부적 / 황천의 낙뢰
export class ZhangJiaoFight extends BossFight {
  constructor(ch, unit, cfg) {
    super(ch, unit, cfg);
    this.range = 4.2;            // 기본 공격 사거리 (테스트: 장수 교전 거리 ≈ 스킬 거리 1.8 + 배회 2.25 안쪽으로 들어오게)
    this.boltSpeed = 6; this.talSpeed = 5;
    this.strikeR = 1.6;          // 낙뢰 원 반경 (기본 근접 거리 수준부터 검증)
  }
  onStart() {
    this.script = ['basic', 'basic', 'talisman', 'basic', 'lightning'];
    this.readyAt = { talisman: 0, lightning: 0 };
    this.lastStrikeTarget = null;
  }
  onPhase2() { this.talk('C1_10_08'); }
  think() {
    const t = this.nearest();
    if (!t) { this.u.Body.Move(0, 0, false); return; }
    let act = this.script.length ? this.script[0] : null;
    if (!act) {
      const ft = this.fightTime;
      const tr = ft >= this.readyAt.talisman, lr = ft >= this.readyAt.lightning && !this.proj.some(p => p.kind === 'talisman');
      if (tr && lr) act = this.readyAt.talisman <= this.readyAt.lightning ? 'talisman' : 'lightning';
      else act = tr ? 'talisman' : lr ? 'lightning' : 'basic';
    }
    if (act === 'lightning' && this.proj.some(p => p.kind === 'talisman')) act = 'basic';   // 부적이 남아 있으면 낙뢰 예고 금지
    if (!this.approach(t, this.range)) return;
    if (act === 'basic' && this.fightTime - this.lastBasic < 2.0) { this.u.Body.Move(0, 0, false); return; }
    if (this.script.length) this.script.shift();
    this[act](t);
  }
  basic(t) {
    this.lastBasic = this.fightTime;
    const p = this.u.transform.position, tp = t.transform.position;
    const dir = norm(tp[0] - p[0], tp[1] - p[1]);      // 발사 준비 시작에 방향 확정, 유도 없음
    this.face(tp);
    let done = false;
    this.busy = () => { if (done) this.busy = null; };
    this.play(ANIM.attack, () => {
      const c = this.u.transform.position;
      this.proj.push({ kind: 'bolt', x: c[0], y: c[1] + 0.4, vx: dir[0] * this.boltSpeed, vy: dir[1] * this.boltSpeed, r: 0.3, life: 1.8, dmg: this.A * 0.8, cast: new Set() });
    }, () => { done = true; });
  }
  talisman(t) {
    this.talk('C1_10_06');
    if (this.ch.tutorialOnce('danger')) this.ch.ui.toast(this.ch.msg.dangerHint);
    const u = this.u, p = [...u.transform.position];
    const len = this.talSpeed * 2.5;
    const tele = { type: 'lines', x: p[0], y: p[1] + 0.4, dirs: [], len, w: 0.6, t: 0, dur: 1.0 };
    const aim = () => { const tp = (t.IsDead() ? this.nearest() || t : t).transform.position; const d = norm(tp[0] - p[0], tp[1] - p[1]); tele.dirs = [rot(d, -25), d, rot(d, 25)]; this.face(tp); };
    aim(); this.tele.push(tele);
    let phase = 'warn';
    this.busy = () => {
      u.Body.Move(0, 0, false);
      if (phase === 'warn') {
        if (tele.t < tele.dur - 0.3) aim();                // 마지막 0.3초 전에 방향 고정
        if (tele.t >= tele.dur) {
          phase = 'cast';
          this.play(ANIM.skill1, () => {
            this.tele = this.tele.filter(x => x !== tele);
            const cast = new Set();                         // 같은 시전의 부적은 대상당 1회
            for (const d of tele.dirs) this.proj.push({ kind: 'talisman', x: tele.x, y: tele.y, vx: d[0] * this.talSpeed, vy: d[1] * this.talSpeed, r: 0.32, life: 2.5, dmg: this.A * 1.1, cast });
          }, () => {
            this.tele = this.tele.filter(x => x !== tele);
            this.wait(0.8, () => { this.readyAt.talisman = this.fightTime + 7; });
          });
        }
      }
    };
  }
  lightning() {
    this.talk('C1_10_07');
    const u = this.u;
    const hs = this.heroes();
    if (!hs.length) return;
    // 이전 대상만 연속 선택하지 않도록 교대
    let pool = hs.filter(h => h !== this.lastStrikeTarget);
    if (!pool.length) pool = hs;
    const pick = [];
    const n = this.phase2 ? 2 : 1;
    while (pick.length < n && pool.length) { const i = Math.floor(Math.random() * pool.length); pick.push(pool.splice(i, 1)[0]); }
    if (pick.length < n) for (const h of hs) if (!pick.includes(h) && pick.length < n) pick.push(h);
    this.lastStrikeTarget = pick[0];
    const spots = [];
    for (const h of pick) {
      const p = [...h.transform.position];
      if (spots.some(s => dist(s, p) < this.strikeR * 1.2)) continue;      // 너무 가까우면 원 하나로 합침
      spots.push(p);
    }
    const teles = spots.map(s => ({ type: 'circle', color: 'violet', x: s[0], y: s[1], r: this.strikeR, t: 0, dur: 1.4 }));
    this.tele.push(...teles);
    this.face(spots[0]);
    const hitAt = u.Body._animationClips?.[ANIM.skill2] ? (G.assets.anims[u.Body._animationClips[ANIM.skill2]]?.events?.[0]?.t || 0.42) : 0.42;
    let phase = 'warn', played = false;
    this.busy = () => {
      u.Body.Move(0, 0, false);
      const tt = teles[0].t;
      if (!played && tt >= 1.4 - hitAt) { played = true; this.play(ANIM.skill2, null, () => { phase === 'struck' && this.wait(1.2, () => { this.readyAt.lightning = this.fightTime + 10; }); }); }
      if (phase === 'warn' && tt >= 1.4) {
        phase = 'struck';
        const cast = new Set();
        for (const t of teles) {
          for (const h of this.heroes()) if (!cast.has(h) && dist(h.transform.position, [t.x, t.y]) <= t.r + 0.3) { cast.add(h); this.hit(h, this.A * 1.5); }
          this.flash.push({ kind: 'bolt', x: t.x, y: t.y, r: t.r, t: 0, dur: 0.35 });
        }
        this.tele = this.tele.filter(x => !teles.includes(x));       // 낙뢰 후 지면 즉시 안전
        if (!u.Body.IsAttack) this.wait(1.2, () => { this.readyAt.lightning = this.fightTime + 10; });
      }
    };
  }
}
