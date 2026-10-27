// Renders map JSON (Story_*/World_*/Dungeon_*) as Unity isometric tilemaps.
// Grid "Map": CellLayout IsometricZAsY, cellSize (3.32, 2.0). Grid "Deco": Isometric, cellSize (1.10667, 0.66667),
// tilemaps offset by (-1.106667, 0.666667). Sorting orders from the WorldMap scene: ground -3, road -2, water -1,
// deco 0, block 3 (Individual), barrier 3 (Individual), fog 5.

export const MAP_CELL = { x: 3.32, y: 2.0 };
export const DECO_CELL = { x: 1.1066666841506958, y: 0.6666666865348816 };
export const DECO_OFFSET = { x: -1.1066670417785645, y: 0.6666666865348816 };

/** Unity Grid.CellToLocalInterpolated for isometric layouts (tile anchor 0.5, 0.5). */
export function cellCenter(x, y, cell, off = { x: 0, y: 0 }) {
  const cx = x + 0.5, cy = y + 0.5;
  return { x: (cx - cy) * cell.x * 0.5 + off.x, y: (cx + cy) * cell.y * 0.5 + off.y };
}

/** Unity Grid.WorldToCell for isometric layouts. */
export function worldToCell(wx, wy, cell, off = { x: 0, y: 0 }) {
  const lx = (wx - off.x) / (cell.x * 0.5), ly = (wy - off.y) / (cell.y * 0.5);
  return { x: Math.floor((lx + ly) * 0.5), y: Math.floor((ly - lx) * 0.5) };
}

const LAYERS = [
  { key: 'mapData', order: -3, cell: MAP_CELL, off: { x: 0, y: 0 }, individual: false },
  { key: 'roadData', order: -2, cell: MAP_CELL, off: { x: 0, y: 0 }, individual: false },
  { key: 'waterData', order: -1, cell: MAP_CELL, off: { x: 0, y: 0 }, individual: false },
  { key: 'decoData', order: 0, cell: DECO_CELL, off: DECO_OFFSET, individual: false },
  { key: 'blockData', order: 3, cell: MAP_CELL, off: { x: 0, y: 0 }, individual: true },
];

export class WorldMapView {
  constructor(assets, mapJson, tileResolver) {
    this.assets = assets;
    this.map = mapJson;
    this.resolve = tileResolver;
    this.cells = [];
    for (const L of LAYERS) {
      const list = mapJson[L.key] || [];
      const occ = new Map();
      for (const t of list) occ.set(`${t.x},${t.y}`, t.n);
      for (const t of list) {
        const p = cellCenter(t.x, t.y, L.cell, L.off);
        this.cells.push({ n: t.n, x: t.x, y: t.y, wx: p.x, wy: p.y, order: L.order, individual: L.individual,
          layer: L.key, occ });
      }
    }
    this.bounds = this._bounds();
  }

  _bounds() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cells) {
      x0 = Math.min(x0, c.wx); y0 = Math.min(y0, c.wy); x1 = Math.max(x1, c.wx); y1 = Math.max(y1, c.wy);
    }
    return { x0, y0, x1, y1 };
  }

  spriteNames() {
    const s = new Set();
    for (const c of this.cells) for (const n of this.resolve.spritesOf(c.n)) s.add(n);
    return s;
  }

  draw(renderer, view) {
    const margin = 4;
    for (const c of this.cells) {
      if (c.wx < view.x0 - margin || c.wx > view.x1 + margin || c.wy < view.y0 - margin || c.wy > view.y1 + margin * 2) continue;
      const t = this.resolve.tileSprite(c);
      if (!t) continue;
      const sp = this.assets.sprite(t.sprite);
      if (!sp) continue;
      renderer.draw({
        sp, x: c.wx + (t.dx || 0), y: c.wy + (t.dy || 0), sx: t.sx ?? 1, sy: t.sy ?? 1,
        r: t.color.r, g: t.color.g, b: t.color.b, a: t.color.a,
        layer: 0, order: c.order, sortY: c.individual ? c.wy : 0,
      });
    }
  }
}
