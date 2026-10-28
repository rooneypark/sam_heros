"""Install the requested motion assets into the shared maker/checker pack."""
from pathlib import Path
from PIL import Image
import json,shutil,hashlib,numpy as np,sys
from package_restart_20261028 import publish
R=Path(__file__).resolve().parents[2];review=R/'motion-restart-2026-10-28';dest=R/'art/samguk/motions/2026-10-28'
dest.mkdir(parents=True,exist_ok=True)
units_path=R/'content/samguk/units.json';before=json.loads(units_path.read_text(encoding='utf-8'));data=json.loads(json.dumps(before))
backup=review/'sources/units-before-integration.json'
if not backup.exists():shutil.copy2(units_path,backup)
states={'basic-attack':'Attack','skill-1':'Skill_01','skill-2':'Skill_02','run':'Move'}
names={'liu-bei':'유비','guan-yu':'관우','zhang-fei':'장비','zhang-jiao':'장각'}
report=[]
for hero,motions in [('liu-bei',['skill-1','skill-2']),('guan-yu',['run','basic-attack','skill-1','skill-2']),('zhang-fei',['basic-attack','skill-1','skill-2'])]:
 for motion in motions:
  src=review/hero/motion;d=dest/hero/motion;d.mkdir(parents=True,exist_ok=True)
  for pattern in ['frame-*.png','animation.json','spritesheet.png','frames-overview.png','preview*.gif']:
   for f in src.glob(pattern):shutil.copy2(f,d/f.name)
  m=json.loads((d/'animation.json').read_text(encoding='utf-8'));m['status']='user-requested-integration';m['source_review']=src.relative_to(R).as_posix();(d/'animation.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
  report.append((hero,motion,d,m))
# Technical alpha-matte repair only: RGB and opaque artwork remain untouched.
src=R/'chapter-1/zhang-jiao/skill-2';meta=json.loads((src/'animation.json').read_text(encoding='utf-8'));frames=[];qa=[]
for i in range(1,9):
 a=np.array(Image.open(src/f'frame-{i:02}.png').convert('RGBA'));b=a.copy()
 if 2<=i<=6:
  al=a[:,:,3].astype(float);t=np.clip((al-95)/105,0,1);weight=t*t*(3-2*t)
  b[:,:,3]=np.where(al>=200,al,np.rint(al*weight)).astype('uint8')
 assert np.array_equal(a[:,:,:3],b[:,:,:3])
 assert np.array_equal(a[a[:,:,3]>=200],b[a[:,:,3]>=200])
 qa.append({'frame':i,'changed_alpha_pixels':int((a[:,:,3]!=b[:,:,3]).sum()),'rgb_changes':0,'alpha_ge_200_changes':0})
 frames.append(Image.fromarray(b))
# Reuse packaging only, publishing to a dedicated staging path then install.
sd=publish('zhang-jiao','skill-2',frames,dict(alpha_cleanup=qa,source='chapter-1/zhang-jiao/skill-2',pivot=meta.get('pivot',[.5,.3]),foot_anchor=meta.get('foot_anchor',[175,245])),meta['durations_ms'])
d=dest/'zhang-jiao/skill-2';shutil.copytree(sd,d,dirs_exist_ok=True);m=json.loads((d/'animation.json').read_text(encoding='utf-8'));report.append(('zhang-jiao','skill-2',d,m))
for hero,motion,d,m in report:
 u=next(u for u in data['units'] if u['name']==names[hero]);state=states[motion];old=u['motion'][state];oldms=old['ms']
 # Preserve each existing gameplay event's frame and fractional position;
 # this changes no damage, target, cooldown, or skill semantics.
 hits=[]
 for hit in old.get('hits',[]):
  acc=0
  for ix,duration in enumerate(oldms):
   if hit<acc+duration:break
   acc+=duration
  ix=min(ix,len(m['durations_ms'])-1)
  hits.append(round(sum(m['durations_ms'][:ix])+(hit-acc)/oldms[ix]*m['durations_ms'][ix]))
 u['art']['frames'][state]=[(d/f).relative_to(R).as_posix() for f in m['frames']]
 u['art'].setdefault('stateMeta',{})[state]={'pivot':m.get('pivot',[.5,.3]),'ppu':m.get('ppu',100)}
 old.update(sequence=list(range(1,m['frame_count']+1)),ms=m['durations_ms'],hits=hits)
 u['motionTimingBasis']='delivered-animation-json'
data['note']='2026-10-28 유관장 최신9모션 + 장각 스킬2 알파 교정. 공통 맵메이커/모션체커 등록. 전투 수치/스킬 로직 보존.'
for u,v in zip(before['units'],data['units']):assert u.get('skills')==v.get('skills')
units_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest={'date':'2026-10-28','motions':[{'hero':h,'motion':mo,'path':d.relative_to(R).as_posix(),'frames':m['frame_count']} for h,mo,d,m in report],'files':{p.relative_to(R).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in dest.rglob('frame-*.png')},'zhang_jiao_alpha':qa,'skill_logic_changed':False}
(dest/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8');print('Integrated',len(report),'motions;',len(manifest['files']),'frames')
