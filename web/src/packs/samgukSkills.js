// 삼국 장수 스킬 효과 (docs/planning/units/SG_U0001~3.md, 2026-10-28 최신 승인) — 실행용 연결.
// 동작(어떤 효과인지)은 기획 확정이고, 아래 숫자(배율·범위·대상 수·지속·쿨타임)는 전부 **개발 테스트값**이다.
// 기획 문서에 확정값으로 옮기지 않는다. units.json(디자이너 등록)은 그대로 두고 로드 시 skills 슬롯만 교체한다.
export const SKILL_TEST_VALUES = true;
// 2026-10-28 CHAPTER1_BALANCE.md 유지력 첫 검증안: 유비 단일 1.2배/8초, 전체 0.65배/18초, 장비 방어 +20·5초/16초.
// 발동 조건(전투 중·체력 임계치)은 chapter1/Chapter1.js skillAllowed.

const NO_FX = { startEffect: '', castEffect: '' };

/** id -> { slot: units.json skills[slot] 형식 } */
export const SAMGUK_SKILLS = {
  // 유비: A 가슴 앞 X자·단일 치유 / B 머리 위 X자·전체 치유
  SG_U0001: {
    skillA: { base: 'Skill013000', state: 'Skill_01',
      actions: [{ base: 'SkillAction039010', patch: { skillRateType: 'DAMAGE', skillRateValue: 1.2, skillTargetCount: 1, startEffect: '', hitEffect: 'Effect600003' },
        range: { rangeRadius: 6 } }],
      patch: { ...NO_FX, condition: '', conditionType: 'AND', skillDelay: 0.15, skillActionType: 'INSTANT', name: '단일 치유', desc: '가장 체력 비율이 낮은 아군 1명 치유',
        skillCoolTime: 8, skillDistance: 1.8, isAlways: true, atkCnt: false } },
    skillB: { base: 'Skill013000', state: 'Skill_02',
      actions: [{ base: 'SkillAction039010', patch: { skillRateType: 'DAMAGE', skillRateValue: 0.65, skillTargetCount: 70, startEffect: '', hitEffect: 'Effect600003' },
        range: { rangeRadius: 12 } }],
      patch: { ...NO_FX, condition: '', conditionType: 'AND', skillDelay: 0.15, skillActionType: 'INSTANT', name: '전체 치유', desc: '살아 있는 출전 장수 전체 치유',
        skillCoolTime: 18, skillDistance: 1.8, isAlways: true, atkCnt: false } },
  },
  // 관우: A 크게 들어 내려 베기 / B 한 손으로 들어 올리기·공격력 버프
  SG_U0002: {
    skillA: { base: 'Skill013000', state: 'Skill_01',
      actions: [{ base: 'SkillAction001000', patch: { skillTargetCount: 4, skillRateValue: 2.4 },
        range: { startPos: 'MINE_CENTER', pivotType: 'CENTER', rangeType: 'CIRCLE', rangeRadius: 2.2, rangeAngle: 90 } }],
      patch: { ...NO_FX, condition: '', conditionType: 'AND', skillDelay: 0.15, skillActionType: 'INSTANT', name: '내려 베기', desc: '전방 내려 베기',
        skillCoolTime: 7, skillDistance: 1.8, isAlways: false, atkCnt: false } },
    skillB: { base: 'Skill013000', state: 'Skill_02',
      actions: [{ base: 'SkillAction077013', patch: { skillRateType: 'DAMAGE', skillRateValue: 0.25, skillTargetCount: 70, skillDuration: 6, startEffect: '' },
        range: { rangeRadius: 12 } }],
      patch: { ...NO_FX, condition: '', conditionType: 'AND', skillDelay: 0.15, skillActionType: 'INSTANT', name: '공격력 증가', desc: '부대 공격력 증가',
        skillCoolTime: 14, skillDistance: 1.8, isAlways: true, atkCnt: false } },
  },
  // 장비: A 한 번 크게 휘두르기 범위공격 / B 포효·방어력 버프 (도발은 미정 → TAUNT_ENABLED=false)
  SG_U0003: {
    skillA: { base: 'Skill030002', state: 'Skill_01',
      actions: [{ base: 'SkillAction001000', patch: { skillTargetCount: 6, skillRateValue: 1.4 },
        range: { startPos: 'MINE_CENTER', pivotType: 'CENTER', rangeType: 'CIRCLE', rangeRadius: 2.2, rangeAngle: 360 } }],
      patch: { ...NO_FX, condition: '', conditionType: 'AND', skillDelay: 0.15, skillActionType: 'INSTANT', name: '큰 휘두르기', desc: '주변 범위공격',
        skillCoolTime: 8, skillDistance: 1.5, isAlways: false, atkCnt: false } },
    skillB: { base: 'Skill030003', state: 'Skill_02',
      actions: [{ base: 'SkillAction038210', patch: { skillAdditional: 20, skillTargetCount: 70, skillDuration: 5, startEffect: '' },
        range: { rangeRadius: 12 } }],
      patch: { ...NO_FX, name: '포효', desc: '부대 방어력 증가', skillCoolTime: 16, skillDistance: 2.0, isAlways: true } },
  },
};

/** 장비 도발: 유지 여부 미정(미정사항.md). true로 켜면 보스 제외 4초 도발이 추가된다. */
export const TAUNT_ENABLED = false;
const TAUNT_ACTION = { base: 'SkillAction011010', patch: { packTaunt: true, startEffect: '', skillDuration: 4 } };

/** units.json 정의에 최신 스킬 효과를 덮어쓴 사본 */
export function withSamgukSkills(def) {
  const cfg = SAMGUK_SKILLS[def.id];
  if (!cfg || !def.skills) return def;
  const skills = { ...def.skills };
  for (const [slot, s] of Object.entries(cfg)) skills[slot] = JSON.parse(JSON.stringify(s));
  if (TAUNT_ENABLED && def.id === 'SG_U0003') skills.skillB.actions.unshift(TAUNT_ACTION);
  return { ...def, skills };
}
