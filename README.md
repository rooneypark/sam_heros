> **2026-10-28 최신 전체 승인·정리:** 유비·관우·장비 최종본은 루트 `liu-bei/`, `guan-yu/`, `zhang-fei/`에 통합했다. 맵메이커·모션체커도 같은 파일을 참조한다. 장비 공격·스킬1 색상 보정, 불꽃 방어 버프까지 승인. 기본공격·스킬1·2 각8장, 접지(175,245), 왼쪽 시선. 이전 경로·승인 보류·관우 Y260/7프레임 안내보다 우선한다. 체크섬: `docs/motion-guide/FINAL_HEROES_2026-10-28.json`. 늑대 신규 재작업은 이 승인에 포함하지 않는다.

## 맵메이커·모션 체커 — 다른 PC 실행

Python 3 설치 후 **run_maker.bat**, **run_motion_checker.bat**, **run_maps.bat** 실행.
[실행·제작·저장 가이드](docs/MAP_MAKER_HANDOFF.md) · [챕터1 시안](docs/design/maps/1장_황건소탕_overview.png)

> 최신 확정: 장비 basic-attack/skill-1/skill-2 각8프레임과 세 장수 portrait/portrait.png 승인 완료. GIF 공통 팔레트 적용, 장비 공격·스킬1 색상 보정 완료. 최종 폴더 외 이전 작업은 DELETE_ME_intermediate에 격리(삭제 정책 차단). 최종PNG107장 체크섬 기준.

> **최신 확정 2026-10-27:** 세 장수 왼쪽 원화/모션이 최종 기준. 현재 파일은 각 장수 루트 original/idle/run 및 승인 공격 폴더. 과거 오른쪽·400/640 규격·중간 보정 경로는 이력이며 재사용 금지. [현재 제작 기준](docs/motion-guide/CURRENT_CHARACTER_RULES.md)이 아래 과거 기록보다 우선합니다.

> **2026-10-27 최신 확정:** 관우 공격7·스킬1 8·스킬2 8은 `guan-yu/combat-redraw-v1/idle-unified-350/` 사용자 승인본이다. 이전 미승인/교정본 안내보다 우선한다. 다음 장수는 [현재 장수 제작 기준](docs/motion-guide/CURRENT_CHARACTER_RULES.md)을 먼저 읽는다. 이 관우 공격 세트만 발(175,260) 예외이며 신규 장수 기본은(175,245)다.

> **2026-10-27 최신 기준:** 원본·idle·run·유비/관우 공격 출력은350×350, 발(175,245), PPU100, pivot(0.5,0.3), facing=right로 통일했다. 기존 모양을0.45배 균일 축소했으며 재생 시간은 유지했다. 아래400/640 규격은 이전 제작 기록이다. 관우 공격은 재작업 베이스이며 승인본이 아니다.

# 삼국지 용병단 — 최종 캐릭터 자료

2026-10-26: 사용자 확정에 따라 기본 외형과 이동을 최종본으로 정리했다. 이전 유관장 시안·실패한 모션·비교 자료·버전별 작업파일은 삭제했다.

<<<<<<< Updated upstream
## 최종 결과
=======
## 장비 파츠 시험 — 2026-10-24

