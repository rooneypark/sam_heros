# UI·도구 화면 참고

**실제 수정은 [art/ui 편집 원본·가이드](../../art/ui/README.md)에서 한다.** 이 폴더 PNG는 결과 확인용이다.

2026-10-28. 재디자인 검토용. 게임 코드를 재사용한 별도 브라우저 예시 상태이며 실제 챕터 클리어·최종 미술 승인이 아니다. main 세이브와 분리했다.

[통합 실행 안내](../GITHUB_DELIVERY_2026-10-28.md) · [전체 UI 보드](ui-overview.png) · [도구 보드](tools-overview.png)

## 화면별 원본과 재생 경로

| 화면 | PNG | 실행 코드/경로 |
|---|---|---|
| 인트로 시안 | [01-intro.png](01-intro.png) | web/src/packs/chapter1/introSplash.js; /web/ui-review.html?view=intro |
| 게임 HUD | [02-hud.png](02-hud.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=hud |
| 대화·NPC 초상화 | [03-dialog.png](03-dialog.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=dialog |
| 부대 훈련 | [04-training.png](04-training.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=training |
| 훈련 잠금 안내 | [05-locked.png](05-locked.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=locked |
| 모닥불 회복 | [06-rest.png](06-rest.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=rest |
| 다리 복구 | [07-bridge.png](07-bridge.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=bridge |
| 보스 HP·목표 | [08-boss.png](08-boss.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=boss |
| 1장 완료 | [09-complete.png](09-complete.png) | web/src/packs/chapter1/ui.js; /web/ui-review.html?view=complete |
| 환경설정·기존 엔진 | [10-settings.png](10-settings.png) | web/src/game/Option.js (기존 엔진 참고); /web/ui-review.html?view=settings |
| 조작 조이스틱 | [11-controls.png](11-controls.png) | web/src/game/ui/UIManager.js; /web/ui-review.html?view=controls |
| 맵메이커 | [map-maker.png](map-maker.png) | /web/maker.html?samgukMap=1장_황건소탕 |
| 나무 모션 체커 | [motion-checker.png](motion-checker.png) | /web/motion.html?units=SG_U0002&test=gather |

## 디자인 갱신 검토 자료

- [네 장수 채집](../motion-guide/reviews/gather/final-review.png)
- [NPC 초상화 7종](../motion-guide/reviews/npc-portraits/review.png)
- [창병·궁병 공격 교정](../../motion-cleanup-2026-10-28/final-review.png)
- [마을 소품·지형 정리](../chapter1-polish-village.png)

PNG와 함께 -context.png에는 검토 페이지 제목·예시 상태 안내를 포함했다. manifest.json에 각 화면의 모드·경로·오류 여부를 기록했다. 환경설정은 기존 엔진 화면을 호출한 참고본이며 현재 삼국HUD의 설정 버튼 신규 연결을 의미하지 않는다.

훈련 효과/비용·보스 HP·자원량은 시연용으로 구성했다. 화면 캡처를 밸런스 최종값이나 실제 플레이 결과로 인용하지 않는다. 기존 주점·영웅관리·명성·원작 훈련 UI 코드는 저장소 web/src/game에 유지돼 있지만 이번 삼국 기능 채택·신규 UI 승인으로 간주하지 않는다.
