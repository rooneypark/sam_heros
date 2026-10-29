// NavMesh (from the game's baked Detour tiles, re/extract/navmesh/*.json) + a NavMeshAgent approximation.
// Path = A* over polygons + simple stupid funnel; agents steer along corners with Unity-like speed/acceleration
// and separate from each other (approximating NavMeshAgent obstacle avoidance).

export class NavMesh {
  constructor(json) {
    this.v = json.verts;
    this.polys = json.polys;
    this.adj = json.adj;
    this.n = this.polys.length;
    this.cx = new Float32Array(this.n); this.cy = new Float32Array(this.n);
    this.bb = new Float32Array(this.n * 4);
    for (let i = 0; i < this.n; i++) {
      const p = this.polys[i];
      let sx = 0, sy = 0, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const k of p) {
        const x = this.v[k * 2], y = this.v[k * 2 + 1];
        sx += x; sy += y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      this.cx[i] = sx / p.length; this.cy[i] = sy / p.length;
      this.bb.set([x0, y0, x1, y1], i * 4);
    }
    // uniform grid index
    this.cell = 4;
    this.grid = new Map();
    for (let i = 0; i < this.n; i++) {
      const [x0, y0, x1, y1] = this.bb.subarray(i * 4, i * 4 + 4);
      for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
        for (let gy = Math.floor(y0 / this.cell); gy <= Math.floor(y1 / this.cell); gy++) {
          const k = gx * 73856093 ^ gy * 19349663;
          let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i);
        }
    }
  }

  _inPoly(i, x, y) {
    const p = this.polys[i], v = this.v;
    let inside = false;
    for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
      const xa = v[p[a] * 2], ya = v[p[a] * 2 + 1], xb = v[p[b] * 2], yb = v[p[b] * 2 + 1];
      if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) inside = !inside;
    }
    return inside;
  }

  findPoly(x, y) {
    const k = Math.floor(x / this.cell) * 73856093 ^ Math.floor(y / this.cell) * 19349663;
    for (const i of this.grid.get(k) || []) if (this._inPoly(i, x, y)) return i;
    return -1;
  }

  /** Closest point on the navmesh (searching nearby cells). Returns {x,y,poly}. */
  closest(x, y, maxR = 12) {
    const p = this.findPoly(x, y);
    if (p >= 0) return { x, y, poly: p };
    let best = null, bd = Infinity;
    const r = Math.ceil(maxR / this.cell);
    const gx0 = Math.floor(x / this.cell), gy0 = Math.floor(y / this.cell);
    const seen = new Set();
    for (let gx = gx0 - r; gx <= gx0 + r; gx++) for (let gy = gy0 - r; gy <= gy0 + r; gy++) {
      for (const i of this.grid.get(gx * 73856093 ^ gy * 19349663) || []) {
        if (seen.has(i)) continue; seen.add(i);
        const q = this._closestOnPoly(i, x, y);
        const d = (q.x - x) ** 2 + (q.y - y) ** 2;
        if (d < bd) { bd = d; best = { x: q.x, y: q.y, poly: i }; }
      }
    }
    return best;
  }

  _closestOnPoly(i, x, y) {
    if (this._inPoly(i, x, y)) return { x, y };
    const p = this.polys[i], v = this.v;
    let bx = 0, by = 0, bd = Infinity;
    for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
      const ax = v[p[b] * 2], ay = v[p[b] * 2 + 1], cx = v[p[a] * 2], cy = v[p[a] * 2 + 1];
      const dx = cx - ax, dy = cy - ay;
      const L = dx * dx + dy * dy || 1;
      let t = ((x - ax) * dx + (y - ay) * dy) / L; t = Math.max(0, Math.min(1, t));
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = (qx - x) ** 2 + (qy - y) ** 2;
      if (d < bd) { bd = d; bx = qx; by = qy; }
    }
    return { x: bx, y: by };
  }

  /** Portal edge from poly a into poly b as [leftX,leftY,rightX,rightY] relative to travel direction (a -> b). */
  _portal(a, b) {
    const p = this.polys[a], n = p.length, v = this.v;
    for (let e = 0; e < n; e++) if (this.adj[a][e] === b) {
      const v0 = p[e], v1 = p[(e + 1) % n];
      // polygon winding in our 2D projection: CCW -> interior on the left of v0->v1 -> leaving poly, v1 is on the left
      let area = 0;
      for (let k = 0; k < n; k++) { const i = p[k], j = p[(k + 1) % n]; area += v[i * 2] * v[j * 2 + 1] - v[j * 2] * v[i * 2 + 1]; }
      const A = [v[v0 * 2], v[v0 * 2 + 1]], B = [v[v1 * 2], v[v1 * 2 + 1]];
      return area > 0 ? [B[0], B[1], A[0], A[1]] : [A[0], A[1], B[0], B[1]];
    }
    return null;
  }
  /** A* + funnel. Returns list of corner points (excluding start) or null. */
  path(sx, sy, tx, ty) {
    const s = this.closest(sx, sy), t = this.closest(tx, ty);
    if (!s || !t) return null;
    if (s.poly === t.poly) return [{ x: t.x, y: t.y }];
    const g = new Map([[s.poly, 0]]), came = new Map(), open = [[0, s.poly]];
    const h = i => Math.hypot(this.cx[i] - t.x, this.cy[i] - t.y);
    const closed = new Set();
    let found = false, iter = 0;
    while (open.length && iter++ < 20000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][0] < open[bi][0]) bi = k;
      const [, cur] = open.splice(bi, 1)[0];
      if (cur === t.poly) { found = true; break; }
      if (closed.has(cur)) continue;
      closed.add(cur);
      const gc = g.get(cur);
      for (const nb of this.adj[cur]) {
        if (nb < 0 || closed.has(nb)) continue;
        const ng = gc + Math.hypot(this.cx[nb] - this.cx[cur], this.cy[nb] - this.cy[cur]);
        if (ng < (g.get(nb) ?? Infinity)) { g.set(nb, ng); came.set(nb, cur); open.push([ng + h(nb), nb]); }
      }
    }
    this._dbg = { found, iter, s: s.poly, t: t.poly };
    if (!found) return [{ x: t.x, y: t.y }];
    const seq = [t.poly];
    while (seq[0] !== s.poly) seq.unshift(came.get(seq[0]));
    // portals (left/right relative to travel direction)
    const portals = [[s.x, s.y, s.x, s.y]];
    for (let i = 0; i < seq.length - 1; i++) {
      const pt = this._portal(seq[i], seq[i + 1]);
      if (pt) portals.push(pt);
    }
    portals.push([t.x, t.y, t.x, t.y]);
    this._dbg.seq = seq.length; this._dbg.portals = portals.length;
    return funnel(portals);
  }

  /** Line of sight on the navmesh (walk polygons along the segment). */
  raycastClear(sx, sy, tx, ty) {
    const steps = Math.ceil(Math.hypot(tx - sx, ty - sy) / 0.25);
    for (let i = 1; i <= steps; i++) {
      const k = i / steps;
      if (this.findPoly(sx + (tx - sx) * k, sy + (ty - sy) * k) < 0) return false;
    }
    return true;
  }
}

