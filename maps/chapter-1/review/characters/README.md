# 1장 주민·황건적 — 최종 승인

2026-10-27 사용자 전체 확정. [전체 모션 재생](index.html) · [최종 파일 묶음](chapter-1-final.zip).

7종, 21개 모션, 애니메이션 프레임 126장. 모든 게임용 프레임은 350×350 투명 PNG, 왼쪽 시선, PPU100, pivot(0.5,0.3)이다.

- village-woman / village-boy / village-elder: 숨쉬기4, 이동6
- yellow-turban-wolf: 숨쉬기4, 이동6, 일반공격8
- yellow-turban-soldier: 숨쉬기4, 이동6, 일반공격8
- guan-hai: 숨쉬기4, 이동6, 일반공격8, 스킬1 8
- zhang-jiao: 숨쉬기4, 이동6, 일반공격8, 스킬1 8, 스킬2 8

각 original/original.png는 확정 원화, original/source.png는 고해상도 제작 원본이다. 모션 폴더의 frame-*.png가 최종 구현 기준이며 spritesheet.png, animation.json, preview.gif, preview-slow.gif를 함께 제공한다. source-sheet.png는 제작 참조이며 최종 정렬을 재현하려면 반드시 frame PNG를 기준으로 한다.

졸병·관해는 좁은 옷자락과 모은 발, 관해는 약한 상체 근육이 최종 외형이다. 일반공격은 프레임 전체의 정수 이동만으로 위치를 보정했다. 프레임별 크기 변경은 하지 않았다. 시작과 마지막 정지 이미지는 원화와 동일하다.

FINAL_MANIFEST.json에 승인 PNG의 SHA256을 기록했다. 다시 그리거나 이전 생성기로 덮어쓰지 않는다. 최종 PNG와 animation.json만으로 시트와 GIF를 재구성할 수 있다.

이전 시안·보정 전 파일·옛 생성기는 ../DELETE_ME/chapter-1-intermediate-2026-10-27/로 이동했다. 해당 폴더를 통째로 삭제해도 현재 최종 PNG·모션 재생에는 영향이 없다. 이미지 생성 서비스의 전역 저장소나 다른 장수 승인 자료는 정리 대상에서 제외했다.
