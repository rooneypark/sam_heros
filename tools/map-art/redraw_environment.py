"""Slice generated atlases; no painted substitutes. Rebuild chapter art from preserved layout."""
from pathlib import Path
from PIL import Image
import json, shutil
import math
R=Path(__file__).resolve().parents[2]
O=R/'art/environment/chapter-1';(O/'sources').mkdir(parents=True,exist_ok=True)
G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411')
groups=[
 ('nature','exec-fed25b7f-2e5f-4fe1-b625-5082f0be407f.png',[0,430,730,1086],[
 ('tree','나무',190),('bush','수풀',125),('boulder','이끼 바위',230),('mountain','산등성이',400),
 ('grass','풀잎',50),('flowers','들꽃',45),('stump','그루터기',65),('stones','작은 돌',65),
 ('dead_tree','마른 나무',160),('thorn','가시 덤불',100),('reeds','갈대',75),('oak','짙은 나무',210)]),
 ('village','exec-8b61df31-e17e-4f92-a09d-2264234b1729.png',[0,418,780,1086],[
 ('tavern','주막',300),('cottage','민가',275),('blacksmith','대장간',290),('armory','무기고',275),
 ('barracks','병영',280),('watchtower','초소',195),('tent','야영막',230),('cage','감옥',160),
 ('fence_a','목책 ↗',145),('fence_b','목책 ↘',145),('well','우물',175),('farm','채소밭',260)]),
 ('props','exec-989adc4f-d9e8-4208-8f1c-e272f88306a8.png',[0,425,740,1086],[
 ('banner','황건 깃발',85),('torch','화로',65),('fire','모닥불',95),('jar','술독',55),
 ('barrel','나무통',55),('sacks','곡식 포대',100),('cart','보급 수레',155),('sign','이정표',70),
 ('rack','무기 거치대',110),('altar','제단',230),('planks','부서진 판자',150),('logs','장작',105)])]
tiles=[]
for group,src,rows,spec in groups:
 shutil.copy2(G/src,O/'sources'/(group+'.png'))
 sheet=Image.open(O/'sources'/(group+'.png')).convert('RGBA')
 for i,(slug,name,w) in enumerate(spec):
  x=i%4;y=i//4
  im=sheet.crop((x*362,rows[y],(x+1)*362,rows[y+1]))
  box=im.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
  im=im.crop(box);im=im.resize((w,round(im.height*w/im.width)),Image.Resampling.LANCZOS);im.save(O/(slug+'.png'))
  blocks=slug in ['boulder','thorn','fence_a','fence_b','tavern','cottage','blacksmith','armory','barracks','watchtower','tent','cage','well','altar']
  foot=3 if slug in ['tavern','cottage','blacksmith','armory','barracks','tent','altar'] else 1
  t=dict(id='sg2_'+slug,name=name,layer='blockData' if slug=='mountain' else 'decoData',type='single',sprite=f'art/terrain/sources/base/{slug}.png',ppu=120 if slug=='mountain' else 100,pivot=[.5,.18],blocks=blocks,footprint=[foot,foot])
  if slug=='fence_a':t['pair']='sg2_fence_b'
  tiles.append(t)
shutil.copy2(G/'exec-84085c7c-3189-4bea-a7e7-28f02f5e3f32.png',O/'sources/materials.png')
im=Image.open(O/'sources/materials.png')
for i,name in enumerate(['grass','earth','water']):im.crop((i*724,0,(i+1)*724,724)).save(O/(name+'-material.png'))
for slug,name,layer,shape,mat in [('ground','초원','mapData','ground','grass'),('road','흙길','roadData','road','earth'),('yard','흙마당','roadData','area','earth'),('river','강·연못','waterData','area','water')]:
 tiles.append(dict(id='sg2_'+slug,name=name,layer=layer,type='material',shape=shape,material=f'art/terrain/sources/base/{mat}-material.png',shore='#75c2d5' if mat=='water' else '#b69871'))
(R/'content/samguk/tiles.json').write_text(json.dumps({'tiles':tiles},ensure_ascii=False,indent=2),encoding='utf8')
path=R/'maps/chapter-1/map.json'
backup=R/'maps/chapter-1/docs/layout-before-full-redraw.map.json'
if not backup.exists():shutil.copy2(path,backup)
m=json.loads(backup.read_text(encoding='utf8'))
for layer,new in [('mapData','ground'),('waterData','river'),('blockData','mountain')]:
 for t in m[layer]:t['n']='sg2_'+new
