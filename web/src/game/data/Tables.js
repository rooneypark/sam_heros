// PlayCore.Table.TableAccess equivalent over the exported table JSON (re/extract/tables).
const NAMES = [
  'TableUnit', 'TableUnitStat', 'TableUnitSkill', 'TableSkillGroup', 'TableSkill', 'TableSkillAction', 'TableRangeData',
  'TableEffect', 'TableSkillCondition', 'TableDefine', 'TableLocalize', 'TableBaseStat', 'TableLinkSkill', 'TableBullet',
  'TableTutorial', 'TableTutorialGroup', 'TableWorldBuilding', 'TableQuest', 'TableUserLevel', 'TableItem', 'TableWorld', 'TableDropItem', 'TableCC', 'TableUnitSkin', 'TableResource', 'TableBuilding', 'TableSound', 'TableGrowth', 'TablePub', 'TableTown', 'TableGlobalUpgrade', 'TableUpgradeStat', 'TableInstantQuest', 'TableInstantQuest_Reward', 'TableFame', 'TableContribution',
];

class TableAccess {
  async load(assets) {
    this.t = {};
    await Promise.all(NAMES.map(async n => { try { this.t[n] = await assets.table(n); } catch { this.t[n] = {}; } }));
    this.index();
  }
  /**
   * content-pack table changes: { TableName: { rowKey: { field: value, ... } } }. An existing row gets the listed
   * fields replaced, a new key adds a row (give every field). Returns the number of rows touched.
   */
  applyOverrides(ov) {
    let n = 0;
    for (const [table, rows] of Object.entries(ov || {})) {
      if (table.startsWith('_') || !rows || typeof rows !== 'object') continue;   // "_note" etc.
      const t = this.t[table] || (this.t[table] = {});
      for (const [key, patch] of Object.entries(rows)) {
        if (key.startsWith('_')) continue;
        t[key] = t[key] ? { ...t[key], ...patch } : { key, ...patch };
        n++;
      }
    }
    this.index();
    return n;
  }
  index() {
    // TableBaseStat by level: first row per level in dictionary order (GetTableBaseStatByLevel @0x3e015e4)
    this.baseByLevel = new Map();
    for (const r of Object.values(this.t.TableBaseStat)) if (!this.baseByLevel.has(r.level)) this.baseByLevel.set(r.level, r);
    this.baseLast = [...this.baseByLevel.values()].pop();
    this.unitSkillByCat = new Map();
    for (const r of Object.values(this.t.TableUnitSkill)) {
      let a = this.unitSkillByCat.get(r.category); if (!a) this.unitSkillByCat.set(r.category, a = []); a.push(r);
    }
    for (const a of this.unitSkillByCat.values()) a.sort((x, y) => x.level - y.level);
  }
  get(table, key) { return key ? this.t[table]?.[key] || null : null; }
  unit(k) { return this.get('TableUnit', k); }
  unitStat(k) { return this.get('TableUnitStat', k); }
  skill(k) { return this.get('TableSkill', k); }
  skillAction(k) { return this.get('TableSkillAction', k); }
  range(k) { return this.get('TableRangeData', k); }
  effect(k) { return this.get('TableEffect', k); }
  condition(k) { return this.get('TableSkillCondition', k); }
  skillGroup(k) { return this.get('TableSkillGroup', k); }
  baseStat(level) { return this.baseByLevel.get(level) || this.baseLast; }
  define(k, i = 0) { const r = this.get('TableDefine', 'Define_' + k); return r ? r.value[i] : 0; }
  defineList(k) { return this.get('TableDefine', 'Define_' + k)?.value || []; }
  loc(k) { const r = this.get('TableLocalize', k); return r ? r.ko : k; }
  linkSkill(skillKey) {
    for (const r of Object.values(this.t.TableLinkSkill)) if (r.prevSkill === skillKey) return r;
    return null;
  }
  /** UnitSkill row with the highest level <= unit level for the category */
  unitSkillFor(category, level) {
    const a = this.unitSkillByCat.get(category) || [];
    let best = a[0] || null;
    for (const r of a) if (r.level <= level) best = r;
    return best;
  }
}
export const Tables = new TableAccess();
