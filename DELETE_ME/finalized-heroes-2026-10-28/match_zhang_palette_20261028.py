"""Color-only calibration. Never resample, translate, or change alpha."""
from pathlib import Path
from PIL import Image
import numpy as np,json,shutil,hashlib
from package_restart_20261028 import publish,overview
R=Path(__file__).resolve().parents[2];base=R/'art/samguk/motions/2026-10-28';review=R/'motion-restart-2026-10-28';backup=review/'sources/zhang-before-palette'
def masks(rgb):
 v=rgb.max(2);n=rgb.min(2);r,g,b=rgb[:,:,0],rgb[:,:,1],rgb[:,:,2]
 return {'dark':(v>40)&(v<110)&(v-n<20),'cloth':(v>125)&(v<200)&(v-n<15),'skin':(r>220)&(g>140)&(g<220)&(b>100)&(b<190),'red':(r>200)&(g<65)&(b<90),'gold':(r>200)&(g>160)&(b<70)}
reference=np.array(Image.open(R/'zhang-fei/original/original.png').convert('RGBA'));rgb=reference[:,:,:3].astype(float)
target={k:np.median(rgb[m&(reference[:,:,3]>245)],axis=0) for k,m in masks(rgb).items()}
report=[]
for motion in ['basic-attack','skill-1']:
 d=base/'zhang-fei'/motion;bdir=backup/motion
 if not bdir.exists():shutil.copytree(d,bdir)
 meta=json.loads((bdir/'animation.json').read_text(encoding='utf-8'));fs=[]
 for i in range(1,9):
  im=Image.open(bdir/f'frame-{i:02}.png').convert('RGBA');a=np.array(im);rgb=a[:,:,:3].astype(float);out=rgb.copy();ms=masks(rgb)
  med={k:np.median(rgb[m&(a[:,:,3]>245)],axis=0) for k,m in ms.items()}
  if i not in (1,8):
   neutral=np.clip((25-(rgb.max(2)-rgb.min(2)))/15,0,1)*(a[:,:,3]>0)
   neutral[rgb.max(2)<=18]=0
   for ch in range(3):
    mapped=np.interp(rgb[:,:,ch],[0,18,med['dark'][ch],115,med['cloth'][ch],215,255],[0,18,target['dark'][ch],125,target['cloth'][ch],215,255])
    out[:,:,ch]+=neutral*(mapped-rgb[:,:,ch])
   for k in ['skin','red','gold']:
    out[ms[k]]+=target[k]-med[k]
  result=a.copy();result[:,:,:3]=np.rint(np.clip(out,0,255)).astype('uint8')
  assert np.array_equal(a[:,:,3],result[:,:,3])
  assert np.array_equal(a[rgb.max(2)<=18],result[rgb.max(2)<=18])
  cyan=(rgb[:,:,2]>rgb[:,:,0]+30)&(rgb[:,:,1]>rgb[:,:,0]+30)
  assert np.array_equal(a[cyan],result[cyan])
  fs.append(Image.fromarray(result));new=result[:,:,:3].astype(float)
  report.append(dict(motion=motion,frame=i,alpha_changed=0,black_changed=0,cyan_changed=0,before={k:med[k].tolist() for k in med},after={k:np.median(new[m&(a[:,:,3]>245)],axis=0).tolist() for k,m in ms.items()}))
 meta['color_correction']='2026-10-28 original/idle palette; RGB only; alpha/geometry/timing preserved'
 staging=publish('zhang-fei',motion,fs,meta,meta['durations_ms'])
 for f in staging.iterdir():
  if f.suffix in ['.png','.gif','.json']:shutil.copy2(f,d/f.name)
 # Include idle in the GIF palette to keep its reference colors in the table.
 colors=[reference]+[np.array(f) for f in fs];bgs=[]
 for a in colors:
  bg=Image.new('RGBA',(350,350),'#dfe9ed');bg.alpha_composite(Image.fromarray(a));bgs.append(bg.convert('RGB'))
 atlas=Image.new('RGB',(350,350*len(bgs)))
 for j,bg in enumerate(bgs):atlas.paste(bg,(0,j*350))
 pal=atlas.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in bgs[1:]]
 for name,t in [('preview.gif',meta['durations_ms']),('preview-slow.gif',[350]*8)]:
  q[0].save(d/name,save_all=True,append_images=q[1:],duration=t,loop=0,disposal=2,optimize=False);shutil.copy2(d/name,staging/name)
overview()
for path,key in [(base/'MANIFEST.json','files'),(review/'APPROVED_EXCEPT_ZHANG_SKILL2.json','files')]:
 doc=json.loads(path.read_text(encoding='utf-8'))
 for p in doc[key]:
  if '/zhang-fei/basic-attack/' in '/'+p or '/zhang-fei/skill-1/' in '/'+p:doc[key][p]=hashlib.sha256((R/p).read_bytes()).hexdigest()
 doc['color_revision']='2026-10-28 user-requested Zhang Fei Attack/Skill1 palette only';path.write_text(json.dumps(doc,ensure_ascii=False,indent=2),encoding='utf-8')
(base/'zhang-fei/color-verification.json').write_text(json.dumps(dict(target={k:v.tolist() for k,v in target.items()},frames=report),indent=2),encoding='utf-8')
print('16 frames: RGB calibrated; alpha, black outline pixels, cyan VFX and timings unchanged.')
print(json.dumps(report[2],indent=2))
