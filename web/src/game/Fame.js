// 용병 사무소 (Building_Fame, category 25): fame grade from the total hero level.
// UserHero.GetTotalHeroLv @0x3875248: sum over owned heroes of min(lv + 1, Define_FAME_UNIT_MAXLEVEL).
// TableFame rows in grade order need reqLv; a row with isManual waits for the 업그레이드 button, the others
// advance by themselves. Each reached row adds its TableUpgradeStat (HP / DAMAGE x1.1 multiplications, EXP_BONUS).
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { UNIT_STAT } from './data/UnitData.js';

export class FameState {
  constructor() { this.grade = 0; }   // number of TableFame rows reached
  rows() { return Object.values(Tables.t.TableFame || {}).sort((a, b) => a.grade - b.grade); }
  unitMax() { return Math.round(Tables.define('FAME_UNIT_MAXLEVEL') || 55); }
  totalLv() {
    let s = 0;
    for (const d of G.UserHero.datas.values()) s += Math.max(0, Math.min(d.lv + 1, this.unitMax()));
    return s;
  }
  next() { return this.rows()[this.grade] || null; }
  /** auto advance through non-manual rows; returns true when the grade changed */
  update() {
    let changed = false;
    for (let r = this.next(); r && !r.isManual && this.totalLv() >= r.reqLv; r = this.next()) { this.grade++; changed = true; }
    if (changed) this.applyAll();
    return changed;
  }
  canManual() { const r = this.next(); return !!r && r.isManual && this.totalLv() >= r.reqLv; }
  manualUpgrade() {
    if (!this.canManual()) return false;
    this.grade++; this.update(); this.applyAll();
    return true;
  }
  /** summed stats of the reached rows: {HP, DAMAGE} multiplication rates, EXP_BONUS addition */
  bonus(upTo = this.grade) {
    const out = { HP: 0, DAMAGE: 0, EXP_BONUS: 0 };
    for (const r of this.rows().slice(0, upTo)) {
      for (const k of [r.upgradeStat1, r.upgradeStat2, r.upgradeStat3]) {
        const s = k && Tables.get('TableUpgradeStat', k);
        if (!s) continue;
        if (s.addStat in out) out[s.addStat] += s.addValue;
        else if (s.addUpgrade === 'EXP_BONUS') out.EXP_BONUS += s.addValue;
      }
    }
    return out;
  }
  applyAll() {
    for (const u of G.UnitManager.HeroUnits) { const rate = u.GetHPRate?.() ?? 1; u.SetLvStat(); u.UnitData.CurrentHP = u.UnitData.GetStat(0) * rate; }
    G.UserData.ExpBonus = 1 + this.bonus().EXP_BONUS;
  }
}

/** 발전등급 (UIPopFameOfficeTab / Logic_Contribution): gold bars bought into contribution exp (1 bar = 1 exp,
 *  UIPopBuyContributionView uses RESOURCE_TYPE GOLD_BAR); TableContribution rows are reached at reqExp. The row of
 *  the current level lists the active upgrade stats; reaching a row pays its lvUpReward; its dailyReward can be
 *  received once a day from level 1. Login streak payouts and the package are server / paid content. */
export class ContributionState {
  constructor() { this.exp = 0; this.rewarded = 0; this.daily = ''; }
  rows() { return Object.values(Tables.t.TableContribution || {}).sort((a, b) => a.lv - b.lv); }
  level() { return this.rows().filter(r => this.exp >= r.reqExp).length; }
  row(lv = this.level()) { return this.rows()[Math.min(lv, this.rows().length - 1)]; }
  maxLevel() { return this.level() >= this.rows().length; }
  /** active stat values by upgrade name (INVEN_COUNT, STORAGE, CAMP_TIME, PUB_H_CARD_*) */
  stat(name) {
    let v = 0;
    for (const k of this.row()?.upgradeStat || []) { const s = Tables.get('TableUpgradeStat', k); if (s && (s.addUpgrade === name || s.addStat === name)) v += s.addValue; }
    return v;
  }
  invest(bars) {
    if (bars <= 0 || G.Inventory.count('GOLD_BAR') < bars) return false;
    G.Inventory.use('GOLD_BAR', bars);
    this.exp += bars;
    // level-up rewards for every row newly reached
    for (let lv = this.rewarded + 1; lv <= this.level(); lv++) {
      const r = this.rows()[lv];
      (r?.lvUpReward || []).forEach((k, i) => G.Inventory.add(itemRes(k), r.lvUpAmount[i]));
    }
    this.rewarded = Math.max(this.rewarded, this.level());
    return true;
  }
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
  canDaily() { return this.level() >= 1 && this.daily !== this.today() && (this.row()?.dailyReward || []).length > 0; }
  receiveDaily() {
    if (!this.canDaily()) return null;
    this.daily = this.today();
    const r = this.row();
    r.dailyReward.forEach((k, i) => G.Inventory.add(itemRes(k), r.dailyAmount[i]));
    return r;
  }
  save() { return { exp: this.exp, rewarded: this.rewarded, daily: this.daily }; }
  load(d) { if (d) Object.assign(this, d); }
}
function itemRes(key) {
  const it = Tables.get('TableItem', key);
  return it?.itemType === 'RESOURCE' && it.itemDetailKey ? it.itemDetailKey : key;
}

