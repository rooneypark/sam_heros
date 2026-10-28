// Screen-space UI: popups instantiated from the exported prefabs, VariableJoystick (Floating), fades.
import { G } from '../registry.js';
import { Tables } from '../data/Tables.js';
import { Timing } from '../core/Timing.js';
import { loadPrefab, instantiate } from '../../engine/prefab.js';
import { layoutTree, drawUI, hitTest, canvasSize, bindUIAnim, setLayoutAssets, scrollAt, scrollBy } from '../../engine/ui.js';
import { Animator } from '../../engine/components.js';
import { drawImage } from '../../engine/uidraw.js';

function findGo(root, name) { for (const g of root.walk()) if (g.name === name) return g; return null; }
async function preloadUISprites(root) {
  const s = new Set();
  for (const g of root.walk()) for (const sc of g.scripts || []) { const n = sc.f?.m_Sprite?.sprite; if (n) s.add(n); }
  await G.assets.preloadSprites(s);
}

/** PlayCore.TextMeshProUGUILocalize: text from TableLocalize[localizeKey] */
function localizeTree(root) {
  for (const g of root.walk()) for (const sc of g.scripts || []) if (sc.script.endsWith('TextMeshProUGUILocalize') && sc.f?.localizeKey) g.uiText = Tables.loc(sc.f.localizeKey);
}

export class UIManager {
  constructor() {
    this.popups = [];          // {name, root, onClick, closeLock}
    this.canvas = { w: 1080, h: 2160 };
    this.fade = null;          // {a, from, to, t, time}
    this.joy = { active: false, bg: [0, 0], handle: [0, 0], radius: 128 };
  }
  resize(sw, sh) { this.canvas = canvasSize(sw, sh); }

  /** UICanvas (UIWorldMainView): world HUD. Joystick is drawn by this class; dungeon/title branches stay off. */
  async initHUD() {
    setLayoutAssets(G.assets);
    const json = await loadPrefab('prefab/ui/uicanvas');
    const root = instantiate(json, G.assets);
    await preloadUISprites(root);
    this.hudRoot = root;
    this.hud = findGo(root, 'SafeArea');
    for (const p of ['SafeArea/Hide/Variable Joystick', 'SafeArea/Hide/Dungeon', 'UITitle', 'TempBG', 'SafeArea/Warn']) root.find(p)?.setActive(false);
    this.hudFind = n => findGo(this.hud, n);
    localizeTree(root);
    bindUIAnim(root);
    this.hudAnims = root.getInChildren(Animator);
    for (const a of this.hudAnims) { a.awake?.(); }
  }
  /** HUD animators (quest clear shine, fingers, bottom tab) */
  updateHUD(dt) {
    for (const a of this.hudAnims || []) if (a.go.activeInHierarchy !== false) a.update(dt);
    for (const p of this.popups) for (const a of p.anims || []) if (a.go.activeInHierarchy !== false) a.update(dt);
  }

  async openPopup(path, setup) {
    const designUrl = G.uiDesign?.prefabs?.[path];
    const json = designUrl ? await fetch(designUrl).then(r => { if (!r.ok) throw new Error('UI layout ' + r.status); return r.json(); }) : await loadPrefab(path);
    const root = instantiate(json, G.assets);
    await preloadUISprites(root);
    localizeTree(root);
    bindUIAnim(root);
    const p = { root, path, onClick: null, closeLock: false, anims: root.getInChildren(Animator) };
    setup?.(p, n => findGo(root, n));
    this.popups.push(p);
    return p;
  }
  close(p) { const i = this.popups.indexOf(p); if (i >= 0) this.popups.splice(i, 1); p.onClose?.(); }
  /** a popup that takes the input (everything but toasts and the prologue talk) */
  hasModal() { return this.popups.some(p => p.kind !== 'toast' && p.kind !== 'prologue'); }
  /** a full-screen window (not a toast / talk / dialog / ok-cancel box): the main view's Inner HUD is hidden under it */
  hasWindow() { return this.popups.some(p => !['toast', 'prologue', 'dialog', 'okcancel'].includes(p.kind)); }

  /** UIProloguePopupView: typewriter (1 char/frame), then 5 s and RemoveTypePopup */
  async prologueTalk(talkKey, icon) {
    const token = this._talkToken = (this._talkToken || 0) + 1;
    const text = Tables.loc(talkKey);
    await G.assets.preloadSprites([icon]);
    if (token !== this._talkToken) return;
    for (const q of this.popups.filter(q => q.kind === 'prologue')) { Timing.Kill(q.h); this.close(q); }
    const p = await this.openPopup('prefab/ui/popup/uiprologuepopup', (p, f) => {
      p.kind = 'prologue';
      f('Icon').uiSprite = icon;
      p.textGo = f('Text (TMP)');
      p.textGo.uiText = '';
    });
    if (token !== this._talkToken) { this.close(p); return; }
    const self = this;
    p.h = Timing.RunCoroutine((function* () {
      for (let i = 0; i < text.length; i++) { p.textGo.uiText = text.slice(0, i + 1); yield -Infinity; }
      yield 5;
      self.close(p);
    })(), null);
  }

