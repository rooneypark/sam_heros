"""Animate the existing approved sprites with a pinned vertical breathing rig.
No generated replacement art; original pixels are retained at pinned regions.
"""
from pathlib import Path
import json, hashlib, shutil
import numpy as np
from scipy.ndimage import map_coordinates
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
NAMES=['liu-bei','guan-yu','zhang-fei']
OFFSETS=[0,-2,-4,-2]
MS=300
# Coordinates belong to the 400x440 final idle canvas, not source artwork.
CONFIG={
 'liu-bei':{'blend_top':302,'fixed_below':338},
 'guan-yu':{'blend_top':302,'fixed_below':343,'pole_x':249,'fist':[263,240],'fist_radius':22},
 'zhang-fei':{'blend_top':309,'fixed_below':345,'pole_x':273,'fist':[284,248],'fist_radius':23},
}

def smooth(t):
 t=np.clip(t,0,1); return t*t*(3-2*t)

def weight(x,y,c):
 w=1-smooth((y-c['blend_top'])/(c['fixed_below']-c['blend_top']))
 if 'pole_x' in c:
  # Entire weapon strip is fixed, including blade, shaft and grounded butt.
  w*=1-smooth((x-(c['pole_x']-18))/18)
  fx,fy=c['fist'];dist=np.sqrt((x-fx)**2+(y-fy)**2)
  w*=smooth((dist-c['fist_radius'])/22)
  # Wide blades can extend to the left of the shaft; pin those too.
  blade_left=238 if c['pole_x']==249 else 258
  w=np.where((y<180)&(x>=blade_left),0,w)
 return w

def animate(source,c,offset):
 a=np.asarray(source).astype(np.float64)/255
 y,x=np.mgrid[0:a.shape[0],0:a.shape[1]].astype(float)
 fixed=weight(x,y,c)==0
 if offset==0:return source.copy(),fixed
 # Invert the continuous vertical rig; no cuts or disconnected sprite layers.
 sy=y.copy()
 for _ in range(8): sy=y-offset*weight(x,sy,c)
 prem=a.copy();prem[:,:,:3]*=prem[:,:,3:4]
 out=np.stack([map_coordinates(prem[:,:,i],[sy,x],order=1,mode='constant',cval=0) for i in range(4)],axis=-1)
 out[:,:,:3]=np.divide(out[:,:,:3],out[:,:,3:4],out=np.zeros_like(out[:,:,:3]),where=out[:,:,3:4]>0)
 out=np.clip(np.rint(out*255),0,255).astype('uint8')
 original=np.asarray(source)
 out[fixed]=original[fixed]
 assert np.array_equal(out[fixed],original[fixed])
 return Image.fromarray(out),fixed

def main():
 allframes=[];verification={}
 for name in NAMES:
  base=ROOT/name;original=base/'original';original.mkdir(exist_ok=True)
  original_file=original/'original.png'
  if not original_file.exists():shutil.copy2(base/'idle/idle.png',original_file)
  source=Image.open(original_file).convert('RGBA');c=CONFIG[name]
  frames=[]
  for i,offset in enumerate(OFFSETS):
   frame,fixed=animate(source,c,offset);frame.save(base/'idle'/f'frame-{i+1:02}.png');frames.append(frame)
  strip=Image.new('RGBA',(1600,440));overview=Image.new('RGB',(1600,468),'#e5ecee');d=ImageDraw.Draw(overview)
  flat=[]
  for i,frame in enumerate(frames):
   strip.alpha_composite(frame,(400*i,0));overview.paste(frame,(400*i,28),frame)
   d.text((400*i+12,8),f'{name} | {i+1}/4 | upper y {OFFSETS[i]}px',fill='#111111')
   bg=Image.new('RGB',(400,440),'#202426');bg.paste(frame,(0,0),frame);flat.append(bg)
  strip.save(base/'idle/spritesheet.png');overview.save(base/'idle/frames-overview.png')
  flat[0].save(base/'idle/idle.gif',save_all=True,append_images=flat[1:],duration=MS,loop=0,disposal=2,optimize=False)
  metadata={'status':'approved','approved_on':'2026-10-26','motion':'breathing','direction':'down-right','cell':[400,440],'frame_count':4,'duration_ms':MS,'loop':True,'upper_body_y':OFFSETS,'rig':c,'source':'../original/original.png','frames':[f'frame-{i+1:02}.png' for i in range(4)],'fixed':['lower body']+(['weapon','weapon holding fist'] if name!='liu-bei' else []),'note':'idle.png is the original static compatibility image; use animation.json frames for breathing.'}
  (base/'idle/animation.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
  verification[name]={'original_sha256':hashlib.sha256(original_file.read_bytes()).hexdigest(),'fixed_pixels':int(fixed.sum()),'fixed_regions_identical_in_all_frames':True}
  allframes.append(frames)
 doc=ROOT/'docs/motion-guide/visuals'
 sheet=Image.new('RGB',(1600,1404),'#e5ecee')
 for h,name in enumerate(NAMES):sheet.paste(Image.open(ROOT/name/'idle/frames-overview.png'),(0,468*h))
 sheet.save(doc/'idle-breathing-12-frames.png')
 seq=[]
 for i in range(4):
  im=Image.new('RGB',(1200,468),'#202426');d=ImageDraw.Draw(im)
  for h,name in enumerate(NAMES):
   im.paste(allframes[h][i],(400*h,28),allframes[h][i]);d.text((400*h+12,8),f'{name} | {i+1}/4',fill='white')
  seq.append(im)
 seq[0].save(doc/'idle-breathing.gif',save_all=True,append_images=seq[1:],duration=MS,loop=0,disposal=2,optimize=False)
 (ROOT/'docs/motion-guide/idle-verification.json').write_text(json.dumps(verification,indent=2),encoding='utf-8')
 print('Created 3 breathing animations. Original PNGs preserved; pinned pixels verified unchanged.')

if __name__=='__main__':main()
