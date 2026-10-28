# 황건소탕 맵·신규 캐릭터 작업 인계 — 2026-10-28

다른 PC에서는 이 문서를 먼저 읽는다. **맵 재작화와 신규 4종은 사용자 검토 중**이다. 기존 유비·관우·장비·조운, 주민 3종, 늑대 등의 승인 상태와 구분한다. 제작 파일은 Git 저장소 안에 있으며 `.codex/generated_images`나 이전 PC의 절대 경로 없이 실행할 수 있다.

## 바로 실행하기

1. `git pull` 후 Python 3가 설치되어 있는지 확인한다.
2. 루트 `run_maker.bat`: 현재 황건소탕 맵. `run_motion_checker.bat`: 모든 캐릭터 모션.
3. 또는 `python tools/launch_tools.py maker`, `python tools/launch_tools.py motion` 실행.
4. 서버 창은 열어 둔다. HTML을 파일로 직접 열지 않는다. 기본 포트 8134, 사용 중이면 8154까지 빈 포트를 사용한다.
5. 서버 주소의 포트를 그대로 사용하여 다음 페이지를 연다.
   - `/web/maker.html?samgukMap=1장_황건소탕`
   - `/web/motion.html?units=SG_M0005,SG_M0006,SG_N0004,SG_N0005` — 이번 신규 4종만 비교
   - `/samguk/chapter-1/expansion-review/index.html` — 원본·전체 GIF·느린 GIF

일반 실행에는 Node/npm/Pillow가 필요 없다. PNG 재포장 도구에만 Python Pillow, numpy, scipy가 필요하다.

## 실제 사용되는 파일

| 구분 | 저장소 상대 경로 | 역할 |
|---|---|---|
| 현재 전체 지도 | `content/samguk/maps/1장_황건소탕.map.json` | 맵메이커가 여는 현재 작업 원본 |
| 지형 등록 | `content/samguk/tiles.json` | `sg2_` 공용 컴포넌트 40종 |
| 지형 그림 | `art/environment/chapter-1/` | 자연·건물·군영·생활 소품 PNG 36장과 재질 PNG 3장 |
| 지형 생성 원본 | `art/environment/chapter-1/sources/` | 자연/건물/소품/재질 원본 시트 |
| 캐릭터 공용 등록 | `content/samguk/units.json` | 총 15종, 맵메이커·모션체커가 같은 PNG 참조 |
| 창병 | `chapter-1/yellow-turban-spearman/` | `SG_M0005` |
| 궁병 | `chapter-1/yellow-turban-archer/` | `SG_M0006`; `projectile/arrow.png`는 실제 발사 화살 |
| 대장장이 | `chapter-1/village-blacksmith/` | `SG_N0004` |
| 주모 | `chapter-1/village-hostess/` | `SG_N0005` |
| 신규 검토 모음 | `chapter-1/expansion-review/` | GIF 갤러리, `lineup.png`, 신규 프레임 체크섬 `manifest.json` |
| 배치 확인 화면 | `docs/design/maps/chapter-1/expanded-village.png` | 대장간·주막 앞 주민 배치 캡처 |

각 신규 캐릭터 폴더 구성:

- `original/original.png`: 정지 원화. 숨쉬기 첫 프레임과 동일.
- `idle/`: 숨쉬기 4장, 각 300ms.
- `run/`: 이동 6장, 각 100ms. 주민은 걷기 표현.
- `basic-attack/`: 창병·궁병만 8장. 시간 `[180,110,100,90,100,120,160,300]`ms, 타격/발사 480ms.
- 각 모션 폴더: `frame-01.png`부터 개별 PNG, `spritesheet.png`, `preview.gif`, `preview-slow.gif`, `animation.json`.
- `sources/`: 이미지 생성 원본 시트. 현재 프레임의 크기·위치는 개별 PNG와 animation.json을 기준으로 한다.

신규 총량: 원화 4장 + 모션 PNG 56장. 납품 셀 350×350 RGBA, PPU100, pivot(0.5,0.3), 발 기준 Y245, 왼쪽 아래 시선. 공격 마지막 두 장은 idle 첫 장과 픽셀 동일하게 복귀한다. 시트별 동일축 납품 배율과 프레임별 정수 이동값을 animation.json에 기록했다. 이것은 시점에 따른 모든 신체 치수 불변성이 완전히 검증됐다는 뜻은 아니다. 신규 4종은 반복 재생을 보고 사용자 승인받아야 한다.

## 현재 맵 배치