/** applied in UnitActor.SetLvStat after the additions (training) */
export function applyFame(u) {
  if (!G.Fame || !G.Fame.grade) return;
  const b = G.Fame.bonus();
  u.UnitData.AddStat(UNIT_STAT.HP, u.UnitData.GetStat(UNIT_STAT.HP) * b.HP);
  u.UnitData.AddStat(UNIT_STAT.DAMAGE, u.UnitData.GetStat(UNIT_STAT.DAMAGE) * b.DAMAGE);
}

const pct = v => `+${Math.round(v * 100)}%`;

export async function openFame() {
  G.Fame.update();
  const p = await G.UI.openPopup('prefab/ui/popup/uipopfameupgrade', () => {});
  p.kind = 'fame';
  const f = path => p.root.find(path);
  const st = f('InnerFrame/UIStatusTab'), office = f('InnerFrame/UIOfficeTab');
  let tab = 'fame';
  const showTab = t => { tab = t; st.setActive(t === 'fame'); office.setActive(t === 'office'); refresh(); };
  // ---- office tab (발전등급)
  const C = G.Contribution;
  const O = 'InnerFrame/MiddleFrame/';
  let shown = null;   // displayLevel for the arrows (null = current)
  office.find(O + 'TopFrame/txtToday')?.setActive(false);        // daily gold bar payout: server
  office.find(O + 'TopFrame/txtContinuity')?.setActive(false);   // login streak: server
  office.find(O + 'Holder/PackageHolder')?.setActive(false);     // paid package
  office.find(O + 'Holder/Inner/UIScrollArrow')?.setActive(false);
  office.find(O + 'TopFrame/imgLevel/imgBubble')?.setActive(false);
  office.find('InnerFrame/BG')?.setActive(true);
  const refreshOffice = () => {
    const lv = C.level(), view = shown ?? lv, row = C.row(view), next = C.rows()[lv];
    const T = O + 'TopFrame/';
    office.find(T + 'imgLevel/txtLevel').uiText = String(view);
    const need = next ? next.reqExp : C.exp;
    office.find(T + 'SliderHolder/Inner/Background/txtValue').uiText = `${C.exp} / ${need}`;
    office.find(T + 'SliderHolder/Inner/Background/Fill').uiFill = need ? Math.min(C.exp / need, 1) : 1;
    office.find(T + 'SliderHolder/Plus/UIRedDot')?.setActive(G.Inventory.count('GOLD_BAR') > 0 && !C.maxLevel());
    office.find(T + 'txtExpDesc').uiText = next ? Tables.loc('LocalizeUIFame000029').replace('{0}', need - C.exp).replace('{1}', lv + 1) : '';
    office.find(T + 'imgRewardBox/RewardBoxHolder/UIRedDot')?.setActive(C.canDaily());
    office.find(T + 'imgRewardBox')?.setActive(true);
    // active stats of the shown level: "<title>  +value" per line
    const lines = (row?.upgradeStat || []).map(k => Tables.get('TableUpgradeStat', k)).filter(Boolean)
      .map(s => `${Tables.loc(s.titleStrKey)}  +${s.upgradeType === 'MULTIPLICATION' ? Math.round(s.addValue * 100) + '%' : s.addValue}`);
    office.find(O + 'Holder/Inner/stats/txtDesc').uiText = lines.join('\n');
    const daily = office.find(O + 'Holder/DailyHolder/OutBg/txtDailyDesc');
    if (daily) daily.uiText = view < 1 ? Tables.loc('LocalizeUIFame000031').replace('{0}', 1)
      : (row?.dailyReward || []).map((k, i) => `${Tables.loc(Tables.get('TableItem', k)?.name)} x${row.dailyAmount[i]}`).join(', ');
    office.find(O + 'ArrowHolder/imgLArrow')?.setActive(view > 0);
    office.find(O + 'ArrowHolder/imgRArrow')?.setActive(view < C.rows().length - 1);
  };
  const refresh = () => {
    if (tab === 'office') { refreshOffice(); return; }
    const F = G.Fame, total = F.totalLv(), r = F.next();
    const mid = 'InnerFrame/MiddleFrame/';
    st.find(mid + 'Bg/TopFrame/txtTotalLv').uiText = Tables.loc('LocalizeUIFame000001').replace('{0}', total);
    const need = r ? r.reqLv : total;
    st.find(mid + 'Bg/TopFrame/SliderHolder/Inner/Background/txtValue').uiText = `${total} / ${need}`;
    st.find(mid + 'Bg/TopFrame/SliderHolder/Inner/Background/Fill').uiFill = need ? Math.min(total / need, 1) : 1;
    st.find(mid + 'Bg/BottomFrame/txtDesc').uiText = Tables.loc('LocalizeUIFame000002');
    const cur = F.bonus(), nxt = F.bonus(F.grade + 1);
    const H = mid + 'Bg/BottomFrame/StatHolder/';
    st.find(H + 'dmgHoler/txtcurDMG').uiText = pct(cur.DAMAGE); st.find(H + 'dmgHoler/NextHolder/txtNextDMG').uiText = pct(nxt.DAMAGE);
    st.find(H + 'HPHoler/txtcurHP').uiText = pct(cur.HP); st.find(H + 'HPHoler/NextHolder/txtNextHP').uiText = pct(nxt.HP);
    st.find(H + 'ExpHoler/txtcurEXP').uiText = pct(cur.EXP_BONUS); st.find(H + 'ExpHoler/NextHolder/txtNextEXP').uiText = pct(nxt.EXP_BONUS);
    for (const n of ['dmgHoler', 'HPHoler', 'ExpHoler']) st.find(H + n + '/NextHolder')?.setActive(!!r);
    const label = [...st.walk()].find(g => g.name === 'txtGrade');
    if (label) label.uiText = `${Tables.loc('LocalizeUIFame000000')} ${F.grade}`;
    st.find('BG/imgStatue/BtnUpgrade')?.setActive(F.canManual());
    // statue stars: tier inside the current category
    const tier = F.grade % 5;
    (st.find('BG/imgStatue/starHolder')?.transform.children || []).forEach((s, i) => { s.go.uiAlpha = i < tier ? 1 : 0.3; });
  };
  showTab('fame');
  p.onClick = async hit => {
    if (!hit) return;
    const n = hit.name;
    if (n === 'BtnUpgrade') { if (G.Fame.manualUpgrade()) { G.Sound.play('SOUND_ETC_0001'); refresh(); } return; }
    if (n === 'BtnFame') { showTab('fame'); return; }
    if (n === 'BrtnVIP') { shown = null; showTab('office'); return; }
    if (n === 'BtnInfo') return;
    if (n === 'Plus') {   // OnBtnBuyContribution: put every gold bar in
      const bars = G.Inventory.count('GOLD_BAR');
      if (C.maxLevel()) { G.UI.toast(Tables.loc('LocalizeUICommon000011')); return; }
      if (bars <= 0) { G.UI.toast(`${Tables.loc(Tables.get('TableItem', 'Item002039')?.name || '') || '금괴'} 부족`); return; }
      if (await G.UI.confirm(Tables.loc('LocalizeUIFame000017'), `${Tables.loc('LocalizeUIFame000035')}\n(${bars})`)) {
        C.invest(bars); G.Sound.play('SOUND_ETC_0001'); refresh();
      }
      return;
    }
    if (n === 'RewardBoxHolder') { const r = C.receiveDaily(); if (r) { G.Sound.play('SFX_0000'); refresh(); } return; }
    if (n === 'imgLArrow') { shown = Math.max(0, (shown ?? C.level()) - 1); refresh(); return; }
    if (n === 'imgRArrow') { shown = Math.min(C.rows().length - 1, (shown ?? C.level()) + 1); refresh(); return; }
    if (n === 'UI_Back' || n === 'Bg') G.UI.close(p);
  };
  return p;
}
