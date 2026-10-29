from pathlib import Path
import json,sys,hashlib
import numpy as np
from scipy import ndimage
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'tools')
from export_liu_commander import face
D=Path('characters/liu-bei/sources/youthful-short-tunic');S=D/'motions';P=S/'prepared';P.mkdir(exist_ok=True)
orig=Image.open(D/'original-350.png').convert('RGBA');of=face(orig)
timing=json.loads(Path('characters/liu-bei/sources/single-sword-motions/timing-source.json').read_text(encoding='utf8'))['motion']
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
def boots(im):
 a=np.array(im);rgb=a[:,:,:3].astype(int);v=rgb.mean(2);m=(a[:,:,3]>160)&(v>30)&(v<135)&(rgb.max(2)-rgb.min(2)<38);m[:int(im.height*.60)]=False
 labs,n=ndimage.label(m);parts=[]
 for k in range(1,n+1):
  y,x=np.where(labs==k)
  if len(x)>5:parts.append((len(x),x,y))
 parts=sorted(parts,key=lambda p:p[0],reverse=True)[:2];assert len(parts)==2
 x=np.concatenate([p[1] for p in parts]);y=np.concatenate([p[2] for p in parts]);return ((x.min()+x.max())/2,float(y.max()))
ob=boots(orig);clips={};records={}
for state,cols,count,folder in [('Move',3,6,'run'),('Attack',4,8,'basic-attack'),('Skill_01',2,4,'skill-1'),('Skill_02',2,4,'skill-2')]:
 sh=Image.open(S/(state+'-source.png')).convert('RGBA');cw=sh.width/cols;ch=sh.height/2;a=np.array(sh);labs,n=ndimage.label(a[:,:,3]>16);owners={}
 for k in range(1,n+1):
  y,x=np.where(labs==k)
  if len(x):owners[k]=min(count-1,int(y.mean()/ch)*cols+min(cols-1,int(x.mean()/cw)))
 scale=of[2]/face(sh.crop((0,0,round(cw),round(ch))))[2];frames=[];records[state]=[]
 for i in range(count):
  mask=ndimage.binary_dilation(np.isin(labs,[k for k,o in owners.items() if o==i]),iterations=1);cut=a.copy();cut[:,:,3]=np.where(mask,cut[:,:,3],0)
  im=Image.fromarray(cut).crop((round(i%cols*cw)-160,round(i//cols*ch)-160,round((i%cols+1)*cw)+160,round((i//cols+1)*ch)+160));im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
  if state=='Move':f=face(im);offset=(round(of[0]-f[0]),round(of[1]-f[1]))
  else:b=boots(im);offset=(round(ob[0]-b[0]),round(ob[1]-b[1]))
  out=Image.new('RGBA',(350,350));out.alpha_composite(im,offset)
  if state=='Move':
   amount=[0,1,3,0,1,3][i];ar=np.array(out).astype(float)/255;yy,xx=np.mgrid[:350,:350].astype(float);t=np.clip((yy-211)/12,0,1);sy=yy+amount*(1-t*t*(3-2*t));al=ndimage.map_coordinates(ar[:,:,3],[sy,xx],order=1,mode='constant');rgb=np.stack([ndimage.map_coordinates(ar[:,:,c]*ar[:,:,3],[sy,xx],order=1,mode='constant') for c in range(3)],-1);rgb=np.divide(rgb,al[:,:,None],out=np.zeros_like(rgb),where=al[:,:,None]>0);aout=np.clip(np.rint(np.dstack([rgb,al])*255),0,255).astype('uint8');aout[223:]=np.array(out)[223:];out=Image.fromarray(aout)
  frames.append(out);records[state].append({'scale':scale,'offset':offset,'face':face(out)})
 if state=='Attack':frames[0]=orig.copy();frames[6]=orig.copy();frames[7]=orig.copy()
 if state.startswith('Skill'):frames=[orig.copy(),frames[1],frames[2],frames[3],frames[3].copy(),frames[2].copy(),frames[1].copy(),orig.copy()]
 clips[state]=(folder,frames)
# Reproduce approved guide breathing from the new original, preserving boots.
a=np.array(orig).astype(float)/255;y,x=np.mgrid[:350,:350].astype(float);t=np.clip((y-220)/12,0,1);weight=1-t*t*(3-2*t);idle=[]
for amount in [0,1,2,1]:
 if not amount:idle.append(orig.copy());continue
 sy=y+amount*weight;alpha=ndimage.map_coordinates(a[:,:,3],[sy,x],order=1,mode='constant');rgb=np.stack([ndimage.map_coordinates(a[:,:,c]*a[:,:,3],[sy,x],order=1,mode='constant') for c in range(3)],-1);rgb=np.divide(rgb,alpha[:,:,None],out=np.zeros_like(rgb),where=alpha[:,:,None]>0);out=np.clip(np.rint(np.dstack([rgb,alpha])*255),0,255).astype('uint8');out[232:]=np.asarray(orig)[232:];idle.append(Image.fromarray(out))
clips['Idle']=('idle',idle)
# Non-target delivered PNGs remain exact, including approved Idle/Skill_02.
for state,folder in [('Idle','idle'),('Skill_02','skill-2'),('Attack','basic-attack')]:
 existing=sorted((P/folder).glob('frame-*.png'))
 if existing:clips[state]=(folder,[Image.open(p).convert('RGBA') for p in existing])
def gif(fs,path,ms):
 atlas=Image.new('RGB',(fs[0].width*len(fs),fs[0].height))
 for i,im in enumerate(fs):atlas.paste(im,(im.width*i,0))
 pal=atlas.quantize(colors=256);q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in fs];q[0].save(path,save_all=True,append_images=q[1:],duration=ms,loop=0,optimize=False,disposal=2)
html='<meta charset="utf-8"><title>새 유비 모션 검토</title><style>body{background:#26323c;color:white;font:18px sans-serif}img{max-width:100%}a{color:#8edfc8}</style><h1>새 유비 · 5종 모션 검토</h1><img src="all-motions.gif">'
manifest=[]
for state,(folder,frames) in clips.items():
 p=P/folder;p.mkdir(exist_ok=True);cols=3 if state=='Move' else 4;overview=Image.new('RGBA',(350*cols,380*((len(frames)+cols-1)//cols)),'#e5edef');draw=ImageDraw.Draw(overview);sheet=Image.new('RGBA',(350*len(frames),350));bg=[];compare=[];ms=[300]*4 if state=='Idle' else [100]*6 if state=='Move' else timing[state]['ms']
 for i,im in enumerate(frames):
  path=p/f'frame-{i+1:02}.png';im.save(path);manifest.append({'path':str(path.relative_to(D)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});sheet.alpha_composite(im,(350*i,0));overview.alpha_composite(im,(350*(i%cols),380*(i//cols)+30));draw.text((350*(i%cols)+10,380*(i//cols)+5),f'{state} {i+1}',font=font,fill='#26323c');b=Image.new('RGBA',(350,350),'#e5edef');b.alpha_composite(im);bg.append(b.convert('RGB'));c=Image.new('RGBA',(700,350),'#e5edef');c.alpha_composite(orig);c.alpha_composite(im,(350,0));compare.append(c.convert('RGB'))
 sheet.save(p/'spritesheet.png');overview.save(p/'overview.png');gif(bg,p/'preview.gif',ms);gif(compare,p/'compare.gif',ms);(p/'animation.json').write_text(json.dumps({'frames':[f'frame-{i+1:02}.png' for i in range(len(frames))],'ms':ms,'loop':state in ['Idle','Move']},indent=2),encoding='utf8');html+=f'<h2>{state} · 원화 / 모션</h2><a href="{folder}/overview.png"><img src="{folder}/compare.gif"></a>'
gallery=[];items=[('원화',None,[orig])]+[(label,state,clips[state][1]) for label,state in [('숨쉬기','Idle'),('이동','Move'),('베기','Attack'),('단일 힐','Skill_01'),('전체 힐','Skill_02')]]
for tick in range(150):
 out=Image.new('RGBA',(960,740),'#e5edef');draw=ImageDraw.Draw(out)
 for j,(label,state,frames) in enumerate(items):
  idx=0
  if state:
   ms=[300]*4 if state=='Idle' else [100]*6 if state=='Move' else timing[state]['ms'];v=(tick*40)%sum(ms)
   while idx<len(ms)-1 and v>=ms[idx]:v-=ms[idx];idx+=1
  crop=frames[idx].crop((80,100,240,260)).resize((320,320),Image.Resampling.NEAREST);out.alpha_composite(crop,(j%3*320,j//3*370+40));draw.text((j%3*320+12,j//3*370+10),label,font=font,fill='#26323c')
 gallery.append(out.convert('RGB'))
gif(gallery,P/'all-motions.gif',40);(P/'index.html').write_text(html,encoding='utf8');(S/'measurements.json').write_text(json.dumps(records,indent=2),encoding='utf8');(S/'manifest.json').write_text(json.dumps({'status':'review-not-approved','runtimeChanged':False,'frames':manifest},indent=2),encoding='utf8')
assert len(manifest)==34
assert all(np.array_equal(np.asarray(im)[232:],np.asarray(orig)[232:]) for im in idle)
print('34 RGBA350 frames; idle lower region exact; combat last frame equals original; runtime unchanged')

