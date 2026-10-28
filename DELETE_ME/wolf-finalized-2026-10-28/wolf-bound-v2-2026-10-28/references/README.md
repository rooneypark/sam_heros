# 동물 달리기 참고 — 2026-10-28

1. Motion Zoo, 애니메이터 아비하루의 직접 제작한 개 보행/달리기 설명과 GIF.
https://motionzoo.net/dog_walk_gaits/
원본 GIF: https://motionzoo.net/wp-content/uploads/2024/01/Dog_Gallop_Loop.gif
그림: https://motionzoo.net/wp-content/uploads/2024/03/ad874470f9557c2258d59145a70fc2f8.jpg
GIF17장을 디코딩하여 접지와 발 회수 순서를 확인했다. analysis-contact-sheet.jpg는 분석용12표본이다. 이 자료는 원작 우르르용병단 동작 데이터가 아니다. 저작권은 원 제작자에게 있고 게임에 납품하지 않는다. 생성 참조에는 자세 순서만 사용했다.

2. Polycount 제작자 피드백 토론
https://polycount.com/discussion/170542/quadruped-walk-and-run
다리 회수 중 튐, 접지 전에 앞발을 너무 일찍 뻗는 문제에 대한 의견을 참고했다. 댓글을 생물학적 정답으로 간주하지 않고 직접 동작 자료와 대조했다.

적용: 앞발 지지→뒷발 회수/지지→뒷발 추진→공중 뻗기→앞발 착지. 기존의 뻗기 직후 공중 모으기는 제거. 프레임별 큰 기울기와20px 높이 점프를 줄인다. 작은 게임 캐릭터용으로 단순화한6프레임이며 실사 동작의 완전 재현은 아니다.
