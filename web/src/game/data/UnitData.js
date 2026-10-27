// Port of struct UnitData (TypeDefIndex 306) + CCStat (305).
// Sources: UnitData$$GetStat @0x3b76a30, GetData @0x3b77084, GetCC @0x3b76f20, SetDamage @0x3b774b8,
//          op_Addition @0x3b77134, CCStat$$GetCC @0x3b7657c, CCStat$$AddCC @0x3b76490.

export const UNIT_STAT = {
  NONE: -1, HP: 0, DAMAGE: 1, SPEED: 2, ATTACK_SPEED: 3, DETECT_UNIT_RANGE: 4, DETECT_RESOURCE_RANGE: 5, ARMOR: 6,
  DEFENCE: 7, TAUNT: 8, CRITICAL_RATE: 9, EVASION_RATE: 10, CRITICAL_DAMAGE: 11, TREE_DAMAGE: 12, STONE_DAMAGE: 13,
  VAMPIRIC: 14, COOL_TIME: 15, SHIELD: 16, IMMUNE_SLOW: 17, IMMUNE_STUN: 18, IMMUNE_BONDAGE: 19, IMMUNE_FROZEN: 20,
  IMMUNE_AIR: 21, IMMUNE_KNOCK: 22, INVINCIBILITY: 23, BLD_DMG: 24, BLD_ARMOR: 25, FST_DMG: 26, FST_ARMOR: 27,
  BRN_DMG: 28, BRN_ARMOR: 29, PSN_DMG: 30, PSN_ARMOR: 31, THORN: 32, BS_DMG: 33, ALL_ARMOR: 34, ATTACK_RATE: 35,
  IMMUNE_CRITICAL: 36, IMMUNE_BURN: 37, IMMUNE_BLEEDING: 38, IMMUNE_CURSE: 39, IMMUNE_POISON: 40,
};

export const CC_TYPE = {
  NONE: 0, BLEEDING: 256, POISON: 512, BURN: 1024, CURSE: 2048, FROSTBITE: 4096, FROZEN: 8192, STUN: 16384, BONDAGE: 32768,
};

const EPS = Math.fround(0.001);
const clamp01 = v => (v < 0 ? 0 : Math.min(v, 1));

export class CCStat {
  constructor() {
    this.CcType = 0;
    this.Bleeding = 0; this.Poison = 0; this.Burn = 0; this.Curse = 0;
    this.Frostbite = 0; this.Frozen = 0; this.Stun = 0; this.Bondage = 0;
  }
  clone() { return Object.assign(new CCStat(), this); }
  static field(t) {
    switch (t) {
      case CC_TYPE.BLEEDING: return 'Bleeding';
      case CC_TYPE.POISON: return 'Poison';
      case CC_TYPE.BURN: return 'Burn';
      case CC_TYPE.CURSE: return 'Curse';
      case CC_TYPE.FROSTBITE: return 'Frostbite';
      case CC_TYPE.FROZEN: return 'Frozen';
      case CC_TYPE.STUN: return 'Stun';
      case CC_TYPE.BONDAGE: return 'Bondage';
      default: return null;
    }
  }
  AddCC(t, v) {
    if ((t & ~this.CcType) !== 0) this.CcType += t;
    const f = CCStat.field(t);
    if (f) this[f] += v;
  }
  GetCC(t) {
    if (t === CC_TYPE.CURSE) { const s = 1 - this.Curse; return s < 0 ? 0 : Math.min(s, 1); }
    const f = CCStat.field(t);
    return f ? this[f] : 0;
  }
}

const FIELDS = ['CurrentHP', 'MaxHP', 'Speed', 'Damage', 'AttackSpeed', 'AttackRate', 'DetectUnitRange',
  'DetectResourceRange', 'Armor', 'Defence', 'Taunt', 'CriticalRate', 'CriticalDamage', 'EvasionRate', 'TreeDamage',
  'StoneDamage', 'Vampiric', 'CoolTime', 'Shield', 'ImmuneSlow', 'ImmuneStun', 'ImmuneBondage', 'ImmuneFrozen',
  'immuneBurn', 'immunePoison', 'immuneBleeding', 'immuneCurse', 'immuneCritical', 'bldDmg', 'bldArmor', 'fstDmg',
  'fstArmor', 'brnDmg', 'brnArmor', 'psnDmg', 'psnArmor', 'allArmor', 'thorn', 'bsDmg'];

