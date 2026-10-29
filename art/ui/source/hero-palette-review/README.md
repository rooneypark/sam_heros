# 장수 공통 색감 — 진행 UI 검토

실행 스타일은 `art/ui/chapter1/hero-palette.css`이며 `theme.css` 마지막에 불러온다. 검정 윤곽, 짙은 중성 패널, 아이보리 글자, 금색 강조, 청록 버튼과 단색 붉은 보스 HP를 적용했다. 목표·자원·대화·훈련·회복·복구·선택·완료 등의 기존 선택자에 시각 속성만 덮어쓴다. 위치·크기·문구·기능·타이밍·조이스틱·게임 수치는 변경하지 않았다. 설정 참고 화면과 인트로는 이번 진행 UI 스타일 대상이 아니다.

검토: `/web/ui-review.html`. HUD와 훈련 패널을 실제 실행 화면에서 확인했다. `python tools/verify_ui_resources.py` 통과. 사용자 최종 승인 전이다.

사용자는 승인 모션을 보존하는 Python 픽셀 색보정과 필요한 지형만 재작화하는 방식을 선택했다. NPC·몬스터 225 PNG, 지형 45 PNG에 공통 색 보정을 적용했다. 주막은 `art/terrain/tavern/sources/hero-style/redraw.png`를 기존 캔버스와 배치 기준에 맞춰 반영했다. 유비 새 검토 시안 `characters/liu-bei/sources/commander-concept/concept.png`는 아직 게임 자산을 대체하지 않았다. 전체 비교와 검사 기록은 `art/style-review/hero-palette/` 참조.
