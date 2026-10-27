// Training school (UITrainingPopupView / UIUpgradeCell): TableGlobalUpgrade category 0 levels, each pays
// needResource x needValue and adds TableUpgradeStat (ADDITION) to every hero; limitLv gates by the user level.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { instantiate, loadPrefab } from '../engine/prefab.js';
import { UNIT_STAT } from './data/UnitData.js';

export class TrainingState {
  constructor() { this.level = 0; this.buildingLv = 0; }
  rows() { return Object.values(Tables.t.TableGlobalUpgrade).filter(r => r.category === 0).sort((a, b) => a.level - b.level); }
  row(lv) { return this.rows().find(r => r.level === lv) || null; }
  stat(r) { return Tables.get('TableUpgradeStat', r.upgradeKey); }
  /** sum of the learned ADDITION stats by stat name */
  bonus() {
    const out = {};
    for (const r of this.rows()) {
      if (r.level >= this.level) break;
      const s = this.stat(r);
      if (s && s.upgradeType === 'ADDITION') out[s.addStat] = (out[s.addStat] || 0) + s.addValue;
    }
    return out;
  }
  canUpgrade() {
    const r = this.row(this.level);
    if (!r) return 'max';
    // Logic_Training.IsPossibleUpgrade @0x20a0510: the row's limitLv must be <= UserDataManager.GetLevel()
    if (r.limitLv > (G.UserData?.Level ?? 0)) return 'limit';
    if (!r.needResource.every((k, i) => G.Inventory.count(k) >= r.needValue[i])) return 'res';
    return 'ok';
  }
  Upgrade() {
    if (this.canUpgrade() !== 'ok') return false;
    const r = this.row(this.level);
    r.needResource.forEach((k, i) => G.Inventory.use(k, r.needValue[i]));
    this.level++;   // User.Levelup: TrainingLevel += 1 (normal levels are TrainingLevel % 10000)
    for (const u of G.UnitManager.HeroUnits) { const rate = u.GetHPRate?.() ?? 1; u.SetLvStat(); u.UnitData.CurrentHP = u.UnitData.GetStat(0) * rate; }
    G.Quest?.AddQuest('ETC', 'TRAINING', 1);
    G.InstantQuest?.add('TRAINING_LV', 1);
    G.Sound.play('SOUND_ETC_0001');
    return true;
  }
}

/** applied in UnitActor.SetLvStat for heroes */
export function applyTraining(u) {
  if (!G.Training) return;
  const b = G.Training.bonus();
  for (const [k, v] of Object.entries(b)) if (UNIT_STAT[k] !== undefined) u.UnitData.AddStat(UNIT_STAT[k], v);
}

export async function openTraining() {
  const p = await G.UI.openPopup('prefab/ui/popup/uitrainingpopup', () => {});
  p.kind = 'training';
  const R = p.root;
  const f = path => R.find(path);
  f('SafeArea/InnerFrame/HeroTrainingPage')?.setActive(false);
  f('SafeArea/InnerFrame/TabFrame')?.setActive(false);
  f('SafeArea/InnerFrame/BtnAllUpgrade')?.setActive(false);
  f('SafeArea/BtnDPS (1)')?.setActive(false);
  f('SafeArea/InnerFrame/MainPage/ResourceFrame/RedStone')?.setActive(false);
  f('Block')?.setActive(false);
  const scroller = f('SafeArea/InnerFrame/MainPage/MidFrame/Panel/Scroller');
  // EnhancedScroller rows as a vertical layout (visible window around the current level)
  scroller.scripts.push({ script: 'UnityEngine.UI.VerticalLayoutGroup', f: { m_Padding: { left: 0, right: 0, top: 20, bottom: 0 }, m_ChildAlignment: 'UpperCenter', m_Spacing: 0, m_ChildForceExpandWidth: true, m_ChildForceExpandHeight: false, m_ChildControlWidth: true, m_ChildControlHeight: false } });
  const cellJson = await loadPrefab('prefab/ui/element/uiupgradecell');
  const rows = [];
  const build = () => {
    for (const r of rows) r.go.destroyed = true;
    scroller.transform.children.length = 0; rows.length = 0;
    const start = Math.max(0, G.Training.level - 2);
    for (let lv = start; lv < start + 7; lv++) {
      const r = G.Training.row(lv); if (!r) break;
      const go = instantiate(cellJson, G.assets);
      go.transform.setParent(scroller.transform);
      rows.push({ go, r });
    }
  };
  const refresh = () => {
    const stoneMax = Tables.define('SAVE_ADD_RESOURCE_MAX') + (G.Contribution?.stat('STORAGE') || 0);
    const ore = f('SafeArea/InnerFrame/MainPage/ResourceFrame/Ore');
    ore.find('Text (TMP)').uiText = String(G.Inventory.count('STONE'));
    ore.find('Penal/Fill').uiFill = Math.min(G.Inventory.count('STONE') / stoneMax, 1);
    for (const { go, r } of rows) {
      const s = G.Training.stat(r);
      const big = !!r.isLimit;
      go.find('TrainingUpgradeElement').setActive(!big);
      go.find('TrainingUpgradeElementBig').setActive(big);
      const el = go.find(big ? 'TrainingUpgradeElementBig' : 'TrainingUpgradeElement');
      el.find('Inner/Panel/Icon').uiSprite = s?.icon;
      const t = el.find('Inner/Panel/Bottom/Text (TMP)'); if (t) t.uiText = `+${s?.addValue}`;
      el.find('Inner/Panel/Bottom')?.setActive(true);
      const learned = r.level < G.Training.level, next = r.level === G.Training.level;
      el.find('Inner/Panel/Disable').setActive(!learned && !next);
      el.find('Gauge/Fill').uiFill = learned ? 1 : 0;
      el.find('UIRedDot')?.setActive(next && G.Training.canUpgrade() === 'ok');
      el.find('UIRedDot (1)')?.setActive(next && G.Training.canUpgrade() === 'ok');
      go.find('UILineCell/Lv/Icon/Text').uiText = String(r.level + 1);
      go.find('Image')?.setActive(false);
      go.r = r;
    }
  };
  build(); refresh();
  await G.assets.preloadSprites(new Set(rows.map(x => G.Training.stat(x.r)?.icon).filter(Boolean)));
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    let g = hit; while (g && !g.r) g = g.transform.parent?.go;
    if (g && g.r.level === G.Training.level) {
      const res = G.Training.canUpgrade();
      if (res === 'ok') { G.Training.Upgrade(); build(); refresh(); }
      else if (res === 'res') G.UI.toast(Tables.loc('LocalizeItemName000031') + ' 부족');
      else if (res === 'limit') G.UI.toast(Tables.loc('LocalizeUIToast000017'));
    }
  };
  return p;
}
