// 삼국히어로즈 content pack (served from the collaboration repo at /samguk/, see tools/serve.py).
// content/samguk/units.json defines units on top of an original "base" unit (prefab, stats and motions until the
// pack has its own art); "levels" can replace the skills per level with any original skill keys. Each unit is
// registered as TableUnit / TableUnitSkill / TableSkillGroup rows so the engine spawns it like any other unit.
import { Tables } from '../game/data/Tables.js';
import { iconOf, kindOf, MIRROR } from './original.js';
import { packFrame } from './artFrames.js';
import { registerCustomMotion } from './customMotion.js';
import { packUnitsPath } from './reviewMode.js';

export const SAMGUK_ROOT = '/samguk/';
export const FACTIONS = ['위', '촉', '오', '군', '주민'];
export const SAMGUK = { id: 'samguk', name: '삼국히어로즈', units: 'content/samguk/units.json', maps: 'content/samguk/maps/' };

async function fetchJSON(path) {
  const r = await fetch(SAMGUK_ROOT + path);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}

/** register a pack unit as table rows; returns the palette entry */
function register(def, assets) {
  const base = Tables.unit(def.base);
  if (!base) { console.warn(`samguk: base unit ${def.base} of ${def.id} not found`); return null; }
  const row = { ...base, key: def.id, name: def.name, gradeType: def.gradeType || base.gradeType, drawWeight: 0 };
  row.motionTimingBasis = def.motionTimingBasis || 'original';
  registerCustomMotion(def, base, row, assets, Tables);
  if (def.levels?.length) {
    // own skill rows: category = unit id, one TableSkillGroup per level entry (missing slots keep the base skills)
    const baseUs = Tables.get('TableUnitSkill', base.skillKey);
    const baseGroup = Tables.skillGroup(Tables.unitSkillFor(baseUs ? baseUs.category : base.category, 0)?.skillGroup) || {};
    const rows = [];
    def.levels.forEach((lv, i) => {
      const gk = `${def.id}_G${i}`, uk = `${def.id}_S${i}`;
      Tables.t.TableSkillGroup[gk] = { ...baseGroup, key: gk, ...pick(lv, ['defaultSkill', 'skillA', 'skillB', 'gatheringSkill', 'isFirstB']) };
      const r = { key: uk, category: def.id, level: Math.max(0, (lv.level ?? 1) - 1), grade: 0, skillGroup: gk, passive: lv.passive || '' };
      Tables.t.TableUnitSkill[uk] = r; rows.push(r);
    });
    rows.sort((a, b) => a.level - b.level);
    Tables.unitSkillByCat.set(def.id, rows);
    row.skillKey = rows[0].key; row.category = def.id;
  }
  // own art: the unit's body frames are replaced by the pack's PNGs (art.frames per state, art.static for one image)
  if (def.art?.frames || def.art?.static) {
    const art = registerArt(assets, def.id, def.art, base.prefab);
    row.spriteRemap = art.remap; row.artReady = art.ready;
    row.artFlip = def.art.facing === 'right';    // original sprites face left; right-facing pack art is mirrored
  }
  // pack effects: motion[state].fx[i] = { frames: [png...], at, ms, life, loop, offset, move, follow, layer, pivot }
  const fxReady = [];
  row.motionFx = {};
  for (const [state, spec] of Object.entries(def.motion || {})) {
    if (!spec.fx?.length) continue;
    row.motionFx[state] = spec.fx.map((f, i) => {
      const sprites = (f.frames || []).map((path, k) => {
        const name = `${def.id}:fx:${state}:${i}:${k}`;
        fxReady.push(registerImage(assets, name, SAMGUK_ROOT + path, f.pivot || [0.5, 0.5], f.ppu || 100));
        return name;
      });
      return { ...f, sprites };
    });
  }
  // replaced original effects: skillFx[<original prefab, e.g. Fx_Heal_01>] = { frames, ms, life, loop, offset, follow, layer, pivot } | null (hide)
  if (def.skillFx) {
    row.skillFx = {};
    for (const [prefab, f] of Object.entries(def.skillFx)) {
      if (!f) { row.skillFx[prefab] = null; continue; }
      const sprites = (f.frames || []).map((path, k) => {
        const name = `${def.id}:skillFx:${prefab}:${k}`;
        fxReady.push(registerImage(assets, name, SAMGUK_ROOT + path, f.pivot || [0.5, 0.5], f.ppu || 100));
        return name;
      });
      row.skillFx[prefab] = { ...f, sprites };
    }
  }
  const fxSprites = () => [...Object.values(row.motionFx).flat(), ...Object.values(row.skillFx || {}).filter(Boolean)].flatMap(f => f.sprites);
  if (fxReady.length) row.artReady = Promise.all([row.artReady, ...fxReady]).then(() => assets.preloadSprites(fxSprites()));
  row.quietAttack = def.attackFx !== true;        // basic attacks show no (original) effects; "attackFx": true keeps them
  if (def.statKey) row.statKey = def.statKey;    // another TableUnitStat row (원작 능력치 곡선 차용)
  if (def.scale) row.scale = def.scale;
  Tables.t.TableUnit[def.id] = row;
  return {
    // faction: 위 / 촉 / 오 / 군 (군 = 황건적 등 세력 밖 군대·몬스터); the maker's 삼국히어로즈 tabs
    key: def.id, name: def.name, kind: FACTIONS.includes(def.faction) ? def.faction : '군', grade: def.grade || '', prefab: base.prefab, source: 'samguk',
    baseKind: kindOf(base.prefab), base: def.base, memo: def.memo || '',
    icon: iconOf(assets, base.prefab), art: def.art?.icon ? SAMGUK_ROOT + def.art.icon : null,
  };
}
/**
 * Register pack PNGs as sprites. art = { ppu = 100, pivot = [0.5, 0.3], static: 'path.png',
 * frames: { Idle: [...], Move: [...], Attack: [...], Skill_01: [...], Gather: [...], Die: [...] } }.
 * Base frame names are <Prefab>_<State>_<n> (or <State><n>); a state without frames uses Idle, then `static`.
 */
