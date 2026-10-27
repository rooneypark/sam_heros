// Original game resource module ("original" pack): one place that answers what the tools need from the extracted
// Rumble Heroes data — units, their level-based skills, terrain brushes and resource paths. The extracted files stay
// under re/extract (local only, never committed to the shared repo); tools and the samguk pack refer to them by key.
import { Tables } from '../game/data/Tables.js';

export const ORIGINAL = {
  id: 'original',
  name: '우르르 용병단 (원작)',
  paths: {
    tables: '/re/extract/tables/',        // Table*.json
    prefabs: '/re/extract/prefabs/',      // prefab/<group>/<name>.json
    textures: '/re/extract/media/textures/',
    audio: '/re/extract/media/audio/',
    maps: '/re/extract/text/',            // World_* / Dungeon_* map JSON (.bytes)
  },
};

const KIND = [['Monster_DPS', '허수아비'], ['Hero', '영웅'], ['Mercenary', '용병'], ['Monster', '몬스터'], ['Raid_Boss', '레이드 보스'],
  ['Abyss', '어비스'], ['NPC', 'NPC']];
export const kindOf = prefab => (KIND.find(([p]) => (prefab || '').startsWith(p)) || [0, '기타'])[1];
const GRADE = { NORMAL: '일반', RARE: '희귀', UNIQUE: '특별', LEGEND: '전설', MYTH: '신화' };

/** portrait sprite of a unit prefab: _Icon when the atlas has one, else the first idle / move frame */
export function iconOf(assets, prefab) {
  const S = assets.sprites || {};
  for (const n of [`${prefab}_Icon`, `${prefab}_Idle_1`, `${prefab}_Idle1`, `${prefab}_Move_1`, `${prefab}_Move1`]) if (S[n]) return n;
  return Object.keys(S).find(k => k.startsWith(prefab + '_')) || null;
}

/** every placeable unit: {key, name, kind, grade, prefab, icon} */
export function units(assets) {
  return Object.values(Tables.t.TableUnit)
    .filter(u => u.prefab && kindOf(u.prefab) !== 'NPC')
    .map(u => ({
      key: u.key, name: Tables.loc(u.name) || u.key, kind: kindOf(u.prefab), grade: GRADE[u.gradeType] || u.gradeType || '',
      prefab: u.prefab, icon: iconOf(assets, u.prefab), source: 'original',
    }));
}

export const MAX_LEVEL = 999;

function skillInfo(key) {
  const s = Tables.skill(key);
  if (!s) return null;
  return { key, name: s.name ? Tables.loc(s.name) : '', desc: s.desc ? Tables.loc(s.desc) : '', icon: s.icon, cool: s.skillCoolTime, range: s.skillDistance };
}

/** UnitSkill rows of a unit (by its skill category), ordered by level */
function skillRows(unitKey) {
  const u = Tables.unit(unitKey);
  const us = Tables.get('TableUnitSkill', u?.skillKey);
  const cat = us ? us.category : u?.category;
  return Object.values(Tables.t.TableUnitSkill).filter(r => r.category === cat).sort((a, b) => a.level - b.level);
}

/** skills of a unit at a displayed level (1-based): default attack, skill A/B, gathering + every tier with its unlock level */
export function skillsAt(unitKey, displayLevel) {
  const lv = Math.max(0, displayLevel - 1);
  const rows = skillRows(unitKey);
  const cur = [...rows].reverse().find(r => r.level <= lv) || rows[0];
  const g = Tables.skillGroup(cur?.skillGroup) || {};
  const tiers = [];
  for (const slot of ['skillA', 'skillB']) {
    const seen = new Set();
    for (const r of rows) {
      const k = Tables.skillGroup(r.skillGroup)?.[slot];
      if (!k || seen.has(k)) continue;
      seen.add(k);
      tiers.push({ slot: slot === 'skillA' ? 'A' : 'B', unlock: r.level + 1, unlocked: r.level <= lv, ...skillInfo(k) });
    }
  }
  return {
    basic: skillInfo(g.defaultSkill), skillA: skillInfo(g.skillA), skillB: skillInfo(g.skillB),
    gathering: skillInfo(g.gatheringSkill), passive: cur?.passive || '', tiers,
  };
}

/** terrain brushes of the map maker -> original tile layer / tile name */
export const TERRAIN = [
  { id: 'grass', name: '잔디', layer: 'mapData', tile: 'g_r_00', icon: 'Ground' },
  { id: 'dirt', name: '흙길', layer: 'roadData', tile: 'rd_r_00', icon: 'Tile_Sand_6' },
  { id: 'sand', name: '모래밭', layer: 'roadData', tile: 'rd_r_01', icon: 'Tile_Sand_6' },
  { id: 'water', name: '물', layer: 'waterData', tile: 'wt_r_00', icon: 'Tile_Water_10' },
  { id: 'rock', name: '바위', layer: 'decoData', tile: 'br_22', icon: 'Object_Mountain_small' },
  { id: 'tree', name: '나무', resource: 'TREE', level: 0, icon: 'tree_0' },
  { id: 'fence', name: '울타리', layer: 'decoData', tile: 'br_122', icon: 'Object_town_fence_1' },
];

