# 공통 팔레트 검토본

사용자 요청: 유관장조운을 기준으로 지형·건물·NPC·몬스터·진행 UI의 색상계열, 채도, 명도, 윤곽선과 디테일 밀도를 통일한다. 사용자가 선택한 방식은 Python 색 보정으로 기존 모션을 보존하고, 필요한 지형만 imagegen으로 재작화하는 것이다.

## 반영

- NPC·몬스터 225 PNG: 모든 상태에 같은 RGB 변환 적용. 알파·350×350 크기·위치·프레임 수·시간·타격 이벤트 불변. 미등록 주민 여자 원본/모션도 포함.
- 등록 지형 46종이 공유하는 고유 PNG 45장: 공통 녹색·흙색·금색 계열과 중성 검정 윤곽선. 건물 음영 대비를 정리했다. 주막만 imagegen 재작화 후 기존 캔버스에 균일 축소·하단 정렬. 다른 지형의 실루엣과 내부 선 구조는 보존했다. 따라서 모든 건물의 형태 디테일을 새로 그린 결과는 아니다.
- 진행 UI: `art/ui/chapter1/hero-palette.css`로 목표/자원/대화/훈련/회복/복구/보스/완료 등의 표현 통일. 위치·기능·조이스틱 유지.
- 기존 유관장조운 프레임은 바이트 그대로 유지. 새 유비 주인공 시안은 별도 보관하며 미적용.
- 각 등록 모션의 GIF·스프라이트 시트를 현재 PNG로 재생성했다. 맵메이커·모션체커는 기존 경로의 수정 파일을 읽는다. 새로고침 필요.

## 재현과 검증

`python tools/harmonize_art_palette.py --apply`는 각 자산 archive/before-hero-palette 원본에서 다시 보정하므로 누적 변색하지 않는다. 고정 팔레트 LUT를 보간하여 색 경계 노이즈를 피하고, 중성 옷/늑대 털의 색이 보라색으로 새지 않도록 처리한다. 이미지마다 별도 팔레트나 bbox를 맞추지 않는다.

`python tools/rebuild_character_previews.py` 후 `python tools/verify_hero_palette.py --record`로 현재 체크섬을 기록한다. 승인 상태는 검토본이며 자동 승인하지 않는다. 과거 프레임 체크섬은 `characters/archive/before-hero-palette-manifest.json` 보존.

검수용 `characters-comparison.png`와 `terrain-comparison.png`는 각 항목 왼쪽 이전 / 오른쪽 수정. `manifest.json`에 모든 입력·출력 체크섬과 크기·알파 보존 여부를 기록한다. 주막 재작화만 알파 변경 예외이다.
