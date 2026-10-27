// Enums from dump.cs (values verified against TypeDefIndex constants).
export const UNIT_STATE = { IDLE: 0, MOVE: 1, ACTION: 2, DEAD: 3, RETURN_BASE: 4, TOWN: 5, TELEPORT: 6 };
export const TEAM = { PLAYER: 0, ENEMY: 1, PREVIEW: 2, PREVIEW_MONSTER: 3 };
export const ACTOR_TYPE = { NONE: -1, UNIT: 0, RESOURCE: 1, BUILDING: 2 };
export const SKILL_TARGET_TYPE = {
  NONE: 0, MINE: 1, TEAM: 2, ENEMY: 4, RESOURCE: 8, BUILDING: 16, STR: 32, DEX: 64, INT: 128, DEAD: 65536,
};
export const TARGET_SORT_TYPE = { DIST: 0, HP: 1, HP_RATE: 2, RANDOM: 3, DMG: 4 };
export const COMPARE_TYPE = { GREATER: 1, EQUAL: 2, GREATER_EQUAL: 3, LOWER: 4, GREATER_LOWER: 5, LOWER_EQUAL: 6 };
export const SELECT_TYPE = { OR: 0, AND: 1 };
export const SKILL_TYPE = {
  ATTACK: 0, BULLET: 1, TAUNT: 2, HEAL: 3, SKILL: 4, ATTRACT: 5, BUFF: 6, JUMP: 7, AIRBORNE: 8, DASH: 9, KNOCKBACK: 10,
  CC: 11, CLEAR_CC: 12, ATTACK_RATE: 13, RESURRECTION: 14, SHIELD: 15, TRUE_ATTACK: 16, BUFF_TARGET: 17,
};
export const CAST_TYPE = { INSTANT: 0, CASTING: 1, CHANNELING: 2, AOE: 3, AOE_TARGET: 4, AOE_TARGET_EXPAND: 5 };
export const ORDER_TYPE = { INSTANT: 0, IN_ORDER: 1, RANDOM: 2, LIST: 3, F_ONCE: 4 };
export const CONDITION_TYPE = {
  ATTACK_COUNT: 0, DAMAGE_COUNT: 1, DIST: 2, BLEEDING: 3, POISON: 4, BURN: 5, CURSE: 6, FROSTBITE: 7, FROZEN: 8,
  STUN: 9, BONDAGE: 10, EVASION: 11, CRITICAL: 12, HP_RATE: 13, DEAD_COUNT: 14, SELF_DEAD: 15, ADD_BURN: 16,
  ADD_POISON: 17, ADD_FROSTBITE: 18, ADD_BLEEDING: 19,
};
// RangeData.startPos flags (byte @0x20 of TableRangeDataData)
export const START_POS = { MINE: 1, MINE_CENTER: 2, TARGET: 4, MINE_FRONT: 8, MINE_BACK: 16, TARGET_FRONT: 32, GIVEN: 64 };
export const RANGE_TYPE = { CIRCLE: 0, BOX: 1 };
export const PIVOT_TYPE = { CENTER: 0, PIVOT: 1 };
export const ELITE_TYPE = { NORMAL: 0, ELITE: 1, CHAMPION: 2, HERO: 3, BOSS: 4 };

/** Table rows store enums as strings; resolve to the int value. */
export function E(map, v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return 0;
  if (v in map) return map[v];
  // flags joined with ', ' (C# [Flags] ToString)
  if (typeof v === 'string' && v.includes(',')) return v.split(',').reduce((a, s) => a | (map[s.trim()] || 0), 0);
  return 0;
}