export class UnitData {
  constructor() {
    for (const f of FIELDS) this[f] = 0;
    this.InstantStop = false; this.Invincibility = false;
    this.immuneAir = false; this.immuneKnock = false;
    this.CcStat = new CCStat();
    this.LootResource = 0; this.LootAmount = 0; this.EliteType = 'NORMAL';
  }

  /** UnitData(TableUnitStatData) ctor @0x3b76688 (note: _invincibility is NOT copied). */
  static fromTable(t) {
    const u = new UnitData();
    if (!t) return u;
    u.CurrentHP = t.hp; u.MaxHP = t.hp; u.Speed = t.speed; u.Damage = t.damage; u.AttackSpeed = t.attackSpeed;
    u.DetectUnitRange = t.detectUnitRange; u.DetectResourceRange = t.detectResourceRange;
    u.LootResource = t.lootResource; u.LootAmount = t.lootAmount;
    u.CriticalRate = t.criticalRate; u.CriticalDamage = t.criticalDamage; u.EvasionRate = t.evasionRate;
    u.ImmuneSlow = t.immuneSlow; u.ImmuneStun = t.immuneStun; u.ImmuneBondage = t.immuneBondage; u.ImmuneFrozen = t.immuneFrozen;
    u.immuneBurn = t.immuneBurn; u.immunePoison = t.immunePoison; u.immuneBleeding = t.immuneBleeding; u.immuneCurse = t.immuneCurse;
    u.Armor = t.armor; u.Defence = t.defence; u.Vampiric = t.vampiric;
    u.bldArmor = t.bldArmor; u.fstArmor = t.fstArmor; u.brnArmor = t.brnArmor; u.psnArmor = t.psnArmor; u.allArmor = t.allArmor;
    u.immuneAir = !!t.immuneAir; u.immuneKnock = !!t.immuneKnock;
    u.AttackRate = t.attackRate; u.immuneCritical = t.immuneCritical;
    return u;
  }

  /** AddStat @0x3b767b8 */
  AddStat(s, v) {
    const map = {
      0: 'MaxHP', 1: 'Damage', 2: 'Speed', 3: 'AttackSpeed', 4: 'DetectUnitRange', 5: 'DetectResourceRange', 6: 'Armor',
      7: 'Defence', 8: 'Taunt', 9: 'CriticalRate', 10: 'EvasionRate', 11: 'CriticalDamage', 12: 'TreeDamage',
      13: 'StoneDamage', 14: 'Vampiric', 15: 'CoolTime', 16: 'Shield', 17: 'ImmuneSlow', 18: 'ImmuneStun',
      19: 'ImmuneBondage', 20: 'ImmuneFrozen', 24: 'bldDmg', 25: 'bldArmor', 26: 'fstDmg', 27: 'fstArmor', 28: 'brnDmg',
      29: 'brnArmor', 30: 'psnDmg', 31: 'psnArmor', 32: 'thorn', 33: 'bsDmg', 34: 'allArmor', 35: 'AttackRate',
      36: 'immuneCritical',
    };
    if (s === 23) { this.Invincibility = v > 0; return; }
    const f = map[s];
    if (f) this[f] += v;
  }

  clone() {
    const u = Object.assign(new UnitData(), this);
    u.CcStat = this.CcStat.clone();
    return u;
  }

  /** op_Addition: numeric fields summed; bools OR'd (immuneAir/immuneKnock/Invincibility); CcType OR'd. */
  static add(a, b) {
    const r = a.clone();
    for (const f of FIELDS) r[f] = a[f] + b[f];
    r.immuneAir = a.immuneAir || b.immuneAir;
    r.immuneKnock = a.immuneKnock || b.immuneKnock;
    r.Invincibility = a.Invincibility || b.Invincibility;
    const c = r.CcStat;
    c.CcType = a.CcStat.CcType | b.CcStat.CcType;
    for (const f of ['Bleeding', 'Poison', 'Burn', 'Curse', 'Frostbite', 'Frozen', 'Stun', 'Bondage']) c[f] = a.CcStat[f] + b.CcStat[f];
    return r;
  }

  _curseMul() { return Math.min(1, this.immuneCurse + clamp01(1 - this.CcStat.Curse)); }

