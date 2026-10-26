"""Render generated cutout parts using the original v3 blocking's joint phases.
No artwork is painted here; parts are cropped and posed as rigid sprite layers.
"""
from PIL import Image, ImageDraw, ImageChops
from pathlib import Path
import math,json
import numpy as np
from scipy import ndimage
P=Path(__file__).parent
atlas=Image.open(P/'parts-atlas.png').convert('RGBA')
# Alpha-test sprite coverage removes low-coverage dust; preserve soft edge ramp.
atlas.putalpha(atlas.getchannel('A').point(lambda a: 0 if a<80 else min(255,round((a-80)*255/140))))
W,H=400,440
THIGH=[32,0,-30,-38,5,38]; SHIN=[12,-8,-32,-78,-65,38]; BOB=[0,-3,-7,0,-3,-7]
def clean_part(im):
 a=np.array(im.getchannel('A')); labels,n=ndimage.label(a>100)
 if n:
  sizes=np.bincount(labels.ravel());sizes[0]=0
  mask=ndimage.binary_dilation(labels==sizes.argmax(),iterations=1)
  im.putalpha(Image.fromarray(np.where(mask,a,0).astype('uint8')))
 return im

def cut(poly):
 m=Image.new('L',atlas.size);ImageDraw.Draw(m).polygon(poly,fill=255)
 a=atlas.copy();a.putalpha(ImageChops.multiply(a.getchannel('A'),m));return clean_part(a)
polys=[[(0,0),(515,0),(515,740),(0,740)],[(515,0),(1110,0),(1110,175),(1020,300),(1020,748),(515,748)],[(1120,0),(1536,0),(1536,748),(1025,748),(1025,400),(1120,210)]]
centers=[240,720,1280]; hems=[692,700,700]
legboxes=[(75,752,260,969),(560,752,750,969),(1070,752,1265,969)]
names=['liu-bei','guan-yu','zhang-fei']
def place_rot(dst,part,anchor,target,angle):
 # Padded layer with rotation center at its central anchor, so roots stay fixed.
 layer=Image.new('RGBA',(240,240));layer.alpha_composite(part,(round(120-anchor[0]),round(120-anchor[1])))
 layer=layer.rotate(angle,resample=Image.Resampling.BICUBIC,center=(120,120))
 dst.alpha_composite(layer,(round(target[0]-120),round(target[1]-120)))
def finish_leg(layer):
 # Resolve seams on the assembled leg, before compositing with the other leg.
 arr=np.array(layer); original=arr[:,:,3]>127
 disk=np.array([[0,1,1,1,0],[1,1,1,1,1],[1,1,1,1,1],[1,1,1,1,1],[0,1,1,1,0]],dtype=bool)
 solid=ndimage.binary_fill_holes(original)
 solid=ndimage.binary_closing(solid,structure=disk)
 solid=ndimage.binary_opening(solid,structure=disk)
 solid=ndimage.gaussian_filter(solid.astype(float),.8)>.48
 # Fill any newly restored area from the adjacent opaque material color.
 material=original & (arr[:,:,:3].max(axis=2)>65)
 _,nearest=ndimage.distance_transform_edt(~material,return_indices=True)
 changed=solid & ~original
 arr[changed,:3]=arr[nearest[0][changed],nearest[1][changed],:3]
 inside=ndimage.distance_transform_edt(solid)
 arr[solid & (inside<=2.5),:3]=[12,13,13]
 alpha=ndimage.gaussian_filter(solid.astype(float),.55)
 arr[:,:,3]=np.clip(alpha*255,0,255).astype('uint8')
 return Image.fromarray(arr)

def point(p,length,angle):
 a=math.radians(angle);return(p[0]+.82*length*math.sin(a),p[1]+length*math.cos(a)+.48*length*math.sin(a))
