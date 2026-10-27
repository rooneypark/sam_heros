// UIWorldMapPopupView (region mode): TableWorld map image stretched to the screen height
// (BetterAspectRatioFitter HeightControlsWidth), pivot = GetPivotByPos(camera) so the player sits in the centre,
// UIMapIcon per portal (category 9: built -> B_PORTAL_ON + teleport, else B_PORTAL_OFF) and the current quest target.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { instantiate, loadPrefab } from '../engine/prefab.js';

// ConstValue.MAP_SIZE for the main world (worlds 900..904 use other sizes)
const MAP_SIZE = [563.7, 341.6];
/** GetPivotByPos @0x3c97868 */
const pivotOf = (x, y) => [x / MAP_SIZE[0], (y + MAP_SIZE[1] * 0.5) / MAP_SIZE[1]];
// ResourceManager.GetSprite(MAP_ICON_TYPE) @0x236d2b4
const ICON = { HERO: 'Map_User', B_PORTAL_ON: 'Map_Portal_Active', B_PORTAL_OFF: 'Map_Portal_Inactive', I_PORTAL: 'ui_158', QUEST: 'Map_Target', FOG: 'Map_FogCrystal', BOSS: 'Map_Boss_big', M_BOSS: 'Map_Boss_small' };

export async function openWorldMap() {
  const p = await G.UI.openPopup('prefab/ui/popup/uiworldmappopup', () => {});
  p.kind = 'worldmap';
  const f = path => p.root.find(path);
  G.UI.releaseJoystick?.();
  // OnEnter (world type 1): region frame, mode buttons with the world lock until the ship (093000) is built
  f('RegionFrame').setActive(true);
  f('WorldFrame').setActive(false);
  f('AbyssFrame').setActive(false);
  const IF = 'SafeArea/InnerFrame/';
  for (const n of ['StoryBtn', 'UIAbyssIcon', 'AbyssMode', 'TextTouch']) f(IF + n)?.setActive(false);
  f(IF + 'Mode')?.setActive(true);
  f(IF + 'Mode/World/Lock')?.setActive(!G.Buildings.built.has('WorldBuilding093000'));

  const map = f('RegionFrame/Map');
  const world = Object.values(Tables.t.TableWorld).find(r => r.key === 'World001');
  if (world?.mapImg) map.uiSprite = world.mapImg;
  const cam = G.CameraManager.position;
  const pv = pivotOf(cam[0], cam[1]);
  map.transform.rect = { ...map.transform.rect, pivot: pv, aPos: [0, 0] };
  // SetPosIcon: anchors at the pivot, anchoredPosition zero
  const place = (go, pos) => { go.transform.rect = { ...go.transform.rect, aMin: pos, aMax: pos, aPos: [0, 0] }; };
  place(map.find('MapUser'), pv);

  const iconJson = await loadPrefab('prefab/ui/uimapicon');
  const icons = [];
  const addIcon = (type, wpos, onClick) => {
    const go = instantiate(iconJson, G.assets);
    go.transform.setParent(map.transform);
    go.find('Icon').uiSprite = ICON[type];
    if (type === 'I_PORTAL') go.find('Icon').transform.rect = { ...go.find('Icon').transform.rect, size: [100, 100] };
    place(go, pivotOf(wpos[0], wpos[1]));
    go.onClick = onClick;
    icons.push(go);
  };
  for (const b of G.Buildings.list) {
    if (b.data.category !== 9 || !G.Buildings.visible(b)) continue;
    if (b.done) addIcon('B_PORTAL_ON', b.pos, () => teleport(p, b));
    else addIcon('B_PORTAL_OFF', b.pos, null);
  }
  for (const c of G.Buildings.completed) if (c.data.category === 9) addIcon('B_PORTAL_ON', c.pos, () => teleport(p, c));
  // MapManager.BossMonster: the world boss (TableWorld.boss) while it is alive
  const boss = G.UnitManager.monsters.find(u => u.Key === world?.boss && !u.IsDead());
  if (boss) addIcon('BOSS', boss.transform.position, null);
  // current quest: the hint position (or the nearest resource of a RESOURCE quest)
  const q = G.Quest?.data;
  if (q && !G.Quest.IsComplete()) {
    let pos = null;
    if (q.questType === 'RESOURCE') {
      const rt = { TREE: 1, STONE: 2, GOLD: 4 }[q.questKey];
      const hm = G.HeroManager.transform.position;
      const r = G.Resources.actors().filter(a => !a.IsDead() && a.ResourceType === rt)
        .sort((a, b) => Math.hypot(a.transform.position[0] - hm[0], a.transform.position[1] - hm[1]) - Math.hypot(b.transform.position[0] - hm[0], b.transform.position[1] - hm[1]))[0];
      pos = r?.transform.position;
    } else if (q.hintPosX || q.hintPosY) pos = [q.hintPosX, q.hintPosY];
    if (pos) addIcon('QUEST', pos, null);
  }
  await G.assets.preloadSprites(new Set([world?.mapImg, ...Object.values(ICON)].filter(Boolean)));
  // UIWorldMapPopupView.Update / OnPointerMove: pinch (wheel here) zooms the map between MIN_SIZE 1 and
  // Define_WORLD_MAP_ZOOM_IN while the user marker and icons keep their size (1/size); dragging moves the pivot
  const MAX_SIZE = Tables.defineList?.('WORLD_MAP_ZOOM_IN')?.[0] || 2;
  let size = 1;
  const applyZoom = () => {
    map.transform.ls = [size, size, 1];
    for (const g of [map.find('MapUser'), ...icons]) if (g) g.transform.ls = [1 / size, 1 / size, 1];
  };
  p.onWheel = dy => { size = Math.max(1, Math.min(MAX_SIZE, size * (1 - dy * 0.001))); applyZoom(); };
  p.onDrag = (dx, dy, rects) => {
    const R = rects.get(map), P = rects.get(map.transform.parent.go);
    if (!R || !P) return;
    const ex = Math.abs(R.w) - Math.abs(P.w), ey = Math.abs(R.h) - Math.abs(P.h);
    const pv = [...map.transform.rect.pivot];
    if (ex > 1) pv[0] = Math.max(0, Math.min(1, pv[0] - dx / ex));
    if (ey > 1) pv[1] = Math.max(0, Math.min(1, pv[1] - dy / ey));
    map.transform.rect = { ...map.transform.rect, pivot: pv };
  };
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    let g = hit; while (g && !icons.includes(g)) g = g.transform.parent?.go;
    if (g?.onClick && G.HeroManager.control && !G.HeroManager.IsCamp) g.onClick();
  };
  return p;
}

/** <OnEnter>b__3: OkCancel "LocalizeUITeleport000000" -> warp the party next to the portal */
async function teleport(mapPopup, b) {
  const town = Tables.get('TableTown', b.data.town);
  const ok = await G.UI.confirm?.(Tables.loc('LocalizeUITeleport000000'), Tables.loc(town?.name || '')) ?? true;
  if (!ok) return;
  G.UI.close(mapPopup);
  await G.UI.fadeTo(1, 0.3);
  const pos = [b.pos[0] + 1, b.pos[1] - 1];
  G.HeroManager.transform.position = [...pos];
  G.CameraManager.position = [...pos];
  for (const u of G.UnitManager.HeroUnits) if (!u.IsDead()) u.WarpHero(pos[0], pos[1]);
  await G.UI.fadeTo(0, 0.3);
}
