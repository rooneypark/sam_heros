# 코덱스 작업 가이드 — 삼국히어로즈 맵·몬스터·캐릭터를 맵 메이커에 넣기

작성일: 2026-10-23.

- 이 문서만 따르면 코덱스가 만든 결과물이 맵 메이커(시뮬레이터)에 바로 나타난다.
- 먼저 [AGENTS.md](../AGENTS.md), [기본 스타일](design/SAMGUK_BASE_STYLE.md), [그림 규격](../art/samguk/README.md)을 읽는다.
- AGENTS.md의 결정이 이 문서보다 우선한다. 공격·스킬·모션은 [모션 제작 가이드](design/motion/MOTION_GUIDE.md)를 따른다.

## 0. 확인 방법 (사람이 실행)

1. `sam_heros2` 폴더의 `run_maker.bat`을 더블클릭한다.
   - 이 저장소(`Documents/GitHub/sam_heros`)가 자동으로 연결된다.
   - 저장소가 다른 위치에 있으면 환경 변수 `SAMGUK_REPO`에 그 경로를 지정한다.
2. 파일을 고친 뒤 브라우저를 **새로고침(F5)** 한다.
3. 왼쪽 **유닛 → 삼국** 탭에 새 유닛이 나온다.
4. 맵에 배치하고 **▶ 실행**을 누르면 전투로 확인할 수 있다.
5. JSON 문법 오류가 있으면 삼국 탭이 비어 있다. 브라우저 콘솔(F12)에서 `samguk pack not loaded` 메시지를 확인한다.

## 1. 코덱스가 만드는 파일

| 무엇 | 파일 | 비고 |
|---|---|---|
| 캐릭터·몬스터 정의 | `content/samguk/units.json` | 아래 2절 형식. 기존 항목은 ID를 유지한다 |
| 캐릭터·몬스터 그림 | `art/samguk/units/<ID>/` | `icon.png`, `portrait.png`, `idle.png` (3절) |
| 맵 | `content/samguk/maps/<이름>.map.json` | 맵 메이커로 그리는 것을 권장. 직접 생성 시 5절 |
| 기획 메모 | `docs/planning/units/<ID>.md` | 템플릿 `docs/planning/templates/unit.md` |

## 2. 유닛 정의 (`content/samguk/units.json`)

```json
{
  "version": 1,
  "units": [
    {
      "id": "SG_U0001",
      "name": "유비",
      "grade": "전설", "gradeType": "LEGEND",
      "base": "Unit000001",
      "art": {
        "icon": "art/samguk/units/SG_U0001/icon.png",
        "portrait": "art/samguk/units/SG_U0001/portrait.png",
        "static": "art/samguk/units/SG_U0001/idle.png"
      },
      "memo": "쌍검. base는 임시"
    },
    {
      "id": "SG_M0001",
      "name": "황건적 졸병",
      "grade": "일반", "gradeType": "NORMAL",
      "base": "Unit000146",
      "art": { "icon": "art/samguk/units/SG_M0001/icon.png", "static": "art/samguk/units/SG_M0001/idle.png" },
      "memo": "1장 잡몹. base = 햇맨 보병(사람형 보병)"
    }
  ]
}
```

| 필드 | 필수 | 뜻 |
|---|---|---|
| `id` | ✔ | 캐릭터 `SG_U####`, 몬스터 `SG_M####`. 한 번 정하면 바꾸지 않는다 (맵·그림 폴더가 ID로 연결됨) |
| `name` | ✔ | 화면에 보일 이름 |
| `base` | ✔ | 능력치·크기·공격·스킬·모션 타이밍을 빌릴 원작 유닛 키. 카탈로그 xlsx의 **유닛** 시트에서 고른다. 몬스터는 원작 몬스터 키(예: 햇맨 보병 `Unit000146`)를 쓰면 적 AI가 그대로 동작한다 |
| `grade`, `gradeType` | | 표시 등급 / `NORMAL`·`RARE`·`UNIQUE`·`LEGEND` |
| `statKey` | | 능력치 곡선만 다른 원작 유닛의 `UnitStat…` 키로 바꿀 때 |
| `levels` | | 레벨별 스킬 교체: `[{ "level": 1, "skillA": "Skill011001" }, { "level": 20, "skillB": "…" }]`. 원작 스킬 키만 사용 |
| `art.icon` | | 팔레트·목록 아이콘 (256×256) |
| `art.portrait` | | 소개용 전신 (512×512) |
| `art.static` | | **게임 화면에 그려질 캐릭터 그림 1장.** 지정하면 base 유닛의 모든 몸통 프레임(서기·걷기·공격·스킬)이 이 그림으로 바뀐다. 모션을 그리기 전 임시용 |
| `art.frames` | | 상태별 모션 프레임 ([모션 제작 가이드](design/motion/MOTION_GUIDE.md)). `{ "Idle": [..], "Move": [..], "Attack": [..], "Skill_01": [..], "Gather": [..], "Die": [..] }`. 상태별 PNG 경로 목록이며, 없는 상태는 Idle 첫 장으로 대체된다 |
| `art.ppu`, `art.pivot` | | 기본값 `100`, `[0.5, 0.3]`. 규격(3절)대로 그리면 지정할 필요 없다 |

- `base`가 영웅이면 기본은 아군으로, 몬스터면 적군으로 쓰기를 권장한다. 진영은 맵에서 배치할 때 정한다.
- 공격 판정·사거리·이펙트는 base 유닛의 것이 그대로 나온다. 새 이펙트 그림은 `art/samguk/effects/`에 그리면 개발자가 연결한다.

