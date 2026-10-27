// UserQuest main quest chain (UserQuest.AddQuest @0x3958718, CompleteQuest @0x3958a20, NextQuest).
import { G } from './registry.js';
import { Tables } from './data/Tables.js';
import { Timing } from './core/Timing.js';

export class UserQuest {
  constructor() { this.SetQuest('Quest000000'); }
  /** QuestData(key, value, complete) */
  SetQuest(key) { this.current = key ? { key, value: 0, complete: false } : null; G.GameState?.send('Reset_Quest'); }
  get data() { return this.current ? Tables.get('TableQuest', this.current.key) : null; }
  IsComplete() { const d = this.data; return !!d && this.current.value >= d.questValue; }
  GetRate() { const d = this.data; return d ? Math.min(this.current.value / d.questValue, 1) : 0; }
  /** AddQuest(type, key, add): matching type and key (or empty key), capped at questValue */
  AddQuest(type, key, add = 1) {
    const d = this.data;
    if (!d || this.current.complete || d.questType !== type) return;
    if (d.questKey && d.questKey !== key) return;
    if (this.IsComplete()) return;
    this.current.value = Math.min(this.current.value + add, d.questValue);
    G.GameState?.send('Update_Quest');
  }
  /** CheckComplete: a BUILD quest whose building already exists completes at once */
  CheckComplete() {
    const d = this.data;
    if (d?.questType === 'BUILD' && G.Buildings?.built.has(d.questKey)) this.current.value = d.questValue;
  }
  /** CompleteQuest: reward (UtilCraft.GetReward), mark complete, NextQuest, SFX_0000, Reset_Quest, CheckComplete after 1 s */
  CompleteQuest() {
    const d = this.data;
    if (!d || this.current.complete || !this.IsComplete()) return false;
    if (d.rewardType && d.rewardValue) G.UserData.AddResource(d.rewardType, d.rewardValue);
    this.current.complete = true;
    this.SetQuest(d.nextKey || null);
    G.Sound?.play('SFX_0000');
    const self = this;
    Timing.RunCoroutine((function* () { yield 1; self.CheckComplete(); })(), null);
    return true;
  }
}
