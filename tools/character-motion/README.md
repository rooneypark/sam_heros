# 최종 캐릭터 재생성 베이스

다음 세션의 작업 설명과 시각 참고는 [docs/motion-guide](../../docs/motion-guide/README.md)에 있다. 새 장수 제작 전 상세 명세와 검수 절차를 읽는다. 가이드용 그림만 갱신하려면 프로젝트 루트에서 `python docs/motion-guide/build_references.py`를 실행한다. 이 명령은 최종 캐릭터 파일을 수정하지 않는다.
render.py: 상체 원본+닫힌 곡선 하체를 합성하는 재현 코드.
parts-atlas.png: 최종 상체·무기 원본. 하단의 기존 다리 이미지 대신 코드의 승인된 곡선 하체를 사용한다.
joint-data.json: 최종 18프레임 좌표.

프로젝트 루트에서 `python tools/character-motion/render.py`로 최종 세 캐릭터 폴더를 재생성한다. Python, Pillow, numpy, scipy 필요. 이전 버전이나 임시 파일에 의존하지 않는다.

idle-sources/: 관우·장비 한 손 지면 지지 기본자세 생성 원본. 내장 이미지 편집 프롬프트: 현재 외형·오른쪽 방향 유지, 한 손으로 수직의 곧은 무기를 잡고 끝은 발바닥 높이 지면에 접촉, 다른 손은 허리. run과 별도 원본을 사용한다.

render_idle.py: 각 장수 original/original.png에서4프레임 숨쉬기를 출력한다. 고정영역과 상세 규칙은 docs/motion-guide/idle-breathing.md 참조. render.py의 정지 이미지 출력과 별도이며 run을 수정하지 않는다.
