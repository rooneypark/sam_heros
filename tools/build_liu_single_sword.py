"""Package complete imagegen drawings; no torso/leg splicing or local retouching."""
from pathlib import Path
import json,hashlib,shutil
import numpy as np
from scipy import ndimage
from PIL import Image,ImageDraw,ImageFont
from export_liu_commander import face
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';D=C/'sources/single-sword-motions';P=D/'prepared';P.mkdir(exist_ok=True)
u=json.loads((D/'timing-source.json').read_text(encoding='utf8'))
def feet(im):
 a=np.array(im);h,w=a.shape[:2];m=(a[:,:,3]>180)&(a[:,:,:3].max(2)<140);m[:int(h*.72)]=False
 yy,xx=np.where(m)
 bottom=int(yy.max());yy,xx=np.where(m & (np.indices(m.shape)[0]>bottom-h*.12))
 return (float((xx.min()+xx.max())/2),bottom)
def place(im,scale,x,y):
 small=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);o=Image.new('RGBA',(350,350));o.alpha_composite(small,(round(x),round(y)));return o
src=Image.open(D/'approved-original.png').convert('RGBA');f=face(src);scale=46/f[2];ft=feet(src)
original=place(src,scale,175-ft[0]*scale,245-ft[1]*scale);original.save(P/'original.png')
target=face(original);states={};records={}
for state,folder,cols,count in [('Move','run',3,6),('Attack','basic-attack',4,8),('Skill_01','skill-1',4,8),('Skill_02','skill-2',4,8)]:
 sheet=Image.open(D/f'{state}-source.png').convert('RGBA');cw=sheet.width/cols;ch=sheet.height/2
 cells=[sheet.crop((round(i%cols*cw),round(i//cols*ch),round((i%cols+1)*cw),round((i//cols+1)*ch))) for i in range(count)]
 sc=46/face(cells[0])[2];out=[];rec=[]
 for i,im in enumerate(cells):
  if state=='Attack':
   # Drop isolated neighbouring-cell fragments from the generated sheet gutters.
   arr=np.array(im);labels,n=ndimage.label(arr[:,:,3]>20);sizes=np.bincount(labels.ravel());sizes[0]=0
   keep=np.zeros_like(labels,dtype=bool)
   for lab in range(1,n+1):
    ys,xs=np.where(labels==lab)
    if sizes[lab]>100 and xs.mean()>im.width*.06 and xs.mean()<im.width*.94:keep|=labels==lab
   keep=ndimage.binary_dilation(keep,iterations=2);arr[:,:,3]=np.where(keep,arr[:,:,3],0);im=Image.fromarray(arr)
  ff=face(im);foot=feet(im)
  # Effects can hide the face, so use stationary boots for combat registration.
  dx=175-foot[0]*sc if state!='Move' else target[0]-ff[0]*sc
  dy=245-foot[1]*sc if state!='Move' else target[1]-ff[1]*sc+[0,-1,-2,0,-1,-2][i]
  frame=place(im,sc,dx,dy);out.append(frame);rec.append({'scale':sc,'offset':[round(dx),round(dy)]})
 if state!='Move':out[0]=original.copy();out[-1]=original.copy()
 states[state]=(folder,out);records[state]=rec
# Four-frame breathing from approved original: two-pixel upper rise, fixed legs.
a=np.array(original);yy,xx=np.indices((350,350),dtype=float);idle=[]
for bob in [0,-1,-2,-1]:
 weight=np.clip((227-yy)/20,0,1);coords=np.array([yy-bob*weight,xx]);v=np.stack([ndimage.map_coordinates(a[:,:,k],coords,order=1,mode='constant',cval=0) for k in range(4)],-1).astype('uint8');idle.append(Image.fromarray(v))
states['Idle']=('idle',idle)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
page='<meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{background:#202a30;color:#fff;font:16px system-ui;padding:20px}.grid{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0}img{width:350px;background:#e5edef}a{color:#6eeac1}</style><h1>유비 · 한 검 기본자세 / 두 검 힐 스킬</h1><p>검토본 · 이동6장, 공격/스킬 각8장 · 클릭하면 전체 프레임</p><div class="grid">'
for state,(folder,frames) in states.items():
 p=P/folder;p.mkdir(exist_ok=True);cols=3 if state=='Move' else 4;rows=(len(frames)+cols-1)//cols
 overview=Image.new('RGBA',(cols*350,rows*380),'#e5edef');d=ImageDraw.Draw(overview);bg=[]
 for i,im in enumerate(frames):
  im.save(p/f'frame-{i+1:02}.png');overview.alpha_composite(im,(i%cols*350,i//cols*380+30));d.text((i%cols*350+8,i//cols*380+5),f'{state} {i+1}/{len(frames)}',font=font,fill='#20303a');b=Image.new('RGBA',(350,350),'#e5edef');b.alpha_composite(im);bg.append(b.convert('RGB'))
 overview.save(p/'overview.png');atlas=Image.new('RGB',(350*len(bg),350))
 for i,b in enumerate(bg):atlas.paste(b,(i*350,0))
 pal=atlas.quantize(colors=256);gif=[b.quantize(palette=pal,dither=Image.Dither.NONE) for b in bg]
 for suffix,m in [('',1),('-slow',2)]:gif[0].save(p/f'preview{suffix}.gif',save_all=True,append_images=gif[1:],duration=[t*m for t in u['motion'][state]['ms']],loop=0,disposal=2,optimize=False)
 page+=f'<figure><a href="{folder}/overview.png"><img src="{folder}/preview.gif"></a><figcaption>{state} · <a href="{folder}/preview-slow.gif">느리게 보기</a></figcaption></figure>'
(P/'index.html').write_text(page+'</div>',encoding='utf8');(D/'alignment.json').write_text(json.dumps(records,indent=2),encoding='utf8')
print('Prepared original + 34 motion frames; not yet installed')
