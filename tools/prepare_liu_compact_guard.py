from pathlib import Path
import sys,json
sys.path.insert(0,'tools')
from export_liu_commander import face
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from scipy import ndimage
R=Path.cwd();D=R/'characters/liu-bei/sources/two-hand-sword/compact-guard';P=D/'prepared';P.mkdir(exist_ok=True)
original=Image.open(D/'original-350.png').convert('RGBA');of=face(original)
source=Image.open(D/'original-source.png');sf=face(source)
cell_size=source.width*46/sf[2]
u=json.loads((R/'characters/liu-bei/sources/single-sword-motions/timing-source.json').read_text(encoding='utf8'))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
records={};html='<meta charset="utf-8"><style>body{background:#26323c;color:white;font:16px sans-serif}section{display:inline-block;vertical-align:top}img{background:#e5edef}a{color:#8fdfcf}</style><h1>유비 승인한 두 손 검 자세 · 모션 검토</h1><p>왼쪽 원화 / 오른쪽 모션. 크기별 확대축소 없음. 검수 중.</p>'
for state,folder,cols,count in [('Move','run',3,6),('Attack','basic-attack',4,8),('Skill_01','skill-1',4,8),('Skill_02','skill-2',4,8),('Idle','idle',2,4)]:
 p=P/folder;p.mkdir(exist_ok=True);frames=[];rec=[]
 if True:
  sheet=Image.open(D/(state+'-source.png')).convert('RGBA');cw=sheet.width/cols;ch=sheet.height/2
  arr=np.array(sheet);labels,n=ndimage.label(arr[:,:,3]>10);sizes=np.bincount(labels.ravel());owners={}
  # A source sheet has one fixed export scale; never fit individual frames.
  first=sheet.crop((0,0,round(cw),round(ch)));cell_size=cw*46/face(first)[2]
  for lab in range(1,n+1):
   ys,xs=np.where(labels==lab)
   if len(xs):owners[lab]=min(count-1,int(ys.mean()/ch)*cols+min(cols-1,int(xs.mean()/cw)))
 for i in range(count):
  if True:
   mask=np.isin(labels,[lab for lab,owner in owners.items() if owner==i]);mask=ndimage.binary_dilation(mask,iterations=1)
   data=arr.copy();data[:,:,3]=np.where(mask,data[:,:,3],0)
   pad=80;cell=Image.fromarray(data).crop((round(i%cols*cw)-pad,round(i//cols*ch)-pad,round((i%cols+1)*cw)+pad,round((i//cols+1)*ch)+pad))
   scale=cell_size/cw;cell=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
   f=face(cell);im=Image.new('RGBA',(350,350));dx=round(of[0]-f[0]);dy=round(of[1]-f[1])
   if state!='Move':
    # Register stationary boots; face can be covered by swords/effects.
    a=np.array(cell);m=(a[:,:,3]>180)&(a[:,:,:3].max(2)<140);m[:round(cell.height*.68)]=False
    ys,xs=np.where(m);dx=round(175-(xs.min()+xs.max())/2);dy=245-int(ys.max())
   im.alpha_composite(cell,(dx,dy))
   rec.append({'frame':i+1,'face':face(im),'offset':[dx,dy],'cellSize':round(cell_size)})
  if (state not in ['Move','Idle'] and i in [0,count-1]) or (state=='Idle' and i==0) or (state=='Attack' and i==6):im=original.copy()
  im.save(p/f'frame-{i+1:02}.png');frames.append(im)
 records[state]=rec
 overview=Image.new('RGBA',(350*cols,380*((count+cols-1)//cols)),'#e5edef');draw=ImageDraw.Draw(overview)
 both=[]
 for i,im in enumerate(frames):
  overview.alpha_composite(im,(i%cols*350,i//cols*380+30));draw.text((i%cols*350+10,i//cols*380+5),f'{state} {i+1} / {count}',font=font,fill='#23313b')
  b=Image.new('RGBA',(700,350),'#e5edef');b.alpha_composite(original,(0,0));b.alpha_composite(im,(350,0));both.append(b.convert('RGB'))
 overview.save(p/'overview.png')
 atlas=Image.new('RGB',(700*count,350))
 for i,b in enumerate(both):atlas.paste(b,(i*700,0))
 pal=atlas.quantize(colors=256);gif=[b.quantize(palette=pal,dither=Image.Dither.NONE) for b in both]
 gif[0].save(p/'compare.gif',save_all=True,append_images=gif[1:],duration=u['motion'][state]['ms'],loop=0,optimize=False,disposal=2)
 solo=[b.crop((350,0,700,350)) for b in gif];solo[0].save(p/'preview.gif',save_all=True,append_images=solo[1:],duration=u['motion'][state]['ms'],loop=0,optimize=False,disposal=2)
 html+=f'<section><h2>{state}</h2><a href="{folder}/overview.png"><img src="{folder}/compare.gif"></a></section>'
(P/'index.html').write_text(html,encoding='utf8');(D/'measurements.json').write_text(json.dumps({'originalFace':of,'records':records},indent=2),encoding='utf8')
print(json.dumps(records,indent=2))