function registerArt(assets, id, art, prefab) {
  const ppu = art.ppu || 100, pivot = art.pivot || [0.5, 0.3];
  const frames = {};
  const all = [];
  const add = (path, state) => {
    const name = `${id}:${path}`;
    const meta = art.stateMeta?.[state] || {};
    all.push({ name, url: SAMGUK_ROOT + path, pivot: meta.pivot || pivot, ppu: meta.ppu || ppu });
    return name;
  };
  for (const [state, list] of Object.entries(art.frames || {})) frames[state] = list.map(path => add(path, state));
  const still = art.static ? add(art.static) : null;
  const ready = Promise.all(all.map(({ name, url, pivot, ppu }) => registerImage(assets, name, url, pivot, ppu)))
    .then(() => assets.preloadSprites(all.map(a => a.name)));
  const ok = n => n && assets.sprites[n];
  const remap = (base, state) => packFrame(base, state, prefab, frames, still, ok);
  return { remap, ready };
}

const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

/** planners' table changes (content/samguk/tables/overrides.json) over the original tables; 0 when there are none */
export async function loadSamgukOverrides() {
  try { return Tables.applyOverrides(await fetchJSON('content/samguk/tables/overrides.json')); } catch { return 0; }
}

/** load the pack; [] when the repo is not mounted */
export async function loadSamgukUnits(assets) {
  try {
    const j = await fetchJSON(packUnitsPath());
    return (j.units || []).map(d => register(d, assets)).filter(Boolean);
  } catch (e) {
    console.info('samguk pack not loaded:', e.message);
    return [];
  }
}

/** load one PNG as a sprite (Unity-style meta: full rect, pivot, ppu); resolves false when the file is missing */
function registerImage(assets, name, url, pivot, ppu) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      assets.sprites[name] = { tex: url, rect: [0, 0, w, h], size: [w, h], offset: [0, 0], pivot, ppu, border: [0, 0, 0, 0] };
      res(true);
    };
    img.onerror = () => { console.warn('samguk art missing:', url); res(false); };
    img.src = encodeURI(url);
  });
}