  GetStat(s) {
    const S = UNIT_STAT, c = this.CcStat;
    switch (s) {
      case S.HP: return this.MaxHP * this._curseMul();
      case S.DAMAGE: return this.Damage * this._curseMul();
      case S.SPEED: {
        if (Math.max(c.Bondage - this.ImmuneBondage, 0) > EPS) return 0;
        if (Math.max(c.Frozen - this.ImmuneFrozen, 0) > EPS) return 0;
        const f = 1 - Math.max(c.Frostbite - this.ImmuneSlow, 0);
        return (f < 0 ? 0 : Math.min(f, 1)) * this.Speed;
      }
      case S.ATTACK_SPEED: {
        let m = 0;
        if (!(Math.max(c.Frozen - this.ImmuneFrozen, 0) > EPS)) {
          const f = 1 - Math.max(c.Frostbite - this.ImmuneSlow, 0);
          m = f < 0 ? 0 : Math.min(f, 1);
        }
        return Math.max(this.AttackSpeed * m, Math.fround(0.1));
      }
      case S.DETECT_UNIT_RANGE: return this.DetectUnitRange * this.DetectUnitRange;
      case S.DETECT_RESOURCE_RANGE: return this.DetectResourceRange * this.DetectResourceRange;
      case S.ARMOR: return this.Armor;
      case S.DEFENCE: return this.Defence;
      case S.TAUNT: return this.Taunt;
      case S.CRITICAL_RATE: return this.CriticalRate;
      case S.EVASION_RATE: return this.EvasionRate;
      case S.CRITICAL_DAMAGE: return this.CriticalDamage;
      case S.TREE_DAMAGE: return this.TreeDamage;
      case S.STONE_DAMAGE: return this.StoneDamage;
      case S.VAMPIRIC: return this.Vampiric;
      case S.COOL_TIME: return Math.min(this.CoolTime, 1);
      case S.SHIELD: return this.Shield;
      case S.IMMUNE_SLOW: return this.ImmuneSlow;
      case S.IMMUNE_STUN: return this.ImmuneStun;
      case S.IMMUNE_BONDAGE: return this.ImmuneBondage;
      case S.IMMUNE_FROZEN: return this.ImmuneFrozen;
      case S.BLD_DMG: return this.bldDmg;
      case S.BLD_ARMOR: return this.bldArmor + this.allArmor;
      case S.FST_DMG: return this.fstDmg;
      case S.FST_ARMOR: return this.fstArmor + this.allArmor;
      case S.BRN_DMG: return this.brnDmg;
      case S.BRN_ARMOR: return this.brnArmor + this.allArmor;
      case S.PSN_DMG: return this.psnDmg;
      case S.PSN_ARMOR: return this.psnArmor + this.allArmor;
      case S.THORN: return this.thorn;
      case S.BS_DMG: return this.bsDmg;
      case S.ATTACK_RATE: return this.AttackRate;
      case S.IMMUNE_CRITICAL: return this.immuneCritical;
      case S.IMMUNE_BURN: return this.immuneBurn;
      case S.IMMUNE_BLEEDING: return this.immuneBleeding;
      case S.IMMUNE_CURSE: return this.immuneCurse;
      case S.IMMUNE_POISON: return this.immunePoison;
      default: return 0;
    }
  }

  GetData(s) {
    switch (s) {
      case UNIT_STAT.DAMAGE: return this.Damage;
      case UNIT_STAT.SPEED: return this.Speed;
      case UNIT_STAT.ATTACK_SPEED: return this.AttackSpeed;
      case UNIT_STAT.COOL_TIME: return this.CoolTime;
      default: return 0;
    }
  }

  GetBoolData(s) { return s === UNIT_STAT.INVINCIBILITY ? !!this.Invincibility : false; }

  GetCC(t) {
    const c = this.CcStat;
    switch (t) {
      case CC_TYPE.POISON: return Math.max(c.Poison - this.immunePoison, 0);
      case CC_TYPE.FROZEN: return Math.max(c.Frozen - this.ImmuneFrozen, 0);
      case CC_TYPE.CURSE: return this._curseMul();
      case CC_TYPE.BONDAGE: return Math.max(c.Bondage - this.ImmuneBondage, 0);
      case CC_TYPE.BLEEDING: return Math.max(c.Bleeding - this.immuneBleeding, 0);
      case CC_TYPE.FROSTBITE: return Math.max(c.Frostbite - this.ImmuneSlow, 0);
      case CC_TYPE.BURN: return Math.max(c.Burn - this.immuneBurn, 0);
      case CC_TYPE.STUN: return Math.max(c.Stun - this.ImmuneStun, 0);
      default: return c.GetCC(t);
    }
  }

