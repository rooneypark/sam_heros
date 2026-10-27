// PrologueManager.OnEvent @0x23676d4 + GameStateManager/UIStateManager message routing.
import { G } from '../registry.js';
import { Timing, waitFrame } from '../core/Timing.js';
import { CameraManager } from './HeroManager.js';

export class GameState {
  constructor() { this.handlers = []; }
  on(fn) { this.handlers.push(fn); }
  send(msg, ...args) { for (const h of this.handlers) h(msg, ...args); }
}

export class PrologueManager {
  constructor() {
    this.MonsterKill = 0;
    this.PricessNpc = null;
    this.touch = false;
    this.anim = false;
    this.maxDist = 25;
    this.logs = [];
  }
  PrologueLog(i) { this.logs.push(i); }

  async OnEvent(msg, a, b, c) {
    const HM = G.HeroManager, UI = G.UI;
    const f = s => parseFloat(s);
    switch (msg) {
      case 'DIALOG_POPUP': UI.prologueTalk(a, b); break;
      case 'TELEPORT_BOSSROOM': {
        G.Sound?.bgm('BGM_0001');
        UI.releaseJoystick();
        const x = f(a), y = f(b);
        waitFrame(2, () => UI.fadePopup(0.5, () => {
          G.UnitManager.WarpHero(x, y);
          G.CameraManager.position = HM.GetHeroCenterPos();
        }, () => { HM.Control = true; }));
        break;
      }
      case 'CREATE_PRINCESS': this.princess = await G.Npc?.spawn('NPC_Princess', f(a), f(b)); break;
      case 'CREATE_PRINCESS_MOVE': this.PricessNpc = await G.Npc?.spawn('NPC_Princess_2', f(a), f(b)); break;
      case 'MOVE_PRINCESS': {
        const npc = this.PricessNpc; if (!npc) break;
        const x = f(a), y = f(b);
        const self = this;
        Timing.RunCoroutine((function* () {
          npc.agent.isStopped = false; npc.agent.setDestination(x, y);
          yield -Infinity;
          while (npc.agent.remainingDistance > 0.5) yield -Infinity;
          G.Npc.despawn(npc); self.PricessNpc = null; self.anim = false; self.touch = true;
        })(), null);
        break;
      }
      case 'MOVE_TUTORIAL_START': {
        this.maxDist = HM.MaxDist; HM.MaxDist = 1;
        const x = f(a), y = f(b);
        Timing.RunCoroutine((function* () { for (;;) { HM.FlagEffect([x, y], 3); yield 1; } })(), null, 'TAG_MOVE_TUTORIAL');
        break;
      }
      case 'MOVE_TUTORIAL_END': HM.MaxDist = this.maxDist; Timing.KillTag('TAG_MOVE_TUTORIAL'); break;
      case 'INVINCIBILITY_OFF': G.User.instantInvincibility = false; break;
      case 'ADD_HERO': {
        const u = await G.UnitManager.CreateHero(a, 0x3b);
        u.WarpHero(f(b), f(c));
        break;
      }
      case 'MOVE_CAMERA_TARGET': this.moveCameraTarget(f(a), f(b)); break;
    }
  }

  /** CorMoveCameraTarget @0x2368c6c */
  async moveCameraTarget(x, y) {
    const HM = G.HeroManager, cam = G.CameraManager;
    HM.Control = false;
    G.UI.releaseJoystick(); G.UI.joystickHidden = true;
    await cam.CameraMoveZoom([x, y], CameraManager.DEFAULT_CAMERA, 0.75);
    G.MapManager.SetCurrentMapActive([x, y]);
    this.touch = false;
    await new Promise(res => { const t = setInterval(() => { if (this.touch) { clearInterval(t); res(); } }, 16); });
    await cam.CameraMoveZoom(HM.transform.position, CameraManager.DEFAULT_CAMERA, 0.75);
    HM.Control = true;
    G.UI.joystickHidden = false;
  }
  /** Update @0x23684f4: a touch while no animation sets `touch` */
  onTouch() { if (!this.anim) this.touch = true; }
}
