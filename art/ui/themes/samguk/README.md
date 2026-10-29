# 삼국히어로즈 조작 UI — 개발자 전달 패키지

## 바로 확인
- 정리된 시안: `/samguk/art/ui/themes/samguk/index.html`
- 실제 게임 창에 적용한 미리보기: `/web/ui-proposal.html`
- 실행: 저장소의 `python tools/launch_tools.py ui`로 서버 시작 후 위 경로를 연다. 포트는 실행 로그 기준.

## 납품물
| 파일 | 역할 |
|---|---|
| theme.css | 단일 진입점, 아래 CSS 자동 로드 |
| tokens.css | 공통 색상 변수 |
| panels.css | 훈련·회복·복구·선택·잠금·버튼 상태 |
| dialogue.css | 대화·이름표·초상화 주변·넘기기 |
| completion.css | 챕터 완료 |
| markers.css | 기존 월드 마커 테두리 |
| manifest.json | 범위와 유지 조건 |
| previews/ | 실제 실행 캡처 7장과 비교 보드 |
| qa.json | 검증 범위 및 제한 |

CSS 자체가 편집 가능한 실행 리소스다. 패널과 버튼을 PNG로 굽지 않는다. 한글 길이와 작은 화면에 대응하도록 기존 DOM과 폰트 크기 계산을 재사용한다. 별도 PSD·Figma 파일이나 새로운 폰트 의존성은 없다.

## 개발 적용
기존 `/samguk/art/ui/chapter1/theme.css` 다음에 `/samguk/art/ui/themes/samguk/theme.css`를 로드한다. 예:
```html
<link rel="stylesheet" href="/samguk/art/ui/chapter1/theme.css">
<link rel="stylesheet" href="/samguk/art/ui/themes/samguk/theme.css">
```
기존 ChapterUI 생성자는 앞의 테마를 이미 로드하므로 중복 생성하지 않는다. 현재 실제 게임에는 새 테마를 자동 적용하지 않았고 검토 페이지에서만 두 번째 링크를 추가한다. 적용 후 문제가 있으면 두 번째 링크만 제거하면 된다.

### 유지해야 할 계약
- `#c1`, `.win`, `.box`, `.row`, `.btns`, `.sub`, `.dlg`, `.done`, `data-screen`, `disabled` 그대로.
- 창 위치/폭 및 초상화 위치는 기존 CSS를 상속한다. 새 테마는 선·색·내부 간격을 덮어쓴다.
- pointer 이벤트, 훈련 자원 차감/수치, 회복/복구, 저장은 기존 코드 담당. 시안 예시 값을 복사하지 않는다.
- 상태: 비취=주 실행, 아이보리 회색=보조, 회색=disabled, 적갈색=부족 안내, 금색=제목. 글자와 disabled 속성으로도 상태를 구분한다.
- 버튼 최소 높이44px, 윤곽2~3px, 눌림2px. 그림자 외에 과한 질감/광택/문양 추가 금지.
- 조이스틱 PNG·반경·입력은 유지. 이번 CSS에는 HUD/HP/EXP 위치·로직 수정이 없다.

## 기존 UI 자료와 관계
- 승인된 EXP 연출: `../../source/exp-levelup-concept/` (동작 검토 소스 보존). 실제 획득 이벤트·월드좌표에 개발 연결 필요.
- HUD 이미지 시안: `../../source/play-hud-concept/` (참고용, 생성 이미지의 글자/위치를 실행값으로 추출 금지).
- 기존 실행 팔레트: `../../chapter1/hero-palette.css` 유지.
- 설정 창은 Canvas 기반 기존 참고본이며 이번 DOM 패널 패키지에 재디자인/구현했다고 간주하지 않는다.

## 검수
`npm install --no-save playwright`가 준비된 환경에서 `node tools/test_ui_theme.cjs http://127.0.0.1:포트`. 다른 설치 위치는 SAM_HEROS_PLAYWRIGHT, 브라우저 채널은 SAM_HEROS_BROWSER 지정.
390px/320px 실제 ChapterUI에서 테마 로드, 실행 callback, disabled, 닫기, 패널 폭을 검사한다. 전체 게임 최초 캡처7종은 성공했지만 후속 전체 게임 재실행에서 로딩 시간초과가 발생했다. 따라서 전투/저장까지 통합 검증 완료로 보지 않는다. 개발 적용 후 자원 부족·최대훈련·진행잠금과 터치 입력 복귀를 재확인한다.

## 정리
이번 임시 단일 CSS 폴더와 로컬 절대경로 테스트2개는 `DELETE_ME/ui-theme-intermediate/`로 격리했다. 승인된 HUD/EXP 시안, 기존 원작 참고자료, 캐릭터·맵 자산은 보존했다. Git 업로드에서 DELETE_ME는 제외한다.
