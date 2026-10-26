# 우르르 용병단 게임 체계 총정리 — 삼국히어로즈 재정립용 (기획자용)

작성일: 2026-10-23.

- 원작을 역분석해 로컬 웹으로 이식하면서 확인한 **실제 규칙과 수치**를 정리했다.
- 수치는 원작 테이블 값이고, 공식은 이식 코드(원작 바이너리에서 옮긴 것) 기준이다.
- 각 절 끝의 **"바꾸려면"**에 삼국히어로즈용으로 고치는 방법을 적었다.

| 함께 볼 자료 | 위치 |
|---|---|
| 성장·진행 데이터북 (이 문서의 표 원본, 20개 시트) | `docs/planning/catalog/우르르용병단_성장_진행_데이터북.xlsx` |
| 유닛·스킬 카탈로그 (유닛 856종, 레벨별 스킬, 이펙트) | `docs/planning/catalog/우르르용병단_유닛_스킬_카탈로그.xlsx` |
| 수정 파일 | `content/samguk/tables/overrides.json` (7절), `content/samguk/units.json` ([CODEX_GUIDE](../CODEX_GUIDE.md)) |

---

## 1. 게임 한 바퀴 (핵심 루프)

```
필드 이동 → 몬스터 자동 전투 → 경험치·자원 드롭 → 메인 퀘스트 달성 → 건설(자원 소비)
  → 안개가 걷히고 새 지역·영웅 구출 → 주점에서 영웅 영입 → 영웅 레벨업(조각+고기) → 더 강한 지역
```
- **조작:** 플레이어는 이동만 한다. 공격과 스킬은 영웅 AI가 자동으로 쓴다(사거리 안의 적, 쿨타임·조건 충족 시).
- **부대 이동:** 영웅들은 부대 중심점을 따라다닌다. 귀환 거리는 기본 1.8에, 영웅 1명 추가마다 0.45씩 늘어나 최대 8명분까지 커진다. 이보다 멀어지면 부대로 돌아온다.
- **모닥불:** 맵 곳곳의 모닥불이 마을 역할(부활·캠프)을 한다.
- **안개:** 지도의 안개는 건설로 걷힌다. 걷히기 전에는 그 지역에 들어갈 수 없다.

## 2. 진행 체계

### 2-1. 프롤로그
- 강한 영웅 1명(`Unit000570`, 레벨 60)으로 시작한다. 부대 최대 인원은 `PROLOGUE_HERO_COUNT` 11명이다.
- 전멸하면 연출 뒤 본편 `World_1`로 넘어간다. 부대는 히로(`Unit000001`) 1명, 최대 인원 `DEFAULT_HERO_COUNT` 4명으로 초기화된다.

### 2-2. 메인 퀘스트 (`TableQuest`, 273개)
- 한 번에 1개씩 진행하는 사슬 구조다. `Quest000000`부터 시작해 `nextKey`로 다음 퀘스트로 넘어간다.
- 퀘스트 종류는 네 가지다.
  - `MONSTER`: 몬스터 N마리 처치
  - `RESOURCE`: 자원 N개 획득
  - `BUILD`: 건물 건설
  - 기타 힌트형
- 보상은 대부분 골드 10~40이다.
- 힌트 좌표(`hintPosX/Y`)가 있으면 퀘스트 버튼을 눌렀을 때 카메라가 그곳을 보여 준다.
- **초반 흐름** (원작 순서):
  1. 토끼 3 → 건설 → 고기 10 → 건설 → 나무 10 → 건설 3회
  2. 슬라임 10 → 맹독버섯 5 → 건설 → 쥐 10
  3. **갈색곰(보스) 1** → 늑대 10 → … → 외눈거인(보스) → …
  4. 13번째 퀘스트 전후로 첫 보스(`Unit000600~` 계열)가 나온다. 이후 5~6개마다 보스가 한 번씩 끼어 있다.
- **설계 패턴:** 잡몹 처치 수는 3 → 10 → 20 → 35로 늘어난다. 자원·건설 퀘스트가 섞여서 필드 탐색을 유도한다.

**바꾸려면:** `overrides.json`의 `TableQuest`에서 `Quest000000`부터 행을 덮어쓴다.
- `questKey`에 삼국 몬스터 ID(`SG_M0001` 등)를 넣을 수 있다.
- 새 퀘스트를 추가하려면 키(예: `Quest_SG_0001`)를 만들고 앞 퀘스트의 `nextKey`로 연결한다.

