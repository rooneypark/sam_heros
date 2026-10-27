// Map document of the maker: the original World_*.bytes JSON layout (so the game's MapManager / TileResolver read it
// unchanged) plus a "maker" block with the placed units and trees. Units: {id, key, team:'ally'|'enemy', level, x, y}
// (level = displayed level, 1-based); trees: {id, x, y}.
import { MAP_CELL, DECO_CELL, DECO_OFFSET, worldToCell, cellCenter } from '../game/map/WorldMapView.js';
import { TERRAIN } from '../packs/original.js';

export const MAP_LAYERS = ['mapData', 'roadData', 'waterData', 'decoData', 'blockData'];
const GROUND = 'g_r_00';
let nextId = 1;
const newId = () => `m${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function newDoc(name = '새 맵', size = 12) {
  const doc = { name, maker: { version: 1, pack: 'original', units: [], trees: [] }, Spawners: [], Buildings: [], FootSwitch: [] };
  for (const L of MAP_LAYERS) doc[L] = [];
  for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) doc.mapData.push({ x, y, n: GROUND });
  const c = cellCenter(size / 2 - 0.5, size / 2 - 0.5, MAP_CELL);
  doc.BonfirePos = { x: c.x, y: c.y };
  return doc;
}

/** accept a maker save or an original map (World_*.bytes): the latter gains an empty maker block */
export function normalize(json, name) {
  const doc = json;
  for (const L of MAP_LAYERS) doc[L] = doc[L] || [];
  doc.maker = doc.maker || { version: 1, pack: 'original', units: [], trees: [] };
  doc.maker.units = doc.maker.units || []; doc.maker.trees = doc.maker.trees || [];
  for (const u of doc.maker.units) u.id = u.id || newId();
  for (const t of doc.maker.trees) t.id = t.id || newId();
  doc.name = doc.name || name || '맵';
  doc.Spawners = doc.Spawners || []; doc.Buildings = doc.Buildings || [];
  doc.BonfirePos = doc.BonfirePos || { x: 0, y: 0 };
  return doc;
}

export const clone = doc => JSON.parse(JSON.stringify(doc));

function setTile(list, x, y, n) {
  const i = list.findIndex(t => t.x === x && t.y === y);
  if (n === null) { if (i >= 0) { list.splice(i, 1); return true; } return false; }
  if (i >= 0) { if (list[i].n === n) return false; list[i].n = n; return true; }
  list.push({ x, y, n }); return true;
}

/** cells covered by a brush of `size` map cells around a world point (for deco brushes: size*3 deco cells) */
function cellsAround(wx, wy, cell, off, size) {
  const c = worldToCell(wx, wy, cell, off), r = Math.floor((size - 1) / 2), out = [];
  for (let dx = -r; dx < size - r; dx++) for (let dy = -r; dy < size - r; dy++) out.push([c.x + dx, c.y + dy]);
  return out;
}

/** paint a terrain brush; returns true when the tile layers changed (trees are handled by the caller) */
export function paint(doc, brush, wx, wy, size = 1) {
  const b = typeof brush === 'string' ? TERRAIN.find(t => t.id === brush) : brush;   // brush: id or {layer, tile}
  if (!b || b.resource) return false;
  let changed = false;
  // CustomPondTile (water, sand) only draws blocks of at least 2x2 cells
  if (b.rule === 'pond') size = Math.max(size, 2);
  if (b.layer === 'decoData') {
    for (const [x, y] of cellsAround(wx, wy, DECO_CELL, DECO_OFFSET, size)) changed = setTile(doc.decoData, x, y, b.tile) || changed;
    return changed;
  }
  for (const [x, y] of cellsAround(wx, wy, MAP_CELL, undefined, size)) {
    if (b.layer !== 'mapData') changed = setTile(doc.mapData, x, y, GROUND) || changed;   // road / water sit on ground
    if (b.layer === 'roadData') changed = setTile(doc.waterData, x, y, null) || changed;
    if (b.layer === 'waterData') changed = setTile(doc.roadData, x, y, null) || changed;
    changed = setTile(doc[b.layer], x, y, b.tile) || changed;
  }
  return changed;
}

/**
 * points of a drag from (x0,y0) to (x1,y1) for `fn(x, y)`: every cell the segment crosses, and when two consecutive
 * cells only touch at a corner the edge cell between them too (a CustomRoadTile line must be edge-connected)
 */
export function strokeCells(x0, y0, x1, y1, deco, fn) {
  const cell = deco ? DECO_CELL : MAP_CELL, off = deco ? DECO_OFFSET : undefined;
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cell.y * 0.25)));
  let last = null;
  for (let i = 0; i <= steps; i++) {
    const k = i / steps, c = worldToCell(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, cell, off);
    if (last && last.x === c.x && last.y === c.y) continue;
    if (last && last.x !== c.x && last.y !== c.y) { const p = cellCenter(c.x, last.y, cell, off); fn(p.x, p.y); }
    const p = cellCenter(c.x, c.y, cell, off); fn(p.x, p.y);
    last = c;
  }
}

/** erase the top-most tile under the point: deco, then block / water / road, then ground */
export function erase(doc, wx, wy, size = 1) {
  let changed = false;
  for (const [x, y] of cellsAround(wx, wy, DECO_CELL, DECO_OFFSET, size === 1 ? 1 : size * 3)) changed = setTile(doc.decoData, x, y, null) || changed;
  if (changed) return true;
  for (const [x, y] of cellsAround(wx, wy, MAP_CELL, undefined, size)) {
    let done = false;
    for (const L of ['blockData', 'waterData', 'roadData', 'mapData']) if (!done && setTile(doc[L], x, y, null)) { done = changed = true; }
  }
  return changed;
}

export function addUnit(doc, key, team, level, x, y) {
  const u = { id: newId(), key, team, level, x, y };
  doc.maker.units.push(u);
  return u;
}
export function addTree(doc, x, y) {
  const t = { id: newId(), x, y };
  doc.maker.trees.push(t);
  return t;
}
export function removeById(doc, id) {
  for (const k of ['units', 'trees']) {
    const i = doc.maker[k].findIndex(o => o.id === id);
    if (i >= 0) { doc.maker[k].splice(i, 1); return true; }
  }
  return false;
}

/** world bounds of the painted map (for "전체 보기") */
export function bounds(doc) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const t of doc.mapData) {
    const c = cellCenter(t.x, t.y, MAP_CELL);
    x0 = Math.min(x0, c.x - MAP_CELL.x / 2); x1 = Math.max(x1, c.x + MAP_CELL.x / 2);
    y0 = Math.min(y0, c.y - MAP_CELL.y / 2); y1 = Math.max(y1, c.y + MAP_CELL.y / 2);
  }
  return isFinite(x0) ? { x0, y0, x1, y1 } : { x0: -10, y0: -10, x1: 10, y1: 10 };
}
