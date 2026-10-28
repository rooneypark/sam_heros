"""Package new imagegen sheets; never overwrite approved hero folders."""
from pathlib import Path
from PIL import Image, ImageDraw
import numpy as np, json, hashlib, shutil
from scipy import ndimage
R=Path(__file__).resolve().parents[2]
OUT=R/'motion-restart-2026-10-28'
SRC=OUT/'sources'
TIMES=[180,120,120,90,150,120,150,240]
def writejson(p,x): p.write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
def contact(im):
 a=np.array(im); h,w=a.shape[:2]; yy,xx=np.indices((h,w))
 rgb=a[:,:,:3].astype(int)
 mask=(a[:,:,3]>180)&(rgb.max(2)<120)&((rgb.max(2)-rgb.min(2))<45)&(yy>h*(.60 if h==350 else .70))&(xx>w*.24)&(xx<w*.90)
 lab,n=ndimage.label(mask); comps=[]
 for i in range(1,n+1):
  y,x=np.where(lab==i)
  if len(x)>8: comps.append((int(y.max()),len(x),x,y))
 if not comps: raise ValueError('No feet')
 bottom=max(c[0] for c in comps)
 use=[c for c in comps if c[0]>=bottom-10]
 x=np.concatenate([c[2] for c in use]); y=np.concatenate([c[3] for c in use])
 return ((int(x.min())+int(x.max()))/2,int(y.max())+1)
