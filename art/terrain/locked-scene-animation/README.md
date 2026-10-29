# 통합 장면 배경 고정 검토본

기준: ../integrated-scene-redraw의 통합 장면. 별도 제작 facilities의 건물·NPC는 사용하지 않음. 해당 통합 프레임의 인물 동작을 같은 장면에 한정하여 재구성. 배경 전체는 고정 장면 1장이고 손·도구·연결 소매 주변만 전경 마스크로 갱신함. 인물 전체를 따로 디자인한 결과는 사용하지 않음.

512×512 RGB 검토 PNG 6장씩과 공통 팔레트 GIF. 마지막은 첫 자세와 동일. qa.json은 실제 동작 마스크 바깥 정지 픽셀 검사, gif-check.json은 GIF 디코딩 후 지붕·지면 정지 영역 검사. 검사는 마스크 내부의 모든 경계 품질을 보증하지 않으므로 사용자 재생 검토 전 최종 승인 처리하지 않음.

맵 등록은 아직 변경하지 않음. 재현 tools/lock_integrated_scene.py. 프레임 원천 input-*.png, 고정 바탕 locked-scene.png, 경계 motion-mask-*.png를 보존함.