  /** UIToastPopup: text at the upper screen, fades out (UIManager.ShowToast) */
  async toast(text) {
    for (const q of this.popups.filter(q => q.kind === 'toast')) this.close(q);
    const p = await this.openPopup('prefab/ui/toast/uitoastpopup', (p, f) => { p.kind = 'toast'; f('Text (TMP)').uiText = text; });
    const self = this, img = findGo(p.root, 'Image');
    Timing.RunCoroutine((function* () { yield 1.5; for (let t = 0; t < 0.3; t += Timing.deltaTime) { img.uiAlpha = 1 - t / 0.3; yield -Infinity; } self.close(p); })(), null);
  }

  /** UIOkCancelPopup (OpenOkCancelPopup): title + message, resolves true on 확인 and false on 취소 / outside */
  confirm(title, message) {
    return new Promise(async res => {
      const p = await this.openPopup('prefab/ui/popup/uiokcancelpopup', p => {
        p.kind = 'okcancel';
        const f = path => p.root.find(path);
        f('SafeArea/InnerFrame/TopFrame/Text (TMP)').uiText = title;
        f('SafeArea/InnerFrame/Text (TMP)').uiText = message;
        f('SafeArea/InnerFrame/UIADSkipPackage')?.setActive(false);
      });
      p.onClick = hit => {
        const n = hit?.name;
        if (n === 'Ok') { this.close(p); res(true); } else if (n === 'Cancel' || !hit) { this.close(p); res(false); }
      };
    });
  }

  /** UIDialogPopupView (tutorial DIALOG steps): typewriter, tap to close -> UserTutorial.PlayNextStep */
  async dialog(talkKey, unitKey, onClose) {
    const text = Tables.loc(talkKey);
    const u = Tables.unit(unitKey);
    const icon = u ? (u.icon || `${u.prefab}_Icon`) : null;
    if (icon) await G.assets.preloadSprites([icon]);
    const p = await this.openPopup('prefab/ui/popup/uidialogpopup', (p, f) => {
      p.kind = 'dialog';
      if (icon) f('Icon').uiSprite = icon;
      const nt = f('NameText'); if (nt) nt.uiText = u ? Tables.loc(u.name) : '';
      p.textGo = f('Text (TMP)'); p.textGo.uiText = '';
      p.closeLock = true;
      p.onClose = onClose;
    });
    p.onClick = () => { if (!p.closeLock) this.close(p); };
    Timing.RunCoroutine((function* () {
      for (let i = 0; i < text.length; i++) { p.textGo.uiText = text.slice(0, i + 1); yield -Infinity; }
      p.closeLock = false;
    })(), null);
    return p;
  }

  /** UIFadePopup.Initialize(time, onMiddle, onEnd): black fade in, callback, fade out */
  fadePopup(time, onMiddle, onEnd) {
    const self = this;
    Timing.RunCoroutine((function* () {
      let t = 0;
      while (t < time) { t += Timing.deltaTime; self.fade = Math.min(1, t / time); yield -Infinity; }
      self.fade = 1; onMiddle?.(); yield -Infinity;
      t = 0;
      while (t < time) { t += Timing.deltaTime; self.fade = 1 - Math.min(1, t / time); yield -Infinity; }
      self.fade = 0; onEnd?.();
    })(), null);
  }

  // ---------------------------------------------------------- input (canvas units, origin bottom-left)
  /** OpenFadeSoftPopup / EndSoftMask: tween the black screen alpha to `to` over `time` seconds */
  fadeTo(to, time) {
    return new Promise(res => Timing.RunCoroutine((function* (self) {
      const from = self.fade || 0; let t = 0;
      while (t < time) { t += Timing.deltaTime; self.fade = from + (to - from) * Math.min(1, t / time); yield -Infinity; }
      self.fade = to; res();
    })(this), null));
  }

