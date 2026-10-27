// Logic_SleepMode + UISleepModeView: with the 절전모드 option on and user level >= Define_SLEEPMODE_UNLOCKLV,
// Define_SLEEP_MODE_TIME seconds without input open the sleep screen. OnSleepMode: OnDemandRendering
// renderFrameInterval 3, main camera off, AudioListener paused. Sliding the handle to the end exits.
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { Timing } from './core/Timing.js';

export class SleepMode {
  constructor() { this.idle = 0; this.open = null; }
  /** Logic_SleepMode.HasInputAnyKey: any touch restarts the countdown */
  input() { this.idle = 0; }
  unlocked() { return G.UserData.Level >= (Tables.define('SLEEPMODE_UNLOCKLV') || 0); }
  update(dt) {
    if (this.open) return;
    this.idle += dt;
    if (!G.Option?.sleep || !this.unlocked() || G.User.isPrologue) return;
    if (G.UI.popups.some(p => p.kind !== 'toast')) return;
    if (this.idle >= (Tables.define('SLEEP_MODE_TIME') || 300)) this.enter();
  }
  get rendering() { return !this.open; }
  async enter() {
    this.open = 'opening';
    G.UI.releaseJoystick();
    const p = await G.UI.openPopup('prefab/ui/popup/uisleepmode', () => {});
    p.kind = 'sleep'; p.closeLock = true;
    this.open = p;
    const f = path => p.root.find(path);
    const IF = 'SafeArea/InnerFrame/';
    f(IF + 'btnPackage')?.setActive(false);   // shop packages are paid content
    G.Sound.ctx?.suspend();                   // AudioListener.pause = true
    const handle = f(IF + 'Slider/Handle Slide Area/Handle'), fill = f(IF + 'Slider/Fill Area/Fill');
    let value = 0;
    const setValue = v => {
      value = Math.max(0, Math.min(1, v));
      handle.transform.rect = { ...handle.transform.rect, aMin: [value, 0], aMax: [value, 1] };
      if (fill) fill.transform.rect = { ...fill.transform.rect, aMax: [value, 1] };
    };
    setValue(0);
    const refresh = async () => {
      const d = new Date();
      f(IF + 'txtTime').uiText = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const bat = await navigator.getBattery?.().catch(() => null);
      f(IF + 'BatteryHolder')?.setActive(!!bat);
      if (bat) {
        f(IF + 'BatteryHolder/txtBettery').uiText = `${Math.round(bat.level * 100)}%`;
        const fl = f(IF + 'BatteryHolder/imgBattery/imgBattery/imgFill'); if (fl) fl.uiFill = bat.level;
        f(IF + 'BatteryHolder/imgBattery/imgBattery/imgFill/imgCharge')?.setActive(bat.charging);
      }
    };
    refresh();
    p.timer = Timing.RunCoroutine((function* () { while (G.UI.popups.includes(p)) { refresh(); yield 1; } })(), null);
    // UISleepModeSlider: drag the handle; releasing before the end springs back
    const width = () => 600;
    p.onDrag = dx => setValue(value + dx / width());
    p.onDragEnd = () => { if (value >= 0.95) this.exit(); else setValue(0); };
    p.onClick = () => {};
  }
  exit() {
    const p = this.open; if (!p || p === 'opening') return;
    G.UI.close(p);
    this.open = null; this.idle = 0;
    G.Sound.ctx?.resume();
  }
}
