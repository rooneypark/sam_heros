from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
p=Path('새시안/작업/characters/hero-lineup-v3-dark-zhang')
items=[('히로','hiro',Path('새시안/작업/원작분석/hero-proportions/hero-01.png'),1,166,249),('유비','liu-bei',Path('새시안/작업/characters/liu-bei/hiro-body-v1/liu-small-forelock-v7.png'),135/680,690,1005),('관우','guan-yu',p/'guan-yu-source.png',135/720,675,1140),('장비','zhang-fei',p/'zhang-fei-source.png',135/850,650,1160),('조운','zhao-yun',p/'zhao-yun-source.png',135/790,655,1090)]
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
line=Image.new('RGB',(1250,350),'#819467');d=ImageDraw.Draw(line);d.line((0,245,1250,245),fill='#d7dfca',width=1)
for i,(label,key,path,sc,fx,fy) in enumerate(items):
 src=Image.open(path).convert('RGBA');src=src.resize((round(src.width*sc),round(src.height*sc)),Image.Resampling.LANCZOS)
 out=Image.new('RGBA',(350,350));out.paste(src,(round(175-fx*sc),round(245-fy*sc)));out.save(p/f'{key}-350.png')
 tile=Image.new('RGBA',(250,350));tile.paste(out,(-50,0));line.paste(tile,(250*i,0),tile)
 d.text((i*250+100,275),label,font=font,fill='white')
line.save(p/'lineup-actual.png');line.resize((2500,700),Image.Resampling.NEAREST).save(p/'lineup-2x.png')
(p/'status.json').write_text(json.dumps({'status':'review','motion':'paused by user','ground':[175,245],'height_target':135,'note':'Weapon excluded from body height. Hiro original resolution unchanged; other concept full images uniformly scaled, no body-part reshaping.'},indent=2),encoding='utf8')
