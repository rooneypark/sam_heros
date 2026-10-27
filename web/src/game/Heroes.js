// UserHero / UserHeroData (AddHero @0x386e030, AddHeroPart, HeroLevelUp @0x3870bec) and the
// UIHeroManagementPopup / UIHeroInformationPopup (hero tab: UIInformationHero.OnClickUpgrade @0x2c500fc).
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { TEAM } from './defs.js';
import { Timing } from './core/Timing.js';
import { Animator } from '../engine/components.js';

/** TableGrowth row for a hero level: category by grade (UNIQUE+ use the part-only table) */
export function growthOf(key, lv) {
  const u = Tables.unit(key);
  const cat = u && (u.gradeType === 'LEGEND' || u.gradeType === 'MYTH') ? 1 : 0;
  const rows = Object.values(Tables.t.TableGrowth).filter(r => r.category === cat);
  return rows.find(r => r.level === lv + 1) || null;   // cost to reach the next level
}

export class UserHero {
  constructor() { this.datas = new Map(); this.index = 0; }
  GetHero(key) { return this.datas.get(key) || null; }
  /** AddHero(key): existing hero gets +count parts, a new one starts at HeroLv 0 */
  AddHero(key, count = 0, lv = 0) {
    const d = this.datas.get(key);
    if (d) { d.count += Math.max(count, 1); return false; }
    this.datas.set(key, { key, lv, count, index: this.index++, isNew: true });
    return true;
  }
  /** returns 'ok' | 'part' | 'res' | 'max' */
  CanLevelUp(key) {
    const d = this.datas.get(key);
    const g = d && growthOf(key, d.lv);
    if (!g) return 'max';
    if (d.count < g.partCount) return 'part';
    if (G.Inventory.count(g.requiredResource) < g.resourceAmount) return 'res';
    return 'ok';
  }
  /** OnClickUpgrade: pay parts + resource, HeroLevelUp: lv+1, ResetSkill/ResetStat of the actor */
  LevelUp(key) {
    if (this.CanLevelUp(key) !== 'ok') return false;
    const d = this.datas.get(key), g = growthOf(key, d.lv);
    d.count -= g.partCount;
    G.Inventory.use(g.requiredResource, g.resourceAmount);
    d.lv++;
    for (const u of G.UnitManager.HeroUnits) if (u.Key === key) {
      u.Level = d.lv; u.SetLvStat(); u.ResetSkill(); u.UnitData.RestoreHp();
    }
    G.Sound.play('SOUND_ETC_0001');
    G.InstantQuest?.add('HERO_LV', 1);   // UserHero.HeroLevelUp -> AddInstantQuest(HERO_LV)
    G.Fame?.update();                    // total hero level -> fame grade
    return true;
  }
  power(key) {
    const u = G.UnitManager.HeroUnits.find(h => h.Key === key);
    return u ? Math.round(u.UnitData.GetStat(1) * 4 + u.UnitData.GetStat(0)) : 0;
  }
}

const fmt = (k, ...a) => a.reduce((s, v, i) => s.replace(`{${i}}`, v), Tables.loc(k));

