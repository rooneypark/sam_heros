# 유비 — 최종 기본자세·이동

2026-10-26 사용자 확정. 오른쪽 아래 대각 방향.

- idle/idle.png: 최종 외형과 골반 위치를 유지한 중립 정지 자세.
- run/: 투명400×440 PNG6장, 2400×440 시트, 3×2 프레임 보기, 100ms/프레임 GIF 및 느린 GIF.
- 원본 및 재생성: ../tools/character-motion/render.py, parts-atlas.png, joint-data.json.

이동 프레임은 최종 승인 right-v10과 픽셀 동일. 기본자세는 동일 리그의 관절각을 중립화한 정지 이미지이며 별도 대기 애니메이션은 아니다.

## 숨쉬기 추가 — 최종 승인본

- `original/original.png`: 변경하지 않은 원본 정지 이미지.
- `idle/`: 상체 숨쉬기4프레임·시트·GIF·animation.json. 기존 idle.png는 정지 미리보기용.
- [숨쉬기 규칙](../docs/motion-guide/idle-breathing.md). 기존 이동은 승인본 그대로 유지.

## 기본 공격·스킬 최종 승인본

2026-10-26: basic-attack(두 검 찌르기), skill-1(가슴 앞 X), skill-2(머리 위 X)를 각8프레임으로 제작했다. [재생 화면](combat-preview/index.html) · [명세](../docs/motion-guide/liu-bei-combat.md). 2026-10-26 사용자 최종 승인. original/idle/run과 함께 보존한다.