`PARTS_GUIDE.md`에 따라 장비 컷아웃 파츠 9장을 `art/samguk/parts/SG_U0003/`에 제작했다. 같은 파츠로 기본 자세·숨쉬기·걷기·찌르기를 조립한 검수 시안이다. [파츠 제작 기록](docs/design/production/zhang-parts-v1/README.md) · [파츠 조립 비교](http://127.0.0.1:8124/samguk/docs/design/production/zhang-parts-v1/index.html). 게임 등록은 아래 이전 모션 상태를 유지하며 파츠 시안은 사용자 검수 중이다.

## 현재 게임 등록 모션 — 장비 새 비율 프로토타입 변환 (2026-10-24)

장비 SG_U0003를 새 비율 SG_P0003에 맞춰 다시 변환했다. 이전 장비의 옆얼굴·수염·옷맵시를 살리고 몸과 창 길이를 줄였다. 몸 46장, 이펙트 39장. 새 장팔사모 휘두르기와 장판교 포효의 motion·skills·levels·skillFx를 연결했다. [현재 제작·검수·프롬프트 기록](docs/design/production/zhang-revision2/README.md) · [장비/프로토 비교](http://127.0.0.1:8124/web/motion.html?units=SG_U0003,SG_P0003). [첫 프로토타입 변환](docs/design/production/zhang-prototype/README.md)은 이전 기록이며 유비·관우는 아직 v2다.

## 이전 고유 모션 v2 — 역할·무기 중심 재설계

유비(치유·쌍검), 관우(공격·언월도), 장비(탱커·장팔사모)의 숨쉬기·교대 보행·공격·스킬을 108장으로 제작했던 이전 버전이다. [이전 제작 기록](docs/design/production/MOTION_REDESIGN_V2.md) · [이전 검수 화면](http://127.0.0.1:8124/samguk/docs/design/production/motion-v2.html). 장비의 현재 등록은 위 프로토타입 변환본이며 이 화면은 이전 자료다.

## 승인된 결과물
>>>>>>> Stashed changes

- [유비](liu-bei/README.md): idle / run
- [관우](guan-yu/README.md): idle / run
- [장비](zhang-fei/README.md): idle / run

각 이동 폴더에 투명400×440 개별6프레임, 가로 시트, 프레임 보기, 일반/느린GIF와 animation.json이 있다. 이동18프레임은 최종 승인본과 픽셀 동일 검증 완료. 관우·장비 idle은 한 손으로 무기를 땅에 짚는 정지 자세, run은 양손 자세다. 유비 idle은 쌍검 준비 자세다.

<<<<<<< Updated upstream
## 작업 기준과 필수 베이스

- [다음 장수용 모션 가이드](docs/motion-guide/README.md): 승인18프레임·GIF, 관절·비율·합성 명세, 실패 원인과 검수 절차.
- [디자인 가이드](docs/DESIGN_GUIDE.md)
- [작업 지침](AGENTS.md)
- [재생성 원본·코드·동작 좌표](tools/character-motion/README.md)
- [원작 참고자료](docs/design/references/original-game/README.md)
- [기존 승인 마을·캐릭터 참고7컷](docs/design/references/samguk-base-style/)

`docs/design`에는 참고자료만 보존한다. 원작 스크린샷과 기존 승인7컷은 시행착오 이미지와 구분해 유지한다. 다음 모션의 종류는 아직 선택 전이다.

정리 방식: 이전 작업폴더는 프로젝트에서 제거하고 Windows 휴지통으로 이동했다. 생성 도구의 앱 캐시나 다른 프로젝트 파일은 정리 범위에 포함하지 않았다.
=======
### 정지 유닛 그림 — 2026-10-23

유비(`SG_U0001`)·관우(`SG_U0002`)·장비(`SG_U0003`)·황건적 졸병(`SG_M0001`)의 아이콘, 전신 초상화, 정지 그림을 `art/samguk/units/<ID>/`에 제작하고 `units.json`에 연결했다. 신규 그림은 기존 승인 기준을 대체하지 않는다. 이번 산출물에는 모션 프레임이 없다.

[그림 모음](docs/design/production/unit-art-preview.png) · [제작·검수 기록과 프롬프트](docs/design/production/README.md) · [원작 유닛 비교 맵](content/samguk/maps/정지그림_검수.map.json)

- [AGENTS.md](AGENTS.md): 이후 작업자가 따라야 할 지침과 보류 결정.
- [협업 구조](docs/COLLABORATION.md): 기획·디자인·개발 역할, 폴더·파일 규칙, 맵 메이커 사용법. 그림 규격은 [art/samguk/README.md](art/samguk/README.md), 기획 규칙은 [docs/planning/README.md](docs/planning/README.md).
- [디자인 가이드](docs/design/SAMGUK_BASE_STYLE.md): 승인 스타일, 캐릭터 외형, 카메라·지형·조감도 규칙.
- [원작 자료와 출처](docs/design/references/original-game/README.md): 원작 스크린샷 7장과 커뮤니티 게시물 출처. 승인 목업과 구분해 유지한다.

## 공격·스킬·모션 제작 — 2026-10-23 재개

유비·관우·장비의 서기·걷기·공격·스킬 2종, 총 **143장**을 제작하고 `units.json`에 연결했다. [제작·원작 분석 기록](docs/design/production/MOTION_PRODUCTION.md) · [실시간 모션 비교](http://127.0.0.1:8124/samguk/docs/design/production/motion-review.html). 검수 맵은 `content/samguk/maps/<유비·관우·장비>_모션_검수.map.json`이다. 원작의 시간·판정·효과는 유지하며, 새 그림은 사용자 검수용이다.

사용자 결정으로 재개했다. 원작 애니메이션 데이터(상태별 프레임 수·프레임별 시간·타격 시점)와 스킬 구성을 뽑은 [모션 제작 가이드](docs/design/motion/MOTION_GUIDE.md)와 [원작 모션 레퍼런스](docs/design/motion/reference/README.md)를 기준으로 한다. 걷기(Move)·서기(Idle)부터 그린다. 정지 화면만 보고 추측하지 않는다는 원칙은 유지한다.

(이전 기록) 화면만 보고 동작을 추측하는 접근이 불충분하다고 판단해 모션 작업을 중단했었다.

## 작업 가이드

- 맵·캐릭터·몬스터를 맵 메이커에 넣기: [코덱스 작업 가이드](docs/CODEX_GUIDE.md)
- 지형·집·울타리 등 맵 부품: [맵 컴포넌트 가이드](docs/design/map/MAP_COMPONENTS.md)
- 기획(성장·진행·경제·전투 규칙과 수정 방법): [게임 체계 총정리](docs/planning/GAME_SYSTEMS.md)
>>>>>>> Stashed changes

## 숨쉬기 최종 승인본

각 장수 original에 원본 정지 이미지를 보존했다. idle에는4프레임 숨쉬기를 추가했다. [숨쉬기 재생·명세](docs/motion-guide/idle-breathing.md). 이동 최종본은 변경하지 않았다.

- 2026-10-26 유비 기본 공격·스킬1·스킬2 각8프레임 사용자 최종 승인. liu-bei/basic-attack, skill-1, skill-2 및 docs/motion-guide/liu-bei-combat.md에 보존.

- 다음 PC/세션에서 장수·모션 제작 전 [작업 이어가기](docs/motion-guide/COMBAT_HANDOFF.md)와 [새 장수 생성 조건](docs/motion-guide/CHARACTER_GENERATION_SPEC.md)을 읽는다. 머리·몸통·다리 width/height, 관절·파지·칼날 방향과 승인 상태를 확인한다.
