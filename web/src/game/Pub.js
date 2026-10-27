// Pub (UIPubHero): UserShop.ResetPubHero @0x1d45014 lineup of 3 hero cards, UIPubHero.OnClickPurchase @0x3168340,
// GetRandomHero @0x31692e0 (grade weight PUB_GRADE_WEIGHT -> drawWeight), parts Random(PUB_GRADE_MIN, PUB_GRADE_MAX).
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { Timing } from './core/Timing.js';
import { Random } from '../engine/unitymath.js';
import { openNewHero } from './Heroes.js';

const GRADE = { NORMAL: 0, RARE: 1, UNIQUE: 2, LEGEND: 3 };
const def = k => Tables.defineList(k);

function weightedIndex(ws) {
  const tot = ws.reduce((a, b) => a + b, 0);
  let r = Random.range(0, tot);
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; }
  return ws.length - 1;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Random.rangeInt(0, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pubHeroes() {
  return Object.values(Tables.t.TableUnit).filter(u => u.drawWeight > 0 && (u.worldBit & 1) && u.gradeType in GRADE);
}

export class PubState {
  constructor() {
    this.lineup = []; this.drawn = 0; this.pubCount = 0; this.resetAt = 0;
    this.bonusCount = 0; this.bonusStep = 0; this.confirmHero = ''; this.drawRate = 1;
  }
  /** UIPubHero.ResetPubHero b__0 @0x316b548 (즉시갱신 / 포기하기): currency 'TICKET' uses Item009013, 'GOLD' pays
   *  PUB_RESET_GOLD_COST, 'FREE' (discard) nothing. A full bonus gauge (PUB_BONUS_MAX[step]) makes this lineup carry
   *  the chosen ConfirmHero and moves to the next step; otherwise the gauge rises by one. */
  ManualReset(currency) {
    if (currency === 'TICKET') { if (G.Inventory.count('Item009013') < 1) return false; G.Inventory.use('Item009013', 1); }
    else if (currency === 'GOLD') {
      const cost = Math.round(def('PUB_RESET_GOLD_COST')[0]);
      if (G.Inventory.count('GOLD') < cost) return false;
      G.Inventory.use('GOLD', cost);
    }
    let confirm = 0;
    if (this.bonusCount >= Math.round(def('PUB_BONUS_MAX')[this.bonusStep] ?? 10)) {
      confirm = this.bonusStep === 0 ? 3 : 1;
      this.bonusCount = 0;
      this.bonusStep = (this.bonusStep + 1) % 2;
    } else this.bonusCount++;
    this.drawRate = 1;
    G.InstantQuest?.add('PUB_RESET', 1);
    this.Reset(confirm);
    return true;
  }
  /** ResetPubHero: confirm hero by TablePub(count == PubCount), the rest by GRADE_WEIGHT then drawWeight */
  Reset(confirmCount = 0) {
    const cands = pubHeroes();
    let keys = [];
    this.confirmIndex = -1;
    const conf = Object.values(Tables.t.TablePub).find(p => p.count === this.pubCount);
    if (conf) {
      // TablePub row: confirm card + two display cards, each a unit key list or a grade ("UNIQUE", "LEGEND_HAS")
      const confKey = this._confirmHero(conf.confirmUnit, keys, cands); keys.push(confKey);
      keys.push(this._confirmHero(conf.displayUnit1, keys, cands));
      keys.push(this._confirmHero(conf.displayUnit2, keys, cands));
      keys = shuffle(keys);
      this.confirmIndex = keys.indexOf(confKey);   // UserShop.ConfirmIndex: the first hire takes this card
    } else {
      const gw = def('GRADE_WEIGHT');
      while (keys.length < 3) {
        const g = weightedIndex(gw);
        const pool = cands.filter(u => GRADE[u.gradeType] === g && !keys.includes(u.key));
        if (!pool.length) continue;
        keys.push(pool[weightedIndex(pool.map(u => u.drawWeight))].key);
      }
    }
    // bonus gauge full: the chosen hero takes a random slot as the guaranteed first hire
    if (confirmCount > 0 && this.confirmHero && Tables.unit(this.confirmHero)) {
      const at = Random.rangeInt(0, 3);
      keys = keys.filter(k => k !== this.confirmHero);
      while (keys.length > 2) keys.pop();
      keys.splice(at, 0, this.confirmHero);
      this.confirmIndex = at;
    }
    const mn = def('PUB_GRADE_MIN'), mx = def('PUB_GRADE_MAX');
    this.lineup = keys.map(key => {
      const g = GRADE[Tables.unit(key).gradeType];
      // TotalGlobalStat.AddPubHeroCardCount: contribution PUB_H_CARD_<grade> parts on top (no LEGEND stat)
      const add = G.Contribution?.stat(['PUB_H_CARD_NORMAL', 'PUB_H_CARD_RARE', 'PUB_H_CARD_UNIQUE'][g]) || 0;
      return { key, count: Math.round(Random.range(mn[g], mx[g])) + add, purchase: false };
    });
    this.drawn = 0;
    this.resetAt = Timing.time + Tables.define('PUB_RESET_TIME');
  }
  /** <ResetPubHero>g__GetConfirmHero @0x1d4bd84: "GRADE_HAS" -> an owned hero of that grade,
   *  "GRADE" -> a random pub hero of that grade not already shown, else one of the listed unit keys */
  _confirmHero(spec, taken, cands) {
    const s = spec?.[0] || '';
    const pick = arr => arr[Random.rangeInt(0, arr.length)];
    if (s.includes('HAS')) {
      const g = s.replace('_HAS', '');
      const owned = [...G.UserHero.datas.keys()].filter(k => Tables.unit(k)?.gradeType === g && !taken.includes(k));
      if (owned.length) return pick(owned);
      return this._confirmHero([g], taken, cands);
    }
    if (s in GRADE) {
      const pool = cands.filter(u => u.gradeType === s && !taken.includes(u.key));
      return pool.length ? pick(pool).key : pick(cands).key;
    }
    const keys = (spec || []).filter(k => Tables.unit(k) && !taken.includes(k));
    return keys.length ? pick(keys) : pick(cands).key;
  }
  ensure() { if (!this.lineup.length || Timing.time >= this.resetAt || this.lineup.every(c => c.purchase)) this.Reset(); }
  /** UIPubHero.GetRandomHero @0x31692e0: every unbought card weighs PUB_GRADE_WEIGHT[grade]; the drawn grade is
   *  then split among its cards by drawWeight. Rates shown on the cards are those probabilities. */
  rates() {
    const left = this.lineup.filter(c => !c.purchase);
    const pw = def('PUB_GRADE_WEIGHT');
    const gOf = c => GRADE[Tables.unit(c.key).gradeType];
    const tot = left.reduce((a, c) => a + Math.round(pw[gOf(c)]), 0);
    return this.lineup.map(c => {
      if (c.purchase) return 0;
      if (this.confirmIndex >= 0) return this.lineup[this.confirmIndex] === c ? 1 : 0;
      const g = gOf(c), same = left.filter(x => gOf(x) === g);
      const pg = same.length * Math.round(pw[g]) / tot;
      return pg * Tables.unit(c.key).drawWeight / same.reduce((a, x) => a + Tables.unit(x.key).drawWeight, 0);
    });
  }
  /** OnRefresh: PUB_COST[count] x DrawRate, gold for the first hire of a lineup, dia afterwards */
  cost() { return { type: this.drawn === 0 ? 'GOLD' : 'DIA', amount: Math.round(def('PUB_COST')[Math.min(this.drawn, 2)] * (this.drawRate || 1)) }; }
  /** the 1x/2x/3x rate buttons unlock after PUB_RATE_LOCK_COUNT hires */
  rateUnlocked() { return this.pubCount > Math.round(def('PUB_RATE_LOCK_COUNT')[0]); }
  /** OnClickPurchase -> CorPurchase: pay, pick a card, AddHero(key, parts) */
  Purchase() {
    const c = this.cost();
    if (G.Inventory.count(c.type) < c.amount) return null;
    const left = this.lineup.map((x, i) => [x, i]).filter(([x]) => !x.purchase);
    let idx;
    if (this.confirmIndex >= 0 && !this.lineup[this.confirmIndex].purchase) { idx = this.confirmIndex; this.confirmIndex = -1; }
    else {
      // grade first (one PUB_GRADE_WEIGHT entry per card), then drawWeight among that grade's cards
      const pw = def('PUB_GRADE_WEIGHT');
      const gOf = i => GRADE[Tables.unit(this.lineup[i].key).gradeType];
      const g = gOf(left[weightedIndex(left.map(([, i]) => Math.round(pw[gOf(i)])))][1]);
      const same = left.filter(([, i]) => gOf(i) === g);
      idx = same.length === 1 ? same[0][1] : same[weightedIndex(same.map(([x]) => Tables.unit(x.key).drawWeight))][1];
    }
    G.Inventory.use(c.type, c.amount);
    const card = this.lineup[idx];
    card.purchase = true;
    this.drawn++; this.pubCount++;
    const isNew = this.lastNew = G.UserHero.AddHero(card.key, card.count * (this.drawRate || 1));   // GetTotalPubHeroCardCont
    if (isNew && G.UnitManager.HeroUnits.length < G.User.heroMax)
      G.UnitManager.CreateHero(card.key, 0).then(u => { const p = G.HeroManager.transform.position; u.WarpHero(p[0], p[1]); });
    G.Quest?.AddQuest('PUB', '', 1);
    G.InstantQuest?.add('PUB', 1);
    return idx;
  }
}

/** UIHeroSelectPopupView (type 3): the pub's LEGEND heroes in a grid (owned first), the current one checked;
 *  확인 applies the selection. RecImage marks heroes not owned yet. */
async function openHeroSelect(current, onSelect) {
  const p = await G.UI.openPopup('prefab/ui/popup/uiheroselectpopup', () => {});
  p.kind = 'heroselect';
  const content = p.root.find('SafeArea/InnerFrame/MidFrame/Scroll View/Viewport/Content');
  p.root.find('SafeArea/InnerFrame/MidFrame/Scroll View/Viewport/UIScrollArrow')?.setActive(false);
  const { instantiate, loadPrefab } = await import('../engine/prefab.js');
  const cellJson = await loadPrefab('prefab/ui/element/uiheroreccell');
  const owned = k => !!G.UserHero.GetHero(k);
  const heroes = pubHeroes().filter(u => u.gradeType === 'LEGEND').sort((a, b) => (owned(b.key) - owned(a.key)) || a.key.localeCompare(b.key));
  await G.assets.preloadSprites(heroes.map(u => `${u.prefab}_Icon`));
  let sel = current;
  const cells = heroes.map(u => {
    const go = instantiate(cellJson, G.assets);
    go.transform.setParent(content.transform);
    go.key = u.key;
    go.find('Group/Frame/HeroFame/HeroPice').uiSprite = `${u.prefab}_Icon`;
    go.find('Group/Fx_ DimensionBonusFrame')?.setActive(false);
    go.find('Group/Frame/RecImage')?.setActive(!owned(u.key));
    return go;
  });
  const refresh = () => { for (const c of cells) c.find('Group/Frame/HeroFame/Check')?.setActive(c.key === sel); };
  refresh();
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    if (hit.name === 'Ok') { if (sel) onSelect(sel); G.UI.close(p); return; }
    let g = hit; while (g && !g.key) g = g.transform.parent?.go;
    if (g) { sel = g.key; refresh(); }
  };
}

