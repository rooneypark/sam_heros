# 황건소탕 전체 환경 재작화 — 2026-10-28 검토본

사용자 규칙: 원작 지형지물의 색감·색상·크기·디테일에 맞춘다. 기존 지형지물을 제거하고 황건소탕용 대체 자산으로 배치한다. 자연·길·지형도 다시 그린다.

## 현재 파일

- 실제 지도: content/samguk/maps/1장_황건소탕.map.json
- 공용 등록: content/samguk/tiles.json — **sg2_ 40종**
- 그림: art/environment/chapter-1/ — 자연12종, 건축/시설12종, 생활/군영 소품12종, 지면 재질3장.
- 지형 브러시4종: 초원, 흙길, 흙마당, 강·연못. 생성한 재질 그림을 로딩 시 마름모 격자와 이웃 연결 마스크에 투영한다. 원작 그림/알파를 복제하지 않는다.
- 마스크 구현: web/src/packs/materialTiles.js. 각16방향 연결 조합. 이웃 검사: TileResolver의 SamgukMaterialTile.
- 재포장/배치: tools/map-art/redraw_environment.py. **현재 사용자가 편집한 지도를 덮어쓰므로 일반 편집 뒤에는 재실행하지 않는다.**

모든 mapData/roadData/waterData/blockData/decoData가 sg2_ 자산만 참조한다. 원작 자산 파일 자체는 다른 맵이 사용하므로 삭제하지 않았다. 이전 맵은 layout-before-full-redraw.map.json에 복구용으로 보존한다. 이전 package_chapter1.py는 과거 버전용이다.

## 배치와 크기

마을은 초가·주막·대장간·무기고와 채소밭, 군영은 황색 깃발·병영·초소·감옥·무기 거치대, 북쪽 진지는 마른 나무·가시 덤불·제단으로 구분한다. 기존 환상적인 들판 오브젝트와 거대한 곡식 장식은 제거했다. 풀꽃은 작게, 바위는 중간, 건물은 약275~300px 폭, 나무190~210px 폭이다. 캐릭터와 같은 PPU100, 산과 바닥 PPU120. 형상은 동일축 축소했다.

기존 주요 이동·구출·전투 좌표와 지형 통행 레이어 좌표는 보존한다. 새 충돌 오브젝트가 유닛/NPC에 걸리는 경우 같은 구역의 길 밖으로 옮겼다. 자원 나무80개는 외형만 새 나무/그루터기로 바꾸고 HP·채집량·재생성 동작은 유지한다. 맵별 environmentArt로 적용하며 다른 원작 맵에는 적용하지 않는다. 모닥불·훈련·다리·산길 진행 시설도 새 소품으로 시각화한다. 원작 NPC 캐릭터 표현은 지형 교체 범위와 별개다.

## 표현 근거와 생성 기록

내장 image_gen 사용. 시각 참조는 실제 기존 엔진 지도 docs/design/maps/chapter-1/map-maker-preview.png, docs/design/maps/portable-maker-check.png와 승인 유비 original/original.png. 과거 가이드의 마을 승인 이미지7컷과 원작 스크린샷7장은 로컬에서 누락되어 사용하지 못했다. 존재하지 않는 자료를 확인했다고 주장하지 않는다.

공통 프롬프트: Rumble Heroes식 평면2D, 제한된2~3명암, 초록/황토 팔레트, 둥글고 큰 형태, 읽기 쉬운 짧은 외곽선, 목재 결·잔무늬·사실적인 재질 배제, 위에서 내려다보는 사선 시점. 삼국지 농촌/황건군 전용 사물로 구성, 투명 스프라이트 시트. sources/의 nature/village/props는 각각4×3시트. materials는 초원·흙·물3재질 가로시트. 패키징은 잘라내기·동일축 크기 조정만 사용했다.

## 확인

tools/map-art/verify_chapter1.mjs: 원작 타일 잔존0, 미등록타일0, 게임 진행데이터 및 유닛33/자원80 보존, 기존 통행 가능한 유닛/NPC 자리 유지, 주요9지점 flood-fill 연결. tools/verify_portable.py로 캐릭터/필수자산 확인. 지도 전체 클리어를 자동 검증했다는 의미는 아니다.
