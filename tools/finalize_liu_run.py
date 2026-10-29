from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';W=C/'sources/commander-motions'
notice='> 최신 사용자 확정: 새 군주 외형의 이동 6프레임(run/) 전체 재작화본 승인. 상하체 합성본은 폐기하며 `sources/commander-motions/run-full-redraw/source.png`와 현재 run/ PNG를 기준으로 한다. 다른 새 모션의 최종 승인 여부와 구분한다.\n\n'
for p in [C/'README.md',R/'docs/motion-guide/CURRENT_CHARACTER_RULES.md',R/'AGENTS.md']:
    s=p.read_text(encoding='utf8');p.write_text(notice+s,encoding='utf8')
p=W/'README.md';s=p.read_text(encoding='utf8')
start=s.index('이동 생성 시트는');end=s.index('\n\n',start)
s=s[:start]+'이동은 사용자 승인된 전체 재작화 6프레임이다. 상체와 다리를 합성하지 않는다. `run-full-redraw/source.png`를 단일 공통 배율로 분할하고 정수 위치 정렬했다. 기존 합성본·실패 시트·밑단 검사 이미지는 `DELETE_ME/liu-bei-run-rejected/`로 격리했다. `Move-poses.png`는 기존 동작 참조로 보존한다.'+s[end:]
s=s.replace('재현: `tools/export_liu_commander.py` → prepared/ 검토 → `tools/install_liu_commander.py` → `tools/rebuild_character_previews.py`.','이동 재현: `tools/liu_run_full_redraw.py` → `tools/rebuild_character_previews.py`. 이전 export/install 생성기는 덮어쓰기 방지로 중단 처리했다.')
p.write_text(notice+s,encoding='utf8')
p=W/'run-full-redraw/README.md';p.write_text('# 유비 이동 — 최종 승인\n\n새 군주 복식의 전신 재작화 6프레임. 350×350 RGBA, 각100ms, 왼쪽 시선. 상하체 합성·밑단 국소 덧칠 금지. source.png는 내장 imagegen 생성 원본, alignment.json은 공통 배율과 프레임별 정수 위치 정렬 기록이다. 재현: tools/liu_run_full_redraw.py. 실행 원본: characters/liu-bei/run/. 다른 PC에서도 저장소 source.png만 사용한다.\n\n생성 조건: 현재 original의 외형과 Move-poses의 기존6자세, 쌍검·닫힌 도포 밑단·짧은 다리 유지, 전체 인물을 한 번에 재작화, 투명 배경. 프레임별 확대축소 및 몸통/다리 재합성 금지.\n',encoding='utf8')
p=W/'manifest.json';m=json.loads(p.read_text(encoding='utf8'));m['stateApprovals']={'Move':'approved'};p.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
print('Move approval and current production guide recorded')
