"""One-time, lossless asset layout migration. Do not rerun after migration."""
from pathlib import Path
import json,re,shutil,hashlib,os
R=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((R/p).read_text(encoding='utf-8-sig'))
units=read('content/samguk/units.json')
tiles=read('content/samguk/tiles.json')
if (R/'characters/manifest.json').exists():raise SystemExit('Already organized; refusing to overwrite current assets')
slug={'SG_U0001':'liu-bei','SG_U0002':'guan-yu','SG_U0003':'zhang-fei','SG_U0004':'zhao-yun','SG_N0002':'village-boy','SG_N0003':'village-elder','SG_N0004':'village-blacksmith','SG_N0005':'village-hostess','SG_N0006':'armory-guard','SG_M0001':'yellow-turban-soldier','SG_M0002':'yellow-turban-wolf','SG_M0003':'guan-hai','SG_M0004':'zhang-jiao','SG_M0005':'yellow-turban-spearman','SG_M0006':'yellow-turban-archer'}
states={'Idle':'idle','Move':'run','Attack':'basic-attack','Skill_01':'skill-1','Skill_02':'skill-2','Gather':'gather','Die':'die','Work':'work'}
mapping={};prefixes={};active=[]
def plan(src,dst):
 p=R/src
 if not p.exists():return
 if p.is_dir():
  prefixes[src+'/']=dst+'/'
  for f in p.rglob('*'):
   if f.is_file():mapping[f.relative_to(R).as_posix()]=dst+'/'+f.relative_to(p).as_posix()
 else:mapping[src]=dst
for s in ['liu-bei','guan-yu','zhang-fei','zhao-yun']:plan(s,'characters/'+s)
for p in (R/'chapter-1').iterdir():
 if p.is_dir() and p.name!='expansion-review':plan(p.relative_to(R).as_posix(),'characters/'+p.name)
plan('chapter-1','maps/chapter-1/review/characters') # restore character-specific overrides below
for p in (R/'chapter-1').iterdir():
 if p.is_dir() and p.name!='expansion-review':plan(p.relative_to(R).as_posix(),'characters/'+p.name)
for src,s in [('liu-bei','liu-bei'),('guan-yu-fresh','guan-yu'),('zhang-fei-redraw','zhang-fei'),('zhao-yun-redraw','zhao-yun')]:plan('gather-finish-2026-10-28/'+src,'characters/'+s+'/gather')
for p in (R/'gather-finish-2026-10-28').iterdir():
 if p.is_file():plan(p.relative_to(R).as_posix(),'docs/motion-guide/reviews/gather/'+p.name)
for uid in ['SG_M0005','SG_M0006']:plan('motion-cleanup-2026-10-28/'+uid,'characters/'+slug[uid]+'/sources/attack-corrections')
plan('new-motions-2026-10-28/zhao-yun','characters/zhao-yun/sources/additional-motions')
plan('corrections/2026-10-28/guan-skill2','characters/guan-yu/sources/skill-2-corrections')
for p in (R/'npc-work-2026-10-28').iterdir():plan(p.relative_to(R).as_posix(),'characters/'+p.name+'/work')
portraits={'boy':'village-boy','elder':'village-elder','blacksmith':'village-blacksmith','hostess':'village-hostess','guard':'armory-guard','guan-hai':'guan-hai','zhang-jiao':'zhang-jiao'}
plan('npc-portraits-2026-10-28','docs/motion-guide/reviews/npc-portraits')
for p,s in portraits.items():plan('npc-portraits-2026-10-28/'+p+'.png','characters/'+s+'/portrait/portrait.png')
plan('art/samguk/motions/2026-10-28/zhang-jiao','characters/zhang-jiao/sources/skill-corrections')
plan('art/samguk/motions/2026-10-28/MANIFEST.json','characters/zhang-jiao/sources/skill-corrections/MANIFEST.json')
plan('art/samguk/motions/2026-10-28/README.md','characters/zhang-jiao/sources/skill-corrections/README.md')
for src,dst in [('map-detail-2026-10-28','maps/chapter-1/history/detail'),('map-polish-2026-10-28','maps/chapter-1/history/polish'),('docs/design/maps/chapter-1','maps/chapter-1/docs'),('art/objects/chapter-1','maps/chapter-1/archive/building-drafts'),('art/environment/chapter-1','art/terrain/sources/base'),('art/environment/chapter-1-polish','art/terrain/sources/additions')]:plan(src,dst)
for t in tiles['tiles']:
 for k in ['sprite','material']:
  if t.get(k):plan(t[k],'art/terrain/'+Path(t[k]).stem+'/'+Path(t[k]).name)
