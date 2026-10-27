// Bag (UIInventoryPopupView): tabs All / Equipment / Currency / Consume (INVEN_TAB 0..3).
// ResetCell @0x2b49c1c: dismantle + item count only on the Equipment tab, craft on the others,
// EmptyObj when nothing is drawn. Count text "{0} / {1}" = equipment count / Define_INVENTORY_LIMIT_COUNT.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { instantiate, loadPrefab } from '../engine/prefab.js';

const TAB = { AllBtn: 0, EquipBtn: 1, CurrencyBtn: 2, ConsumeBtn: 3 };

/** items drawn on a tab: basic resources live in the HUD and never show in the bag */
function drawItems(tab) {
  const out = [];
  for (const [key, n] of G.Inventory.items) {
    if (!(n > 0)) continue;
    const it = Tables.get('TableItem', key);
    if (!it || it.itemType === 'RESOURCE' || it.bBagShow === false) continue;
    const equip = it.itemType === 'ITEM_EX';
    if (tab === 1 && !equip) continue;
    if (tab === 2 || (tab === 3 && equip)) continue;
    out.push({ key, n, it });
  }
  return out;
}

export async function openInventory() {
  const p = await G.UI.openPopup('prefab/ui/popup/uiinventorypopup', () => {});
  p.kind = 'inventory';
  const f = path => p.root.find(path);
  const bag = 'SafeArea/InnerFrame/MidFrame/Bag';
  let tab = 0;
  // EnhancedScroller rows (UIInventoryRow: 5 UIInventoryCell per row, padding 8/8/17/8, spacing 2.22, cell height 175)
  const view = f(`${bag}/MidPanel/Panel/Enhanced Scroll View`);
  view.scripts.push({ script: 'UnityEngine.UI.VerticalLayoutGroup', f: { m_Padding: { left: 0, right: 0, top: 0, bottom: 0 }, m_ChildAlignment: 'UpperCenter', m_Spacing: 0, m_ChildForceExpandWidth: true, m_ChildForceExpandHeight: false, m_ChildControlWidth: true, m_ChildControlHeight: false } });
  const [rowJson, cellJson] = await Promise.all([loadPrefab('prefab/ui/element/uiinventoryrow'), loadPrefab('prefab/ui/element/uiinventorycell')]);
  const rows = [];
  const fill = items => {
    for (const r of rows) r.destroyed = true;
    view.transform.children.length = 0; rows.length = 0;
    for (let i = 0; i < items.length; i += 5) {
      const row = instantiate(rowJson, G.assets);
      // 5 equal columns: the row lays its cells out with forced width, empty slots keep their place (SetEmpty)
      row.scripts = [{ script: 'UnityEngine.UI.HorizontalLayoutGroup', f: { m_Padding: { left: 8, right: 8, top: 17, bottom: 8 }, m_ChildAlignment: 'UpperLeft', m_Spacing: 2.22, m_ChildForceExpandWidth: true, m_ChildForceExpandHeight: false, m_ChildControlWidth: true, m_ChildControlHeight: false } }];
      row.transform.rect = { ...row.transform.rect, size: [0, 200] };
      row.transform.setParent(view.transform);
      rows.push(row);
      for (let k = 0; k < 5; k++) {
        const d = items[i + k];
        const cell = instantiate(cellJson, G.assets);
        cell.transform.rect = { ...cell.transform.rect, aMin: [0, 1], aMax: [0, 1], size: [0, 175], pivot: [0, 1] };
        cell.transform.setParent(row.transform);
        cell.find('InnerFrame')?.setActive(!!d);
        if (!d) continue;
        // UIInventoryCell.Initialize(key, count): TitleImg = item image, CountText = count
        const icon = cell.find('InnerFrame/Penal_Frame/Items/Icon'); if (icon) icon.uiSprite = d.it.image;
        const t = cell.find('InnerFrame/Penal_Frame/Items/Text'); if (t) t.uiText = String(d.n);
        cell.item = d.key;
      }
    }
  };
  const reset = () => {
    const items = drawItems(tab);
    fill(items);
    f('SafeArea/InnerFrame/BatchDismentle')?.setActive(false);   // tab 1 && unequipped equipment > 0
    f(`${bag}/TopPanel/ItemCountFrame`)?.setActive(tab === 1);
    f('SafeArea/InnerFrame/BtnCraft')?.setActive(tab !== 1);
    f(`${bag}/MidPanel/Panel/Enhanced Scroll View`)?.setActive(items.length > 0);
    f(`${bag}/MidPanel/Panel/EmptyObj`)?.setActive(items.length === 0);
    const cnt = f(`${bag}/TopPanel/ItemCountFrame/Inner/txtCount`);
    if (cnt) cnt.uiText = `0 / ${Tables.define('INVENTORY_LIMIT_COUNT') + (G.Contribution?.stat('INVEN_COUNT') || 0)}`;
    f(`${bag}/TopPanel/ItemCountFrame/Inner/ImgNoti`)?.setActive(false);
    for (const n of ['CurrencyBtn', 'ConsumeBtn']) f(`${bag}/BottomPanel/${n}/UIRedDot`)?.setActive(false);
  };
  reset();
  await G.assets.preloadSprites(new Set(drawItems(0).map(x => x.it.image)));
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    let g = hit; while (g && TAB[g.name] === undefined) g = g.transform.parent?.go;
    if (g) { tab = TAB[g.name]; reset(); }   // OnClickType(value)
  };
  return p;
}
