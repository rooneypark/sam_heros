// UIOptionPopupView: sound / convenience / graphic toggles (kept in this browser), language label,
// local save button. Community, account, UID and support rows are server features and stay hidden.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { saveGame } from './Save.js';

const KEY = 'rumble_heroes_option_v1';
// UserOption.InitData @0x3955074: BGM / SFX / haptic / dead body removal / fx on, font 2 (shown), sleep off
const DEFAULTS = { bgm: true, sfx: true, haptic: true, dmgFont: true, fx: true, deadBody: true, sleep: false };

export class UserOption {
  constructor() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* private mode */ }
    Object.assign(this, DEFAULTS, s);
    this.apply();
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.keys(DEFAULTS).map(k => [k, this[k]])))); } catch { /* */ }
  }
  apply() { G.Sound?.SetBGM(this.bgm); G.Sound?.SetSFX(this.sfx); }
}

// toggle row -> option field and the "off" image under its Background
const ROWS = {
  'Sound/BGM': ['bgm', 'BgmOff'], 'Sound/SFX': ['sfx', 'SfxOff'],
  'Convenience/Haptic': ['haptic', 'HapticOff'], 'Convenience/DmgFont': ['dmgFont', 'FontOff'],
  'GraphicOption/Fx': ['fx', 'HapticOff'], 'GraphicOption/DeadBody': ['deadBody', 'FontOff'],
  'SleepMode/Haptic': ['sleep', 'SleepModeOff'],
};

export async function openOption() {
  const p = await G.UI.openPopup('prefab/ui/popup/uioptionpopup', () => {});
  p.kind = 'option';
  const f = path => p.root.find(path);
  const IF = 'SafeArea/InnerFrame/';
  f(IF + 'CommunityBtn')?.setActive(false);
  f(IF + 'MidFrame/Account')?.setActive(false);
  f(IF + 'MidFrame/Language/Button/Text (TMP)').uiText = '한국어';
  const refresh = () => {
    for (const [row, [key, off]] of Object.entries(ROWS)) {
      const bg = f(`${IF}MidFrame/${row}/Toggle/Background`); if (!bg) continue;
      bg.find('Checkmark')?.setActive(!!G.Option[key]);
      bg.find(off)?.setActive(!G.Option[key]);
    }
  };
  refresh();
  p.onClick = hit => {
    if (!hit) return;
    if (hit.name === 'UI_Back' || hit.name === 'BG') { G.UI.close(p); return; }
    let g = hit, path = [];
    while (g && g !== p.root) { path.unshift(g.name); g = g.transform.parent?.go; }
    const s = path.join('/');
    const row = Object.keys(ROWS).find(r => s.includes(`MidFrame/${r}/`));
    if (row) {
      const key = ROWS[row][0];
      G.Option[key] = !G.Option[key];
      G.Option.save(); G.Option.apply(); refresh();
      return;
    }
    if (s.includes('MidFrame/Save/')) { saveGame(); G.UI.toast(Tables.loc('LocalizeUIOption000012')); }
  };
  return p;
}