/** UIHeroManagementPopup: battle list of the party with level / parts gauge, tap -> information popup */
export async function openHeroManagement() {
  const UI = G.UI;
  const p = await UI.openPopup('prefab/ui/popup/uiheromanagementpopup', (p, f) => { p.kind = 'heroes'; });
  const f = n => p.root.find(n) || [...p.root.walk()].find(g => g.name === n);
  const HM = 'SafeArea/InnerFrame/MidFrame/HeroManagement/Panel/';
  const inParty = new Set(G.UnitManager.HeroUnits.map(h => h.Key));
  const waiting = [...G.UserHero.datas.keys()].filter(k => !inParty.has(k));
  for (const path of ['Scroll View/Viewport/Content/HeroNotFound_List', 'Scroll View/Viewport/Content/Text (TMP)', 'Scroll View/Viewport/UIScrollArrow', 'Filter'])
    p.root.find(HM + path)?.setActive(false);
  // UIHeroManagementList (waiting): owned heroes outside the party
  const wait = p.root.find(HM + 'Scroll View/Viewport/Content/WaitingHero_List');
  wait?.setActive(waiting.length > 0);
  p.root.find('SafeArea/InnerFrame/MidFrame/HeroManagement/UIFameOverview')?.setActive(false);
  p.root.find('SafeArea/InnerFrame/BottomPanel/Mask/AncientButton')?.setActive(false);
  const battle = [...p.root.walk()].find(g => g.name === 'HeroinBattle_List');
  const list = battle.find('List');
  battle.find('Panel/Text_Quantity').uiText = `${G.UnitManager.HeroUnits.length}/${G.User.heroMax}`;
  const cellJson = await import('../engine/prefab.js').then(m => m.loadPrefab('prefab/ui/element/uiheromanagementcell'));
  const { instantiate } = await import('../engine/prefab.js');
  p.cells = [];
  const refresh = () => {
    for (const c of p.cells) {
      // the prologue hero is in the party without being owned (UserHero.InitData runs at ClearPrologue)
      const d = G.UserHero.GetHero(c.key) || { lv: G.UnitManager.HeroUnits.find(h => h.Key === c.key)?.Level ?? 0, count: 0 };
      const u = Tables.unit(c.key), g = growthOf(c.key, d.lv);
      c.go.find('Panel/UIHeroCell/Group/Frame/HeroFame/HeroPice').uiSprite = `${u.prefab}_Icon`;
      c.go.find('Panel/Power/Panel/Text').uiText = String(G.UserHero.power(c.key));
      c.go.find('Panel/Exp/Icon/Text').uiText = String(d.lv + 1);
      c.go.find('Panel/Exp/Gauge/Text').uiText = g ? `${d.count}/${g.partCount}` : 'MAX';
      c.go.find('Panel/Exp/Gauge/Fill').uiFill = g && g.partCount ? Math.min(d.count / g.partCount, 1) : 1;
      c.go.find('Panel/UIHeroCell/imgNew')?.setActive(!!d.isNew);
    }
  };
  const addCell = (key, parent) => {
    const go = instantiate(cellJson, G.assets);
    go.transform.setParent(parent.transform);
    p.cells.push({ key, go });
  };
  for (const h of G.UnitManager.HeroUnits) addCell(h.Key, list);
  if (wait && waiting.length) {
    wait.find('Panel/Text_Quantity').uiText = String(waiting.length);
    for (const k of waiting) addCell(k, wait.find('List'));
  }
  await G.assets.preloadSprites([...p.cells.map(c => `${Tables.unit(c.key).prefab}_Icon`), ...spriteNames(p.root)]);
  refresh();
  p.refresh = refresh;
  p.onClick = hit => {
    if (!hit) return;
    let g = hit; while (g && !p.cells.some(c => c.go === g)) g = g.transform.parent?.go;
    const cell = g && p.cells.find(c => c.go === g);
    if (cell) { const d = G.UserHero.GetHero(cell.key); d.isNew = false; openHeroInformation(cell.key, refresh); return; }
    if (hit.name === 'UI_Back' || hit.name === 'BG') UI.close(p);
  };
  return p;
}

// ------------------------------------------------------------------ party formation (UIBottomTab.OnClickBonfire)
// BonfirePreview.SetSeat @0x1ae689c: seat i of `max` at angle 360/max*i + 45 on the ellipse (4, 3) * SCALE[max]
// under the Seat node (scale 0.5); the preview camera (orthographic, square RenderTexture) has size SIZE[max]
const SEAT_SIZE = [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.9, 1.9, 2.0, 2.0, 2.5, 2.5];
const SEAT_SCALE = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.6, 0.6, 0.7, 0.7, 0.85, 0.85];
function seatPos(i, max) {
  const n = Math.min(max, 12), k = SEAT_SCALE[n] ?? 1, a = (360 / n * i + 45) * Math.PI / 180;
  return [Math.cos(a) * 4 * k * 0.5, Math.sin(a) * 3 * k * 0.5];
}
const framesOf = (prefix) => Object.keys(G.assets.sprites).filter(n => new RegExp(`^${prefix}_?\\d+$`).test(n))
  .sort((a, b) => +a.match(/(\d+)$/)[1] - +b.match(/(\d+)$/)[1]);

