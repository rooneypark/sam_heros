// UIWorldMainView children bound to game state every frame:
// UIResource (UpdateResource/SetUI), UITopTab (ResetLevel/ResetPower/UpdateCurrency), UIMainQuest (ResetData), UIBottomTab.
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { resourceItemSprite } from '../world/Resources.js';
import { openHeroManagement, openBonfire } from '../Heroes.js';
import { openTraining } from '../Training.js';
import { openInventory } from '../Inventory.js';
import { openOption } from '../Option.js';
import { openWorldMap } from '../WorldMap.js';
import { openInstantQuest } from '../InstantQuest.js';

const RES_MAX = () => Tables.define('SAVE_ADD_RESOURCE_MAX') + (G.Contribution?.stat('STORAGE') || 0);   // ResourceSaveData.GetMaxValue (define + STORAGE stat)
const imgOf = k => { const u = Tables.unit(k); return u ? `${u.prefab}_Idle_1` : null; };   // TableUnitData.image
const iconOf = k => { const u = Tables.unit(k); return u ? `${u.prefab}_Icon` : null; };    // TableUnitData.icon

export class HUD {
  constructor() { this.loaded = new Set(); this.init = false; }
  /** sprites that are assigned at runtime must be preloaded once */
  _sprite(go, name) {
    if (!go || !name) return;
    if (!this.loaded.has(name)) { this.loaded.add(name); G.assets.preloadSprites([name]); }
    go.uiSprite = name;
  }
  _setup(find) {
    this.init = true;
    // UIResource.SetUI: Tree/Stone/Meat on (world type != 8); season event and package buttons off for a new user
    for (const n of ['Season', 'Package']) find(n)?.setActive(false);
    for (const n of ['UISpeedUp', 'UIGlobalSkill']) find(n)?.setActive(false);
    const mq = find('UIMainQuest');
    // Btn_QuestClear's Animator fades Inner in (CanvasGroup 0 -> 1)
    const inner = mq?.find('Btn_QuestClear/Inner');
    const cg = inner?.scripts.find(s => s.script === 'CanvasGroup'); if (cg) cg.f.m_Alpha = 1;
    mq?.transform.children.find(c => c.go.name === 'Text (TMP)')?.go.setActive(false);   // RemainTimeText (event quests)
  }
  bind(find) {
    if (!this.init) this._setup(find);
    // UIWorldMainView.SetCanvas @0x25a16a4: prologue hides WorldObj / UITopTab / UIBottomTab and shows PrologueSkip
    const pro = !!G.User.isPrologue;
    find('PrologueSkip')?.setActive(pro);
    for (const n of ['World', 'UITopTab', 'UIBottomTab']) find(n)?.setActive(!pro);
    // full-screen popups cover the main view: only UITopTab (currencies) stays above them
    G.UI.hud?.find('Hide/Inner')?.setActive(!G.UI.hasWindow());
    find('UIMainQuest')?.setActive(!!G.Quest?.current);
    // UIResource.UpdateResource
    for (const [node, type] of [['Meat', 'MEAT'], ['Tree', 'TREE'], ['Ore', 'STONE']]) {
      const g = find(node); if (!g) continue;
      const v = G.Inventory.count(type);
      const t = g.find('Text (TMP)'); if (t) t.uiText = String(v);
      const f = g.find('Penal/Fill'); if (f) f.uiFill = Math.min(v / RES_MAX(), 1);
    }
    // UITopTab
    const top = find('UITopTab');
    if (top) {
      top.find('InnerFrame/UI_Coin/Penal/Text_Number').uiText = String(G.Inventory.count('GOLD'));
      top.find('InnerFrame/UI_Dia/Penal/Text_Number').uiText = String(G.Inventory.count('DIA'));
      top.find('InnerFrame/UI_CombatPower/UI_Shield/Text_Number').uiText = String(G.UserData.Level + 1);   // GetLevel() + 1
      // UnitManager.GetPower: sum of DAMAGE * 4 + HP
      let power = 0;
      for (const h of G.UnitManager.HeroUnits) power += h.UnitData.GetStat(1) * 4 + h.UnitData.GetStat(0);
      top.find('InnerFrame/UI_CombatPower/Text_Number').uiText = String(Math.round(power));
      const need = G.UserData.NeedExp(), rate = need ? Math.min(G.UserData.Exp / need, 1) : 0;
      top.find('InnerFrame/Penal/Fill').uiFill = rate;
      top.find('InnerFrame/Penal/Fill (1)').uiFill = rate;
      top.find('InnerFrame/Penal/Text (TMP)').uiText = `EXP ${Math.floor(rate * 100)}%`;
      const lead = G.UnitManager.LeaderHero;
      if (lead) this._sprite(top.find('InnerFrame/UIUserInfo/Image/Image/HeroImg'), iconOf(lead.Key));
    }
    // UIBottomTab.CountText: "{0} / {1}" = HeroManager.GetHeroCount / UserHero.GetHeroMaxCount
    const bt = find('UIBottomTab');
    if (bt) {
      if (!this.countText) this.countText = bt.find('InnerFrame/Left/UIPortrait/Frame/BackGround/Icon/Text (TMP)');
      if (this.countText) this.countText.uiText = `${G.HeroManager.GetHeroCount()} / ${G.User.heroMax}`;
    }
    this._bindRightTab(find);
    this._bindQuest(find);
  }
  /** UIRightTab.OnRenewal @0x2119e6c (world type 1: no 8/9 special cases) */
  _bindRightTab(find) {
    const rt = find('UIRightTab'); if (!rt) return;
    const L = rt.find('InnerFrame/Panel/Layout'); if (!L) return;
    const built = k => G.Buildings?.built.has(k);
    L.find('Icon_Map')?.setActive(!!built('WorldBuilding099123'));
    L.find('Icon_Quest')?.setActive(G.UserData.Level >= Tables.define('UNLOCK_QUEST_LV'));
    // QuestNoteObj: a finished, unclaimed mission or an openable reward box
    if (G.InstantQuest) {
      G.InstantQuest.check();
      const note = G.InstantQuest.sets.some((s, i) => s.quests.some(q => !q.complete && q.value >= (Tables.get('TableInstantQuest', q.key)?.questValue ?? 1e9))
        || (G.InstantQuest.rewards(i)[s.reward]?.score ?? 1e9) <= s.score);
      L.find('Icon_Quest/UIRedDot')?.setActive(note);
    }
    L.find('Icon_Challenge')?.setActive(false);   // User.tBtn / dBtn / gBtn / ddBtn
    L.find('Icon_Mail')?.setActive(false);
    L.find('Icon_Training')?.setActive(!!built('WorldBuilding010000'));   // SetTrainingObj: UserBuilding.IsBuild
    L.find('Icon_EQIP')?.setActive(false);        // SetEquipBtn: User.eBtn
    // TrainingNoteUpdater: the "!" bubble while a training level can be bought (default note only)
    L.find('Icon_Training/NoteUpdater/Note')?.setActive(G.Training?.canUpgrade() === 'ok');
  }
  /** UIMainQuest.ResetData @0x278ba4c */
  _bindQuest(find) {
    const q = G.Quest, d = q?.data;
    const mq = find('UIMainQuest'); if (!mq || !d) return;
    const done = q.IsComplete();
    const btn = mq.find('Btn_Quest'), clr = mq.find('Btn_QuestClear');
    btn.setActive(!done); clr.setActive(done);
    if (done) {
      this._sprite(clr.find('Inner/Image/RewardImage'), resourceItemSprite(d.rewardType));
      clr.find('Inner/Image/Text_Number').uiText = String(d.rewardValue);
      return;
    }
    const img = btn.find('Inner/Image/QuestImage'), desc = btn.find('Inner/Right/Desc');
    btn.find('Inner/Right/Bar/Text_Number').uiText = `${q.current.value}/${d.questValue}`;
    btn.find('Inner/Right/Bar/Penal/Fill').uiFill = q.GetRate();
    const L = (k, ...a) => a.reduce((s, v, i) => s.replace(`{${i}}`, v), Tables.loc(k));
    img.transform.ls = [1, 1, 1];
    if (d.questType === 'MONSTER') {
      this._sprite(img, imgOf(d.questKey)); img.transform.ls = [2, 2, 1];
      desc.uiText = L('LocalizeQuestDesc000001', Tables.loc(Tables.unit(d.questKey)?.name), d.questValue);
    } else if (d.questType === 'RESOURCE') {
      this._sprite(img, resourceItemSprite(d.questKey));
      const it = Object.values(Tables.t.TableItem).find(r => r.itemType === 'RESOURCE' && r.itemDetailKey === d.questKey);
      desc.uiText = L('LocalizeQuestDesc000002', Tables.loc(it?.name), d.questValue);
    } else if (d.questType === 'BUILD') {
      const wb = Tables.get('TableWorldBuilding', d.questKey);
      const cat = wb ? wb.category % 100 : -1;
      if (d.key === 'Quest000006') {
        this._sprite(img, 'Monster_14_Idle_1'); img.transform.ls = [2, 2, 1];
        desc.uiText = Tables.loc('LocalizeBuildingName000000');
      } else if (wb && (cat === 3 || cat === 0x61) && wb.heroKey) {
        this._sprite(img, cat === 3 ? imgOf(wb.heroKey) : iconOf(wb.heroKey)); if (cat === 3) img.transform.ls = [2, 2, 1];
        desc.uiText = L('LocalizeQuestDesc000005', Tables.loc(Tables.unit(wb.heroKey)?.name || ''));
      } else {
        const tb = Object.values(Tables.t.TableBuilding).find(r => r.category === wb?.category) || Object.values(Tables.t.TableBuilding).find(r => r.category === cat);
        this._sprite(img, tb?.icon);
        desc.uiText = L('LocalizeQuestDesc000000', Tables.loc(tb?.name));
      }
    } else {
      desc.uiText = Tables.loc(d.hintStr);
    }
  }
  /** returns true when a HUD button consumed the tap */
  click(go) {
    const name = go?.name;
    if (name === 'Btn_QuestClear') { G.Quest.CompleteQuest(); return true; }
    if (name === 'Btn_Quest') { this.hint(); return true; }
    if (name === 'UIPortrait') { openHeroManagement(); return true; }
    // UIBottomTab.OnClickBonfire: OpenBonfirePopup (party formation)
    if (go?.transform.parent?.go.transform.parent?.go.name === 'UIBonfire') { openBonfire(); return true; }
    if (name === 'Icon_Bag') { openInventory(); return true; }
    if (name === 'Icon_Option') { openOption(); return true; }
    if (name === 'Icon_Map') { openWorldMap(); return true; }
    if (name === 'Icon_Quest') { openInstantQuest(); return true; }
    if (name === 'Icon_Training') { openTraining(); return true; }
    if (go?.transform.parent?.go.name === 'PrologueSkip' && G.User.isPrologue && !G.Flow.defeat) { G.Flow.defeat = true; G.Flow.corDefeat(); return true; }
    return false;
  }
  /** UIMainQuest.OnClickHint -> HintMove: camera moves to hintPos and back */
  async hint() {
    const d = G.Quest?.data;
    if (!d || !d.isHintUI || this.hinting) return;
    this.hinting = true;
    G.HeroManager.Control = false;
    await G.CameraManager.CameraMoveZoom([d.hintPosX, d.hintPosY], 13, 0.75);
    await new Promise(r => Timing.RunCoroutine((function* () { yield 1; r(); })(), null));
    const c = G.HeroManager.heroCenterPos;
    await G.CameraManager.CameraMoveZoom([c[0], c[1]], 13, 0.75);
    G.HeroManager.Control = true;
    this.hinting = false;
  }
}
