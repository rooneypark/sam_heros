from pathlib import Path
import sys,json
sys.path.insert(0,'tools')
from export_liu_commander import face
from PIL import Image,ImageDraw,ImageFont
import numpy as np
from scipy import ndimage
R=Path.cwd();D=R/'characters/liu-bei/sources/two-hand-sword/compact-guard/motion-rework';P=D/'prepared';P.mkdir(exist_ok=True)
orig=Image.open(D/'original-350.png').convert('RGBA');source=Image.open(D/'original-source.png').convert('RGBA');of=face(orig)
u=json.loads((R/'characters/liu-bei/sources/single-sword-motions/timing-source.json').read_text(encoding='utf8'))
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
def boot(im):
 a=np.array(im);rgb=a[:,:,:3].astype(int);v=rgb.mean(2);m=(a[:,:,3]>200)&(v>35)&(v<125)&((rgb.max(2)-rgb.min(2))<32);m[:int(im.height*.67)]=False
 labs,n=ndimage.label(m);parts=[]
 for k in range(1,n+1):
  yy,xx=np.where(labs==k)
  if len(xx)>=6:parts.append((len(xx),xx,yy))
 parts=sorted(parts,key=lambda x:x[0],reverse=True)[:2]
 assert len(parts)==2,[(x[0]) for x in parts]
 xx=np.concatenate([p[1] for p in parts]);yy=np.concatenate([p[2] for p in parts])
 return ((xx.min()+xx.max())/2,float(yy.max()))
ob=boot(orig)
def put(im,sc,offset=None):
 im=im.resize((round(im.width*sc),round(im.height*sc)),Image.Resampling.LANCZOS)
 if offset is None:
  b=boot(im);offset=(round(ob[0]-b[0]),round(ob[1]-b[1]))
 out=Image.new('RGBA',(350,350));out.alpha_composite(im,offset);return out
sc=46/face(source)[2];mini=source.resize((round(source.width*sc),round(source.height*sc)),Image.Resampling.LANCZOS);f=face(mini);runoff=(round(of[0]-f[0]),round(of[1]-f[1]))
clips={'Move':('run',[put(Image.open(D/f'Move-{i:02}-source.png').convert('RGBA'),sc,runoff) for i in range(1,7)])}
for state,folder,cols,count in [('Attack','basic-attack',4,8),('Skill_01','skill-1',2,4),('Skill_02','skill-2',2,4)]:
 sheet=Image.open(D/(state+'-source.png')).convert('RGBA');cw=sheet.width/cols;ch=sheet.height/2;arr=np.array(sheet);labs,n=ndimage.label(arr[:,:,3]>10);owners={}
 for k in range(1,n+1):
  y,x=np.where(labs==k)
  if len(x):owners[k]=min(count-1,int(y.mean()/ch)*cols+min(cols-1,int(x.mean()/cw)))
 first=sheet.crop((0,0,round(cw),round(ch)));scale=of[2]/face(first)[2];keys=[]
 for i in range(count):
  mask=ndimage.binary_dilation(np.isin(labs,[k for k,o in owners.items() if o==i]),iterations=1);a=arr.copy();a[:,:,3]=np.where(mask,a[:,:,3],0);pad=70
  cell=Image.fromarray(a).crop((round(i%cols*cw)-pad,round(i//cols*ch)-pad,round((i%cols+1)*cw)+pad,round((i//cols+1)*ch)+pad));keys.append(put(cell,scale))
 if state=='Attack':frames=keys;frames[0]=orig.copy();frames[6]=orig.copy();frames[7]=orig.copy()
 else:frames=[orig.copy(),keys[1],keys[2],keys[3],keys[3].copy(),keys[2].copy(),keys[1].copy(),orig.copy()]
 clips[state]=(folder,frames)
clips['Idle']=('idle',[Image.open(D.parent/'prepared/idle'/f'frame-{i:02}.png').convert('RGBA') for i in range(1,5)])
measure={};html='<meta charset="utf-8"><style>body{background:#26323c;color:white;font:16px sans-serif}img{max-width:100%;background:#e5edef}a{color:#6edaba}</style><h1>유비 모션 재검토</h1><p>원화 / 수정본 비교 · 새 이동6 · 제자리 베기 · 핵심 자세 재작화 스킬</p><img src="all-motions.gif">'
for state,(folder,frames) in clips.items():
 p=P/folder;p.mkdir(exist_ok=True);cols=3 if state=='Move' else 4;overview=Image.new('RGBA',(350*cols,380*((len(frames)+cols-1)//cols)),'#e5edef');draw=ImageDraw.Draw(overview);bg=[];measure[state]=[]
 for i,im in enumerate(frames):
  im.save(p/f'frame-{i+1:02}.png');overview.alpha_composite(im,(i%cols*350,i//cols*380+30));draw.text((i%cols*350+8,i//cols*380+5),f'{state} {i+1}',font=font,fill='#23313b');b=Image.new('RGBA',(700,350),'#e5edef');b.alpha_composite(orig,(0,0));b.alpha_composite(im,(350,0));bg.append(b.convert('RGB'));measure[state].append({'face':face(im),'boot':boot(im)})
 overview.save(p/'overview.png');atlas=Image.new('RGB',(700*len(bg),350))
 for i,b in enumerate(bg):atlas.paste(b,(i*700,0))
 pal=atlas.quantize(colors=256);gif=[b.quantize(palette=pal,dither=Image.Dither.NONE) for b in bg]
 for name,gs in [('compare',gif),('preview',[im.crop((350,0,700,350)) for im in gif])]:gs[0].save(p/(name+'.gif'),save_all=True,append_images=gs[1:],duration=u['motion'][state]['ms'],loop=0,disposal=2,optimize=False)
 html+=f'<h2>{state}</h2><a href="{folder}/overview.png"><img src="{folder}/compare.gif"></a>'
(P/'index.html').write_text(html,encoding='utf8');(D/'measurements.json').write_text(json.dumps(measure,indent=2),encoding='utf8')
print('Original boots',ob)
for s in ['Attack','Skill_01','Skill_02']:print(s,[m['boot'] for m in measure[s]])
