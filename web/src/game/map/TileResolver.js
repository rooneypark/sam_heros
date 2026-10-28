// Tile asset -> sprite/color/transform, reproducing the game's custom tiles (from libil2cpp disassembly):
//  CustomRandomTile.GetTileData  @0x24aecd8
//  CustomPondTile.GetTileData    @0x24ae7e4 (+ index table @0x4170548)
//  CustomRoadTile.GetTileData    @0x24aee78 (+ switch table @0x41704b8)
import { perlinNoise } from '../../engine/unitymath.js';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const POND_TABLE = [11, 9, 5, 11, 8, 10, 4, 11, 7, 6, 12]; // index by mask-5, valid bits 0x777

function spriteName(ref) { return ref && (ref.sprite || ref.n) || null; }

export class TileResolver {
  constructor(tilesJson) {
    this.tiles = tilesJson;
    this.time = 0;
  }

  def(name) { return this.tiles[name]; }

  spritesOf(name) {
    const t = this.tiles[name];
    if (!t || !t.f) return [];
    const f = t.f;
    const out = [];
    if (f.m_Sprite) out.push(spriteName(f.m_Sprite));
    for (const s of f.m_Sprites || []) out.push(spriteName(s));
    for (const s of f.m_AnimatedSprites || []) out.push(spriteName(s));
    if (f.m_DefaultSprite) out.push(spriteName(f.m_DefaultSprite));
    return out.filter(Boolean);
  }

  /** cell: {n, x, y, occ:Map} -> {sprite, color, sx, sy} */
  tileSprite(cell) {
    if (cell._cache !== undefined && !cell._anim) return cell._cache;
    const t = this.tiles[cell.n];
    let res = null;
    if (t && t.f) {
      const f = t.f;
      switch (t.script) {
        case 'SamgukMaterialTile': {
          const {x,y}=cell;
          const mask=(this._has(cell,x-1,y)?1:0)|(this._has(cell,x+1,y)?2:0)|
            (this._has(cell,x,y-1)?4:0)|(this._has(cell,x,y+1)?8:0);
          // Broad, subtle meadow variation; adjacent cells vary smoothly instead of checkerboard tint.
          const n=perlinNoise((x+1000)*.075,(y+1000)*.075)-.5;
          const color=f.shape==='ground'?{r:1+n*.13,g:1+n*.07,b:1-n*.04,a:1}:WHITE;
          res={sprite:spriteName(f.m_Sprites[f.shape==='ground'?15:mask]),color};
          break;
        }
        case 'CustomRandomTile': res = this._random(cell, f); break;
        case 'CustomPondTile': res = this._pond(cell, f); break;
        case 'CustomRoadTile': res = this._road(cell, f); break;
        case 'UnityEngine.Tilemaps.AnimatedTile': {
          cell._anim = true;
          const frames = f.m_AnimatedSprites || [];
          if (frames.length) {
            const speed = (f.m_MinSpeed + f.m_MaxSpeed) * 0.5 || 1;
            const i = Math.floor((this.time * speed + (f.m_AnimationStartTime || 0))) % frames.length;
            res = { sprite: spriteName(frames[i]), color: WHITE };
          }
          break;
        }
        default:
          if (f.m_Sprite) res = { sprite: spriteName(f.m_Sprite), color: f.m_Color || WHITE };
          else if (f.m_DefaultSprite) res = { sprite: spriteName(f.m_DefaultSprite), color: WHITE };
      }
    }
    cell._cache = res;
    return res;
  }

  _random(cell, f) {
    const arr = f.m_Sprites || [];
    if (!arr.length) return null;
    const p = perlinNoise((cell.x + 100000) * 0.5, (cell.y + 100000) * 0.5) * arr.length;
    let i = Math.floor(p);
    if (!Number.isFinite(p)) i = -2147483648;
    i = Math.max(0, Math.min(arr.length - 1, i));
    return { sprite: spriteName(arr[i]), color: WHITE };
  }

  _has(cell, x, y) { return cell.occ.has(`${x},${y}`); }

  _pond(cell, f) {
    const arr = f.m_Sprites || [];
    const { x, y } = cell;
    const pick = i => (i < arr.length ? { sprite: spriteName(arr[i]), color: f.m_Color || WHITE } : null);
    const A = this._has(cell, x - 1, y);
    const B = this._has(cell, x, y + 1);
    let mask = B ? 8 : (A ? 1 : 0);
    if (A && B) {
      if (!this._has(cell, x - 1, y + 1)) return pick(0);
      mask = 9;
    }
    const C = this._has(cell, x + 1, y);
    if (C) mask |= 2;
    const D = this._has(cell, x, y - 1);
    let ad = A ? 1 : 0;
    if (D) {
      ad = A ? 2 : 1;
      mask |= 4;
      if (C && !this._has(cell, x + 1, y - 1)) return pick(1);
    }
    if (C && B && !this._has(cell, x + 1, y + 1)) return pick(2);
    if (ad === 2 && !this._has(cell, x - 1, y - 1)) return pick(3);
    const k = mask - 5;
    if (k >= 0 && k < 11 && ((0x777 >> k) & 1)) return pick(POND_TABLE[k]);
    return null;
  }

  _road(cell, f) {
    const arr = f.m_Sprites || [];
    const { x, y } = cell;
    const A = this._has(cell, x - 1, y), B = this._has(cell, x + 1, y);
    const C = this._has(cell, x, y - 1), D = this._has(cell, x, y + 1);
    const m = (A ? 1 : 0) | (B ? 2 : 0) | (C ? 4 : 0) | (D ? 8 : 0);
    const perlin10 = () => Math.floor(perlinNoise((x + 100000) * 0.5, (y + 100000) * 0.5) * 10);
    let idx, mirror = false;
    switch (m) {
      case 1: idx = 4; break;
      case 2: idx = 4; mirror = true; break;
      case 3: idx = perlin10() === 1 ? 1 : 0; break;
      case 4: idx = 5; mirror = true; break;
      case 5: idx = 7; break;
      case 6: idx = 8; break;
      case 7: idx = 10; break;
      case 8: idx = 5; break;
      case 9: idx = 8; mirror = true; break;
      case 10: idx = 6; break;
      case 11: idx = 10; mirror = true; break;
      case 12: idx = perlin10() === 1 ? 3 : 2; break;
      case 13: idx = 9; break;
      case 14: idx = 9; mirror = true; break;
      case 15: idx = 11; break;
      default: return null;
    }
    if (idx >= arr.length) return null;
    // mirrorMatrix = TRS(0, identity, (-1,-1,1))
    return { sprite: spriteName(arr[idx]), color: WHITE, sx: mirror ? -1 : 1, sy: mirror ? -1 : 1 };
  }
}