# Capture the exact active bytes before moving any older corrected version.
for u in units['units']:
 s=slug[u['id']]
 for state,files in u['art']['frames'].items():
  for i,src in enumerate(files):active.append((u['id'],state,i,src,f'characters/{s}/{states[state]}/frame-{i+1:02}.png',(R/src).read_bytes()))
original_paths=list(mapping)
for src,dst in list(mapping.items()):
 if dst in {a[4] for a in active}:
  wanted=next(a[5] for a in active if a[4]==dst)
  if (R/src).read_bytes()!=wanted:
   mapping[src]='characters/'+dst.split('/')[1]+'/archive/replaced/'+('/'.join(dst.split('/')[2:]))
assert len(set(mapping.values()))==len(mapping),'Destination collision'
for src,dst in mapping.items():
 a=(R/src).resolve();b=(R/dst).resolve()
 assert a.is_relative_to(R) and b.is_relative_to(R)
 assert not b.exists(),dst
 b.parent.mkdir(parents=True,exist_ok=True);shutil.move(str(a),str(b))
# Rebase file links from their old location; then replace repository-relative paths in code/data/docs.
reverse={v:k for k,v in mapping.items()}
replacements={**prefixes,**mapping}
pattern=re.compile('|'.join(re.escape(s) for s in sorted(replacements,key=len,reverse=True)))
text_ext={'.md','.json','.js','.mjs','.py','.html','.css','.bat','.txt'}
files=[p for p in R.rglob('*') if p.is_file() and p.suffix in text_ext and not any(x in p.parts for x in ['.git','re','node_modules']) and p.name!='organize_assets.py']
for p in files:
 try:s=p.read_text(encoding='utf-8-sig')
 except UnicodeError:continue
 old=reverse.get(p.relative_to(R).as_posix(),p.relative_to(R).as_posix())
 if p.suffix in {'.html','.md','.css'}:
  def link(m):
   val=m.group(2)
   if val.startswith(('http:','https:','data:','#')):return m.group(0)
   target=(R/Path(old).parent/val).resolve()
   if not target.is_relative_to(R):return m.group(0)
   rel=target.relative_to(R).as_posix();dest=mapping.get(rel)
   if dest:return m.group(1)+os.path.relpath(R/dest,p.parent).replace('\\','/')+m.group(3)
   return m.group(0)
  s=re.sub(r'((?:src=|href=)[\"\'])([^\"\']+)([\"\'])',link,s)
  if p.suffix=='.md':s=re.sub(r'(\]\()([^\)]+)(\))',link,s)
 s=pattern.sub(lambda m:replacements[m.group(0)],s)
 p.write_text(s,encoding='utf8')
# Units paths must point to contiguous current sets, never mixed correction directories.
units=read('content/samguk/units.json');manifest={}
for uid,state,i,src,dst,data in active:
 p=R/dst;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
 u=next(u for u in units['units'] if u['id']==uid);u['art']['frames'][state][i]=dst
 manifest[dst]=hashlib.sha256(data).hexdigest()
(R/'content/samguk/units.json').write_text(json.dumps(units,ensure_ascii=False,indent=2),encoding='utf8')
(R/'characters/manifest.json').write_text(json.dumps({'purpose':'Active frames; pixel bytes preserved during folder refactor','sha256':manifest},indent=2),encoding='utf8')
(R/'docs/ASSET_PATH_MIGRATION.json').write_text(json.dumps(mapping,ensure_ascii=False,indent=2),encoding='utf8')
# Remove only now-empty source folders inside this repository.
for p in sorted(R.rglob('*'),key=lambda p:len(p.parts),reverse=True):
 if p.is_dir() and '.git' not in p.parts and not any(p.iterdir()):p.rmdir()
print('Moved',len(mapping),'files; preserved',len(active),'active frame entries')