/** every original tile as a brush, by category -> map layer (World_* maps: g/rd/wt/mt/bl/br/obj usage) */
const TILE_CATS = [
  { cat: '바닥', re: /^(g_|eg)/, layer: 'mapData' },          // fr_0 (CustomFogTile) is the game's fog, not a brush
  { cat: '길', re: /^rd_/, layer: 'roadData' },
  { cat: '물', re: /^wt_/, layer: 'waterData' },
  { cat: '산·절벽', re: /^(mt_|bl_)/, layer: 'blockData' },
  { cat: '장식', re: /^br_/, layer: 'decoData' },
  { cat: '오브젝트', re: /^obj_/, layer: 'decoData' },
  { cat: '던전', re: /^(dg_|bg_|raid)/, layer: 'mapData' },
  { cat: '던전', re: /^(dungeon|object_dungeon)/i, layer: 'decoData' },
];
export const TERRAIN_CATS = ['기본', ...new Set(TILE_CATS.map(c => c.cat))];
/**
 * mirrored tile pairs: the original maps store no per-cell rotation, a fence / wall / door facing the other way is a
 * separate left-right mirrored tile. Found by comparing every same-family pair with one side flipped (pixel match),
 * plus br_00/br_01 and br_29/br_30 checked by eye (their shading differs). tile -> partner
 */
const PAIRS = [['obj_318', 'obj_320'], ['object_dungeon_brick_3 1', 'object_dungeon_brick_3 2'], ['obj_137', 'obj_140'], ['br_408', 'br_409'],
  ['obj_038', 'obj_039'], ['bl_96', 'bl_98'], ['obj_180', 'obj_182'], ['obj_036', 'obj_037'], ['obj_136', 'obj_141'], ['obj_138', 'obj_139'],
  ['br_08', 'br_09'], ['obj_158', 'obj_159'], ['obj_181', 'obj_183'], ['br_06', 'br_06_1'], ['obj_075', 'obj_076'], ['br_424', 'br_425'],
  ['br_180', 'br_181'], ['br_88', 'br_89'], ['br_163 1', 'br_164 1'], ['br_31', 'br_32'], ['br_319', 'br_320'], ['br_187', 'br_188'],
  ['obj_086', 'obj_087'], ['br_90', 'br_91'], ['br_253', 'br_254'], ['br_200', 'br_201'], ['obj_148', 'obj_149'], ['bl_83', 'bl_88'],
  ['bl_84', 'bl_87'], ['br_159', 'br_160'], ['br_161', 'br_162'], ['br_163 2', 'br_164 2'], ['br_133', 'br_134'], ['br_163 3', 'br_164 3'],
  ['br_193', 'br_194'], ['bl_94', 'bl_97'], ['br_95', 'br_96'], ['br_357', 'br_358'], ['br_02', 'br_03'], ['br_244', 'br_245'],
  ['bl_79', 'bl_80'], ['br_163', 'br_164'], ['br_221', 'br_223'], ['br_316', 'br_317'], ['bl_85', 'bl_86'], ['obj_063', 'obj_064'],
  ['bl_100', 'bl_102'], ['obj_312', 'obj_314'], ['br_225', 'br_226'], ['br_353', 'br_354'], ['br_171', 'br_174'], ['bl_77', 'bl_78'],
  ['br_173', 'br_176'], ['br_148', 'br_149'], ['br_219', 'br_220'], ['br_165', 'br_166'], ['obj_363', 'obj_364'], ['br_122', 'br_123'],
  ['br_211', 'br_212'], ['bl_62', 'bl_63'], ['br_124', 'br_125'], ['br_308', 'br_309'], ['obj_311', 'obj_313'], ['br_172', 'br_175'],
  ['obj_365', 'obj_367'], ['br_58', 'br_59'], ['br_290', 'br_291'], ['bl_74', 'bl_76'], ['bl_103', 'bl_99'], ['bl_19', 'bl_20'],
  ['br_04', 'br_12'], ['br_294', 'br_295'], ['br_15', 'br_16'], ['br_00', 'br_01'], ['br_29', 'br_30']];
export const MIRROR = new Map(PAIRS.flatMap(([a, b]) => [[a, b], [b, a]]));

/** auto-tile rule of a tile: 'pond' (CustomPondTile: a filled block, at least 2x2), 'road' (CustomRoadTile: a line of
 *  edge-connected cells), else null */