def curved_part(size,start,curves,color,stripe=False):
 scale=4; pts=[start];last=start
 for a,b,end in curves:
  for j in range(1,25):
   t=j/24;u=1-t
   pts.append((u*u*u*last[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*end[0],u*u*u*last[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*end[1]))
  last=end
 im=Image.new('RGBA',(size[0]*scale,size[1]*scale));d=ImageDraw.Draw(im)
 poly=[(round(x*scale),round(y*scale)) for x,y in pts]
 d.polygon(poly,fill=color)
 if stripe:
  decoration=Image.new('RGBA',im.size);dd=ImageDraw.Draw(decoration)
  band=[(43,19),(49,23),(44,29),(40,36),(39,44),(44,53),(34,54),(29,45),(30,35),(35,26)]
  dd.polygon([(x*scale,y*scale) for x,y in band],fill='#eee9db')
  decoration.putalpha(ImageChops.multiply(decoration.getchannel('A'),im.getchannel('A')));im.alpha_composite(decoration)
 d=ImageDraw.Draw(im);d.line(poly+[poly[0]],fill='#0c0d0d',width=14,joint='curve')
 return im.resize(size,Image.Resampling.LANCZOS)

def leg_parts(h):
 trouser=['#fffdf7','#00b58a','#939398'][h];boot=['#555350','#416461','#555456'][h]
 thigh=curved_part((64,58),(15,3),[
 ((22,0),(42,0),(49,5)),((58,12),(61,29),(57,41)),
 ((54,53),(43,56),(32,56)),((20,56),(9,52),(6,42)),
 ((2,29),(6,11),(15,3))],trouser)
 shin=curved_part((74,56),(17,2),[
 ((25,0),(41,0),(48,5)),((53,10),(48,17),(54,23)),
 ((62,28),(72,33),(72,42)),((72,51),(57,54),(38,54)),
 ((19,54),(4,51),(3,43)),((1,34),(11,25),(12,17)),
 ((13,11),(12,5),(17,2))],boot,h==0)
 return thigh,shin

def render(h,f,debug=False):
 out=Image.new('RGBA',(W,H));b=BOB[f]
 thigh,shin=leg_parts(h)
 width_scale=1.0
 joints=[]
 # Align Zhang Fei's pelvis to the garment center, using Guan Yu's offset.
 dx=-2 if h==2 else 0
 dy=-2 if h==2 else 0
 for side,hip in [('R',(222+dx,315+b+dy)),('L',(178+dx,330+b+dy))]:
  k=(f+(3 if side=='R' else 0))%6
  knee=point(hip,32,THIGH[k]);foot=point(knee,28,SHIN[k]);joints.append((side,hip,knee,foot))
  ta=math.degrees(math.atan2(-(knee[0]-hip[0]),knee[1]-hip[1]));sa=math.degrees(math.atan2(-(foot[0]-knee[0]),foot[1]-knee[1]))
  place_rot(out,shin,(32,16),knee,-sa)
  place_rot(out,thigh,(32,17),hip,-ta)
 body=cut(polys[h]);box=body.getbbox();body=body.crop(box)
 scale=.44;body=body.resize((round(body.width*scale),round(body.height*scale)),Image.Resampling.LANCZOS)
 out.alpha_composite(body,(round(200-(centers[h]-box[0])*scale),round(340+b-(hems[h]-box[1])*scale)))
 if debug:
  d=ImageDraw.Draw(out)
  for side,hip,knee,foot in joints:
   c='#00a8b5' if side=='L' else '#ea7b24'
   d.line([hip,knee,foot],fill=c,width=3)
   for x,y in [hip,knee,foot]:d.ellipse((x-4,y-4,x+4,y+4),fill=c)
 return out,joints

if __name__=='__main__':
 root=P.parents[1]
 for h,label in enumerate(['liu-bei','guan-yu','zhang-fei']):
  base=root/label/'idle';move=root/label/'run'
  base.mkdir(parents=True,exist_ok=True);move.mkdir(parents=True,exist_ok=True)
  frames=[render(h,f)[0] for f in range(6)]
  strip=Image.new('RGBA',(W*6,H));review=Image.new('RGB',(W*3,H*2),'#e5ecee')
  flat=[]
  for f,im in enumerate(frames):
   im.save(move/f'frame-{f+1:02}.png');strip.alpha_composite(im,(W*f,0));review.paste(im,((f%3)*W,(f//3)*H),im)
   bg=Image.new('RGB',(W,H),'#e5ecee');bg.paste(im,(0,0),im);flat.append(bg)
  strip.save(move/'spritesheet.png');review.save(move/'frames-overview.png')
  for name,ms in [('run.gif',100),('run-slow.gif',240)]:flat[0].save(move/name,save_all=True,append_images=flat[1:],duration=ms,loop=0,disposal=2)
  old=(THIGH[:],SHIN[:],BOB[:]);THIGH[:]=[0]*6;SHIN[:]=[0]*6;BOB[:]=[0]*6
  # Authored grounded idle is independent of the two-handed running rig.
  if h==0: render(h,0)[0].save(base/'idle.png')
  else:
   artwork=Image.open(P/'idle-sources'/f'{label}.png').convert('RGBA')
   bbox=artwork.getchannel('A').point(lambda a:255 if a>160 else 0).getbbox()
   artwork=artwork.crop(bbox)
   ratio=min(340/artwork.width,370/artwork.height)
   artwork=artwork.resize((round(artwork.width*ratio),round(artwork.height*ratio)),Image.Resampling.LANCZOS)
   idle=Image.new('RGBA',(W,H));idle.alpha_composite(artwork,((W-artwork.width)//2,400-artwork.height));idle.save(base/'idle.png')
  THIGH[:],SHIN[:],BOB[:]=old
 print('Final assets exported to liu-bei, guan-yu, zhang-fei.')
