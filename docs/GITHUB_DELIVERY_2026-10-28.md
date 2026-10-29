> **현재 폴더 기준:** [캐릭터·지형·맵별 리소스 구조](ASSET_LAYOUT.md)가 아래 과거 경로 안내보다 우선합니다. 실행 파일은 날짜별 폴더를 참조하지 않습니다.

# 디자인·도구·게임 UI GitHub 통합

2026-10-28. 사용자의 GitHub 이관 요청과 디자이너 완료 인계에 따라 공유 작업 폴더의 현재 실행 스냅샷을 통합했다. 디자인/코드 전달이며 사용자 최종 미술 승인이나 전체 챕터 클리어 검증을 뜻하지 않는다.

## 실행

Python3 설치 후 저장소 루트에서 실행한다. 기본 포트8134부터 빈 포트를 찾고 같은 저장소 서버가 있으면 재사용한다.

| 실행 파일 | 기능 |
|---|---|
| run_samguk.bat | 삼국히어로즈1장, main 프로필 이어하기 |
| run_samguk_review.bat | 별도 review 프로필 새 게임. main 저장을 지우지 않음 |
| run_maker.bat | 황건소탕 맵메이커 |
| run_motion_checker.bat | 모션 체커·실제 나무 채집 테스트 |
| run_ui_review.bat | 현재 실행 UI 검토 갤러리 |

또는 `python tools/launch_tools.py game`, `maker`, `motion`, `ui`를 사용한다. 원본 HTML을 파일로 직접 열지 않는다. `tools/serve.py`는 이 저장소 루트를 /samguk/에 매핑한다. 별도 work/sam_heros2 설치나 사용자 PC 절대 경로가 실행에 필요하지 않다.

## 옮긴 내용과 원본 위치

| 분류 | 저장소 경로 | 설명 |
|---|---|---|
| 캐릭터·맵 등록 | content/samguk/units.json, tiles.json, maps/ | 현재 활성15종·61모션·372프레임 등록, 황건소탕 현맵 |
| 채집 최종 전달 | gather-finish-2026-10-28/{liu-bei,guan-yu-fresh,zhang-fei-redraw,zhao-yun-redraw}/ | 네 장수 채집9장, 반복 중 Idle 끼임 교정·색 보정 |
| NPC 초상화 | docs/motion-guide/reviews/npc-portraits/ | 소년·노인·주모·훈련병사·관해·장각·대장장이 |
| 적 공격 교정 | motion-cleanup-2026-10-28/SG_M0005,SG_M0006/ | 창병·궁병의 잘린 몸 복원·이웃 프레임 조각 제거 |
| 맵 소품·재질 | art/terrain/sources/additions/, art/terrain/sources/base/ | 소품6종·장식209개·흙57칸 보충·길/물가 경계 |
| 맵메이커·체커 | web/maker.html, motion.html, src/maker/ | 최신 삼국 자산 연결·실제 나무 타격·연속 채집 검수 |
| 인트로 시안 | web/src/packs/chapter1/introSplash.js, docs/design/intro/ | 현재 시작 화면과 별도 재생 시안·스토리보드 |
| 게임 UI | web/src/packs/chapter1/ui.js | 목표·자원·보스HP·대화/초상화·훈련/회복/복구·선택·완료·안내·월드 마커 |
| 게임 조작·표시 | web/src/main.js, game/ui/, game/world/WorldFX.js | 기존 입력·조이스틱·HP/EXP 등 실행 연결 포함 |
| 환경설정·원작 UI 참고 | web/src/game/Option.js, Heroes.js, Training.js, Pub.js, InstantQuest.js, Fame.js, re/extract/prefabs/ | 기존 엔진 UI와 실행 의존 데이터 유지. 삼국 전용 신규 디자인 승인/연결을 뜻하지 않음 |
| UI 재검토 | web/ui-review.html, docs/ui-review-2026-10-28/ | 현재 코드를 재사용한 예시 화면·PNG·매니페스트 |
| 실행 의존 데이터 | re/extract/ | 기존 저장소 데이터와 동일함을 대조. APK·역분석 도구·개인 캐시는 업로드하지 않음 |

관우 채집 활성 경로는 **guan-yu-fresh**다. guan-yu-redraw는 배포하지 않았다. 옛 생성·패키징 스크립트로 현재 units.json·활성 프레임을 덮어쓰지 않는다. 그림을 재생성하거나 임의 보정하지 않고 전달 파일을 그대로 옮겼다.

공통 기획은 기존 shared docs/planning을 계속 원본으로 사용하며, 이 통합에서 GitHub 쪽에 별도 기획 사본을 만들지 않았다. [디자이너 인계](DESIGNER_HANDOFF_2026-10-28.md)는 원본 작업 폴더의 samguk/ 접두사를 사용한다. 이 저장소에서는 그 접두사를 빼서 읽는다.

## UI를 새로 만들 때

**디자이너는 [art/ui 편집 가이드](../art/ui/README.md)부터 읽는다.** `art/ui/`가 실제 수정 원본이며 화면 PNG는 참고다. 훈련·회복·대화·HUD·인트로 CSS, 설정 layout.json 및 설정35종·조이스틱2종 개별 PNG를 실행 코드에 연결했다. 나머지 UI 리소스는 reference로 구분했다. 새 PSD/Figma 원본이 이미 존재한다고 표시하지 않는다.

[UI 화면 목록](ui-review-2026-10-28/README.md)부터 본다. 검토 갤러리는 기존 UI와 현재 게임 코드를 별도 ui-review 프로필로 연다. 훈련 재료·단계·보스HP 등의 시연 상태는 예시이고 실제 진행 결과가 아니다. 사용자 main 세이브를 사용하지 않는다.

환경설정 편집 원본은 art/ui/settings/layout.json과 sprites/이며 PNG 화면은 실제 설정 팝업 참고다. 현재 삼국HUD에 새 설정 버튼이 추가됐거나, 원작 주점/명성 등을 삼국 기능으로 채택했다는 뜻이 아니다. 기존 연결 파일은 저장 후 새로고침으로 반영된다. 새로운 기능·레이아웃 구조 변경은 개발자에게 전달한다.

## 검증과 재현

- python tools/verify_ui_resources.py

- node tools/test_continuous_gather.mjs
- node tools/test_custom_motion.mjs
- node tools/test_pack_frames.mjs
- node tools/test_designer_finish.mjs
- node tools/.verify_chapter1_import.mjs
- python tools/scripts/verify_character_delivery.py
- python tools/verify_portable.py

일반 실행은 Python3만 있으면 된다. Node는 검증 도구에 사용한다. PNG 재캡처는 Node/npm 설치 후 `npm install`, `npx playwright install chromium`, 서버 실행 뒤 `node tools/render_ui_review.mjs http://127.0.0.1:포트`를 사용한다. 검토용 브라우저 컨텍스트는 사용자 브라우저와 분리한다.

채집 반복·프레임 연결·원작 테이블 비변경·52900칸 보행성 불변·주요9동선 연결·886개 납품 매니페스트와 선언된 수정·15종372프레임 경로·1290개 기존 아틀라스 의존 파일 검사를 수행했다. 각 검사의 의미를 전체 챕터 클리어·아트 최종 승인으로 확대하지 않는다.
