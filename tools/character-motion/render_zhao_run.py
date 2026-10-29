from PIL import Image, ImageDraw, ImageChops, ImageFont
from pathlib import Path
import math,json

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
 trouser='#f9f9f7';boot='#4b5561'
 thigh=curved_part((64,58),(15,3),[
 ((22,0),(42,0),(49,5)),((58,12),(61,29),(57,41)),
 ((54,53),(43,56),(32,56)),((20,56),(9,52),(6,42)),
 ((2,29),(6,11),(15,3))],trouser)
 shin=curved_part((74,56),(17,2),[
 ((25,0),(41,0),(48,5)),((53,10),(48,17),(54,23)),
 ((62,28),(72,33),(72,42)),((72,51),(57,54),(38,54)),
 ((19,54),(4,51),(3,43)),((1,34),(11,25),(12,17)),
 ((13,11),(12,5),(17,2))],boot,False)
 return thigh,shin

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'characters/zhao-yun/run'
if (OUT/'frame-01.png').exists():
    raise SystemExit('Approved run protected. Copy renderer to an explicit review destination before rebuilding.')
OUT.mkdir(exist_ok=True)
S=4
THIGH=[32,0,-30,-38,5,38];SHIN=[12,-8,-32,-78,-65,38];BOB=[0,-1,-3,0,-1,-3]
original=Image.open(ROOT/'characters/zhao-yun/original/original.png').convert('RGBA')
# Follow the lower edge of the armor, including its black outline. A horizontal
# crop retained old trouser fragments on the sides and cut the central hem.
HEM=[(142,222),(148,226),(153,228),(159,230),(165,231),(171,232),
     (177,232),(183,231),(189,230),(195,228),(201,226),(207,222)]
upper=original.resize((1400,1400),Image.Resampling.NEAREST)
mask=Image.new('L',upper.size)
ImageDraw.Draw(mask).polygon([(0,0),(1400,0),(1400,210*S)]+[(x*S,y*S) for x,y in reversed(HEM)]+[(0,210*S)],fill=255)
upper.putalpha(ImageChops.multiply(upper.getchannel('A'),mask))
thigh,boot=leg_parts(0)
def part_at(dst,part,anchor,target,angle):
    scale=.4*S
    part=part.resize((round(part.width*scale),round(part.height*scale)),Image.Resampling.LANCZOS)
    pad=Image.new('RGBA',(240,240));pad.alpha_composite(part,(round(120-anchor[0]*scale),round(120-anchor[1]*scale)))
    pad=pad.rotate(angle,resample=Image.Resampling.BICUBIC,center=(120,120))
    dst.alpha_composite(pad,(round(target[0]*S-120),round(target[1]*S-120)))
def projected(p,length,angle):
    a=math.radians(angle)
    return p[0]-.82*length*math.sin(a),p[1]+length*math.cos(a)+.48*length*math.sin(a)
frames=[];debugs=[];joints=[]
for i in range(6):
    f=Image.new('RGBA',(1400,1400));js=[]
    for side,hip,phase in [('R',(166,216+BOB[i]),(i+3)%6),('L',(185,221+BOB[i]),i)]:
        knee=projected(hip,11,THIGH[phase]);foot=projected(knee,9.5,SHIN[phase])
        ta=math.degrees(math.atan2(knee[0]-hip[0],knee[1]-hip[1]));sa=math.degrees(math.atan2(foot[0]-knee[0],foot[1]-knee[1]))
        # Facing-left shapes use the same approved curves mirrored locally.
        part_at(f,boot.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(74-32,16),knee,sa)
        part_at(f,thigh.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(64-32,17),hip,ta)
        js.append({'side':side,'hip':hip,'knee':knee,'foot':foot,'phase':phase})
    f.alpha_composite(upper,(0,BOB[i]*S))
    f=f.resize((350,350),Image.Resampling.LANCZOS);f.save(OUT/f'frame-{i+1:02}.png');frames.append(f)
    dbg=f.copy();d=ImageDraw.Draw(dbg)
    for j in js:
        c='#00bcc8' if j['side']=='L' else '#ff962f';d.line([j['hip'],j['knee'],j['foot']],fill=c,width=2)
    debugs.append(dbg);joints.append(js)
strip=Image.new('RGBA',(2100,350));overview=Image.new('RGB',(1050,700),'#e5ecee');jointsheet=overview.copy()
for i,f in enumerate(frames):
    strip.paste(f,(350*i,0));overview.paste(f,(350*(i%3),350*(i//3)),f);jointsheet.paste(debugs[i],(350*(i%3),350*(i//3)),debugs[i])
strip.save(OUT/'spritesheet.png');overview.save(OUT/'frames-overview.png');jointsheet.save(OUT/'joint-check.png')
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
comparisons=[]
for i,f in enumerate(frames):
    c=Image.new('RGB',(700,390),'#e5ecee');d=ImageDraw.Draw(c)
    d.text((16,10),'유비 · 승인 이동',font=font,fill='#253441');d.text((366,10),'조운 · 이동 재작업',font=font,fill='#253441')
    liu=Image.open(ROOT/f'characters/liu-bei/run/frame-{i+1:02}.png').convert('RGBA')
    c.paste(liu,(0,35),liu);c.paste(f,(350,35),f);comparisons.append(c)
def gif(frames,path,ms):
    train=Image.new('RGB',(frames[0].width,frames[0].height*len(frames)))
    for i,f in enumerate(frames):train.paste(f,(0,i*f.height))
    pal=train.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
    q[0].save(path,save_all=True,append_images=q[1:],duration=ms,loop=0,optimize=False,disposal=2)
flat=[]
for f in frames:
    b=Image.new('RGB',(350,350),'#e5ecee');b.paste(f,(0,0),f);flat.append(b)
gif(flat,OUT/'preview.gif',100);gif(flat,OUT/'preview-slow.gif',240);gif(comparisons,OUT/'comparison.gif',100)
(OUT/'animation.json').write_text(json.dumps({'status':'review-not-approved','cell':[350,350],'frame_count':6,'durations_ms':[100]*6,'facing':'left','pivot':[.5,.3],'ppu':100,'phase_offset':3,'joints':joints,'upper_y':BOB,'note':'Approved gait curves and phases adapted to Zhao armor hem; upper body and sword unchanged.'},indent=2),encoding='utf-8')
print(OUT)