/** UnitManager.SetHero(key): a waiting hero joins the party next to the group (false when full) */
async function joinParty(key) {
  const UM = G.UnitManager;
  if (UM.HeroUnits.length >= G.User.heroMax || UM.HeroUnits.some(h => h.Key === key)) return false;
  const d = G.UserHero.GetHero(key);
  const u = await UM.CreateHero(key, d?.lv ?? 0);
  const p = G.HeroManager.heroCenterPos || G.HeroManager.transform.position;
  u.WarpHero(p[0] + (Math.random() - 0.5) * 0.6, p[1] + (Math.random() - 0.5) * 0.6);
  return true;
}
/** UnitManager.RemoveHero: at least one hero stays (IsRemove); the leader passes to the next hero */
function leaveParty(key) {
  const UM = G.UnitManager, u = UM.HeroUnits.find(h => h.Key === key);
  if (!u || UM.HeroUnits.length <= 1) return false;
  G.HeroManager.RemoveHero(u);
  UM.despawn(u);
  return true;
}
/** UnitManager.SetLeaderHero: the leader is the first hero (seat 1 carries the crown, the save keeps the order) */
function setLeader(key) {
  const UM = G.UnitManager, i = UM.HeroUnits.findIndex(h => h.Key === key);
  if (i < 0) return;
  const [u] = UM.HeroUnits.splice(i, 1); UM.HeroUnits.unshift(u);
  const j = G.HeroManager.HeroUnits.indexOf(u); if (j > 0) { G.HeroManager.HeroUnits.splice(j, 1); G.HeroManager.HeroUnits.unshift(u); }
  UM.LeaderHero = u;
}

/** UIBonfirePopupView_Normal: seats around the bonfire (tap = leave / pick leader), owned heroes grid (tap = join or
 *  leave), 자동 배치 (strongest heroes), 도전하기 / back = close. */
