# 리소스 폴더 기준

날짜나 수정 차수로 실행 리소스를 분리하지 않는다. **캐릭터는 캐릭터별, 지형은 지형별, 지도는 지도별 폴더**가 기준이다. 이번 정리는 경로 변경이며 그림·게임 수치·모션 시간·승인 상태를 변경하지 않는다.

## 캐릭터

`characters/<영문 이름>/`

| 폴더 | 내용 |
|---|---|
| original | 원화 |
| idle / run | 숨쉬기 / 이동 |
| basic-attack / skill-1 / skill-2 | 공격 / 스킬 |
| gather / work / die | 채집 / 주민 작업 / 사망. 해당 캐릭터에 등록된 종류만 사용 |
| portrait | 초상화 |
| preview | 현재 등록 모션을 한눈에 보는 HTML |
| sources | 생성 시트·보정 근거 |
| archive | 대체된 자료. 실행에서 사용하지 않음 |

각 모션에는 `frame-01.png`부터 이어지는 완전한 프레임 세트, `animation.json`, `spritesheet.png`, `preview.gif`, `preview-slow.gif`를 둔다. 서로 다른 보정 폴더의 프레임을 섞어 등록하지 않는다. 관우 채집도 `characters/guan-yu/gather/`, 창병·궁병 보정 공격도 각 캐릭터 `basic-attack/`에 통합했다.

등록은 `content/samguk/units.json`. ID와 시간·타격 이벤트·스탯은 그대로다. `characters/manifest.json`으로 372개 활성 프레임의 원래 PNG 바이트 보존을 검사한다. `characters/index.html` 또는 모션체커로 확인한다.

## 지형

`art/terrain/<지형 이름>/<그림>.png` — 예: `tree/tree.png`, `tavern/tavern.png`, `blacksmith/blacksmith.png`.

초원·흙·물은 `grass-material/`, `earth-material/`, `water-material/`. 공통 생성 시트와 제작 근거는 `art/terrain/sources/`. 이전 미사용 건물 시안은 `maps/chapter-1/archive/building-drafts/`.

등록은 `content/samguk/tiles.json`의 46종. ID·PPU·피벗·충돌값은 유지한다. 다른 장에서도 같은 공용 지형을 참조한다.

## 지도

| 지도 | 현재 데이터 |
|---|---|
| 황건소탕 | `maps/chapter-1/map.json` |
| 캐릭터 검수 | `maps/character-review/map.json` |
| 캐릭터 전체 검수 | `maps/character-overview/map.json` |

`maps/catalog.json`이 표시 이름과 실제 JSON 경로를 연결한다. 각 지도 폴더 안에 `docs/`, `review/`, `history/`, `archive/`를 둔다. 황건소탕의 배치 기록과 캡처도 이곳에 모았다. 이전 지도는 history에만 보관한다.

맵메이커는 `/api/maps/<이름>`으로 현재 파일을 읽고 저장한다. 새 이름으로 저장한 맵은 `maps/custom/<이름>/map.json`에 둔다. **서버 코드가 바뀌었으므로 기존 서버를 종료하고 실행 배치를 다시 연다.** 브라우저 자동저장에 남은 이전 경로 대신 실행 배치로 현재 지도를 연다.

## 실행·검증

- `run_maker.bat`: 현재 황건소탕 지도.
- `run_motion_checker.bat`: 현재 등록 캐릭터 모션.
- `run_samguk.bat`, `run_samguk_review.bat`: 본게임 / 별도 검토 프로필.
- `python tools/rebuild_character_previews.py`: 현재 등록 PNG로 GIF·시트·시간 메타데이터만 다시 만든다. 프레임 PNG는 수정하지 않는다.
- `python tools/verify_portable.py`, `python tools/scripts/verify_character_delivery.py`: 자산 참조와 납품 검사.
- `node tools/test_designer_finish.mjs`, `node tools/.verify_chapter1_import.mjs`: 지도·주민·통행 검사.

이전 경로 대응은 `docs/ASSET_PATH_MIGRATION.json`에 기록했다. 과거 날짜가 적힌 문서는 작업 이력이며, 현재 경로는 이 문서와 등록 JSON이 우선한다. 과거 생성기를 실행하여 새 폴더 구성이나 현재 등록을 덮어쓰지 않는다. `tools/organize_assets.py`는 일회성 이관 기록이며 재실행을 차단한다.

UI 원본은 기존 `art/ui/`, 공통 설계·모션 가이드는 `docs/`, 엔진 실행 의존 데이터는 `re/extract/`를 유지한다.