### 2-3. 건설 (`TableWorldBuilding`, 497개)
- 필드의 건설 지점에 자원(`needResources`/`needAmount`)을 넣으면 건물이 완성된다.
- **완성 효과** (건물 분류 `category`에 따라 다름):
  - 안개 해제, 다음 건설 지점 공개(`prevBuilding` 사슬)
  - 영웅 구출(`heroKey`): 그 영웅이 부대에 합류하거나 조각이 된다
  - 자원 생산(`resourceType`, `createTimer`초마다 `createAmount`, 최대 `createMax`)
  - 보관 한도 증가(`addStorageType`/`Amount`)
  - 시설 개방: 주점, 훈련소, 명성 건물(분류 25) 등
- 처음 지을 때 들어가는 자원 기본값은 `BUILDING_RESOURCE_INIT` [25, 25, 15, 5]다.

**바꾸려면:** 건설 비용은 해당 키의 `needResources`/`needAmount`, 구출 영웅은 `heroKey`를 고친다.
- 삼국 영웅 ID를 넣으면 그 영웅이 구출된다(예: 유비 `SG_U0001`).
- 건설 지점의 **위치**는 맵 파일에 있으므로 개발자와 함께 바꾼다(8절).

### 2-4. 월드 (`TableWorld`)
- 본편은 `우르르 섬`(`World_1`) 하나이고, 필드가 마을(`TableTown`, 31곳) 단위로 나뉜다.
- 무한 던전(유령의 땅 등), 이벤트 월드, 심연(어비스)도 있다. 입장 레벨은 9~19다. **이 이식본에서는 아직 구현되지 않았다.**

### 2-5. 일일 미션 (`TableInstantQuest`, 102개)
- **유저 레벨 11**(`UNLOCK_QUEST_LV`)부터 열린다.
- 종류: 몬스터 처치, 자원 채집, 영웅 레벨업, 광고 시청 등.
- 미션을 달성하면 점수(`rewardValue`)가 쌓인다. 점수 구간마다 보상 상자(`TableInstantQuest_Reward`: 필요 점수, 아이템)를 받는다.

### 2-6. 그 밖의 개방 레벨 (`TableDefine`)

| 기능 | 유저 레벨 | 상수 | 이식 |
|---|---|---|---|
| 캠핑 | 6 | `OPEN_CAMPING_LIMIT_LEVEL` | 부분 |
| 일일 미션 | 11 | `UNLOCK_QUEST_LV` | ✔ |
| 영웅 훈련 | 14 | `HERO_TRAINING_OPEN_LEVEL` | ✔ (훈련소) |
| 도감 | 15 | `COLLECTION_UNLOCKLV` | ✖ |
| 매력(주점) | 17 | `CHARM_UNLOCK_LEVEL` | ✖ |
| 보스 사냥 / 잠재력 | 19 | `BOSSHUNT_OPEN_LEVEL` / `POTENTION_OPEN_LIMIT_LEVEL` | ✖ |
| 유적 / 심연 | 24 | `RUINS_OPEN_LEVEL` / `ABYSS_OPEN_LEVEL` | ✖ |
| 방어전 | 29 | `DEFENCE_OPEN_LEVEL` | ✖ |
| 차원 | 34 | `DIMENSION_OPEN_LEVEL` | ✖ |
| 레이드 | 39 | `RAID_OPEN_LEVEL` | ✖ |
| 절전 모드 | 40 | `SLEEPMODE_UNLOCKLV` | ✔ |

✖ 항목은 원작에 데이터가 있지만 이식하지 않았다. 기획 참고용으로만 본다.

## 3. 성장 체계

