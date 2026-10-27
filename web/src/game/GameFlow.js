// UserTutorial / TutorialData runner and the prologue -> World_1 transition (HeroManager.CorDefeat @0x1e5b370).
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { Timing } from './core/Timing.js';
import { TEAM } from './defs.js';
import { resurrectHero } from './world/Bonfire.js';

const TYPE = { DIALOG: 'DIALOG', FOCUS: 'FOCUS', REWARD: 'REWARD', EVENT: 'EVENT', WAIT_EVENT: 'WAIT_EVENT' };

export class UserTutorial {
  constructor() { this.completed = new Set(); this.cur = null; this.events = new Set(); }
  IsPlaying() { return !!this.cur; }
  /** CheckTutorial(condition): start the first not-completed group with this condition */
  CheckTutorial(cond) {
    if (this.cur) return false;
    const g = Object.values(Tables.t.TableTutorialGroup).find(r => r.tutorialCondition === cond && !this.completed.has(r.key));
    if (!g) return false;
    this.cur = { g, step: -1 };
    this.PlayNextStep();
    return true;
  }
  PlayNextStep() {
    const c = this.cur; if (!c) return;
    c.step++;
    const key = c.g.tutorials[c.step];
    if (!key) { this.completed.add(c.g.key); this.cur = null; G.GameState.send('TUTORIAL_END', c.g.key); return; }
    const t = Tables.get('TableTutorial', key);
    Timing.RunCoroutine((function* (self) { yield -Infinity; self._play(t); })(this), null);
  }
  /** TutorialData.Play @0x1d536f0 */
  _play(t) {
    switch (t.tutorialType) {
      case TYPE.DIALOG: G.UI.dialog(t.talkStr, t.talkUnit, () => this.PlayNextStep()); break;
      case TYPE.REWARD: G.Inventory.add(t.rewardKey, t.rewardAmount); this.PlayNextStep(); break;
      case TYPE.FOCUS: G.UI.focus?.(t.EventKey, () => this.PlayNextStep()) ?? this.PlayNextStep(); break;
      case TYPE.EVENT: G.GameState.send(t.EventKey); break;
      case TYPE.WAIT_EVENT:
        if (this.events.has(t.EventKey)) { this.events.delete(t.EventKey); this.PlayNextStep(); }
        else this.waiting = t.EventKey;
        break;
    }
  }
  /** OnEvent: a WAIT_EVENT step continues when its key arrives */
  OnEvent(msg) {
    if (this.waiting === msg) { this.waiting = null; this.PlayNextStep(); }
    else if (this.cur) this.events.add(msg);
  }
}

export class GameFlow {
  constructor() {
    this.defeat = false;
    G.GameState.on((msg) => {
      G.Tutorial.OnEvent(msg);
      // UIWorldRunState.OnEvent @0x25a8xxx: leader agent stop/resume + Animator.Play(DIE_HASH / IDLE_HASH)
      const lead = G.UnitManager.LeaderHero;
      if (msg === 'HERO_DIE_ANIM') {
        if (lead) { lead.Body.agent && (lead.Body.agent.isStopped = true); lead.Body.animator.play('Die'); }
        G.Tutorial.PlayNextStep();
      } else if (msg === 'HERO_IDLE_ANIM') {
        if (lead) { lead.Body.agent && (lead.Body.agent.isStopped = false); lead.Body.animator.play('Idle'); }
        G.Tutorial.PlayNextStep();
      }
    });
  }

  /** HeroManager.DefeatStart -> CorDefeat */
  update() {
    const HM = G.HeroManager;
    if (this.defeat || !HM.control || HM.IsCamp || HM.GetHeroCount() !== 0) return;
    this.defeat = true;
    this.corDefeat();
  }

  async corDefeat() {
    const HM = G.HeroManager;
    HM.Control = false;
    G.UI.releaseJoystick();
    if (G.User.isPrologue) {
      await wait(1.5);
      G.Tutorial.CheckTutorial('PROLOGUE_END');
      await until(() => !G.Tutorial.IsPlaying());
      await wait(0.5);
      // UserDataManager.ClearPrologue: party reset to Unit000001, HeroMax = Define_DEFAULT_HERO_COUNT
      G.User.isPrologue = false;
      G.User.instantInvincibility = false;
      G.User.heroMax = Tables.define('DEFAULT_HERO_COUNT');
      G.Inventory.items.clear();
      G.UserData.Level = 0; G.UserData.Exp = 0;   // User.ClearPrologue
      G.Quest.SetQuest('Quest000000');           // UserQuest.ClearPrologue
      await G.UI.fadeTo(1, 0.5);                 // OpenFadeSoftPopup
      await wait(0.5);
      G.UserHero.datas.clear(); G.UserHero.AddHero('Unit000001');   // UserHero.ClearPrologue
      await G.loadWorld('World_1', [{ key: 'Unit000001', level: 0 }]);   // MapManager.Initialize
      G.Tutorial.CheckTutorial('GAME_START');
      await wait(0.3);
      await G.UI.fadeTo(0, 0.8);                 // EndSoftMask
      G.GameState.send('WAIT_FADE');
      await until(() => !G.Tutorial.IsPlaying());
      HM.Control = true;
      this.defeat = false;
      return;
    }
    // world defeat: OpenDefeatPopup ("터치하여 마을에서 부활하기") -> OpenFadeSoftPopup -> back to the bonfire, everyone revived
    await wait(1.5);
    await new Promise(res => G.UI.openPopup('prefab/ui/popup/uidefeatpopup', (p, f) => {
      p.kind = 'dialog';
      f('UIADSkipPackage (5)')?.setActive(false);
      f('Contents')?.setActive(false);
      p.onClick = () => { G.UI.close(p); res(); };
    }));
    await G.UI.fadeTo(1, 0.5);
    const town = G.Bonfires.list.find(b => b.key === 'WorldBuilding000001') || G.Bonfires.list[0];
    const pos = town ? [town.pos[0] + 1, town.pos[1] - 1] : G.MapManager.GetStartPosition();
    G.HeroManager.transform.position = [...pos];
    G.CameraManager.position = [...pos];
    for (const u of [...G.HeroManager.DeadHeroes]) { resurrectHero(u, 1); u.WarpHero(pos[0], pos[1]); }
    await wait(0.3);
    await G.UI.fadeTo(0, 0.8);
    HM.Control = true;
    this.defeat = false;
  }
}

function wait(s) { return new Promise(res => Timing.RunCoroutine((function* () { yield s; res(); })(), null)); }
function until(fn) { return new Promise(res => Timing.RunCoroutine((function* () { yield { until: fn }; res(); })(), null)); }
