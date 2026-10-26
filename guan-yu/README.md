# 관우 — 최종 기본자세·이동

2026-10-26 사용자 확정. 오른쪽 아래 대각 방향.

- idle/idle.png: 오른쪽 아래 대각, 한 손으로 무기를 잡고 자루 끝을 땅에 짚는 정지 자세.
- run/: 투명400×440 PNG6장, 2400×440 시트, 3×2 프레임 보기, 100ms/프레임 GIF 및 느린 GIF.
- 원본 및 재생성: ../tools/character-motion/render.py, parts-atlas.png, joint-data.json.

이동 프레임은 최종 승인 right-v10과 픽셀 동일. 기본자세는 한 손 지면 지지, 이동은 양손 무기 자세다. 기본자세 원본은 tools/character-motion/idle-sources에 별도로 보존하여 이동 리그로 덮어쓰지 않는다.

## 숨쉬기 추가 — 최종 승인본

- `original/original.png`: 변경하지 않은 원본 정지 이미지.
- `idle/`: 상체 숨쉬기4프레임·시트·GIF·animation.json. 기존 idle.png는 정지 미리보기용.
- [숨쉬기 규칙](../docs/motion-guide/idle-breathing.md). 기존 이동은 승인본 그대로 유지.

## 공격·스킬 검토본

각8프레임: basic-attack(베기), skill-1(두 번 대각 베기와 X 잔상), skill-2(크게 들어 내려찍기). [재생 화면](combat-preview/index.html) · [모션 명세](../docs/motion-guide/guan-yu-combat.md). 아직 승인 전이며 기존 original/idle/run은 유지했다.
