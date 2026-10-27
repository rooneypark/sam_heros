// Walkable grid for maker maps (the original maps ship a baked NavMesh; user maps derive walkability from their tiles).
// Same interface as NavMesh: findPoly / closest / path / raycastClear. Resolution: the Deco grid (1/3 of a map cell),
// a cell is walkable when the map cell under its centre has ground and no water / block tile, and no blocking deco.
import { MAP_CELL, DECO_CELL, DECO_OFFSET, cellCenter, worldToCell } from '../game/map/WorldMapView.js';

/** deco tiles that stop movement (fences, rocks, barriers); others (flowers, grass) are walkable */
export const BLOCKING_DECO = new Set(['br_00', 'br_01', 'br_22', 'br_122', 'br_123', 'br_50', 'br_113', 'br_76', 'br_72']);
/** blocking deco tiles larger than one deco cell: tile -> [width, height] in deco cells around the placed cell */
export const BLOCKING_FOOTPRINT = new Map();

const key = (x, y) => `${x},${y}`;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class GridNav {
  constructor(json, blocking = BLOCKING_DECO) {
    const set = list => new Set((list || []).map(t => key(t.x, t.y)));
    this.ground = set(json.mapData);
    this.water = set(json.waterData);
    this.block = set(json.blockData);
    this.deco = new Set();
    for (const t of json.decoData || []) {
      if (!blocking.has(t.n)) continue;
      const [fw, fh] = BLOCKING_FOOTPRINT.get(t.n) || [1, 1];
      const rx = Math.floor((fw - 1) / 2), ry = Math.floor((fh - 1) / 2);
      for (let dx = -rx; dx < fw - rx; dx++) for (let dy = -ry; dy < fh - ry; dy++) this.deco.add(key(t.x + dx, t.y + dy));
    }
    this.cache = new Map();
  }
  cellOf(x, y) { return worldToCell(x, y, DECO_CELL, DECO_OFFSET); }
  center(cx, cy) { return cellCenter(cx, cy, DECO_CELL, DECO_OFFSET); }
  walkable(cx, cy) {
    const k = key(cx, cy);
    let v = this.cache.get(k);
    if (v !== undefined) return v;
    const c = this.center(cx, cy), m = worldToCell(c.x, c.y, MAP_CELL), mk = key(m.x, m.y);
    v = this.ground.has(mk) && !this.water.has(mk) && !this.block.has(mk) && !this.deco.has(k);
    this.cache.set(k, v);
    return v;
  }
  /** rebuild after the map changed (maker edits) */
  invalidate(json) { Object.assign(this, new GridNav(json)); }

  findPoly(x, y) { const c = this.cellOf(x, y); return this.walkable(c.x, c.y) ? 1 : -1; }

  /** nearest walkable point within maxR world units (cell centre of the nearest walkable cell) */
  closest(x, y, maxR = 12) {
    const c = this.cellOf(x, y);
    if (this.walkable(c.x, c.y)) return { x, y };
    const rings = Math.ceil(maxR / DECO_CELL.y);
    let best = null, bd = Infinity;
    for (let r = 1; r <= rings && !best; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !this.walkable(c.x + dx, c.y + dy)) continue;
        const p = this.center(c.x + dx, c.y + dy), d = Math.hypot(p.x - x, p.y - y);
        if (d < bd && d <= maxR) { bd = d; best = p; }
      }
    }
    return best ? { x: best.x, y: best.y } : null;
  }

  raycastClear(sx, sy, tx, ty) {
    const n = Math.max(1, Math.ceil(Math.hypot(tx - sx, ty - sy) / 0.2));
    for (let i = 0; i <= n; i++) { const k = i / n; if (this.findPoly(sx + (tx - sx) * k, sy + (ty - sy) * k) < 0) return false; }
    return true;
  }

  /** A* over the cells (8 neighbours, no corner cutting) then string-pulled with line of sight */
  path(sx, sy, tx, ty) {
    const s0 = this.closest(sx, sy, 6), t0 = this.closest(tx, ty, 12);
    if (!s0 || !t0) return null;
    if (this.raycastClear(s0.x, s0.y, t0.x, t0.y)) return [{ x: t0.x, y: t0.y }];
    const s = this.cellOf(s0.x, s0.y), t = this.cellOf(t0.x, t0.y);
    const tc = this.center(t.x, t.y);
    const h = (x, y) => { const p = this.center(x, y); return Math.hypot(p.x - tc.x, p.y - tc.y); };
    const open = [[h(s.x, s.y), 0, s.x, s.y]];
    const came = new Map(), gs = new Map([[key(s.x, s.y), 0]]);
    let found = null, guard = 0;
    while (open.length && guard++ < 30000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, g, x, y] = open.splice(bi, 1)[0];
      if (x === t.x && y === t.y) { found = [x, y]; break; }
      if (g > (gs.get(key(x, y)) ?? Infinity)) continue;
      const pc = this.center(x, y);
      for (const [dx, dy] of N8) {
        const nx = x + dx, ny = y + dy;
        if (!this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(x + dx, y) || !this.walkable(x, y + dy))) continue;
        const nc = this.center(nx, ny), ng = g + Math.hypot(nc.x - pc.x, nc.y - pc.y), nk = key(nx, ny);
        if (ng >= (gs.get(nk) ?? Infinity)) continue;
        gs.set(nk, ng); came.set(nk, [x, y]);
        open.push([ng + h(nx, ny), ng, nx, ny]);
      }
    }
    if (!found) return [{ x: t0.x, y: t0.y }];
    const cells = [];
    for (let c = found; c; c = came.get(key(c[0], c[1]))) cells.push(this.center(c[0], c[1]));
    cells.reverse();
    cells[cells.length - 1] = { x: t0.x, y: t0.y };
    // string pulling: from each anchor keep the farthest point still in line of sight
    const out = [];
    let ax = s0.x, ay = s0.y, i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.raycastClear(ax, ay, cells[j].x, cells[j].y)) j--;
      out.push(cells[j]); ax = cells[j].x; ay = cells[j].y; i = j + 1;
    }
    return out;
  }
}
