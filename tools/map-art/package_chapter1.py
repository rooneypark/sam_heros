"""Package generated artwork and decorate the preserved chapter layout; deterministic."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'art/objects/chapter-1'
specs = [
 ('tavern','주막',330,3),('blacksmith','대장간',300,3),('armory','무기고',300,3),
 ('barracks','황건 병영',300,3),('watchtower','초소',200,3),('cottage','민가',260,3),
 ('tent','황건 야영막',240,3),('cage','구출 감옥',180,1),('gate','산채 문',260,0),
 ('weapon-rack','무기 거치대',130,1),('altar','장각 제단',240,3),('supply-cart','보급 수레',150,1)]
tiles=[]
for i,(slug,name,width,foot) in enumerate(specs):
    sheet=Image.open(OUT/'sources'/('buildings.png' if i<6 else 'props.png')).convert('RGBA')
    k=i%6; col=k%3; row=k//3; split=488 if i<6 else 512
    im=sheet.crop((col*512,0 if row==0 else split,(col+1)*512,split if row==0 else 1024))
    box=im.getchannel('A').point(lambda a:255 if a>12 else 0).getbbox()
    im=im.crop(box); im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS)
    im.save(OUT/(slug+'.png'))
    tiles.append(dict(id='sg_'+slug.replace('-','_'),name=name,layer='decoData',type='single',
      sprite=f'maps/chapter-1/archive/building-drafts/{slug}.png',pivot=[.5,.18],ppu=100,blocks=bool(foot),footprint=[foot or 1,foot or 1]))
for id,name,src,layer,typ in [
 ('sg_dirt_road','흙길 · 자동 연결','rd_r_00','roadData','road'),
 ('sg_courtyard','흙마당 · 자동 연결','rd_r_01','roadData','pond')]:
    tiles.append(dict(id=id,name=name,sourceTile=src,layer=layer,type=typ))
(ROOT/'content/samguk/tiles.json').write_text(json.dumps({'tiles':tiles},ensure_ascii=False,indent=2),encoding='utf-8')
m=json.loads((ROOT/'maps/chapter-1/docs/layout-before-art.map.json').read_text(encoding='utf-8'))
houses=['sg_cottage','sg_tavern','sg_cottage','sg_cottage','sg_blacksmith','sg_cottage','sg_armory','sg_cottage']
hi=0; ti=0
for t in m['decoData']:
    if t['n']=='obj_000': t['n']=houses[hi]; hi+=1
    elif t['n']=='obj_007':
        t['n']='sg_barracks' if ti in [1,4,7,9] else 'sg_tent';ti+=1
    elif t['n']=='br_49':t['n']='sg_watchtower'
    elif t['n']=='br_118':t['n']='sg_supply_cart'
for t in m['roadData']:t['n']={'rd_r_00':'sg_dirt_road','rd_r_01':'sg_courtyard'}.get(t['n'],t['n'])
# Decorative anchors use the finer deco grid. Keep roads, encounters and resource nodes intact.
extras=[('gate',148,149),('cage',37,113),('cage',134,48),('weapon_rack',46,107),('weapon_rack',142,38),
 ('weapon_rack',145,125),('supply_cart',121,128),('supply_cart',61,83),
 ('tent',157,164),('barracks',175,173),('watchtower',163,158),
 ('altar',190,193),('tent',196,179),('weapon_rack',178,167)]
used={(t['x'],t['y']) for t in m['decoData']}
for slug,x,y in extras:
    if (x,y) not in used:m['decoData'].append(dict(n='sg_'+slug,x=x,y=y))
(ROOT/'maps/chapter-1/map.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Packaged {len(specs)} new sprites, {len(tiles)} palette entries, {len(m["decoData"])} decorations')


