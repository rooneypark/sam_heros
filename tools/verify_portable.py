from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]
p=json.loads((r/'content/samguk/units.json').read_text(encoding='utf-8'))
n=0
for u in p['units']:
 for fs in u.get('art',{}).get('frames',{}).values():
  for f in fs:
   assert (r/f).is_file(),f
   assert (r/f).read_bytes().startswith(b'\x89PNG'),f
   n+=1
for f in ['web/maker.html','web/motion.html','re/extract/media/sprites.json','re/extract/media/anims.json','re/extract/tiles.json','docs/design/maps/1장_황건소탕_overview.png']:
 assert (r/f).is_file(),f
sprites=json.loads((r/'re/extract/media/sprites.json').read_text(encoding='utf-8'))
textures={v['tex'] for v in sprites.values() if v.get('tex')}
for f in textures:assert (r/'re/extract/media/textures'/f).is_file(),f
print('PASS',len(p['units']),'characters,',n,'frames,',len(textures),'atlas textures; standalone paths verified')
