# 삼국지 용병단 — 최종 캐릭터 자료

2026-10-26: 사용자 확정에 따라 기본 외형과 이동을 최종본으로 정리했다. 이전 유관장 시안·실패한 모션·비교 자료·버전별 작업파일은 삭제했다.

## 최종 결과

- [유비](liu-bei/README.md): idle / run
- [관우](guan-yu/README.md): idle / run
- [장비](zhang-fei/README.md): idle / run

각 이동 폴더에 투명400×440 개별6프레임, 가로 시트, 프레임 보기, 일반/느린GIF와 animation.json이 있다. 이동18프레임은 최종 승인본과 픽셀 동일 검증 완료. 관우·장비 idle은 한 손으로 무기를 땅에 짚는 정지 자세, run은 양손 자세다. 유비 idle은 쌍검 준비 자세다.

## 작업 기준과 필수 베이스

- [다음 장수용 모션 가이드](docs/motion-guide/README.md): 승인18프레임·GIF, 관절·비율·합성 명세, 실패 원인과 검수 절차.
- [디자인 가이드](docs/DESIGN_GUIDE.md)
- [작업 지침](AGENTS.md)
- [재생성 원본·코드·동작 좌표](tools/character-motion/README.md)
- [원작 참고자료](docs/design/references/original-game/README.md)
- [기존 승인 마을·캐릭터 참고7컷](docs/design/references/samguk-base-style/)

`docs/design`에는 참고자료만 보존한다. 원작 스크린샷과 기존 승인7컷은 시행착오 이미지와 구분해 유지한다. 다음 모션의 종류는 아직 선택 전이다.

정리 방식: 이전 작업폴더는 프로젝트에서 제거하고 Windows 휴지통으로 이동했다. 생성 도구의 앱 캐시나 다른 프로젝트 파일은 정리 범위에 포함하지 않았다.

## 숨쉬기 최종 승인본

각 장수 original에 원본 정지 이미지를 보존했다. idle에는4프레임 숨쉬기를 추가했다. [숨쉬기 재생·명세](docs/motion-guide/idle-breathing.md). 이동 최종본은 변경하지 않았다.

- 2026-10-26 유비 기본 공격·스킬1·스킬2 각8프레임 사용자 최종 승인. liu-bei/basic-attack, skill-1, skill-2 및 docs/motion-guide/liu-bei-combat.md에 보존.

- 다음 PC/세션에서 장수·모션 제작 전 [작업 이어가기](docs/motion-guide/COMBAT_HANDOFF.md)와 [새 장수 생성 조건](docs/motion-guide/CHARACTER_GENERATION_SPEC.md)을 읽는다. 머리·몸통·다리 width/height, 관절·파지·칼날 방향과 승인 상태를 확인한다.