  pointerDown(x, y) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      if (p.kind === 'prologue') continue;
      const rects = layoutTree(p.root, 0, 0, this.canvas.w, this.canvas.h);
      const hit = hitTest(p.root, rects, x, y);
      // inside a ScrollRect the tap waits for pointerUp: a drag scrolls instead of clicking
      const sr = scrollAt(p.root, rects, x, y);
      if (sr || p.onDrag) { this.drag = { p, hit, sr, x, y, moved: 0 }; return true; }
      if (hit || p.kind === 'dialog') { if (hit?.scripts.some(s => s.script.endsWith('UIButtonBase'))) G.Sound.play('SOUND_BTN_0001'); p.onClick?.(hit); return true; }
      if (p.kind !== 'toast') return true;   // full-screen popups are modal
    }
    if (this.hud) {
      const rects = layoutTree(this.hud, 0, 0, this.canvas.w, this.canvas.h);
      const hit = hitTest(this.hud, rects, x, y);
      if (hit && hit.scripts.some(s => s.script.endsWith('UIButtonBase'))) G.Sound.play('SOUND_BTN_0001');   // UIButtonBase.OnPointerClick
      if (hit && G.HUD?.click(hit)) return true;
    }
    // VariableJoystick (Floating): background appears at the touch point
    if (!G.HeroManager.control) return false;
    this.joy.active = true; this.joy.bg = [x, y]; this.joy.handle = [x, y];
    G.HeroManager.Joystick.isPointDown = true;
    G.HeroManager.Joystick.Direction = [0, 0];
    return true;
  }
  /** mouse wheel over a popup ScrollRect */
  wheel(x, y, dy) {
    const p = this.popups.filter(q => q.kind !== 'toast' && q.kind !== 'prologue').at(-1);
    if (!p) return false;
    if (p.onWheel) { p.onWheel(dy); return true; }
    const rects = layoutTree(p.root, 0, 0, this.canvas.w, this.canvas.h);
    const sr = scrollAt(p.root, rects, x, y);
    if (sr) scrollBy(sr, rects, 0, dy);
    return !!sr;
  }
  pointerMove(x, y) {
    if (this.drag) {
      const d = this.drag, rects = layoutTree(d.p.root, 0, 0, this.canvas.w, this.canvas.h);
      d.moved += Math.abs(x - d.x) + Math.abs(y - d.y);
      if (d.sr) scrollBy(d.sr, rects, x - d.x, y - d.y);
      else d.p.onDrag?.(x - d.x, y - d.y, rects);
      d.x = x; d.y = y;
      return;
    }
    if (!this.joy.active) return;
    const r = this.joy.radius;
    let dx = (x - this.joy.bg[0]) / r, dy = (y - this.joy.bg[1]) / r;
    const L = Math.hypot(dx, dy);
    if (L > 1) { dx /= L; dy /= L; }                     // handleRange 1, deadZone 0
    this.joy.handle = [this.joy.bg[0] + dx * r, this.joy.bg[1] + dy * r];
    G.HeroManager.Joystick.Direction = [dx, dy];
  }
  pointerUp() {
    if (this.drag) {
      const d = this.drag; this.drag = null;
      if (d.moved < 15) {   // a tap, not a drag: deliver the click now
        if (d.hit?.scripts.some(s => s.script.endsWith('UIButtonBase'))) G.Sound.play('SOUND_BTN_0001');
        d.p.onClick?.(d.hit);
      } else d.p.onDragEnd?.();
      return;
    }
    this.joy.active = false;
    G.HeroManager.Joystick.isPointDown = false;
    G.HeroManager.Joystick.Direction = [0, 0];
  }
  releaseJoystick() { this.pointerUp(); }

  draw(renderer) {
    const { w, h } = this.canvas;
    if (this.joy.active && G.HeroManager.control) {
      const [bx, by] = this.joy.bg, [hx, hy] = this.joy.handle;
      const skin = G.uiDesign?.gameplay?.joystick;
      const radius = skin?.radius ?? 128, handle = skin?.handleRadius ?? 64;
      const c = [1, 1, 1, skin?.alpha ?? 0.40392157];
      drawImage(renderer, G.assets, 'AllAxis_Outline', bx - radius, by - radius, radius * 2, radius * 2, { color: c, layer: 30 });
      drawImage(renderer, G.assets, 'Handle_Plain', hx - handle, hy - handle, handle * 2, handle * 2, { color: c, layer: 30, order: 1 });
    }
    if (this.hud) {
      const rects = layoutTree(this.hud, 0, 0, w, h);
      drawUI(renderer, G.assets, this.hud, rects, { layer: 29, order: 0 });
    }
    let order = 10;
    for (const p of this.popups) {
      const rects = layoutTree(p.root, 0, 0, w, h);
      order = drawUI(renderer, G.assets, p.root, rects, { layer: 31, order });
    }
    if (this.fade > 0) renderer.draw({ x: 0, y: 0, w, h, px: 0, py: 0, u0: 0, v0: 0, u1: 1, v1: 1, r: 0, g: 0, b: 0, a: this.fade, layer: 40, order: 0, sortY: -1e9 });
  }
}