export async function openBonfire() {
  const UI = G.UI, UM = G.UnitManager;
  const p = await UI.openPopup('prefab/ui/popup/bonfire/uibonfirepopup_normal', () => {});
  p.kind = 'bonfire';
  p.closeLock = true;
  Timing.RunCoroutine((function* () { yield 1.1; p.closeLock = false; })(), null);   // OnEnter: WaitSecond(1.1)
  G.Sound.play('SFX_0015');
  G.UI.releaseJoystick?.();
  const f = path => p.root.find(path);
  const IF = 'SafeArea/InnerFrame/';
  const MAX = Math.round(Tables.define('MAX_HERO_CNT')) || 12;
  f(IF + 'TopFrame/Text (TMP)').uiText = Tables.loc('LocalizeUIBonfire000003');
  f(IF + 'Equip')?.setActive(false);
  f(IF + 'MidFrame/TopFrame/Filter (1)')?.setActive(false);   // grade / attribute / type filters (dropdowns not ported)
  const raw = f(IF + 'RawImage');
  const seats = raw.transform.children.map(c => c.go);         // "1".."12": Button + Slot (+ Leader on seat 1)
  const leaderIcon = f(IF + 'RawImage/1/Leader');
  let ldSel = false;

  // owned hero cells (UIHeroManagementCell, Check = in the party)
  const { loadPrefab, instantiate } = await import('../engine/prefab.js');
  const cellJson = await loadPrefab('prefab/ui/element/uiheromanagementcell');
  const content = f(IF + 'MidFrame/Scroll View/Viewport/Content');
  const keys = [...G.UserHero.datas.keys()];
  const icons = keys.map(k => `${Tables.unit(k).prefab}_Icon`);
  const idle = new Map(keys.map(k => { const pf = Tables.unit(k).prefab; let fr = framesOf(`${pf}_Idle`); if (!fr.length) fr = framesOf(`${pf}_Move`); return [k, fr]; }));
  const move = new Map(keys.map(k => { const fr = framesOf(`${Tables.unit(k).prefab}_Move`); return [k, fr.length ? fr : idle.get(k)]; }));
  // seat walks (BonfireSeat.CreatePreviewUnit / ClearPreviewUnit): key -> {seat, t, dur, leave}
  const walks = new Map();
  let seated = UM.HeroUnits.map(h => h.Key);
  const fire = framesOf('bonfire').length ? framesOf('bonfire') : ['bonfire_0'];
  await G.assets.preloadSprites([...icons, ...[...idle.values()].flat(), ...[...move.values()].flat(), ...fire, 'ui_025', 'ui_016']);
  p.cells = [];
  const inParty = k => UM.HeroUnits.some(h => h.Key === k);
  const dead = k => G.HeroManager.DeadHeroes.some(h => h.Key === k);

  const refresh = () => {
    // <OnRefresh>b__21_0: party first, then power
    const order = [...keys].sort((a, b) => (inParty(b) - inParty(a)) || (G.UserHero.power(b) - G.UserHero.power(a)) || a.localeCompare(b));
    for (const c of p.cells) c.go.transform.setParent(null);
    p.cells.length = 0;
    for (const k of order) {
      const go = instantiate(cellJson, G.assets);
      go.transform.setParent(content.transform);
      const d = G.UserHero.GetHero(k), g = growthOf(k, d.lv);
      go.find('Panel/UIHeroCell/Group/Frame/HeroFame/HeroPice').uiSprite = `${Tables.unit(k).prefab}_Icon`;
      go.find('Panel/UIHeroCell/Group/Frame/HeroFame/Check')?.setActive(inParty(k));
      go.find('Panel/UIHeroCell/Group/Frame/DeadFrame')?.setActive(dead(k));
      go.find('Panel/UIHeroCell/imgNew')?.setActive(false);
      go.find('Panel/Power/Panel/Text').uiText = String(G.UserHero.power(k));
      go.find('Panel/Exp/Icon/Text').uiText = String(d.lv + 1);
      go.find('Panel/Exp/Gauge/Text').uiText = g ? `${d.count}/${g.partCount}` : 'MAX';
      go.find('Panel/Exp/Gauge/Fill').uiFill = g && g.partCount ? Math.min(d.count / g.partCount, 1) : 1;
      p.cells.push({ key: k, go });
    }
    const n = UM.HeroUnits.length;
    // joined heroes walk in to their seat (0.5 s), removed ones turn round and walk out (0.4 s)
    const now = UM.HeroUnits.map(h => h.Key);
    now.forEach((k, i) => { if (!seated.includes(k)) walks.set(k, { seat: i, t: 0, dur: 0.5, leave: false }); });
    seated.forEach((k, i) => { if (!now.includes(k)) walks.set(k, { seat: i, t: 0, dur: 0.4, leave: true }); });
    seated = now;
    f(IF + 'TopFrame/Quantity').uiText = `${n}/${G.User.heroMax} `;
    // seats: i < MAX shown, LockRect (Slot) on i >= HeroMaxCount; the party sits in seat order
    seats.forEach((s, i) => { s.setActive(i < MAX); s.find('Slot')?.setActive(i >= G.User.heroMax); });
    // UIScrollableArrow: only while the list overflows (the arrows themselves are not rotated by this renderer)
    f(IF + 'MidFrame/Scroll View/UIScrollArrow')?.setActive(false);
    leaderIcon?.setActive(n > 0);
    if (leaderIcon) leaderIcon.uiColor = ldSel ? [1, 0.85, 0.3, 1] : null;
  };
  // seat buttons follow BonfirePreview.GetSeat through the preview camera (viewport * RawImage size)
  let rawRect = null;
  const placeSeats = R => {
    const size = SEAT_SIZE[Math.min(MAX, 12)];
    seats.forEach((s, i) => {
      const [x, y] = seatPos(i, MAX), r = s.transform.rect;
      if (!r) return;
      r.aMin = [0, 0]; r.aMax = [0, 0];
      r.aPos = [(x / (2 * size) + 0.5) * R.w, (y / (2 * size) + 0.5) * R.h];
    });
  };
  // the preview itself: bonfire, BotLight shadows and the party's idle frames, scaled like the RenderTexture
  let t = 0;
  raw.drawHook = (renderer, R, o) => {
    if (!rawRect || rawRect.w !== R.w) { rawRect = { ...R }; placeSeats(R); }
    t += G.dt || 0;
    const size = SEAT_SIZE[Math.min(MAX, 12)], k = R.h / (2 * size), cx = R.x0 + R.w / 2, cy = R.y0 + R.h / 2;
    let order = o.order;
    const draw = (name, x, y, sx, sy, a = 1, sortY = -1e9) => {
      const sp = G.assets.sprite(name); if (!sp) return;
      renderer.draw({ sp, x: cx + x * k, y: cy + y * k, sx: sx * k, sy: sy * k, r: 1, g: 1, b: 1, a: a * o.alpha, layer: o.layer, order: order++, sortY });
    };
    draw(fire[Math.floor(t * 10) % fire.length], 0, 0, 0.3, 0.3);
    // seated heroes plus the ones still walking out; a walk runs Move frames along the seat's forward axis
    const dt = G.dt || 0;
    const list = UM.HeroUnits.map((h, i) => ({ key: h.Key, seat: i }));
    for (const [k, w] of walks) { w.t += dt; if (w.leave && w.t < w.dur) list.push({ key: k, seat: w.seat }); if (w.t >= w.dur) walks.delete(k); }
    const units = list.map(u => {
      const seat = seatPos(u.seat, MAX), L = Math.hypot(seat[0], seat[1]) || 1, fwd = [-seat[0] / L, -seat[1] / L];   // Center.LookAt(bonfire)
      const w = walks.get(u.key);
      let pos = seat, walking = false, away = false;
      if (w) {
        const e = Math.min(1, w.t / w.dur), q = e * (2 - e);    // DOTween default ease (OutQuad)
        // enter: from seat - forward * 1.5 to the seat; leave: flipped, from the seat to seat - forward * 0.5
        const d = w.leave ? 0.5 * q : 1.5 * (1 - q);
        pos = [seat[0] - fwd[0] * d, seat[1] - fwd[1] * d]; walking = true; away = w.leave;
      }
      return { ...u, seat, pos, walking, away };
    }).sort((a, b) => b.pos[1] - a.pos[1]);
    for (const u of units) if (!u.away) draw('ui_025', u.seat[0], u.seat[1] - 0.25, 0.4 * 0.5, 0.17 * 0.5, 0.32);
    for (const u of units) {
      const fr = (u.walking ? move.get(u.key) : idle.get(u.key)) || [];
      const name = fr[Math.floor(t * (u.walking ? 12 : 6)) % Math.max(fr.length, 1)];
      let face = u.seat[0] > 0 ? 1 : -1;    // facing the bonfire (sprites face left natively)
      if (u.away) face = -face;             // ClearPreviewUnit: localScale.x = -x
      if (name) draw(name, u.pos[0], u.pos[1], 0.5 * face, 0.5);
    }
    return order;
  };
  refresh();
  p.refresh = refresh;

  const tapHero = async key => {
    if (inParty(key)) { if (leaveParty(key)) refresh(); return; }
    if (dead(key)) { UI.toast(Tables.loc('LocalizeUIToast000035')); return; }
    if (await joinParty(key)) refresh();
  };
  p.onClick = async hit => {
    if (!hit) return;
    const seatIdx = seats.findIndex(s => hit === s || hit.transform.parent?.go === s);
    if (hit.name === 'LeaderIcon') { ldSel = !ldSel; refresh(); return; }
    if (seatIdx >= 0) {
      const h = UM.HeroUnits[seatIdx]; if (!h) return;
      if (ldSel) { setLeader(h.Key); ldSel = false; refresh(); return; }   // OnClickHero with _ldSel
      if (leaveParty(h.Key)) refresh();
      return;
    }
    let g = hit; while (g && !p.cells.some(c => c.go === g)) g = g.transform.parent?.go;
    const cell = g && p.cells.find(c => c.go === g);
    if (cell) { await tapHero(cell.key); return; }
    if (hit.name === 'Auto_Button') {
      // OnClickAuto: the strongest living heroes fill the party, the leader stays when chosen
      const lead = UM.LeaderHero?.Key;
      // (UserHeroData power is not kept for heroes off the field: rank by hero level, then grade)
      const rank = k => (G.UserHero.GetHero(k).lv) * 10 + (GRADE_IDX[Tables.unit(k).gradeType] ?? 0);
      const pick = keys.filter(k => !dead(k)).sort((a, b) => rank(b) - rank(a) || a.localeCompare(b)).slice(0, G.User.heroMax);
      for (const k of UM.HeroUnits.map(h => h.Key)) if (!pick.includes(k)) leaveParty(k);
      for (const k of pick) await joinParty(k);
      if (lead && inParty(lead)) setLeader(lead);
      refresh(); return;
    }
    if (p.closeLock) return;
    if (hit.name === 'Power_Button' || hit.name === 'UI_Back') UI.close(p);
  };
  return p;
}