// tiles.json "type" -> the original tile script the TileResolver reproduces
const TILE_SCRIPT = { single: 'UnityEngine.Tilemaps.Tile', random: 'CustomRandomTile', road: 'CustomRoadTile', pond: 'CustomPondTile' };
const TILE_DEFAULTS = { mapData: [[0.5, 0.5], 120], roadData: [[0.5, 0.5], 120], waterData: [[0.5, 0.5], 120], blockData: [[0.5, 0.3], 120], decoData: [[0.5, 0.3], 100] };

/**
 * content/samguk/tiles.json: map components drawn by the art team, registered as tiles so the maps and the maker use
 * them like original tiles. { id, name, layer, type: single|random|road|pond, sprite | sprites[], pivot?, ppu?, blocks? }
 * Returns maker brushes (category 삼국) and the ids that stop movement.
 */
export async function loadSamgukTiles(assets) {
  let j;
  try { j = await fetchJSON('content/samguk/tiles.json'); } catch { return { brushes: [], blocking: [] }; }
  const brushes = [], blocking = [];
  for (const t of j.tiles || []) {
    // Reuse an existing terrain's complete autotile rule and atlas metadata.
    // A pack alias gets its own stable ID without duplicating the original art.
    if (t.sourceTile) {
      const source = assets.tiles[t.sourceTile];
      if (!source) { console.warn(`samguk tile ${t.id}: missing source ${t.sourceTile}`); continue; }
      assets.tiles[t.id] = { ...source, name: t.id };
      if (t.blocks) blocking.push({ id: t.id, footprint: t.footprint || null });
      if (t.pair) MIRROR.set(t.id, t.pair).set(t.pair, t.id);
      brushes.push({ id: `tile:${t.id}`, name: t.name || t.id, layer: t.layer, tile: t.id,
        cat: '삼국', icon: null, rule: t.type === 'pond' || t.type === 'road' ? t.type : null, source: 'samguk' });
      continue;
    }
    const [pivot0, ppu0] = TILE_DEFAULTS[t.layer] || TILE_DEFAULTS.decoData;
    const files = t.sprites || (t.sprite ? [t.sprite] : []);
    const names = files.map((f, i) => `${t.id}#${i}`);
    const ok = await Promise.all(files.map((f, i) => registerImage(assets, names[i], SAMGUK_ROOT + f, t.pivot || pivot0, t.ppu || ppu0)));
    if (!ok.some(Boolean)) continue;
    const script = TILE_SCRIPT[t.type || 'single'];
    const f = script === TILE_SCRIPT.single ? { m_Sprite: { sprite: names[0] }, m_Color: { r: 1, g: 1, b: 1, a: 1 } }
      : { m_Sprites: names.map(n => ({ sprite: n })), m_Color: { r: 1, g: 1, b: 1, a: 1 } };
    assets.tiles[t.id] = { type: 'MB', script, name: t.id, f };
    await assets.preloadSprites(names);
    if (t.blocks) blocking.push({ id: t.id, footprint: t.footprint || null });
    if (t.pair) MIRROR.set(t.id, t.pair).set(t.pair, t.id);    // the same piece facing the other way (fences, walls)
    brushes.push({ id: `tile:${t.id}`, name: t.name || t.id, layer: t.layer, tile: t.id, cat: '삼국', icon: null,
      rule: t.type === 'pond' || t.type === 'road' ? t.type : null, source: 'samguk' });
  }
  return { brushes, blocking };
}

/** POST a map to the repo (content/samguk/maps/<name>.map.json); returns the repo path or null */
export async function saveMapToRepo(doc) {
  try {
    const r = await fetch(`/api/maps/${encodeURIComponent(doc.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });
    return r.ok ? (await r.json()).path : null;
  } catch { return null; }
}