- 기존 유닛 33개 좌표·레벨·진행 순서는 유지. 칼병 자리 중 **창병 8명, 궁병 6명**으로 교체했다. 창병은 전면/진입부, 궁병은 후방/초소 쪽에 배치했다.
- 해당 지역의 재생성 스포너도 일부 창병·궁병으로 교체했다. 늑대·관해·장각은 유지한다.
- 촌장/기존 주민/구출 대상 6개의 `Npc_*` 외형은 기존 승인 주민 3종 `SG_N0001~3`으로 교체했다. 구출 조건과 건물 진행 데이터는 보존했다.
- `npcs` 배열에 대장장이 `(14.94,37.6)`, 주모 `(-3.32,38.6)` 배치. 이 둘은 비전투 NPC이며 아군 부대/적 유닛 수에 포함되지 않는다. 현재 위치 수정은 JSON의 `npcs` 배열에서 한다. 맵메이커 유닛 드래그 대상으로 연결하지 않았다.
- 지형 5개 레이어는 모두 `sg2_` 그림을 사용한다. 나무80개와 자원 돌, 진행 시설도 `environmentArt`로 대체한다.
- 맵메이커 지형 팔레트는 삼국 컴포넌트만 표시한다. 길을 새로 칠할 때 원작 잔디가 재삽입되지 않도록 `environmentArt.groundTile`을 사용한다.

원작 캐릭터·지형의 **이 맵에서 보이는 표현을 교체**한 것이다. `re/extract/`의 엔진·테이블·프리팹은 실행 의존성이므로 삭제하지 않는다. 원작 전체 맵과 엔진 기반까지 삭제했다는 뜻이 아니다.

## 구현 연결 지점

| 파일 | 역할 |
|---|---|
| `web/src/packs/samguk.js` | 캐릭터/지형/주민 프레임/전용 화살 등록 |
| `web/src/packs/materialTiles.js` | 재질을 격자·길 연결 마스크로 표시 |
| `web/src/game/map/TileResolver.js` | 삼국 재질 타일 해석 |
| `web/src/game/world/Npc.js` | 비전투 주민의 pack Idle/Move 표시 |
| `web/src/boot.js` | 맵 `npcs` 로드 |
| `web/src/game/world/Buildings.js` | 원작 주민·영웅 가입 미리보기 대신 삼국 이미지, 진행 시설 외형 교체 |
| `web/src/game/world/Resources.js` | 자원 나무·돌 외형 교체 |
| `web/src/game/world/WorldFX.js` | 궁병 전용 화살 표시; 기존 발사·피격 로직 이용 |
| `web/src/maker/maker.js`, `mapdoc.js` | 삼국 지형 팔레트, 신규 맵/칠하기 기본 잔디, 편집 중 주민 숨쉬기 |
| `web/src/maker/motion.js`, `motion_checker.js` | 공용 등록 사용; 시연 대상도 삼국 졸병, 시연 바닥도 삼국 잔디 |

창병 사거리2 / 궁병5.5와 타격480ms는 이번 시연용 제작값이며 원작 분석 수치나 최종 밸런스로 승인된 값이 아니다.

## 이어서 확인할 것

1. 신규 4종의 숨쉬기/이동을 반복 재생하며 원화 대비 몸 크기·색감·선 굵기와 양발 교대를 확인한다. 공격은 창병 손과 창이 함께 전진하는지, 궁병 시위/발사/복귀 연결을 확인한다.
2. 모션체커의 ‘숨쉬기 대비 크기 변화’ 경고는 원작의 전체 그림 bbox와 비교한 값이므로 무기 이동까지 포함한다. 경고만 숨기거나 몸을 프레임별 bbox에 맞춰 확대축소하지 않는다.
3. 궁병 실전 사거리/화살 발사 위치와 맵 전체 진행은 추가 플레이 검수가 필요하다. 실행 오류 없음과 9개 주요 경로 연결 검사를 전체 클리어 검증으로 해석하지 않는다.
4. 사용자 확인 전 신규 그림을 승인본으로 표시하거나 기존 승인 장수·늑대를 덮어쓰지 않는다.

## 검증·재작업 주의

실행 완료한 검사: `python tools/verify_portable.py`, `node tools/test_custom_motion.mjs`, `node tools/test_pack_frames.mjs`, `node tools/map-art/verify_chapter1.mjs`. 신규 PNG350×350/RGBA 56장, 승인 장수 체크섬 불변도 확인했다.

- `tools/character-motion/chapter1_expansion.py`: 신규 시트 재포장 도구. **재실행하면 신규 프레임·등록 JSON을 덮어쓴다.** 일반 실행/검토에는 필요 없다. 후속 수동 수정 후에는 무심코 재실행하지 않는다.
- `tools/map-art/redraw_environment.py`: 현재 배치를 덮어쓰므로 재실행 금지. `package_chapter1.py`도 이전 맵 제작용이다.
- `docs/design/maps/chapter-1/layout-before-*.map.json`은 복구 기록. 현재 맵 대신 로드하지 않는다.
- `art/objects/chapter-1/`은 이전 건물 시안. 현재 공용 등록은 `art/environment/chapter-1/`만 사용한다.
- 저장 버튼으로 JSON에 저장한 뒤 PNG/등록JSON/맵JSON/문서를 함께 Commit·Push한다. 브라우저 자동저장만으로 다른 PC에 전달되지 않는다.

관련 기준: [맵 재작화](design/maps/chapter-1/REDRAW.md), [기존 실행 안내](MAP_MAKER_HANDOFF.md), [캐릭터 검수](motion-guide/CHARACTER_MOTION_QA.md), [현재 장수 규칙](motion-guide/CURRENT_CHARACTER_RULES.md).
