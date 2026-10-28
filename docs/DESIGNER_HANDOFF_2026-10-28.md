> GitHub 통합 경로: 이 인계서의 `samguk/` 접두사는 저장소 루트에 대응합니다. 최신 실행·검토 경로는 [통합 안내](GITHUB_DELIVERY_2026-10-28.md)를 먼저 보세요. 사용자 최종 미술 승인과 구분합니다.

# Designer → Producer 완료 인계 (2026-10-28)

사용자가 designer 작업 완료 후 producer가 종합하여 GitHub에 올리도록 명시했다. **designer는 git commit/push하지 않음.** 공유 작업 폴더 `C:/Users/pms10/Documents/work/sam_heros2`의 변경을 통합한다. 아래 경로는 이 폴더 기준.

## 1. 채집과 모션체커
- 유비 색 보정, 관우/장비/조운 imagegen 신규 채집. 350x350 RGBA, 9장/767ms, 타격500ms, 마지막=첫 도끼 복귀 자세.
- 관우는 팔 보정 시안을 사용자 지시로 폐기하고 **gather-finish-2026-10-28/guan-yu-fresh/**에서 전체 새로 생성. `guan-yu-redraw`는 미참조 중간본이므로 배포할 필요 없음.
- 최종 활성: samguk/gather-finish-2026-10-28/{liu-bei,guan-yu-fresh,zhang-fei-redraw,zhao-yun-redraw}/frame-*.png. 공용 units.json 연결.
- 최종 색상 비교 final-color-audit.json: 재질별 RGB 중앙값 차이 최대 유비0/관우2/장비0.5/조운1 (255단계). 보정은 알파/순검정 픽셀 유지. 이 수치는 모든 픽셀·형태가 원본과 동일하다는 뜻이 아니며 최종 미술 승인과 구분한다.
- UnitActor.TryContinueGather + UnitBody.OnAttackEnd: 활성 Gather.continuous일 때 동일 살아있는 자원/거리/기절·정지·이동 조건을 확인해 다음 스윙 직접 연결. 다른 공격/원작 유닛에는 적용하지 않음. 벌목 종료 시 Idle 정상 복귀.
- 실제 나무 모션체커: `web/motion.html?units=SG_U0001&test=gather` (2/3/4로 장수 선택). 실제 ResourceSpawner/AI/스킬/타격 사용, 정지/단계/속도/재시작/HP/타격/숨쉬기 끼임 횟수.
- 브라우저 실측: 네 장수 각각 나무HP4→0, 타격4회, 반복 중 숨쉬기0회. 마지막 관우 fresh 교체 후에도 재검증.
- 코드: web/src/game/{actor/UnitActor.js,actor/UnitBody.js,ai/BT.js}, web/src/packs/customMotion.js, web/src/maker/{motion.js,motion_checker.js}.

## 2. 대화 NPC 초상화 7종
- samguk/npc-portraits-2026-10-28/: 소년, 노인/마을대표, 주모, 훈련병사, 관해, 장각, 대장장이.
- units.json art.portrait 연결. Chapter1의 기존 SPEAKERS→unit→portrait 경로 사용. 대장장이는 초상화만 준비하며 새 대사를 임의로 추가하지 않음.
- sources/에도 생성 원본 복사해 다른 PC 경로 의존 없음. review.png로 전체 비교 가능.

## 3. 황건 창병/궁병 시트 잘림
- samguk/motion-cleanup-2026-10-28/SG_M0005,SG_M0006 활성 Attack 프레임 등록.
- 창병3번의 옆 그림 조각 제거. 양쪽5·6번은 원본 시트에서 전체 캐릭터 연결 영역을 재추출: 잘린 오른쪽 팔/옷/발 복구 + 옆 프레임 조각 제거. 궁병5번의 실제 화살/잔상 보존.
- 기타 idle/run 및 공격 타이밍은 유지. final-review.png 검토.

## 4. 황건소탕 맵 마감
- art/environment/chapter-1-polish/: 신규 소품6종(장터/평상/어구/벌목대/작은사당/보급대), tiles.json 등록 총46종.
- 기존 맵에 비차단 장식209개, 길/공터 내부 작은 틈57칸 흙으로 보충. 생활·채집·강가·군영별 작은 장면, 길 위에 대형 소품 배치하지 않음.
- 물 좌표 유지: 다리 양쪽 강131칸씩, 독립 마을연못6칸. 노출 모서리 둥글게/물가 선, 내부 연결선 제거. 길 폭과 흙 가장자리 정리, 초원 완만한 색변화.
- 코드: web/src/packs/materialTiles.js, web/src/game/map/TileResolver.js.
- 데이터: samguk/content/samguk/{units.json,tiles.json,maps/1장_황건소탕.map.json}, import-manifest.json.
- 백업/배치: samguk/map-polish-2026-10-28/{before.map.json,placements.json,README.md}. 이전 map-detail 작업도 현맵에 포함됨.
- 지도/물/차단/스포너/진행시설/NPC/유닛/자원 좌표 그대로. 전체52900검사칸의 walkability 변화0, 보행29190칸. 주요9동선 연결, NPC보행 위치 확인. 전체 플레이 클리어 검증은 아님.

## 검증 명령
- node tools/test_continuous_gather.mjs
- node tools/test_custom_motion.mjs
- node tools/test_pack_frames.mjs
- node tools/test_designer_finish.mjs
- node tools/.verify_chapter1_import.mjs (57칸 보충 허용, 원본 길 유지 검사로 갱신)
- python tools/scripts/verify_character_delivery.py

검토 파일: docs/chapter1-polish-village.png, samguk/gather-finish-2026-10-28/final-review.png, samguk/npc-portraits-2026-10-28/review.png.
현재 리소스는 검토 가능한 완성 제출본이며 사용자 최종 미술 승인으로 자동 표시하지 않는다.
