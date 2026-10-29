from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib
D=Path('characters/liu-bei/sources/two-hand-sword/compact-guard/motion-rework');P=D/'prepared';u=json.loads(Path('characters/liu-bei/sources/single-sword-motions/timing-source.json').read_text(encoding='utf8'));font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',20)
clips=[('승인 기본자세',None,[Image.open(D/'original-350.png').convert('RGBA')])]
for name,state,folder in [('숨쉬기 · 4','Idle','idle'),('이동 · 6','Move','run'),('기본공격 · 8','Attack','basic-attack'),('단일 힐 · 8','Skill_01','skill-1'),('전체 힐 · 8','Skill_02','skill-2')]:clips.append((name,state,[Image.open(p).convert('RGBA') for p in sorted((P/folder).glob('frame-*.png'))]))
ims=[]
for tick in range(150):
 out=Image.new('RGB',(1080,780),'#e5edef');draw=ImageDraw.Draw(out)
 for j,(name,state,frames) in enumerate(clips):
  idx=0
  if state:
   times=u['motion'][state]['ms'];t=(tick*40)%sum(times)
   while idx<len(times)-1 and t>=times[idx]:t-=times[idx];idx+=1
  tile=Image.new('RGBA',(180,180),'#e5edef');tile.alpha_composite(frames[idx],(-70,-85));out.paste(tile.resize((360,360)).convert('RGB'),(j%3*360,j//3*390+30));draw.text((j%3*360+12,j//3*390+4),name,font=font,fill='#23313b')
 ims.append(out)
samples=ims[::10];atlas=Image.new('RGB',(1080,780*len(samples)))
for j,im in enumerate(samples):atlas.paste(im,(0,780*j))
pal=atlas.quantize(colors=256);gif=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in ims];gif[0].save(P/'all-motions.gif',save_all=True,append_images=gif[1:],duration=40,loop=0,optimize=False,disposal=2)
p=P/'index.html';s=p.read_text(encoding='utf8').replace('img{background:#e5edef}','img{background:#e5edef;max-width:100%;height:auto}').replace('<h1>','<img src="all-motions.gif"><h1>',1);p.write_text(s,encoding='utf8')
files=list(P.glob('*/frame-*.png'));assert len(files)==34
for p in files:
 im=Image.open(p);assert im.size==(350,350) and im.mode=='RGBA'
manifest={'originalStatus':'approved','motionStatus':'review-not-approved','runtimeChanged':False,'frames':34,'assets':[{'path':str(p.relative_to(D)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]}
(D/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('34 frames + combined GIF saved. Runtime unchanged.')