### 3-1. 유저 레벨 (`TableUserLevel`)
- 몬스터 처치 경험치로 오른다. 화면 상단 방패 숫자가 유저 레벨이다.
- 다음 레벨까지 필요 경험치: 40, 90, 155, 240, 350, 490, 665, 880, 1140, 1450 … (95단계)
- 레벨마다 보상 능력치(`statKey` → `TableUpgradeStat`)가 붙어 있다.
- **몬스터 경험치 공식:**
  ```
  기본 = 유닛능력치.exp × (몬스터레벨+1) / 60 × (정예면 5, 아니면 1)
  레벨차 = |유저레벨 − 몬스터레벨| − 5
  레벨차 > 9  → 0
  레벨차 ≥ 1  → 기본 × (1 − 0.1 × 레벨차)        (EXP_LEVEL_PENALTY 0.1)
  최종 = round(기본 × 경험치 보너스)
  ```
  레벨 차이가 5 이내면 손해가 없고, 15를 넘으면 경험치가 0이다. 너무 약한 사냥터에 머무르지 못하게 하는 장치다.

### 3-2. 영웅 레벨 (`TableGrowth`)
- 같은 영웅을 또 얻으면 **조각**이 된다. 조각과 고기를 내고 레벨업한다.
- 일반·희귀·특별 등급(구분 0, 약 95단계): 레벨당 조각 5개(11레벨부터 10개), 고기 5·10·15… (레벨×5).
- 전설·신화 등급(구분 1, 7단계): 조각 1·2·3·4·4… 고기는 들지 않는다.
- **영웅 능력치 공식** (아군, 성장형):
  ```
  체력 = 유닛능력치.hp + growthHp × 레벨
  공격력 = 유닛능력치.damage + growthDamage × 레벨
  ```
  예: 히로(`UnitStat001000`) 체력 360 + 29/레벨, 공격력 45 + 4/레벨.
  여기에 훈련·명성 보너스가 더해진다.
- **스킬 해금:** 레벨에 따라 스킬 그룹이 바뀐다(`TableUnitSkill`). 예: 히로는 1레벨 도끼 강타(2.0배) → 20레벨 2.5배 → 40레벨 3.0배이고, 10레벨부터 부대 격려 버프가 붙는다. 전체 표는 카탈로그 "레벨별 스킬" 시트에 있다.
- **전투력 표시:** 공격력 × 4 + 체력(영웅 합계).

### 3-3. 몬스터 능력치
```
몬스터 체력 = 기본능력치(레벨).hp × growthHp%     (TableBaseStat 레벨별 표 × 유닛별 배율)
몬스터 공격력 = 기본능력치(레벨).damage × growthDamage%
```
- **인원 보정:** 스포너 기준 인원(`BaseCount`)보다 부대가 많으면 차이 1명당 몬스터 체력이 +50%다.
- **정예 몬스터:** `ELITE_MONSTER_LEVEL` [3, 5, 8]. 정예는 경험치 5배다.

### 3-4. 훈련소 (`TableGlobalUpgrade` → `TableUpgradeStat`, 430단계)
- 광석 등 자원으로 부대 전체 능력치(체력·공격력 등)를 올린다.
- 단계마다 요구 유저 레벨(`limitLv`)이 있어서, 유저 레벨보다 높이 올릴 수 없다.

### 3-5. 명성 (`TableFame`, 35단계)
- **부대 영웅 레벨 합**이 기준값 30 → 65 → 105 → 150 → 200 → 255(수동 승급) → …에 이르면 명성 단계가 오른다.
- 단계마다 능력치 보상이 최대 3개(`upgradeStat1~3`) 있다. 일부 단계(`isManual`)는 명성 건물에서 직접 승급한다.
- 영웅을 넓게 키우게 만드는 장치다. 한 명만 키우는 것보다 여러 명을 키우는 쪽이 유리하다.

### 3-6. 기여 (`TableContribution`, 14단계)
- 금괴를 기여 경험치로 바꾼다(1:1). 기여 경험치가 60 → 360 → 900 → … → 80000에 이르면 단계가 오른다.
- **현재 단계의 능력치 묶음**이 적용된다(누적 아님). 인벤토리 칸, 자원 보관량, 캠프 시간, 주점 카드 등이다.

## 4. 경제

| 자원 | 얻는 곳 | 쓰는 곳 |
|---|---|---|
| 나무 `TREE` | 나무 채집 (체력 4타, 2개, 300초 뒤 재생성) | 건설 |
| 광석 `STONE` | 바위 채집 | 건설, 훈련 |
| 고기 `MEAT` | 동물 몬스터 드롭 | 영웅 레벨업 |
| 골드 `GOLD` | 퀘스트 보상, 드롭 | 주점 뽑기·초기화, 건설 |
| 다이아 `DIA` | 보상 | 부활(20), 주점 초기화(20) |
| 금괴 `GOLD_BAR` | 보상 | 기여 |