  SetDamage(dmg) {
    if (dmg > 0 && this.Shield > EPS) {
      const ns = this.Shield - dmg;
      const rem = dmg - this.Shield;
      this.Shield = ns < EPS ? 0 : ns;
      if (rem < EPS) return;
      this.CurrentHP -= rem;
      return;
    }
    this.CurrentHP -= dmg;
  }

  RestoreHp() { this.CurrentHP = this.MaxHP; }
  ClearHP() { this.CurrentHP = 0; this.Shield = 0; }
}

// UnitActor-level combinations (UnitActor$$GetStat @0x3c324ac, GetCC @0x3c3eb94, GetSlow @0x3c3f944).
// GetCC(type) on the actor combines base (UnitData) and buff (AddUnitData) layers with per-type immunity stats,
// reproducing the original mapping exactly (incl. BONDAGE->IMMUNE_BURN and BURN->IMMUNE_BLEEDING/IMMUNE_BONDAGE).
export function actorGetCC(base, add, t) {
  const S = UNIT_STAT;
  const pair = (a, b) => base.CcStat.GetCC(t) + add.CcStat.GetCC(t) - (base.GetStat(a) + add.GetStat(b));
  switch (t) {
    case CC_TYPE.STUN: return Math.max(pair(S.IMMUNE_STUN, S.IMMUNE_STUN), 0);
    case CC_TYPE.CURSE: return Math.min(base.CcStat.GetCC(t) + add.CcStat.GetCC(t) + base.GetStat(S.IMMUNE_CURSE) + add.GetStat(S.IMMUNE_CURSE), 1);
    case CC_TYPE.FROZEN: return Math.max(pair(S.IMMUNE_FROZEN, S.IMMUNE_FROZEN), 0);
    case CC_TYPE.POISON: return Math.max(pair(S.IMMUNE_POISON, S.IMMUNE_POISON), 0);
    case CC_TYPE.BONDAGE: return Math.max(pair(S.IMMUNE_BURN, S.IMMUNE_BURN), 0);
    case CC_TYPE.BURN: return Math.max(pair(S.IMMUNE_BLEEDING, S.IMMUNE_BONDAGE), 0);
    case CC_TYPE.FROSTBITE: return Math.max(pair(S.IMMUNE_SLOW, S.IMMUNE_SLOW), 0);
    case CC_TYPE.BLEEDING: return Math.max(pair(S.IMMUNE_BLEEDING, S.IMMUNE_BLEEDING), 0);
    default: return UnitData.add(base, add).GetCC(t);
  }
}

export function actorGetSlow(base, add) {
  if (actorGetCC(base, add, CC_TYPE.FROZEN) > EPS) return 0;
  const f = 1 - Math.max(actorGetCC(base, add, CC_TYPE.FROSTBITE), 0);
  return f < 0 ? 0 : Math.min(f, 1);
}

export function actorGetStat(base, add, s) {
  const S = UNIT_STAT;
  switch (s) {
    case S.HP: return (base.MaxHP + add.MaxHP) * actorGetCC(base, add, CC_TYPE.CURSE);
    case S.DAMAGE: return (base.GetData(1) + add.GetData(1)) * actorGetCC(base, add, CC_TYPE.CURSE);
    case S.SPEED:
      if (actorGetCC(base, add, CC_TYPE.BONDAGE) > EPS) return 0;
      return (base.GetData(2) + add.GetData(2)) * actorGetSlow(base, add);
    case S.ATTACK_SPEED: return Math.max((base.GetData(3) + add.GetData(3)) * actorGetSlow(base, add), Math.fround(0.1));
    case S.DETECT_UNIT_RANGE: { const r = base.DetectUnitRange + add.DetectUnitRange; return r * r; }
    case S.DETECT_RESOURCE_RANGE: { const r = base.DetectResourceRange + add.DetectResourceRange; return r * r; }
    case S.COOL_TIME: return Math.min(base.GetData(15) + add.GetData(15), 1);
    case S.SHIELD: return base.GetStat(16) + add.GetStat(16);
    case S.IMMUNE_CRITICAL: return base.GetStat(36) + add.GetStat(36);
    default: return UnitData.add(base, add).GetStat(s);
  }
}
