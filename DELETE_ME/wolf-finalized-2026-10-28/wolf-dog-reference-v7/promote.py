from pathlib import Path
import json,shutil,hashlib
r=Path.cwd(); src=r/'wolf-dog-reference-v7'; dst=r/'chapter-1/yellow-turban-wolf'; backup=r/'DELETE_ME/wolf-before-approved-v7-2026-10-28'
if not backup.exists(): shutil.copytree(dst,backup)
for folder in ['original','idle','run','basic-attack']:
 shutil.copytree(src/folder,dst/folder,dirs_exist_ok=True)
 if folder!='original':
  p=dst/folder/'animation.json'; d=json.loads(p.read_text());d['status']='approved';d['approved_date']='2026-10-28';p.write_text(json.dumps(d,indent=2)+'\n')
for name in ['all-frames.png','all-motions.gif','run-review.gif']:shutil.copy2(src/name,dst/name)
shutil.copy2(src/'sources/run.png',dst/'run/source-sheet.png')
p=r/'content/samguk/units.json'; data=json.loads(p.read_text(encoding='utf-8')); units=data['units'] if isinstance(data,dict) else data
u=next(x for x in units if x['id']=='SG_M0002')
for state,folder in [('Idle','idle'),('Move','run'),('Attack','basic-attack')]:
 m=json.loads((dst/folder/'animation.json').read_text());u['motion'][state]['ms']=m['durations_ms']
u['memo']='2026-10-28 사용자 승인 늑대 축소 외형 및 6프레임 달리기. Move 80ms x6. 파츠 분리 없는 재작화.'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
p=r/'chapter-1/FINAL_MANIFEST.json'; d=json.loads(p.read_text());
for f in dst.rglob('*.png'):d['sha256'][str(f.relative_to(r/'chapter-1'))]=hashlib.sha256(f.read_bytes()).hexdigest()
d['wolf_updated']='2026-10-28 approved dog-reference-v7';p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
note='> 2026-10-28 늑대 최신 승인: chapter-1/yellow-turban-wolf에 축소 외형·숨쉬기·물기와 dog-reference-v7 이동6프레임(각80ms)을 반영. SG_M0002 모션체커/맵메이커 공통 자산. 이전 늑대는 DELETE_ME/wolf-before-approved-v7-2026-10-28 보존.\n\n'
for rel in ['AGENTS.md','chapter-1/yellow-turban-wolf/README.md','docs/MAP_MAKER_HANDOFF.md']:
 p=r/rel;p.write_text(note+(p.read_text(encoding='utf-8') if p.exists() else ''),encoding='utf-8')
for f in (src/'run').glob('frame-*.png'):assert f.read_bytes()==(dst/'run'/f.name).read_bytes()
print('Approved wolf promoted; Move timing 480ms; all 6 PNG byte-identical')
