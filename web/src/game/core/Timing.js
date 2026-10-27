// MEC.Timing equivalent: generator-based coroutines ticked once per frame.
// yield <seconds>          -> Timing.WaitForSeconds
// yield -Infinity / null   -> wait one frame (Timing.WaitForOneFrame)
// yield {until: fn}        -> WaitUntilTrue
// yield {whileTrue: fn}    -> WaitUntilFalse (waits while fn() is true)
export class Handle {
  constructor(gen, tag, owner) { this.gen = gen; this.tag = tag; this.owner = owner; this.wait = 0; this.cond = null; this.alive = true; }
  get IsRunning() { return this.alive; }
}

class TimingImpl {
  constructor() { this.list = []; this.time = 0; this.deltaTime = 0; }
  RunCoroutine(gen, owner = null, tag = null) {
    const h = new Handle(gen, tag, owner);
    this.list.push(h);
    this._step(h); // MEC runs the first segment immediately
    return h;
  }
  Kill(h) { if (h) h.alive = false; }
  KillTag(tag) { for (const h of this.list) if (h.tag === tag) h.alive = false; }
  KillOwner(owner) { for (const h of this.list) if (h.owner === owner) h.alive = false; }
  _step(h) {
    if (!h.alive) return;
    let r;
    try { r = h.gen.next(); } catch (e) { console.error(e); h.alive = false; return; }
    if (r.done) { h.alive = false; return; }
    const v = r.value;
    h.cond = null; h.wait = 0;
    if (typeof v === 'number' && v > 0 && isFinite(v)) h.wait = v;
    else if (v && typeof v === 'object') h.cond = v;
  }
  update(dt) {
    this.deltaTime = dt;
    this.time += dt;
    const cur = this.list;
    this.list = [];
    for (const h of cur) {
      if (!h.alive) continue;
      if (h.owner && h.owner.go && h.owner.go.destroyed) { h.alive = false; continue; }
      let ready = true;
      if (h.wait > 0) { h.wait -= dt; ready = h.wait <= 0; }
      else if (h.cond) {
        if (h.cond.until) ready = !!h.cond.until();
        else if (h.cond.whileTrue) ready = !h.cond.whileTrue();
      }
      if (ready) this._step(h);
      if (h.alive) this.list.push(h);
    }
  }
}
export const Timing = new TimingImpl();

/** UtilCraft.WaitFrame(n, action) */
export function waitFrame(n, fn) {
  return Timing.RunCoroutine((function* () { for (let i = 0; i < n; i++) yield -Infinity; fn(); })());
}
/** UtilCraft.WaitSecond(t, action) */
export function waitSecond(t, fn) {
  return Timing.RunCoroutine((function* () { if (t > 0) yield t; else yield -Infinity; fn(); })());
}
