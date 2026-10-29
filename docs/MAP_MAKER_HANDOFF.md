> **2026-10-28 맵·신규 캐릭터 인계:** [현재 리소스 위치와 다른 PC 실행 가이드](CHAPTER1_MAP_CHARACTERS_HANDOFF.md)를 먼저 읽는다. 황건 창병·궁병·대장장이·주모 4종 추가, 총15종. 신규4종과 맵 재작화는 검토본이며 아직 승인 전이다.

> 2026-10-28 늑대 전체 최종 승인: maps/chapter-1/review/characters/yellow-turban-wolf, 크기 보정 포함. 가이드 docs/motion-guide/wolf/README.md. 이전 작업은 DELETE_ME/wolf-finalized-2026-10-28.

> 2026-10-28 늑대 최신 승인: maps/chapter-1/review/characters/yellow-turban-wolf에 축소 외형·숨쉬기·물기와 dog-reference-v7 이동6프레임(각80ms)을 반영. SG_M0002 모션체커/맵메이커 공통 자산. 이전 늑대는 DELETE_ME/wolf-before-approved-v7-2026-10-28 보존.

> **2026-10-28 최신 전체 승인·정리:** 유비·관우·장비 최종본은 루트 `characters/liu-bei/`, `characters/guan-yu/`, `characters/zhang-fei/`에 통합했다. 맵메이커·모션체커도 같은 파일을 참조한다. 장비 공격·스킬1 색상 보정, 불꽃 방어 버프까지 승인. 기본공격·스킬1·2 각8장, 접지(175,245), 왼쪽 시선. 이전 경로·승인 보류·관우 Y260/7프레임 안내보다 우선한다. 체크섬: `docs/motion-guide/FINAL_HEROES_2026-10-28.json`. 늑대 신규 재작업은 이 승인에 포함하지 않는다.

> 2026-10-28 최신 실행 반영: 유관장9모션과 장각 스킬2는 art/samguk/motions/2026-10-28/가 현재 맵메이커·모션체커 자산이며 content/samguk/units.json에 등록됨. MANIFEST.json 참조. 새 관우 공격은 접지Y245/pivot(0.5,0.3), 과거Y260 예외와 구분. 이전 원본은 보존.

# 다른 PC에서 맵 제작 시작하기

## 실행
1. GitHub Desktop에서 이 저장소를 Clone 또는 Pull 한다. ZIP으로 받았다면 압축을 완전히 푼다.
2. Python 3를 설치한다. 설치 시 Add Python to PATH를 체크한다. Node, npm, Unity, 별도 서버 설치는 필요 없다.
3. 루트의 `run_maker.bat`를 더블클릭하면 챕터1 맵이 열린다. `run_motion_checker.bat`는 모션 체커, `run_maps.bat`는 전체 맵 목록이다.
4. 서버 창을 작업하는 동안 열어 둔다. 브라우저는 Chrome/Edge 최신 버전을 권장한다. HTML 파일을 직접 더블클릭하지 않는다.

기본 포트는 8134이며 사용 중이면 8154까지 빈 포트를 찾는다. 기존 다른 프로젝트의 8124 서버와 섞이지 않는다. 캐릭터는 이 저장소의 유비·관우·장비·조운·주민·황건적 등 원본 11종이다. sam_heros2의 재작화 v1~v14는 가져오지 않았다. 원작 캐릭터는 배치 목록과 모션 체커에서 제외했다. 기존 맵을 열고 지형을 편집하는 데 필요한 지형·엔진 데이터는 포함했다.

## 챕터1 시안
- [챕터1 조감도](design/maps/1장_황건소탕_overview.png)
- [구역별 작업 가이드](design/maps/1장_황건소탕_MAP_GUIDE.md)
- [맵 부품 규격과 등록](design/map/MAP_COMPONENTS.md)
- [챕터1 시나리오](map-planning/scenarios/1장_황건소탕.md)

시안은 큰 배치용 프로토타입이다. 구역 순서와 길 연결을 유지하면서 지형·장식을 다듬는다. 챕터1 생성 스크립트를 재실행하여 작업 맵을 덮어쓰지 않는다.

## 맵 편집
- 지형 또는 장식 브러시를 고르고 그리기 도구로 배치한다. `1` 선택, `2` 그리기, `3` 지우기.
- 회전 가능한 울타리·벽은 `R`, 선택 항목 삭제는 Delete, 되돌리기는 Ctrl+Z.
- 캐릭터는 삼국히어로즈의 진영 탭에서 선택한다. 배치 후 아군/적군과 레벨을 조절한다.
- 실행 버튼으로 통행과 전투를 확인하고 편집 모드로 돌아온다. 모션 체커에서 캐릭터별 숨쉬기·이동·공격·스킬을 확인한다.
- 기존 파일은 불러오기에서 `.map.json`, `.json`, `.bytes`를 선택한다. 전체 맵 목록에서도 바로 열 수 있다.

## 저장하고 다음 PC로 옮기기
1. 상단 맵 이름을 정한다. 별도 시안은 다른 이름을 사용한다.
2. 저장 버튼을 누른다. 실제 파일은 `content/samguk/maps/<맵이름>.map.json`에 기록된다.
3. 브라우저 자동저장은 해당 PC에만 남는다. 반드시 저장 버튼으로 파일을 만든다.
4. GitHub Desktop Changes에서 맵 JSON, 새 그림, tiles.json 등 변경 파일을 확인하고 Commit 후 Push origin 한다.
5. 다음 PC에서 Pull 후 실행한다. 새 PNG는 등록 JSON과 함께 커밋해야 한다.

## 포함된 맵
`content/samguk/maps/`의 챕터1과 전체 캐릭터 검수맵, `re/extract/text/`의 World/Dungeon 맵 데이터를 포함했다. `run_maps.bat`에서 목록을 확인한다. 브라우저에만 저장하고 파일로 저장하지 않은 개인 작업은 Git으로 이동하지 않는다.

## 문제 해결
- Python 오류: Python 3 설치 후 터미널을 다시 열고 `py -3 --version` 확인.
- 빈 화면: 서버 창 오류를 확인하고 Ctrl+F5. Chrome/Edge의 하드웨어 가속/WebGL이 켜져 있는지 확인.
- 그림 누락: GitHub에서 다운로드/체크아웃이 끝났는지 확인. `python tools/verify_portable.py` 실행.
- 저장 실패: 서버 창이 열려 있는지 확인. 브라우저가 JSON을 다운로드했다면 `content/samguk/maps/`에 복사한다.