def split(im):
 w,h=im.size
 return [im.crop((round(i%4*w/4),round(i//4*h/2),round((i%4+1)*w/4),round((i//4+1)*h/2))) for i in range(8)]
def publish(hero,motion,fs,extra=None,times=None):
 d=OUT/hero/motion;d.mkdir(parents=True,exist_ok=True)
 times=times or TIMES[:len(fs)]
 for i,f in enumerate(fs):f.save(d/f'frame-{i+1:02}.png')
 sheet=Image.new('RGBA',(1400,700));strip=Image.new('RGBA',(350*len(fs),350))
 for i,f in enumerate(fs):sheet.alpha_composite(f,(i%4*350,i//4*350));strip.alpha_composite(f,(i*350,0))
 sheet.save(d/'frames-overview.png');strip.save(d/'spritesheet.png')
 bgfs=[]
 for f in fs:
  bg=Image.new('RGBA',(350,350),'#dfe9ed');bg.alpha_composite(f);bgfs.append(bg.convert('RGB'))
 atlas=Image.new('RGB',(350,350*len(fs)))
 for i,f in enumerate(bgfs):atlas.paste(f,(0,350*i))
 pal=atlas.quantize(colors=256)
 q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in bgfs]
 for name,duration in [('preview.gif',times),('preview-slow.gif',[350]*len(fs))]:q[0].save(d/name,save_all=True,append_images=q[1:],duration=duration,loop=0,disposal=2,optimize=False)
 meta=dict(status='review-not-approved',cell=[350,350],frame_count=len(fs),frames=[f'frame-{i+1:02}.png' for i in range(len(fs))],durations_ms=times,facing='left',foot_anchor=[175,245],pivot=[.5,.3],ppu=100)
 meta.update(extra or {});writejson(d/'animation.json',meta)
 return d
def combat(key,hero,motion,top,bottom):
 raw=Image.open(SRC/(key+'.png')).convert('RGBA');cells=split(raw)
 original=Image.open(R/hero/'original/original.png').convert('RGBA')
 # A single uniform delivery scale for the entire sheet, not per-frame bbox fit.
 scale=(134 if hero=='zhang-fei' else 132)/(bottom-top)
 anchor=contact(original);fs=[];positions=[]
 for i,c in enumerate(cells):
  sx,sy=contact(c);sz=(round(c.width*scale),round(c.height*scale));small=c.resize(sz,Image.Resampling.LANCZOS)
  xy=(round(anchor[0]-sx*scale),round(anchor[1]-sy*scale));f=Image.new('RGBA',(350,350));f.alpha_composite(small,xy)
  positions.append(dict(source_feet=[sx,sy],offset=xy))
  fs.append(f)
 fs[0]=original.copy();fs[-1]=original.copy()
 if key=='zhang-basic':
  # Hold the same readiness and impact poses rather than morphing geometry.
  fs[2]=fs[1].copy();fs[4]=fs[3].copy();fs[5]=fs[1].copy()
 if key=='guan-basic':fs[6]=original.copy()
 publish(hero,motion,fs,dict(source_sheet=f'../../sources/{key}.png',uniform_source_scale=scale,registration=positions,first_last_original=True,limitation='Generated local geometry requires visual review; uniform scale is not proof of invariant anatomy.'))
def heal(key,motion,factor):
 cells=split(Image.open(SRC/(key+'.png')).convert('RGBA'));d=OUT/'liu-bei'/motion;d.mkdir(parents=True,exist_ok=True)
 meta=json.loads((R/'liu-bei'/motion/'animation.json').read_text(encoding='utf-8-sig'));fs=[]
 for i,c in enumerate(cells):
  # Remove generated cell dividers by selecting only the intended effect region.
  c=c.crop((12,12,c.width-12,c.height-12));sz=(round(c.width*factor),round(c.height*factor));c=c.resize(sz,Image.Resampling.LANCZOS)
  fx=Image.new('RGBA',(350,350));fx.alpha_composite(c,(175-sz[0]//2,180-sz[1]//2))
  if i in (0,7):fx=Image.new('RGBA',(350,350))
  body=Image.open(R/'liu-bei'/motion/f'frame-{i+1:02}.png').convert('RGBA');body.save(d/f'body-{i+1:02}.png');fx.save(d/f'fx-{i+1:02}.png')
  f=body.copy();f.alpha_composite(fx);fs.append(f)
 publish('liu-bei',motion,fs,dict(body_source=f'../../../liu-bei/{motion}',body_pixels_preserved=True,effect='single heal' if motion=='skill-1' else 'group heal'),meta['durations_ms'])
def overview():
 paths=sorted(OUT.glob('*/*/animation.json')); rows=[]
 for p in paths:
  d=p.parent;fs=[Image.open(x).convert('RGBA') for x in sorted(d.glob('frame-*.png'))]
  row=Image.new('RGB',(1400,205),'#dfe9ed');draw=ImageDraw.Draw(row);draw.text((10,5),str(d.relative_to(OUT)),fill='black')
  for i,f in enumerate(fs):row.paste(f.resize((175,175)),(175*i,25),f.resize((175,175)))
  rows.append(row)
 big=Image.new('RGB',(1400,205*len(rows)),'white')
 for i,row in enumerate(rows):big.paste(row,(0,205*i))
 big.save(OUT/'all-frames.png')
def blade_only():
 """User-requested geometric reflection; original body/shaft pixels untouched."""
 fs=[];checks=[]
 for i in range(1,7):
  im=Image.open(R/'guan-yu/run'/f'frame-{i:02}.png').convert('RGBA');a=np.array(im);y,x=np.indices(a.shape[:2])
  gold=(a[:,:,0]>160)&(a[:,:,1]>100)&(a[:,:,2]<100)&(y<150)&(x<150)&(a[:,:,3]>150)
  yy,xx=np.where(gold);yt=int(yy.min());cx=float(xx[yy==yt+2].mean())-.5;cy=yt+2
  u=np.array([.55,.83516465]);u/=np.linalg.norm(u);M=2*np.outer(u,u)-np.eye(2);p=np.array([cx,cy]);offset=p-M@p
  region=((x-cx)*u[0]+(y-cy)*u[1]<-2)&(x>75)&(x<150)&(y>65)&(y<145)
  cut=a.copy();cut[~region]=0
  blade=Image.fromarray(cut).transform((350,350),Image.Transform.AFFINE,(M[0,0],M[0,1],offset[0],M[1,0],M[1,1],offset[1]),resample=Image.Resampling.BICUBIC)
  base=a.copy();base[region]=0;out=Image.fromarray(base);out.alpha_composite(blade)
  changed=np.any(np.array(out)!=a,axis=2);allowed=region|(np.array(blade)[:,:,3]>0)
  assert not np.any(changed&~allowed)
  checks.append(dict(frame=i,axis_origin=[cx,cy],axis_unit=u.tolist(),changed_pixels=int(changed.sum()),outside_blade_changes=0));fs.append(out)
 meta=json.loads((R/'guan-yu/run/animation.json').read_text(encoding='utf-8-sig'))
 publish('guan-yu','run',fs,dict(blade_only_reflection=True,verification=checks),meta.get('durations_ms',[100]*6))
if __name__=='__main__':
 for args in [('zhang-basic','zhang-fei','basic-attack',130,390),('zhang-skill1','zhang-fei','skill-1',148,381),('zhang-skill2','zhang-fei','skill-2',126,404),('guan-basic','guan-yu','basic-attack',170,400),('guan-skill1','guan-yu','skill-1',193,422),('guan-skill2','guan-yu','skill-2',200,430)]:combat(*args)
 heal('liu-skill1','skill-1',.42);heal('liu-skill2','skill-2',.60)
 blade_only()
 overview()
 before=json.loads((SRC/'protected-sha256.json').read_text());changed=[p for p,h in before.items() if hashlib.sha256((R/p).read_bytes()).hexdigest()!=h];assert not changed,changed
 writejson(OUT/'verification.json',dict(protected_original_pngs=len(before),changed_originals=changed,packaged_motions=9,geometry_status='visual review required'))
 print('Packaged9 motions; all originals preserved')

