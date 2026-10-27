// Daily / weekly missions (UserQuest.DailyQuest / WeekQuest + UIInstantQuestPopupView).
// ResetDaily @0x3956f00: every TableInstantQuest of category 0 (1 for the week), score and reward step 0, then
// LOGIN +1. AddInstantQuest @0x3957c18: matching quests below questValue gain `add` (clamped).
// A finished quest is claimed for its rewardValue score; TableInstantQuest_Reward boxes open at score 20..100.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { Timing } from './core/Timing.js';
import { instantiate, loadPrefab } from '../engine/prefab.js';

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
/** week starts on Monday (local time) */
const weekKey = d => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return dayKey(m); };

export class InstantQuests {
  constructor() {
    this.day = null; this.week = null;
    this.sets = [this._empty(), this._empty()];   // [daily, weekly]
  }
  _empty() { return { quests: [], score: 0, reward: 0 }; }
  _fill(cat) {
    const quests = Object.values(Tables.t.TableInstantQuest || {}).filter(r => r.category === cat)
      .sort((a, b) => a.index - b.index).map(r => ({ key: r.key, value: 0, complete: false }));
    return { quests, score: 0, reward: 0 };
  }
  /** ChangeDay / ChangeWeek */
  check() {
    const now = new Date();
    if (this.week !== weekKey(now)) { this.week = weekKey(now); this.sets[1] = this._fill(1); this.add('LOGIN', 1, 1); }
    if (this.day !== dayKey(now)) { this.day = dayKey(now); this.sets[0] = this._fill(0); this.add('LOGIN', 1, 0); }
  }
  add(type, n = 1, only = null) {
    for (const [i, s] of this.sets.entries()) {
      if (only !== null && i !== only) continue;
      for (const q of s.quests) {
        const t = Tables.get('TableInstantQuest', q.key);
        if (t?.questType === type && q.value < t.questValue) q.value = Math.min(t.questValue, q.value + n);
      }
    }
  }
  /** CompleteInstantQuest: claim a finished mission for its score */
  complete(set, key) {
    const s = this.sets[set], q = s.quests.find(x => x.key === key), t = Tables.get('TableInstantQuest', key);
    if (!q || q.complete || q.value < t.questValue) return false;
    q.complete = true;
    s.score += t.rewardValue;
    return true;
  }
  rewards(set) {
    return Object.values(Tables.t.TableInstantQuest_Reward || {}).filter(r => r.category === set).sort((a, b) => a.index - b.index);
  }
  /** RewardInstantQuest: boxes open in order once the score reaches them */
  reward(set, index) {
    const s = this.sets[set], r = this.rewards(set)[index];
    if (!r || index !== s.reward || s.score < r.score) return null;
    s.reward++;
    r.rewardKeyList.forEach((k, i) => G.Inventory.add(itemResource(k), Math.round(r.amountList[i])));
    return r;
  }
  save() { return { day: this.day, week: this.week, sets: this.sets }; }
  load(d) { if (d) Object.assign(this, d); }
}

/** RESOURCE items add to their resource (gold, dia, ...); everything else stays an item */
function itemResource(key) {
  const it = Tables.get('TableItem', key);
  return it?.itemType === 'RESOURCE' && it.itemDetailKey ? it.itemDetailKey : key;
}