// ColorSet ribbon / grade text colours by GRADE_TYPE (NORMAL, RARE, UNIQUE, LEGEND)
const RIBBON = ['A4A4A4', '2962E7', 'D419CE', 'FFAA00'];
const GRADE_TEXT = ['A8A7A8', '0DA9FF', 'BB3BFF', 'FFAA00'];
const GRADE_IDX = { NORMAL: 0, RARE: 1, UNIQUE: 2, LEGEND: 3 };
const hex = h => [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, 1];

/** UINewHeroPopupView.OnEnter @0x291eb58: SFX_0012, top tab hidden, close locked; Animator "Action" for legends
 *  else "Active"; the AnimEnd event types JoinTalk into the bubble and unlocks closing. Resolves on close. */
export function openNewHero(key) {
  return new Promise(async res => {
    const u = Tables.unit(key), g = GRADE_IDX[u.gradeType] ?? 0;
    const img = u.image || `${u.prefab}_Idle_1`, ill = u.illust || `${u.prefab}_Img`;
    await G.assets.preloadSprites([img, ill]);
    G.Sound.play('SFX_0012');
    const top = G.UI.hudFind?.('UITopTab'); top?.setActive(false);
    const p = await G.UI.openPopup('prefab/ui/popup/uinewheropopup', () => {});
    p.kind = 'newhero'; p.closeLock = true;
    const f = path => p.root.find(path);
    f('MidFrame/Characters').uiSprite = img;
    f('MidFrame/ilustMask/GameObject/ilust').uiSprite = ill;
    const texts = f('MidFrame/Name/Ribbon').transform.children.map(c => c.go);
    texts[0].uiText = Tables.loc(u.name);
    texts[1].uiText = Tables.loc(`LocalizeUIGrade00000${g}`); texts[1].uiTextColor = hex(GRADE_TEXT[g]);
    f('MidFrame/Name/Ribbon').uiColor = hex(RIBBON[g]);
    const bubble = f('MidFrame/Characters/imgBubble'), talk = f('MidFrame/Characters/imgBubble/txtJoinTalk');
    bubble.setActive(false); talk.uiText = '';
    const anim = p.root.getComponent?.(Animator) || p.anims?.find(a => a.go === p.root);
    let ended = false;
    const animEnd = () => {
      if (ended) return; ended = true;
      bubble.setActive(true);
      const text = Tables.loc(u.JoinTalk) || '';
      Timing.RunCoroutine((function* () {
        for (let i = 1; i <= text.length; i++) { talk.uiText = text.slice(0, i); yield 0.05; }
        p.closeLock = false;
      })(), null);
    };
    if (anim) {
      anim.listeners.push(fn => { if (fn === 'AnimEnd') animEnd(); });
      anim.play(g === 3 ? 'Action' : 'Active', 0);
      // fallback when the clip carries no AnimEnd event
      Timing.RunCoroutine((function* () { yield (anim.cur?.clip?.length || 1.5) + 0.1; animEnd(); })(), null);
    } else animEnd();
    p.onClick = () => {
      if (p.closeLock) return;
      G.UI.close(p); top?.setActive(true); res();
    };
  });
}