const cross = (ax, ay, bx, by) => ax * by - ay * bx;

/** Simple stupid funnel over [left, right] portals (left = CCW side of the travel direction). */
function funnel(portals) {
  const pts = [];
  let ax = portals[0][0], ay = portals[0][1];
  let lx = ax, ly = ay, rx = ax, ry = ay, li = 0, ri = 0;
  for (let i = 1; i < portals.length; i++) {
    const [nlx, nly, nrx, nry] = portals[i];
    // right side: tighten if the new right point is left of (or on) the current right
    if (cross(rx - ax, ry - ay, nrx - ax, nry - ay) >= 0) {
      if ((ax === rx && ay === ry) || cross(lx - ax, ly - ay, nrx - ax, nry - ay) < 0) { rx = nrx; ry = nry; ri = i; }
      else { pts.push({ x: lx, y: ly }); ax = lx; ay = ly; rx = ax; ry = ay; ri = li; i = li; continue; }
    }
    // left side: tighten if the new left point is right of (or on) the current left
    if (cross(lx - ax, ly - ay, nlx - ax, nly - ay) <= 0) {
      if ((ax === lx && ay === ly) || cross(rx - ax, ry - ay, nlx - ax, nly - ay) > 0) { lx = nlx; ly = nly; li = i; }
      else { pts.push({ x: rx, y: ry }); ax = rx; ay = ry; lx = ax; ly = ay; li = ri; i = ri; continue; }
    }
  }
  const last = portals[portals.length - 1];
  const end = { x: last[0], y: last[1] };
  if (!pts.length || pts[pts.length - 1].x !== end.x || pts[pts.length - 1].y !== end.y) pts.push(end);
  return pts;
}
/** NavMeshAgent approximation driven by SetDestination/isStopped/speed/radius like the Unity component. */
export class NavMeshAgent {
  constructor(transform, data = {}) {
    this.transform = transform;
    this.speed = data.m_Speed ?? 3.5;
    this.acceleration = data.m_Acceleration ?? 8;
    this.radius = data.m_Radius ?? 0.5;
    this.stoppingDistance = data.m_StoppingDistance ?? 0;
    this.priority = data.avoidancePriority ?? 50;
    this.enabled = true;
    this.isStopped = false;
    this.destination = null;
    this.corners = null;
    this.velocity = { x: 0, y: 0 };
    this.nav = null;
    this._repath = 0;
  }
  get isOnNavMesh() { return !!this.nav && this.enabled; }
  setDestination(x, y) {
    if (this.destination && Math.abs(this.destination.x - x) < 1e-5 && Math.abs(this.destination.y - y) < 1e-5 && this.corners) return;
    this.destination = { x, y };
    const p = this.transform.position;
    this.corners = this.nav ? this.nav.path(p[0], p[1], x, y) : [{ x, y }];
  }
  warp(x, y) {
    const q = this.nav ? this.nav.closest(x, y) : { x, y };
    this.transform.position = [q?.x ?? x, q?.y ?? y];
    this.corners = null; this.destination = null; this.velocity = { x: 0, y: 0 };
  }
  get remainingDistance() {
    if (!this.corners || !this.corners.length) return 0;
    const p = this.transform.position;
    let d = 0, x = p[0], y = p[1];
    for (const c of this.corners) { d += Math.hypot(c.x - x, c.y - y); x = c.x; y = c.y; }
    return d;
  }