- **보관 한도:** 나무·광석·고기는 기본 250개(`SAVE_ADD_RESOURCE_MAX`)다. 건물 보관 증가와 기여의 STORAGE 능력치로 늘어난다. 한도를 넘으면 더 주울 수 없다(건설을 유도).
- **드롭 표:** `TableDropItem`(905개)이 레벨 구간별 아이템 확률을 정한다.
- **필드 자원:** `TableResource`(나무·바위 단계별 체력·획득량·재생성 시간)에 있다.

### 4-1. 주점 (영웅 영입)
- 일정 시간마다(`PUB_RESET_TIME` 1800초) 카드 목록이 새로 바뀐다.
- 직접 초기화할 수 있다: 초기화권 1장 또는 골드 50(`PUB_RESET_GOLD_COST`). 원작 상수에는 다이아 20, 광고 하루 3회도 있지만 이식본은 결제·광고를 뺐다.
- **등급 가중치** `PUB_GRADE_WEIGHT` [10, 6, 3, 1]: 일반·희귀·특별·전설 순서다. 등급 안에서는 유닛별 `drawWeight`가 확률을 정한다(데이터북 "주점 뽑기 가중치" 시트).
- **영입 비용** `PUB_COST` [100, 150, 400]: 한 목록에서 첫 영입은 골드 100, 두 번째부터는 다이아 150 → 400이다(할인 배율 `drawRate` 적용).
- **확정 영웅:** 뽑기 횟수 구간마다 확정 전설 영웅이 있다(`TablePub.confirmUnit`). 보너스 게이지(`PUB_BONUS_MAX` 10)가 차면 받는다.
- 확률 잠금 횟수는 `PUB_RATE_LOCK_COUNT` 9다.

## 5. 전투 규칙 (요약)

- **진행:** 영웅과 몬스터는 0.07초(아군) / 0.1초(적) 간격으로 행동 판단(BT)을 한다. 사거리 안에 적이 있으면 공격한다. 스킬은 쿨타임·조건(`TableSkillCondition`)을 만족하면 자동 발동한다.
- **스킬 구조:** 스킬 1개 = 동작(`TableSkillAction`) 여러 개다.
  - 동작에는 피해 배율(`skillRateValue`), 범위(`TableRangeData`), 투사체(`TableBullet`), 상태이상(`TableCC`), 버프가 들어간다.
  - 타격 시점은 애니메이션의 타격 프레임이다([모션 가이드](../design/motion/MOTION_GUIDE.md)).
- **부활:**
  - 필드에서 쓰러진 영웅은 60초(`WORLD_RESURRECTION_TIME`) 뒤 부활한다. 다이아 20으로 즉시 부활할 수 있다.
  - 캠프에서는 30초(`CAMPING_RESURRECTION`)다.
  - 전멸하면 마을(모닥불)로 돌아간다.
- **연계 스킬:** `TableLinkSkill`은 스킬 A 뒤에 B가 이어지는 구조다.
- **부대 인원:** 시작 4명(`DEFAULT_HERO_COUNT`), 최대 12명(`MAX_HERO_CNT`). 편성은 왼쪽 하단 버튼(모닥불 편성 화면)에서 한다.

## 6. 삼국히어로즈로 재정립할 때 바꿀 곳 (대응표)

