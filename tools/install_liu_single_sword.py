"""Register approved single-sword original and review motion drawings."""
from pathlib import Path
import json,hashlib,shutil
from PIL import Image
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';D=C/'sources/single-sword-motions';P=D/'prepared'
old=json.loads((D/'timing-source.json').read_text(encoding='utf8'))
current=next(u for u in json.loads((R/'content/samguk/units.json').read_text(encoding='utf8'))['units'] if u['id']=='SG_U0001')
assert old==current
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
entries=[]
for state in ['Idle','Move','Attack','Skill_01','Skill_02']:
 for path in current['art']['frames'][state]:
  dest=R/path;src=P/dest.parent.name/dest.name;im=Image.open(src);assert im.size==(350,350) and im.mode=='RGBA'
  entries.append({'path':path,'before':sha(dest),'after':sha(src),'state':state});shutil.copy2(src,dest)
dest=C/'original/original.png';entries.append({'path':dest.relative_to(R).as_posix(),'before':sha(dest),'after':sha(P/'original.png'),'state':'Original'});shutil.copy2(P/'original.png',dest)
for folder in ['basic-attack','skill-1','skill-2']:
 assert sha(C/folder/'frame-01.png')==sha(dest)==sha(C/folder/'frame-08.png')
assert sha(C/'idle/frame-01.png')==sha(dest)
m={'status':'original-approved-motions-review','assets':entries,'timingAndSkillBindingsUnchanged':True,'unchangedStates':['Gather','Die','Portrait'],'source':'approved-original.png','frames':34}
(D/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
cm=json.loads((R/'characters/manifest.json').read_text(encoding='utf8'))
lineage=C/'sources/commander-motions/manifest.json';lm=json.loads(lineage.read_text(encoding='utf8'));by={e['path']:e for e in entries}
for e in lm['assets']:
 if e['path'] in by:e['after']=by[e['path']]['after']
lm['stateApprovals']={'Original':'approved-single-sword','Idle':'review','Move':'review','Attack':'review','Skill_01':'review','Skill_02':'review'};lm['supersededBy']='../single-sword-motions/manifest.json'
lineage.write_text(json.dumps(lm,ensure_ascii=False,indent=2),encoding='utf8')
for e in entries:
 if e['path'] in cm['sha256']:cm['sha256'][e['path']]=e['after']
cm['singleSwordReview']='characters/liu-bei/sources/single-sword-motions/manifest.json';(R/'characters/manifest.json').write_text(json.dumps(cm,ensure_ascii=False,indent=2),encoding='utf8')
print('Installed approved original and 34 review frames; metadata unchanged; ready endpoints exact')