  update(dt, others) {
    if (!this.enabled) return;
    const p = this.transform.position;
    let vx = 0, vy = 0;
    if (!this.isStopped && this.corners && this.corners.length) {
      let c = this.corners[0];
      let dx = c.x - p[0], dy = c.y - p[1], d = Math.hypot(dx, dy);
      while (d < 0.05 && this.corners.length > 1) { this.corners.shift(); c = this.corners[0]; dx = c.x - p[0]; dy = c.y - p[1]; d = Math.hypot(dx, dy); }
      const remain = this.remainingDistance;
      if (remain > this.stoppingDistance + 1e-3 && d > 1e-4) {
        let sp = this.speed;
        if (remain < this.stoppingDistance + sp * 0.1) sp = Math.max(0, (remain - this.stoppingDistance) / Math.max(dt, 1e-3));
        vx = dx / d * sp; vy = dy / d * sp;
      }
    }
    // separation (obstacle avoidance approximation)
    if (others) {
      for (const o of others) {
        if (o === this || !o.enabled) continue;
        const q = o.transform.position;
        const dx = p[0] - q[0], dy = p[1] - q[1];
        const rr = this.radius + o.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 1e-8 && d2 < rr * rr) {
          const d = Math.sqrt(d2), push = (rr - d) / rr;
          const w = o.priority <= this.priority ? 1 : 0.5;
          vx += dx / d * push * 2.5 * w; vy += dy / d * push * 2.5 * w;
        }
      }
    }
    // acceleration
    const k = Math.min(1, this.acceleration * dt / Math.max(1e-3, Math.hypot(vx - this.velocity.x, vy - this.velocity.y) || 1));
    this.velocity.x += (vx - this.velocity.x) * k; this.velocity.y += (vy - this.velocity.y) * k;
    let nx = p[0] + this.velocity.x * dt, ny = p[1] + this.velocity.y * dt;
    if (this.nav && this.nav.findPoly(nx, ny) < 0) {
      const q = this.nav.closest(nx, ny, 4);
      if (q) { nx = q.x; ny = q.y; }
    }
    if (NavMeshAgent.blocker && NavMeshAgent.blocker(nx, ny)) { this.velocity = { x: 0, y: 0 }; return; }
    this.transform.position = [nx, ny];
  }
}
