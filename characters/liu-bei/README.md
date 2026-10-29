# 유비 — 최종 확정

SG_U0001. 젊은 얼굴·짧은 상의·두 손 한 검 기본자세.

- original/original.png: 최종 원화
- idle: 숨쉬기4
- run: 이동6, 조운과 동일 관절 기준·좌우3프레임 교대
- basic-attack: 베기8
- skill-1: 가슴 앞 두검 교차 단일힐8
- skill-2: 머리 위 두검 교차 전체힐8

모두350×350 투명PNG. content/samguk/units.json 등록 완료. 원화 비교: /web/motion.html?units=SG_U0001&reference=SG_U0001

채집·사망·별도 초상화는 기존 실행 자산을 유지하며 새 외형으로 재작화하지 않았다. sources/final에 최종 생성 원본·요청문·관절좌표·체크섬만 보관. 이전 시안/재작업/백업 삭제. 이동 재현은 tools/render_youthful_liu_gait.py와 tools/liu_gait_shapes.py; 결과는 sources/final/rebuild-preview로 출력하며 최종본을 자동 덮어쓰지 않는다.
