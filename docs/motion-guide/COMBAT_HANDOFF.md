# 다른 PC에서 이어가기 — 유비·관우 공격 제작

기록일 2026-10-26. 다음 세션은 이 문서 → [새 장수 생성 조건](CHARACTER_GENERATION_SPEC.md) → 해당 장수 모션 문서 → 실제 PNG/GIF 순서로 읽는다.

## 현재 상태

- 유비 기본 공격·스킬1·스킬2: 각8프레임 **사용자 최종 승인**. 기존 상태 유지.
- 관우 기본 공격·스킬1·스킬2: 각8프레임 **수정 검토본**. 아직 최종 승인 아님.
- 관우 최신 요구: 칼날의 매끈한 날이 바깥/베는 방향을 향하도록 교정. 기본 공격은 위→대각 아래 한 번 베기+잔상. 스킬1은 서로 반대 대각 두 번 베기+X 잔상. 스킬2는 크게 들어 내려찍기+더 큰 잔상.
- 유관장 original/idle/run 승인본은 그대로 유지했다. 관우 공격의 칼날 수정은 아직 original/idle/run에 전파하지 않았다. 정지 전환 시 칼날 방향 차이를 확인하고 사용자 승인 범위에 맞춰 후속 처리한다.
- 장비 공격은 아직 요청/제작하지 않았다. 게임 피해량, 판정, 쿨타임은 구현 범위 밖이다.

## 어디서 확인하나

| 자료 | 경로 |
|---|---|
| 유비 제작 명세 | [liu-bei-combat.md](liu-bei-combat.md) |
| 관우 제작 명세 | [guan-yu-combat.md](guan-yu-combat.md) |
| 유비 재생 | [combat-preview](../../liu-bei/combat-preview/index.html) |
| 관우 재생 | [combat-preview](../../guan-yu/combat-preview/index.html) |
| 기본 외형·정지 원본 | 각 장수 original/original.png |
| 공격 원본 시트 | tools/character-motion/combat-sources (유비), guan-yu-combat-sources (관우) |
| 분리·정렬 재현 | tools/character-motion/package_liu_bei_combat.py, package_guan_yu_combat.py |
| 이동 재현 | tools/character-motion/render.py, parts-atlas.png, joint-data.json |
| 숨쉬기 재현 | tools/character-motion/render_idle.py |

## 다른 PC로 옮길 파일

프로젝트의 `docs`, `tools/character-motion`, `liu-bei`, `guan-yu`, `zhang-fei`, `README.md`, `AGENTS.md`를 함께 옮긴다. 생성 원본을 프로젝트 안에 복사해 두었으므로 이전 PC의 `.codex/generated_images`나 Temp 폴더에 의존하지 않는다. 문서·재생 페이지는 상대 경로를 사용한다. 프로젝트 폴더명과 위치는 달라도 된다.

문서 저장은 GitHub 업로드와 별개다. 커밋·푸시되지 않은 파일은 다른 PC에서 pull만 해서 받을 수 없다. 작업 폴더 또는 전달 압축본을 복사하거나 사용자 작업 흐름에 따라 Git에 반영한다. 이 가이드 작성에서 자동으로 커밋/푸시하지 않았다.

## 실행

PNG/GIF는 설치 없이 볼 수 있다. 프레임 재생 페이지는 HTML을 브라우저로 열거나 프로젝트 루트에서 `python -m http.server 8765` 후 `/guan-yu/combat-preview/index.html` 또는 `/liu-bei/combat-preview/index.html`을 연다.

재출력에 필요한 Python 패키지: Pillow, numpy, scipy. `python -m pip install Pillow numpy scipy`로 설치한다. 해당 패키징 스크립트를 프로젝트 루트에서 실행하면 현재 소스 시트를 다시 분리·정렬한다. **이미지 생성은 실행하지 않는다.** 승인 산출물 폴더를 덮어쓰므로 단순 확인을 위해 재실행할 필요는 없다. 수정 시 별도 후보 폴더와 상태를 사용한다.

## 생성 작업을 이어가는 방법

시각 참조로 각 장수 original과 양손 파지를 보여주는 run/frame-01을 전달한다. 우하향·짧은 다리·얼굴·복식·무기 규칙과8프레임별 동작을 명시한다. 시트는4열2행, 각 칸에 전신·무기·잔상이 완전히 들어가고 넓은 투명 여백이 있어야 한다. 번호·글자·그리드·배경은 넣지 않는다. 변형 시 원본 시트를 참조해 필요한 부위만 수정한다.

유비: 기본=두검 평행 전방 찌르기 / 스킬1=가슴 앞 X로 모으기 / 스킬2=머리 위 X로 모으기. 관우: 기본=한 대각 하향 베기 / 스킬1=대각 두 번 / 스킬2=큰 상단 준비 후 내려찍기. 잔상은 칼날의 **지난 경로**에 남고 복귀 때 사라져야 한다. 관우 스킬2는 기본보다 넓고 큰 궤적, 얼굴과 손은 읽힐 정도로 유지한다.

이미지 생성은 프레임 간 외형이 미세하게 변할 수 있다. 프레임마다 새로 생성해 이어 붙이면 일관성이 더 떨어질 수 있으므로 한 시트의 스케일을 유지한다. 정확한 고정 리그가 필요하면 별도 레이어 제작이 필요하다. 현재 시트가 레이어 리그인 것처럼 설명하지 않는다.

## 검수·승인

1.8장의 순서/준비/베기/복귀 확인. 2.발 기준과 캐릭터 축척 확인. 3.손·자루 연결 및 직선성 확인. 4.칼날이 아닌 칼등으로 때리는 프레임이 없는지 확인. 5.잔상 방향·크기·소멸 확인. 6.정상·느린GIF와 idle 전환 확인. 7.사용자 승인 후에만 status=approved 및 가이드 갱신.

이전 실패안은 승인 기준으로 사용하지 않는다. 현재 원본 시트와 출력물이 이어가기 기준이다. 변경이 없는 승인 파일은 run-checksums.json, idle-checksums.json, combat-checksums.json(유비)으로 확인할 수 있다.
