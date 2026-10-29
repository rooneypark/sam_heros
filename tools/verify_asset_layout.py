"""Check current references and exact PNG preservation after folder consolidation."""
from pathlib import Path
import json,hashlib,re
R=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((R/p).read_text(encoding='utf8'))
units=read('content/samguk/units.json')['units'];expected=read('characters/manifest.json')['sha256']
count=0
for u in units:
 roots=set()
 for state,frames in u['art']['frames'].items():
  assert len({str(Path(p).parent) for p in frames})==1,(u['id'],state)
  for p in frames:
   assert p.startswith('characters/') and not re.search(r'20\d\d-\d\d-\d\d',p),p
   assert hashlib.sha256((R/p).read_bytes()).hexdigest()==expected[p],p
   roots.add(Path(p).parts[1]);count+=1
 assert len(roots)==1,u['id']
for t in read('content/samguk/tiles.json')['tiles']:
 for field in ['sprite','material']:
  if t.get(field):assert t[field].startswith('art/terrain/') and (R/t[field]).exists(),t[field]
for p in read('maps/catalog.json').values():assert p.startswith('maps/') and (R/p).exists(),p
print('PASS canonical character/terrain/map paths;',count,'PNG entries match current manifest')
