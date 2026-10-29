import json,hashlib,struct
from pathlib import Path
root=Path(__file__).resolve().parents[2];pack=root
read=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
m=read(pack/'import-manifest.json')
for f,h in m['sha256'].items():assert hashlib.sha256((pack/f).read_bytes()).hexdigest()==m.get('local_overrides',{}).get(f,h),f
u=read(pack/'content/samguk/units.json')['units'];count=states=0
for unit in u:
 for state,frames in unit['art']['frames'].items():
  states+=1
  for f in frames:
   b=(pack/f).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';assert struct.unpack('>II',b[16:24])==(350,350),f;count+=1
  assert len(unit['motion'][state]['ms'])==len(frames)
for f in ['content/samguk/units.json','content/samguk/tiles.json','maps/chapter-1/map.json']:
 def walk(v):
  if isinstance(v,dict):
   for z in v.values():walk(z)
  elif isinstance(v,list):
   for z in v:walk(z)
  elif isinstance(v,str) and v.endswith('.png') and '/' in v:assert (pack/v).is_file(),v
 walk(read(pack/f))
print('PASS',len(m['sha256']),'files verified (declared local overrides included);',len(u),'units;',states,'motions;',count,'frames; all referenced PNGs present')