export function tileRule(assets, name) {
  const s = assets.tiles?.[name]?.script;
  return s === 'CustomPondTile' ? 'pond' : s === 'CustomRoadTile' ? 'road' : null;
}
/** palette sprite of a tile: auto-tiles show the piece of a finished shape (pond centre / straight road), not a corner */
function iconOfTile(assets, resolver, name) {
  const rule = tileRule(assets, name);
  if (resolver && rule) {
    const occ = new Map();
    const cells = rule === 'pond' ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[-1, 0], [0, 0], [1, 0]];
    for (const [x, y] of cells) occ.set(`${x},${y}`, name);
    const r = resolver.tileSprite({ n: name, x: 0, y: 0, occ });
    if (r?.sprite) return r.sprite;
  }
  return resolver?.spritesOf(name)?.[0] || null;
}
export function terrainCatalog(assets, resolver) {
  const out = TERRAIN.map(t => ({ ...t, cat: '기본', icon: t.tile ? iconOfTile(assets, resolver, t.tile) || t.icon : t.icon, rule: t.tile ? tileRule(assets, t.tile) : null }));
  for (const name of Object.keys(assets.tiles || {}).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
    if (/_org\d*$|_red$|empty|^preview$/.test(name)) continue;        // editor-only / backup tiles
    const c = TILE_CATS.find(c => c.re.test(name));
    if (!c) continue;
    out.push({ id: `tile:${name}`, name, layer: c.layer, tile: name, icon: iconOfTile(assets, resolver, name), cat: c.cat, rule: tileRule(assets, name) });
  }
  return out;
}

const images = new Map();
function image(file) {
  if (!images.has(file)) {
    const img = new Image();
    img.src = file.startsWith('/') ? encodeURI(file) : `${ORIGINAL.paths.textures}${encodeURIComponent(file)}`;   // pack art by URL
    // onload, not decode(): decode() can stay pending in a background tab
    images.set(file, new Promise((res, rej) => { img.onload = () => res(img); img.onerror = rej; }));
  }
  return images.get(file);
}

/** draw an atlas sprite into a DOM canvas (tools only), fitted and centred. The atlas PNG may be larger than the
 * logical texture size of the metadata (ASTC padding), so rects are scaled to the image. */
export async function drawSpriteIcon(assets, canvas, name, px = 128) {
  const m = name && assets.sprites?.[name];
  if (!m?.tex) return false;
  await assets.texture(m.tex);
  const tex = assets.texReady.get(m.tex), img = await image(m.tex);
  const sx = img.naturalWidth / tex.w, sy = img.naturalHeight / tex.h;
  const [x, y, w, h] = m.rect;
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, px, px);
  const mesh = assets.sprite(name)?.mesh;
  if (mesh) { drawMesh(ctx, img, mesh, px); return true; }
  const k = px / Math.max(w, h);
  ctx.drawImage(img, x * sx, (tex.h - y - h) * sy, w * sx, h * sy, (px - w * k) / 2, (px - h * k) / 2, w * k, h * k);
  return true;
}

/** tight-packed sprite: only its mesh triangles (the rect also holds neighbours; the packing may be flipped) */
function drawMesh(ctx, img, mesh, px) {
  const { n, pos, uv, tris } = mesh;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) { x0 = Math.min(x0, pos[i * 2]); x1 = Math.max(x1, pos[i * 2]); y0 = Math.min(y0, pos[i * 2 + 1]); y1 = Math.max(y1, pos[i * 2 + 1]); }
  const k = px / Math.max(x1 - x0, y1 - y0), ox = (px - (x1 - x0) * k) / 2, oy = (px - (y1 - y0) * k) / 2;
  const dx = i => ox + (pos[i * 2] - x0) * k, dy = i => oy + (y1 - pos[i * 2 + 1]) * k;      // y up -> canvas down
  const su = i => uv[i * 2] * img.naturalWidth, sv = i => uv[i * 2 + 1] * img.naturalHeight;
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
    // affine map source triangle (atlas pixels) -> destination triangle
    const sx0 = su(a), sy0 = sv(a), sx1 = su(b), sy1 = sv(b), sx2 = su(c), sy2 = sv(c);
    const d = (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);
    if (Math.abs(d) < 1e-9) continue;
    const X0 = dx(a), Y0 = dy(a), X1 = dx(b), Y1 = dy(b), X2 = dx(c), Y2 = dy(c);
    const ma = ((X1 - X0) * (sy2 - sy0) - (X2 - X0) * (sy1 - sy0)) / d;
    const mc = ((X2 - X0) * (sx1 - sx0) - (X1 - X0) * (sx2 - sx0)) / d;
    const mb = ((Y1 - Y0) * (sy2 - sy0) - (Y2 - Y0) * (sy1 - sy0)) / d;
    const md = ((Y2 - Y0) * (sx1 - sx0) - (Y1 - Y0) * (sx2 - sx0)) / d;
    ctx.save();
    // clip slightly enlarged (0.5 px) so neighbouring triangles leave no seams
    const cx = (X0 + X1 + X2) / 3, cy = (Y0 + Y1 + Y2) / 3, grow = (X, Y) => { const L = Math.hypot(X - cx, Y - cy) || 1; return [X + (X - cx) / L * 0.5, Y + (Y - cy) / L * 0.5]; };
    ctx.beginPath(); ctx.moveTo(...grow(X0, Y0)); ctx.lineTo(...grow(X1, Y1)); ctx.lineTo(...grow(X2, Y2)); ctx.closePath(); ctx.clip();
    ctx.setTransform(ma, mb, mc, md, X0 - ma * sx0 - mc * sy0, Y0 - mb * sx0 - md * sy0);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
}