/** UIPubPopup, hero tab */
export async function openPub() {
  G.Pub.ensure();
  const p = await G.UI.openPopup('prefab/ui/popup/uipubpopup', () => {});
  p.kind = 'pub';
  const R = p.root;
  const frame = R.find('SafeArea/InnerFrame/UIHeroFrame');
  for (const n of ['UICharmFrame', 'UIAbyssFrame']) R.find('SafeArea/InnerFrame/' + n)?.setActive(false);
  const bottom = R.find('SafeArea/InnerFrame/BottomFrame');
  bottom.find('UIHeroBtn').setActive(true);
  bottom.find('UICharmBtn')?.setActive(false); bottom.find('UIAbyssBtn')?.setActive(false);
  bottom.find('BottomFrame/TrasitionBtn')?.setActive(false);
  const hb = bottom.find('UIHeroBtn');
  for (const n of ['PushFrame', 'RefreshBtnFrame/PushToggle', 'RefreshBtnFrame/Text (TMP)', 'btnRate']) hb.find(n)?.setActive(false);
  const bonus = frame.find('MidFrame/BonusFrame');
  // shop packages are paid content; the mileage shop shows with the rate buttons (MileShopObj = RateFrame)
  for (const g of R.walk()) if (g.name === 'Product') g.setActive(false);
  const mileShops = [...frame.walk()].filter(g => g.name === 'MileShop');
  const cells = frame.find('MidFrame/CharacterFrame/Frame').transform.children.map(c => c.go);
  const sprites = new Set();
  for (const c of G.Pub.lineup) sprites.add(`${Tables.unit(c.key).prefab}_Img`);
  await G.assets.preloadSprites(sprites);
  const refresh = () => {
    const rates = G.Pub.rates();
    G.Pub.lineup.forEach((c, i) => {
      const cell = cells[i]; if (!cell) return;
      const u = Tables.unit(c.key);
      cell.find('Character/Image').uiSprite = `${u.prefab}_Img`;
      cell.find('Text (TMP)').uiText = `<size=55%>x</size>${c.count}`;
      cell.find('txtAddCount')?.setActive(false);
      cell.find('RateFrame/RateText').uiText = `${(rates[i] * 100).toFixed(2)}%`;
      cell.find('RateFrame').setActive(!c.purchase);
      cell.find('Check').setActive(c.purchase); cell.find('Check/Image')?.setActive(c.purchase);
      cell.find('MileFrame')?.setActive(false);
      cell.find('New/New')?.setActive(!G.UserHero.GetHero(c.key));
      cell.find('Level')?.setActive(false); cell.find('Obj')?.setActive(false);
    });
    const cost = G.Pub.cost();
    const btn = hb.find('UI_Button');
    btn.find('Image (1)/CostIcon').uiSprite = cost.type === 'GOLD' ? 'ui_104' : 'ui_035';
    btn.find('Image (1)/SaleFrame')?.setActive(false);
    const ct = btn.find('Image (1)/CostText'); ct.setActive(true); ct.uiText = String(cost.amount);
    ct.uiTextColor = G.Inventory.count(cost.type) >= cost.amount ? null : [1, 0.35, 0.35, 1];
    const left = Math.max(0, G.Pub.resetAt - Timing.time);
    hb.find('RefreshBtnFrame/TimeText').uiText = `${Math.floor(left / 60)}분 ${Math.floor(left % 60)}초`;
    // OnRefresh: FirstObj (rates + 즉시갱신) before the first hire of a lineup, AddObj (포기하기) after it
    const first = G.Pub.drawn === 0;
    hb.find('FirstFrame').setActive(first);
    hb.find('AddFrame').setActive(!first);
    btn.find('Text_Acheive').uiText = Tables.loc(first ? 'LocalizeUIPub000003' : 'LocalizeUIPub000006');
    const rf = hb.find('FirstFrame/RateFrame');
    rf.setActive(G.Pub.rateUnlocked());
    for (const m of mileShops) m.setActive(G.Pub.rateUnlocked());
    for (const r of [1, 2, 3]) { const b = rf.find(`${r}x`); if (b) b.uiSprite = G.Pub.drawRate === r ? 'ui_080' : 'ui_085'; }
    // 즉시갱신: a reset ticket if owned, else PUB_RESET_GOLD_COST gold
    const tickets = G.Inventory.count('Item009013');
    const rb = hb.find('FirstFrame/UI_Button (1)/Image (1)');
    rb.find('CostIcon').uiSprite = tickets > 0 ? 'ui_365' : 'ui_104';
    rb.find('CostText').uiText = tickets > 0 ? `${tickets}` : String(Math.round(def('PUB_RESET_GOLD_COST')[0]));
    // ResetBonus @0x3169be0: "{count} / {max}", fill scaled by count/max, chosen hero icon or the red dot
    if (bonus) {
      const max = Math.round(def('PUB_BONUS_MAX')[G.Pub.bonusStep] ?? 10);
      const bi = bonus.find('BonusImg');
      bi.find('BonusIcon/BonusCountText').uiText = `${G.Pub.bonusCount} / ${max}`;
      const fill = bi.find('BonusFill'); fill.transform.ls = [Math.min(G.Pub.bonusCount / max, 1), 1, 1];
      bi.find('Bonus_1').setActive(G.Pub.bonusStep === 0);
      bi.find('Bonus_2').setActive(G.Pub.bonusStep === 1);
      if (G.Pub.confirmHero) { const ic = bi.find('Bonus_2/BonusIcon (1)'); if (ic) ic.uiSprite = `${Tables.unit(G.Pub.confirmHero).prefab}_Icon`; }
    }
  };
  // OnClickBonusIcon @0x3168740 -> UIHeroSelectPopup(HeroSelectData(current ConfirmHero, LEGEND, type 3))
  const nextConfirmHero = () => openHeroSelect(G.Pub.confirmHero, key => { G.Pub.confirmHero = key; refresh(); });
  const relineup = () => p.closeCurtain().then(async () => {
    await G.assets.preloadSprites(G.Pub.lineup.map(c => `${Tables.unit(c.key).prefab}_Img`));
    refresh(); p.openCurtain();
  });
  // CorCurtain @0x1fd9308: the two curtain halves slide 0.75 x screen width over 0.7 s
  // (opening: Linear + SFX_0009, closing: InOutCubic + SFX_0008); cards are locked meanwhile
  const curtain = frame.find('Curtain');
  const W = 1080;
  const halves = [[curtain.find('Left'), -1], [curtain.find('Right'), 1]];
  const slide = (from, to, ease, sfx) => new Promise(res => {
    curtain.setActive(true); p.curtainBusy = true;
    G.Sound.play(sfx);
    Timing.RunCoroutine((function* () {
      for (let t = 0; ; t += Timing.deltaTime) {
        const k = ease(Math.min(t / 0.7, 1));
        for (const [h, s] of halves) h.transform.rect = { ...h.transform.rect, aPos: [s * W * 0.75 * (from + (to - from) * k), 30] };
        if (t >= 0.7) break;
        yield -Infinity;
      }
      if (to === 1) curtain.setActive(false);
      p.curtainBusy = false; res();
    })(), null);
  });
  const linear = t => t, inOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  p.openCurtain = () => slide(0, 1, linear, 'SFX_0009');
  p.closeCurtain = () => slide(1, 0, inOutCubic, 'SFX_0008');
  refresh();
  p.openCurtain();
  p.timer = Timing.RunCoroutine((function* () { while (G.UI.popups.includes(p)) { refresh(); yield 1; } })(), null);
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back') { G.UI.close(p); return; }
    if (p.curtainBusy) return;
    const parent = hit.transform.parent?.go.name;
    if (hit.name === 'UI_Button (1)' && parent === 'FirstFrame') {          // OnClickReset
      const cur = G.Inventory.count('Item009013') > 0 ? 'TICKET' : 'GOLD';
      if (!G.Pub.ManualReset(cur)) { G.UI.toast(Tables.loc('LocalizeItemName000033') + ' 부족'); return; }
      relineup(); return;
    }
    if (hit.name === 'UI_Button (1)' && parent === 'AddFrame') { G.Pub.ManualReset('FREE'); relineup(); return; }   // OnClickDiscard
    if (/^[123]x$/.test(hit.name) && G.Pub.drawn === 0) { G.Pub.drawRate = Number(hit.name[0]); refresh(); return; }   // OnClickRate
    if (hit.name === 'Bonus_2' || hit.name === 'BonusIcon') { nextConfirmHero(); refresh(); return; }
    if (hit.name === 'UI_Button' && hit.transform.parent?.go.name === 'UIHeroBtn' && !p.curtainBusy) {
      const idx = G.Pub.Purchase();
      if (idx === null) { const c = G.Pub.cost(); G.UI.toast(Tables.loc(c.type === 'GOLD' ? 'LocalizeItemName000033' : 'LocalizeItemName000035') + ' 부족'); return; }
      G.Sound.play('SOUND_ETC_0003');
      const u = Tables.unit(G.Pub.lineup[idx].key);
      // CorPurchase: a hero not owned before opens UINewHeroPopup, otherwise the parts toast
      if (G.Pub.lastNew) openNewHero(G.Pub.lineup[idx].key);
      else G.UI.toast(`${Tables.loc(u.name)} x${G.Pub.lineup[idx].count}`);
      refresh();
      if (G.Pub.lineup.every(c => c.purchase)) {
        // all three hired: close the curtain, draw a new lineup, open again
        G.Pub.Reset(); relineup();
      }
    }
  };
  return p;
}