function spriteNames(root) {
  const s = new Set();
  for (const g of root.walk()) for (const sc of g.scripts || []) { const n = sc.f?.m_Sprite?.sprite; if (n) s.add(n); }
  return s;
}

/** UIHeroInformationPopup, hero tab (UIInformationHero) */
export async function openHeroInformation(key, onChange) {
  const UI = G.UI, u = Tables.unit(key);
  const p = await UI.openPopup('prefab/ui/popup/uiheroinformationpopup', () => {});
  p.kind = 'heroinfo';
  const all = [...p.root.walk()];
  const f = (n, parent) => all.find(g => g.name === n && (!parent || g.transform.parent?.go.name === parent));
  for (const n of ['AwakeninfoHolder', 'RuneInfoHolder', 'SkinInfoHolder', 'OverTopHeroLimitedFrame', 'imgRG', 'TrasitionBtn', 'AutoLevelUp', 'ContractBtn', 'AncientPower', 'ResourceFrame'])
    f(n)?.setActive(false);
  const info = f('HeroInfoHolder'); info.setActive(true);
  await G.assets.preloadSprites([`${u.prefab}_Img`, `${u.prefab}_Icon`]);
  f('Characters').uiSprite = `${u.prefab}_Img`;
  f('txtName').uiText = Tables.loc(u.name);
  f('BottomFrame', 'imgInfo').uiText = Tables.loc(u.intro1);
  const pice = [...info.walk()].find(g => g.name === 'HeroPice'); if (pice) pice.uiSprite = `${u.prefab}_Icon`;
  const refresh = () => {
    const d = G.UserHero.GetHero(key), g = growthOf(key, d.lv);
    const actor = G.UnitManager.HeroUnits.find(h => h.Key === key);
    const stat = n => (actor ? Math.round(actor.UnitData.GetStat(n)) : 0);
    const top = info.find('TopFrame/Info');
    top.find('CombatPower/Text').uiText = String(G.UserHero.power(key));
    top.find('OffensePower/Text').uiText = String(stat(1));
    top.find('Health/Text').uiText = String(stat(0));
    const lvl = info.find('TopFrame/Infomation/Level/Gauge');
    lvl.find('Text').uiText = g ? `${d.count}/${g.partCount}` : 'MAX';
    lvl.find('Fill').uiFill = g && g.partCount ? Math.min(d.count / g.partCount, 1) : 1;
    lvl.find('Fill/Text (TMP)')?.setActive(false);
    lvl.find('AllConvertBtn')?.setActive(false);
    lvl.find('Level/Text_Number').uiText = String(d.lv + 1);
    info.find('TopFrame/Infomation/Text_Name').uiText = Tables.loc(u.name);
    const btn = info.find('BottomFrame/Btn');
    const ok = G.UserHero.CanLevelUp(key);
    if (g) {
      btn.find('Upgrade/Panel/Icon').uiSprite = { MEAT: 'ui_103', TREE: 'ui_109', STONE: 'ui_102', GOLD: 'ui_104' }[g.requiredResource] || 'ui_103';
      btn.find('Upgrade/Panel/Text').uiText = `${G.Inventory.count(g.requiredResource)}/${g.resourceAmount}`;
      btn.find('Upgrade/Panel/Text').uiTextColor = G.Inventory.count(g.requiredResource) >= g.resourceAmount ? null : [1, 0.35, 0.35, 1];
    }
    btn.uiColor = ok === 'ok' ? null : [0.6, 0.6, 0.6, 1];
    info.find('BottomFrame/Text (TMP)')?.setActive(false);
    // UISkillBlockCell x2: skillA / skillB of the hero's current skill group (UnitSkill row by level)
    const us = Tables.get('TableUnitSkill', u.skillKey);
    const grp = Tables.skillGroup(Tables.unitSkillFor(us ? us.category : u.category, d.lv)?.skillGroup);
    const cells = [...info.walk()].filter(g => g.scripts.some(s => s.script.endsWith('UISkillBlockCell')));
    cells.forEach((c, i) => {
      const sk = Tables.skill(grp?.[i ? 'skillB' : 'skillA']);
      c.setActive(!!sk);
      if (!sk) return;
      const icon = c.find('Button/Icon'); if (icon) { icon.uiSprite = sk.icon; G.assets.preloadSprites([sk.icon]); }
      const name = c.find('NameFrame/Text'); if (name) name.uiText = Tables.loc(sk.name);
      // UIInformationHero.UpdateSkillBtn: the distinct skills of this slot over the UnitSkill rows (by level) are
      // the tiers; SetData stars: tier index <= current -> ui_173, else ui_174
      const cat = us ? us.category : u.category;
      const rows = Object.values(Tables.t.TableUnitSkill).filter(r => r.category === cat).sort((a, b) => a.level - b.level);
      const tiers = [];
      for (const r of rows) {
        const sid = Tables.skillGroup(r.skillGroup)?.[i ? 'skillB' : 'skillA'];
        if (sid && !tiers.some(t => t.sid === sid)) tiers.push({ sid, level: r.level });
      }
      const cur = Math.max(0, tiers.filter(t => t.level <= d.lv).length - 1);
      (c.find('NameFrame/Stars')?.transform.children || []).forEach((s, k) => { s.go.uiSprite = k > cur ? 'ui_174' : 'ui_173'; });
    });
  };
  refresh();
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'Btn' && hit.transform.parent?.go.name === 'BottomFrame') {
      const r = G.UserHero.CanLevelUp(key);
      if (r === 'ok') { G.UserHero.LevelUp(key); refresh(); onChange?.(); }
      else if (r === 'part') G.UI.toast(Tables.loc('LocalizeUIToast000005'));
      else if (r === 'res') { const g = growthOf(key, G.UserHero.GetHero(key).lv); const it = Object.values(Tables.t.TableItem).find(x => x.itemType === 'RESOURCE' && x.itemDetailKey === g.requiredResource); G.UI.toast(`${Tables.loc(it?.name)} 부족`); }
      return;
    }
    if (hit.name === 'UI_Back' || hit.name === 'BackGround') UI.close(p);
  };
  return p;
}
