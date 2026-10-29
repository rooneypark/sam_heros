# UI 편집 원본 — 디자이너 시작 위치

이 폴더가 GitHub 통합본의 **실제 UI 디자인 수정 위치**다. PNG 화면 캡처는 docs/ui-review-2026-10-28의 참고 자료이며 편집 원본이 아니다. 실행 게임의 모양·색·입력·성장 규칙은 이번 폴더 분리에서 바꾸지 않았다.

## 어디를 수정하는가

| 대상 | 실제 수정 파일 | 반영 방식 |
|---|---|---|
| 공통 글꼴·색·안내·배경 | chapter1/common.css | 게임/검토 페이지가 theme.css를 통해 읽음 |
| 목표·자원·보스 HUD | chapter1/hud.css | 동일 |
| 대화·초상화 배치·건너뛰기 | chapter1/dialogue.css | 동일. 초상화 PNG 자체는 units.json의 art.portrait 경로 |
| 클릭 마커·잠금·완료 | chapter1/markers.css | 동일 |
| 공통 창·버튼·비활성 버튼 | chapter1/panels.css | 훈련/휴식/복구/선택 공통 |
| 훈련만 수정 | chapter1/training.css | #c1 .win[data-screen="training"] 선택자로 덮어쓰기 |
| 회복만 수정 | chapter1/rest.css | data-screen="rest" |
| 복구만 수정 | chapter1/bridge.css | data-screen="bridge" |
| 선택창만 수정 | chapter1/choice.css | data-screen="choice" |
| 챕터 제목·완료 | chapter1/chapter-title.css, completion.css | 실제 게임 DOM 스타일 |
| 인트로 색·로고 텍스트·배치·효과 | intro/style.css, intro/images/ | 실제 시작 화면/시안 페이지에서 동일 파일 로드 |
| 환경설정 패널 배치·색·글자 크기 | settings/layout.json | 실제 설정 팝업이 이 편집 레이아웃을 로드 |
| 환경설정 이미지·아이콘·토글 | settings/sprites/*.png | manifest.json에 연결된37종 중 설정35종 |
| 조이스틱 바탕·손잡이 | controls/sprites/AllAxis_Outline.png, Handle_Plain.png | 실제 조이스틱 스프라이트 교체 |
| 조이스틱 크기·투명도 | manifest.json → gameplay.joystick | 그리기 크기와 입력 반경 함께 적용 |
| 장수 HP·EXP바 크기·색 | manifest.json → gameplay.bars | 삼국 챕터에서만 적용 |
| 나머지 기존 UI 원형 참고 | reference/original-prefabs/, reference/sprites/ | 413개 레이아웃·전체1116종 중 비활성 참고 PNG. 자동 적용되지 않음 |
| 이미지 원본 좌표·크기·사용 구분 | sprite-index.json | 원작 아틀라스 매핑·runtime 여부 확인용 |
| 새 디자인 편집 원본 | source/ | 새 원본 파일과 내보내기 위치를 함께 기록 |

기존 설정은 원작 엔진 UI 참고다. 이 구조는 설정 화면을 수정·검토할 수 있게 연결한 것으로, 삼국HUD에 새 환경설정 버튼을 추가한 작업은 아니다. 숨겨진 계정/커뮤니티/결제 기능을 활성화하지 않는다.

## 실행과 검토

저장소 루트 run_ui_review.bat 또는 `python tools/launch_tools.py ui`. 화면 탭에서 훈련/휴식/복구/인트로/설정/조이스틱을 선택한다. CSS·PNG·JSON 저장 후 새로고침한다. 페이지는 별도 ui-review 프로필의 예시 상태를 사용한다. 본게임은 run_samguk.bat, 도구는 run_maker.bat/run_motion_checker.bat.

환경설정과 조이스틱 PNG는 새로 그린 그림이 아니라 기존 아틀라스에서 개별 추출한 투명 PNG다. PNG는 원본 캔버스 크기·투명 여백을 유지해 교체한다. 이미지의 화면상 테마 색은 layout.json의 m_Color 틴트와 결합될 수 있다. 원본PNG를 바꿨는데 색이 예상과 다르면 해당 노드의 틴트도 확인한다.

## 수정 절차

1. 화면 목록을 보고 해당 CSS/PNG/layout 파일을 선택한다. 훈련만 바꿀 때 공통 panels.css를 먼저 건드리지 않는다.
2. 새 리소스는 화면별 images/ 또는 source/에 저장한다. source는 작업 원본, 실행 폴더는 최종 내보내기 파일이다.
3. 같은 파일명·같은 캔버스의 PNG 교체는 추가 코드 없이 반영된다. 파일명/크기를 바꾸면 manifest.json의 file·width·height와 meta의 size/offset/pivot/border도 개발자와 함께 조정한다.
4. CSS 배경 PNG는 해당 CSS에서 상대경로 url("./images/파일.png")로 연결한다. 새 폰트는 로컬 파일과 사용 허용 범위를 함께 제공한다.
5. 설정 레이아웃은 tf의 위치·크기·anchor와 시각 속성을 수정할 수 있다. id·name·localizeKey·버튼 기능 경로를 임의 삭제하지 않는다. 기능/텍스트 변경은 Option.js·기획과 함께 검토한다.
6. reference/는 원형 참고다. 참고 PNG를 수정했다고 자동으로 게임이 바뀌지 않는다. 활성화하려면 manifest.sprites/prefabs에 명시적으로 연결하고 사용 화면을 검증한다. UI 전체1116개를 무조건 전역 교체하지 않는다.
7. 새 이미지·선택자 이름·폰트·버튼 상태·모바일 배율을 확인하고 검토본으로 커밋한다. 디자이너 검토본과 최종 사용자 승인을 구분한다.

## 유지할 기능 경계

현재 목표·자원 수량·실제 HP/EXP·스킬 해금·CD·재료 차감·저장·복구는 디자인 파일에서 바꾸지 않는다. 이벤트 코드는 web/src/packs/chapter1, 기존 설정 동작은 web/src/game/Option.js, 입력은 UIManager.js가 담당한다. DOM id/상태 class/data-screen은 기능 연결점이므로 보존한다.

패널 공통/훈련/회복/복구 CSS의 기본값은 기존 스타일과 같다. 화면별 override 파일은 수정할 위치를 제공하는 비어 있는 CSS 원본이며 이미 완성한 새 디자인이 아니다. 기존 DOM/CSS 패널에 존재하지 않는 레이어 PSD나 배경PNG를 있다고 표시하지 않는다.

## 검수

- 훈련 가능/광석 부족/진행 잠금/최대 단계의 텍스트·버튼 비활성 상태.
- 회복·복구·선택·완료·대화·긴 한글 문장의 잘림과 버튼 겹침.
- 설정 토글의 켜짐/꺼짐·뒤로 버튼·숨김 행 상태와 9-slice 테두리.
- 조이스틱 시각 원과 실제 입력 반경, HP/EXP 색·폭·배치.
- 390×845와 작은 화면 배율, 마우스/터치, 창 닫은 뒤 입력 복귀.

검토 화면 PNG는 이 소스의 결과 확인용으로만 갱신한다. PNG를 고친 것으로 UI 원본 작업을 완료했다고 보고하지 않는다.

연결 검사는 `python tools/verify_ui_resources.py`. 브라우저 검사는 Node/npm과 Playwright 설치 후 서버를 켜고 `node tools/test_ui_design.mjs http://127.0.0.1:포트`로 실행한다. 별도 브라우저에서 훈련 CSS의 임시 변경이 적용되는지, 설정 레이아웃·개별 PNG를 실제로 읽는지 확인하며 디스크 원본은 수정하지 않는다.

## 최신 조작 UI 개발 전달
새 패널 테마는 [themes/samguk/README.md](themes/samguk/README.md). 실행 CSS와 시안, 검수 결과를 함께 보관하며 기존 게임에는 자동 적용하지 않는다.