## 3. 그림 규격 (요약, 상세는 `art/samguk/README.md`)

| 파일 | 크기 | 규칙 |
|---|---|---|
| `idle.png` (= `art.static`) | **350×350 투명 PNG** | 발밑이 가로 50%, **아래에서 30%** (y = 245px, 위에서 잰 값). 몸 높이 약 135px, 너비 약 110px. **왼쪽을 본다** (원작 기준. 오른쪽으로 그렸으면 `art.facing: "right"`). 무기 포함 캔버스 밖으로 나가지 않게 |
| `icon.png` | 256×256 | 얼굴 중심, 원작 영웅 아이콘 구도 |
| `portrait.png` | 512×512 | 전신 |

- 100px = 게임 1칸 단위다. 원작 영웅(히로 `Unit000001`) 옆에 배치했을 때 키가 비슷하면 맞는 크기다.
- 스타일은 굵은 검은 외곽선, 큰 머리, 짧은 팔다리다. 유비·관우·장비의 식별 요소는 기본 스타일 문서를 따른다.
- 몬스터도 같은 규격이다. 원작 몬스터는 크기가 제각각이므로, base로 고른 원작 몬스터 옆에 두고 키를 맞춘다.

## 4. 유비·관우·장비 바로 시작하기

`units.json`에 `SG_U0001`(유비), `SG_U0002`(관우), `SG_U0003`(장비)가 이미 들어 있다. base는 임시값이다.
1. 각 폴더 `art/samguk/units/SG_U000N/`에 `icon.png`, `portrait.png`, `idle.png`를 만든다.
2. 각 항목의 `art`에 `"static": "art/samguk/units/SG_U000N/idle.png"`를 추가한다.
3. 메이커를 새로고침한다. 삼국 탭에서 아이콘을 확인하고, 맵에 배치해 실행하면 캐릭터가 그 그림으로 걷고 싸운다.

## 5. 맵

**권장 방법:** 사람이 맵 메이커에서 그린다.
- **저장**을 누르면 `content/samguk/maps/<맵 이름>.map.json`이 만들어진다.
- 지형 팔레트에는 원작 타일 전체(바닥·길·물·산/절벽·장식·오브젝트·던전, 약 1,070종)가 있다.

**코덱스가 직접 JSON을 만들 때:** 맵은 원작 월드 맵과 같은 형식이다.

```json
{
  "name": "1장_황건소탕",
  "mapData":   [{ "x": 0, "y": 0, "n": "g_r_00" }],
  "roadData":  [{ "x": 3, "y": 2, "n": "rd_r_01" }],
  "waterData": [],
  "decoData":  [{ "x": 10, "y": 7, "n": "br_122" }],
  "blockData": [{ "x": 6, "y": 6, "n": "mt_r_00" }],
  "BonfirePos": { "x": 0, "y": 12 },
  "maker": {
    "version": 1, "pack": "samguk",
    "units": [
      { "id": "u1", "key": "SG_U0001", "team": "ally",  "level": 10, "x": 0.0, "y": 12.0 },
      { "id": "u2", "key": "SG_M0001", "team": "enemy", "level": 5,  "x": 6.6, "y": 14.0 }
    ],
    "trees": [{ "id": "t1", "x": -3.3, "y": 10.0 }]
  }
}
```

- **타일 레이어** (`mapData`, `roadData`, `waterData`, `blockData`)
  - 좌표 `x, y`는 아이소메트릭 칸 번호(정수)다.
  - 한 칸은 월드 3.32×2.0이고, 칸 (x, y)의 중심은 월드 `((x−y)·1.66, (x+y+1)·1.0)`이다.
  - 길·물·바위 아래에는 `mapData` 잔디가 있어야 걸을 수 있다.
- **장식** (`decoData`): 1/3 크기 칸을 쓰고, 칸 (x, y)의 중심은 `((x−y)·0.5533 − 1.1067, (x+y+1)·0.3333 + 0.6667)`이다.
- **유닛·나무** (`maker.units`, `maker.trees`): 좌표는 월드 좌표(실수)다.
- **타일 이름:** 메이커 지형 팔레트에 마우스를 올리면 보인다.
  - 자주 쓰는 것: 잔디 `g_r_00`, 흙길 `rd_r_01`, 물 `wt_r_00`, 산 `mt_r_00`, 바위 `br_22`, 울타리 `br_122`
- **새 지형 그림:** 아직 연결되지 않았다. 맵은 원작 타일로 구성하고, 삼국 전용 타일 그림은 `art/samguk/tiles/`에 그려 두면 개발자가 연결한다.

## 6. 작업 후 체크리스트

- [ ] `units.json`이 올바른 JSON이다 (쉼표·따옴표).
- [ ] 그림 경로가 실제 파일과 대소문자까지 같다.
- [ ] 메이커 새로고침 후 삼국 탭에 아이콘이 보인다.
- [ ] 원작 히로 옆에 배치해 키와 발 위치가 맞다 (발이 그림자 위에 선다).
- [ ] ▶ 실행으로 이동·전투가 된다. 적군은 base 몬스터의 AI로 공격해 온다.
- [ ] 원작 리소스 파일(스프라이트·테이블)을 이 저장소에 복사하지 않았다.
- [ ] 승인 기준 이미지(`docs/design/references`)를 덮어쓰지 않았다.
