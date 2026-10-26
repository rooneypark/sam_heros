"""Slice generated motion sheets, register feet, and export review animations."""
from pathlib import Path
import json,shutil,hashlib
import numpy as np
from scipy import ndimage
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'tools/character-motion/guan-yu-combat-sources'
NAMES=['basic-attack','skill-1','skill-2']
TIMES=[[180,100,70,60,130,90,100,180],[180,110,90,70,140,100,110,180],[180,100,100,90,150,120,120,180]]

def components(im, include_trails=False):
 a=np.array(im);lab,n=ndimage.label(a[:,:,3]>(20 if include_trails else 180))
 sizes=np.bincount(lab.ravel());ids=sorted(range(1,n+1),key=lambda k:sizes[k],reverse=True)[:8]
 parts=[]
 centers={k:ndimage.center_of_mass(lab==k) for k in ids}
 extras={k:[] for k in ids}
 if include_trails:
  for j in range(1,n+1):
   if j in ids or sizes[j]<25: continue
   cy,cx=ndimage.center_of_mass(lab==j)
   owner=min(ids,key=lambda k:(centers[k][0]-cy)**2+(centers[k][1]-cx)**2)
   extras[owner].append(j)
 for k in ids:
  mask=np.isin(lab,[k]+extras[k]); yy,xx=np.where(mask)
  box=(max(0,xx.min()-3),max(0,yy.min()-3),min(im.width,xx.max()+4),min(im.height,yy.max()+4))
  support=ndimage.binary_dilation(mask,iterations=2)
  b=a.copy();b[:,:,3]=np.where(support,a[:,:,3],0)
  parts.append((box,Image.fromarray(b).crop(box)))
 # Rows based on component centers; robust to raised swords and overhanging cells.
 parts.sort(key=lambda t:(t[0][1]+t[0][3])/2)
 return sorted(parts[:4],key=lambda t:t[0][0])+sorted(parts[4:],key=lambda t:t[0][0])

def face_width(im):
 a=np.array(im);r,g,b=a[:,:,:3].transpose(2,0,1).astype(float)
 skin=(r>170)&(g<115)&(b<115)&(r>g*1.8)&(a[:,:,3]>180)
 lab,n=ndimage.label(skin);sizes=np.bincount(lab.ravel());sizes[0]=0
 y,x=np.where(lab==sizes.argmax());return x.max()-x.min()+1

def main():
 reference=Image.open(ROOT/'guan-yu/original/original.png').convert('RGBA')
 target_face=face_width(reference)
 allframes=[]
 for h,name in enumerate(NAMES):
  dst=ROOT/'guan-yu'/name;dst.mkdir(exist_ok=True)
  source=Image.open(SRC/f'{name}.png').convert('RGBA');parts=components(source,True)
  ratio=target_face/float(np.median([face_width(im) for box,im in parts]))
  # Reuse the corrected ready pose for the final recovery keyframe.
  if name=='skill-1': parts[7]=parts[0]
  frames=[];records=[]
  for i,(box,im) in enumerate(parts):
   a=np.array(im)[:,:,3];ys,xs=np.where(a>180);bottom=ys.max()+1
   rgb=np.array(im)[:,:,:3].astype(float); dark=(rgb[:,:,0]>25)&(rgb[:,:,0]<115)&(rgb[:,:,1]>45)&(rgb[:,:,1]<150)&(rgb[:,:,2]>45)&(rgb[:,:,2]<150)&(rgb[:,:,1]>rgb[:,:,0]*1.1)&(a>180)
   by,bx=np.where(dark & (np.indices(a.shape)[0]>im.height*.60))
   if len(by): bottom=by.max()+3
   # Bottom 12% contains the planted boots, not the forward-thrust swords.
   fy,fx=np.where(dark & (np.indices(a.shape)[0]>bottom-30))
   footx=(fx.min()+fx.max())/2
   scaled=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS)
   x=round(320-footx*ratio);y=round(520-bottom*ratio)
   assert x>=0 and y>=0 and x+scaled.width<=640 and y+scaled.height<=600,(name,i,x,y,scaled.size)
   canvas=Image.new('RGBA',(640,600));canvas.alpha_composite(scaled,(x,y));canvas.save(dst/f'frame-{i+1:02}.png');frames.append(canvas)
   records.append({'source_box':[int(v) for v in box],'scale':ratio,'placement':[x,y]})
  sheet=Image.new('RGBA',(5120,600));review=Image.new('RGB',(2560,1256),'#e5ecee');d=ImageDraw.Draw(review);flat=[]
  for i,im in enumerate(frames):
   sheet.alpha_composite(im,(640*i,0));x=(i%4)*640;y=(i//4)*628
   review.paste(im,(x,y+28),im);d.text((x+10,y+8),f'{name} | {i+1}/8',fill='#111111')
   bg=Image.new('RGB',(640,600),'#202426');bg.paste(im,(0,0),im);flat.append(bg)
  sheet.save(dst/'spritesheet.png');review.save(dst/'frames-overview.png')
  for fn,durations in [('preview.gif',TIMES[h]),('preview-slow.gif',[300]*8)]:
   flat[0].save(dst/fn,save_all=True,append_images=flat[1:],duration=durations,loop=0,disposal=2,optimize=False)
  (dst/'animation.json').write_text(json.dumps({'status':'review','motion':name,'frame_count':8,'cell':[640,600],'direction':'down-right','foot_anchor':[320,520],'durations_ms':TIMES[h],'playback':'one-shot; preview GIF loops','frames':[f'frame-{i+1:02}.png' for i in range(8)],'registration':records,'gameplay_values':None},indent=2),encoding='utf-8')
  allframes.append(frames)
 seq=[]
 for i in range(8):
  out=Image.new('RGB',(1920,628),'#202426');d=ImageDraw.Draw(out)
  for h,name in enumerate(NAMES):out.paste(allframes[h][i],(h*640,28),allframes[h][i]);d.text((h*640+10,8),f'{name} | {i+1}/8',fill='white')
  seq.append(out)
 target=ROOT/'guan-yu/combat-preview';target.mkdir(exist_ok=True)
 seq[0].save(target/'all-motions.gif',save_all=True,append_images=seq[1:],duration=160,loop=0,disposal=2,optimize=False)
 combined=Image.new('RGB',(2560,3768))
 for h,name in enumerate(NAMES):combined.paste(Image.open(ROOT/'guan-yu'/name/'frames-overview.png'),(0,1256*h))
 combined.save(target/'all-24-frames.png')
 for name in NAMES:
  im=Image.open(ROOT/'guan-yu'/name/'preview.gif');assert im.n_frames==8
 checks=json.loads((ROOT/'tools/character-motion/run-checksums.json').read_text(encoding='utf-8-sig'))
 assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in checks.items())
 checks=json.loads((ROOT/'tools/character-motion/idle-checksums.json').read_text())['sha256']
 assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in checks.items())
 print('Exported 24 transparent frames, 3 sheets, 6 GIFs; approved idle/run hashes unchanged.')
if __name__=='__main__':main()