export async function openInstantQuest() {
  G.InstantQuest.check();
  const p = await G.UI.openPopup('prefab/ui/popup/uiinstantquestpopup', () => {});
  p.kind = 'instantquest';
  const f = path => p.root.find(path);
  const IF = 'SafeArea/InnerFrame/';
  const panel = IF + 'MidPanel/Panel/';
  const content = f(panel + 'BottomFrame/Scroll View/Viewport/Content');
  f(panel + 'BottomFrame/Scroll View/UIScrollArrow')?.setActive(false);
  const cellJson = await loadPrefab('prefab/ui/element/uiinstantquestcell');
  let set = 0;
  const cells = [];
  const sprites = new Set();
  const build = () => {
    for (const c of cells) c.destroyed = true;
    content.transform.children.length = 0; cells.length = 0;
    const s = G.InstantQuest.sets[set];
    const order = q => { const t = Tables.get('TableInstantQuest', q.key); return q.complete ? 2 : q.value >= t.questValue ? 0 : 1; };
    for (const q of [...s.quests].sort((a, b) => order(a) - order(b))) {
      const t = Tables.get('TableInstantQuest', q.key);
      const go = instantiate(cellJson, G.assets);
      go.transform.setParent(content.transform);
      go.q = q;
      go.find('TitleText').uiText = Tables.loc(t.desc).replace('{0}', String(t.questValue));
      go.find('Reward/Text (TMP)').uiText = String(t.rewardValue);
      go.find('CountText').uiText = `${q.value}/${t.questValue}`;
      go.find('Fill/FillImg').uiFill = Math.min(q.value / t.questValue, 1);
      const done = q.value >= t.questValue, ad = t.questType === 'AD';
      go.find('Complete').setActive(q.complete);
      go.find('RewardBtn').setActive(done && !q.complete);
      go.find('HintBtn').setActive(!done && !q.complete);
      go.find('HintBtn/imgAD')?.setActive(ad);
      go.find('imgAdBg')?.setActive(ad);
      cells.push(go);
    }
    // TopFrame: score, gauge to QUEST_MAX, the five reward boxes with their score steps
    f(panel + 'TopFrame/Score/Text (TMP)').uiText = String(s.score);
    const max = Tables.defineList?.('QUEST_MAX')?.[set] ?? 100;
    const bar = f(panel + 'TopFrame/BarFrame/Image (1)'); if (bar) bar.uiFill = Math.min(s.score / max, 1);
    G.InstantQuest.rewards(set).forEach((r, i) => {
      const box = f(panel + `TopFrame/Reward_${i + 1}`); if (!box) return;
      box.find('TextBG/Text (TMP)').uiText = String(r.score);
      box.find('UIRedDot')?.setActive(i === s.reward && s.score >= r.score);
      box.find('BoxImg').uiAlpha = i < s.reward ? 0.5 : 1;
    });
    f(IF + 'MidPanel/Complete')?.setActive(false);
    for (const [n, i] of [['DayButton', 0], ['WeekButton', 1]]) {
      const b = f(IF + 'BottomPanel/' + n);
      if (b) b.uiColor = i === set ? null : [0.6, 0.6, 0.6, 1];
      b?.find('Panel/UIRedDot')?.setActive(G.InstantQuest.sets[i].quests.some(q => !q.complete && q.value >= Tables.get('TableInstantQuest', q.key).questValue));
    }
  };
  const timer = () => {
    const now = new Date(), end = new Date(now);
    if (set === 0) end.setHours(24, 0, 0, 0);
    else { end.setHours(0, 0, 0, 0); end.setDate(end.getDate() + 7 - ((end.getDay() + 6) % 7)); }
    const left = Math.max(0, (end - now) / 1000);
    const h = Math.floor(left / 3600), m = Math.floor((left % 3600) / 60);
    f(panel + 'BottomFrame/Time/Text (TMP)').uiText = `${Tables.loc('LocalizeUIInstantQuest000001')} : ${h}시간 ${m}분`;
  };
  build(); timer();
  await G.assets.preloadSprites(sprites);
  p.timer = Timing.RunCoroutine((function* () { while (G.UI.popups.includes(p)) { timer(); yield 1; } })(), null);
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    if (hit.name === 'DayButton' || hit.name === 'WeekButton') { set = hit.name === 'DayButton' ? 0 : 1; build(); timer(); return; }
    let g = hit; while (g && !g.q && !/^Reward_\d$/.test(g.name)) g = g.transform.parent?.go;
    if (!g) return;
    if (g.q && hit.name === 'HintBtn') { G.UI.close(p); return; }   // 이동: back to the field
    if (g.q && hit.name === 'RewardBtn') {
      if (G.InstantQuest.complete(set, g.q.key)) { G.Sound.play('SFX_0000'); build(); }
    } else if (/^Reward_\d$/.test(g.name)) {
      const r = G.InstantQuest.reward(set, Number(g.name.slice(7)) - 1);
      if (r) { G.Sound.play('SFX_0000'); G.UI.toast(r.rewardKeyList.map((k, i) => `${Tables.loc(Tables.get('TableItem', k)?.name)} x${Math.round(r.amountList[i])}`).join(', ')); build(); }
    }
  };
  return p;
}