| 바꾸고 싶은 것 | 파일 | 위치 |
|---|---|---|
| 새 영웅·몬스터 추가, 이름, 등급, 진영(위·촉·오·군) | `content/samguk/units.json` | `id`, `name`, `gradeType`, `faction` |
| 영웅의 능력치 곡선 | `units.json` `statKey` + `overrides.json` `TableUnitStat` | 새 행(예: `UnitStat_SG_0001`)을 만들고 `hp`/`damage`/`growthHp`/`growthDamage`/`attackSpeed`/`speed` 지정 |
| 레벨별 스킬 구성 | `units.json` `levels` | `[{ "level": 1, "skillA": "…" }, …]` (카탈로그의 스킬 키) |
| 스킬 수치 (배율·쿨타임·사거리) | `overrides.json` `TableSkill`, `TableSkillAction` | 기존 스킬을 고치면 그 스킬을 쓰는 원작 유닛도 같이 바뀐다. 새 키로 복사해 쓰기를 권장 |
| 메인 퀘스트 흐름 | `overrides.json` `TableQuest` | 2-2절 |
| 건설 비용·구출 영웅 | `overrides.json` `TableWorldBuilding` | 2-3절 |
| 유저 레벨 곡선 | `overrides.json` `TableUserLevel` | `needExp` |
| 영웅 레벨업 비용 | `overrides.json` `TableGrowth` | `partCount`, `requiredResource`, `resourceAmount` |
| 명성·기여·훈련 | `overrides.json` `TableFame` / `TableContribution` / `TableGlobalUpgrade`·`TableUpgradeStat` | |
| 주점 확률·비용 | `overrides.json` `TableDefine` (`PUB_*`), `TablePub` | |
| 시작 인원, 부활 시간, 보관 한도, 개방 레벨 | `overrides.json` `TableDefine` | 2-6, 4, 5절의 상수 |
| 화면 문구·이름 | `overrides.json` `TableLocalize` | `{ "키": { "ko": "문구" } }` |
| 맵 (지형·몬스터 배치) | `content/samguk/maps/*.map.json` | 맵 메이커로 제작 |

## 7. `content/samguk/tables/overrides.json` 쓰는 법

```json
{
  "_note": "삼국히어로즈 테이블 변경. 바꾼 필드만 적는다.",
  "TableDefine": {
    "Define_DEFAULT_HERO_COUNT": { "value": [3] },
    "Define_WORLD_RESURRECTION_TIME": { "value": [45] }
  },
  "TableUnitStat": {
    "UnitStat_SG_0001": { "category": 1, "level": 0, "grade": 0, "eliteType": "NORMAL", "growthType": "GROWTH",
                          "hp": 420, "damage": 40, "growthHp": 32, "growthDamage": 4, "attackSpeed": 1, "speed": 5,
                          "detectUnitRange": 8, "detectResourceRange": 8, "criticalRate": 0, "criticalDamage": 1.5,
                          "evasionRate": 0, "exp": 0 }
  },
  "TableQuest": {
    "Quest000000": { "questType": "MONSTER", "questKey": "SG_M0001", "questValue": 3, "rewardType": "GOLD", "rewardValue": 10 }
  },
  "TableLocalize": {
    "LocalizeWorld0000000": { "ko": "탁현" }
  }
}
```

- **이미 있는 키:** 적은 필드만 바뀌고 나머지는 원작 값이 유지된다.
- **새 키:** 행이 추가된다. 이때는 원작의 같은 종류 행을 데이터북에서 복사해 **모든 필드**를 적는다.
- `_`로 시작하는 키는 메모로 무시된다.
- **적용 범위:**
  - 맵 메이커: 자동으로 적용된다. 전투·스킬·능력치를 확인할 때 쓴다.
  - 게임: 주소 뒤에 `?pack=samguk`을 붙이면 적용된다(예: `http://127.0.0.1:8124/web/index.html?pack=samguk`). 퀘스트·성장·경제를 확인할 때 쓴다. 새 게임은 `?pack=samguk&new`다.
- JSON 문법이 틀리면 적용되지 않는다. 쉼표와 따옴표를 확인한다.

## 8. 아직 개발이 필요한 것 (기획 협의 사항)

| 항목 | 현재 | 필요 작업 |
|---|---|---|
| 게임 본편 맵을 삼국 맵으로 교체 | 게임은 원작 `World_1`을 쓴다. 삼국 맵은 맵 메이커에서만 실행 | 삼국 월드 맵 지정, 건설 지점·스포너·모닥불·안개를 맵 메이커에서 배치하는 기능 |
| 주점에 삼국 영웅 등장 | 삼국 유닛은 뽑기 가중치 0 | `units.json`에 `drawWeight` 지원 |
| 삼국 영웅 구출 건물 | `heroKey`에 삼국 ID를 넣는 것까지 가능 | 게임 쪽 삼국 유닛 등록(현재 맵 메이커만) |
| 던전·레이드·심연·장비·룬 등 | 원작 데이터만 있음 | 필요한 콘텐츠를 골라 개발 우선순위 결정 |

이 표의 항목은 기획에서 범위를 정해 주면 개발자가 순서대로 붙인다.
