<!-- CURRENT_LAYOUT -->
# 조운 — 현재 리소스

ID `SG_U0004`. [전체 모션 미리보기](preview/index.html). 등록 원본은 `content/samguk/units.json`.

현재 모션: `idle/` (Idle, 4장), `run/` (Move, 6장), `basic-attack/` (Attack, 7장), `skill-1/` (Skill_01, 8장), `skill-2/` (Skill_02, 8장), `gather/` (Gather, 9장), `die/` (Die, 1장)

개별 frame PNG가 실행 원본이며 같은 폴더에 시트·GIF·시간정보를 둡니다. sources/는 제작 근거, archive/는 대체된 파일로 실행에 사용하지 않습니다. 이번 정리는 그림 변경이나 추가 승인이 아닙니다.

---

# 조운 — 청공검 전용 최종본

사용자가 청공검 원화 및 모든 제작 모션·초상화를 승인했다.

- original: 청공검 원화 승인
- idle: 숨쉬기4프레임 승인
- portrait: 초상화 승인
- basic-attack: 기본공격7프레임 승인
- skill-1: 상승베기8프레임 승인
- skill-2: 상승회전검기8프레임 승인
- run: 이동6프레임 최종 승인

350×350 투명PNG, 왼쪽 시선, PPU100, pivot(0.5,0.3). approved-manifest.json은 승인 이미지 지문이다.
이전 창 원화·조운 시안·옛 생성기는 삭제 정책 차단으로 ../DELETE_ME_intermediate/zhao-yun-final-cleanup/에 격리했다.
이동은 승인 유비의 허벅지/신발 곡선과 관절 위상·대각 투영을 적용했다. 조운 밑단에 맞춘 관절은 run/animation.json, 재현 코드는 ../tools/character-motion/render_zhao_run.py. 비교 GIF는 run/comparison.gif.