for t in m['roadData']:t['n']='sg2_road' if t['n'] in ['rd_r_00','sg_dirt_road'] else 'sg2_yard'
# Road cells crossing a courtyard must use its full surface, not leave four green pinholes.
yard={(t['x'],t['y']) for t in m['roadData'] if t['n']=='sg2_yard'}
for t in m['roadData']:
 if t['n']=='sg2_road' and sum((t['x']+dx,t['y']+dy) in yard for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)])>=2:t['n']='sg2_yard'
surface={(t['x'],t['y']):t for t in m['roadData']}
for t in m['roadData']:
 if t['n']=='sg2_road' and sum(surface.get((t['x']+dx,t['y']+dy),{}).get('n')=='sg2_yard' for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)])>=2:t['n']='sg2_yard'
mapping={'br_122':'fence_a','br_123':'fence_b','br_402':'fence_a','br_403':'fence_b','br_22':'boulder','br_50':'boulder',
 'br_121':'farm','br_135':'torch','br_14':'fire','br_126':'banner','br_138':'tree','br_144':'oak',
 'br_148':'dead_tree','br_149':'thorn','br_134':'sign','br_133':'sign','br_132':'sign',
 'obj_015':'jar','obj_004':'barrel','obj_033':'well','obj_081':'planks','obj_082':'planks',
 'obj_010':'grass','obj_011':'grass','obj_012':'flowers','obj_013':'flowers','obj_014':'bush',
 'obj_027':'stones','obj_028':'stones','obj_090':'stump','obj_131':'grass','obj_132':'flowers',
 'obj_119':'dead_tree','obj_120':'thorn','obj_054':'stones','obj_055':'stones','obj_125':'boulder',
 'sg_supply_cart':'cart','sg_weapon_rack':'rack','sg_gate':'banner'}
for t in m['decoData']:
 n=t['n'];slug=mapping.get(n,n[3:] if n.startswith('sg_') else 'bush');t['n']='sg2_'+slug
# Keep silhouettes and blocking objects off encounter anchors. Relocate within the same local zone.
actors=[(u['x'],u['y']) for u in m['maker']['units']]+[(b['pos']['x'],b['pos']['y']) for b in m['Buildings']]
occupied={(d['x'],d['y']) for d in m['decoData']}
blocked={(d['x'],d['y']) for layer in ['blockData','waterData'] for d in m[layer]}
ground={(d['x'],d['y']) for d in m['mapData']}
roads={(d['x'],d['y']) for d in m['roadData'] if d['n']=='sg2_road'}
defs={t['id']:t for t in tiles}
def world(x,y):return ((x-y)*1.106666684*.5-1.106667,(x+y+1)*.666666687*.5+.666666687)
def cell(wx,wy):return (math.floor((wx/1.66+wy)/2),math.floor((wy-wx/1.66)/2))
for d in m['decoData']:
 if not defs[d['n']]['blocks']:continue
 radius=2.0 if d['n']=='sg2_boulder' else 1.15
 wx,wy=world(d['x'],d['y'])
 if all(math.hypot(wx-x,wy-y)>radius for x,y in actors):continue
 candidates=sorted([(dx,dy) for dx in range(-7,8) for dy in range(-7,8)],key=lambda v:v[0]**2+v[1]**2)
 for dx,dy in candidates:
  x,y=d['x']+dx,d['y']+dy;wx,wy=world(x,y);c=cell(wx,wy)
  if (x,y) in occupied or c not in ground or c in blocked or c in roads:continue
  if any(math.hypot(wx-a,wy-b)<=radius for a,b in actors):continue
  occupied.discard((d['x'],d['y']));occupied.add((x,y));d.update(x=x,y=y);break
# Art-only customization. Logic and rewards remain untouched.
m['environmentArt']={'resourceTree':'sg2_tree#0','resourceStump':'sg2_stump#0','resourceStone':'sg2_boulder#0','resourceRubble':'sg2_stones#0',
 'buildings':{'SG_WB_C1_BONFIRE':'sg2_fire#0','SG_WB_C1_TRAINING':'sg2_rack#0','SG_WB_C1_BRIDGE':'sg2_planks#0','SG_WB_C1_LAIRGATE':'sg2_banner#0'}}
path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
print('Packaged',len(tiles),'components; all 5 map layers replaced')

