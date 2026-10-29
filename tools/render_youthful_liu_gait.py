from pathlib import Path
import math,json,hashlib
from PIL import Image,ImageDraw,ImageChops,ImageFont
from liu_gait_shapes import leg_parts
D=Path('characters/liu-bei');O=D/'sources/final/rebuild-preview';O.mkdir(exist_ok=True)
orig=Image.open(D/'original/original.png').convert('RGBA');S=4
upper=orig.resize((1400,1400),Image.Resampling.NEAREST)
hem=[(155,215),(160,222),(163,222),(166,217),(173,218),(179,221),(184,222),(196,222),(199,221),(200,225),(204,225),(205,219),(213,217),(216,224),(220,224),(225,214)]
mask=Image.new('L',upper.size);ImageDraw.Draw(mask).polygon([(0,0),(1400,0),(1400,210*S)]+[(x*S,y*S) for x,y in reversed(hem)]+[(0,210*S)],fill=255);upper.putalpha(ImageChops.multiply(upper.getchannel('A'),mask))
thigh,boot=leg_parts(0);T=[32,0,-30,-38,5,38];K=[12,-8,-32,-78,-65,38];B=[0,-1,-3,0,-1,-3]
def proj(p,l,a):
 a=math.radians(a);return p[0]-.82*l*math.sin(a),p[1]+l*math.cos(a)+.48*l*math.sin(a)
def part(dst,im,anchor,p,angle):
 scale=.34*S;im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);pad=Image.new('RGBA',(240,240));pad.alpha_composite(im,(round(120-anchor[0]*scale),round(120-anchor[1]*scale)));pad=pad.rotate(angle,resample=Image.Resampling.BICUBIC,center=(120,120));dst.alpha_composite(pad,(round(p[0]*S-120),round(p[1]*S-120)))
frames=[];joints=[]
for i in range(6):
 out=Image.new('RGBA',(1400,1400));js=[]
 for side,hip,phase in [('R',(177,218+B[i]),(i+3)%6),('L',(200,221+B[i]),i)]:
  knee=proj(hip,9.35,T[phase]);foot=proj(knee,8.1,K[phase]);ta=math.degrees(math.atan2(knee[0]-hip[0],knee[1]-hip[1]));sa=math.degrees(math.atan2(foot[0]-knee[0],foot[1]-knee[1]));part(out,boot.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(42,16),knee,sa);part(out,thigh.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(32,17),hip,ta);js.append({'side':side,'phase':phase,'hip':hip,'knee':knee,'foot':foot})
 out.alpha_composite(upper,(0,B[i]*S));out=out.resize((350,350),Image.Resampling.LANCZOS);out.save(O/f'frame-{i+1:02}.png');frames.append(out);joints.append(js)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18);overview=Image.new('RGBA',(1050,760),'#e5edef');dr=ImageDraw.Draw(overview);comp=[];flat=[]
for i,im in enumerate(frames):
 overview.alpha_composite(im,(350*(i%3),380*(i//3)+30));dr.text((350*(i%3)+8,380*(i//3)+5),str(i+1),font=font,fill='#26323c');c=Image.new('RGBA',(960,380),'#e5edef');cd=ImageDraw.Draw(c)
 for j,(label,pic) in enumerate([('이전 유비',Image.open(D/'run'/f'frame-{i+1:02}.png').convert('RGBA')),('관절 기준 유비',im),('조운',Image.open(Path('characters/zhao-yun/run')/f'frame-{i+1:02}.png').convert('RGBA'))]):
  c.alpha_composite(pic.crop((90,100,250,260)).resize((320,320),Image.Resampling.NEAREST),(j*320,40));cd.text((j*320+10,10),label,font=font,fill='#26323c')
 comp.append(c.convert('RGB'));bg=Image.new('RGBA',(350,350),'#e5edef');bg.alpha_composite(im);flat.append(bg.convert('RGB'))
def gif(fs,path,ms):
 atlas=Image.new('RGB',(fs[0].width*len(fs),fs[0].height))
 for i,im in enumerate(fs):atlas.paste(im,(i*im.width,0))
 pal=atlas.quantize(colors=256);q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in fs];q[0].save(path,save_all=True,append_images=q[1:],duration=ms,loop=0,optimize=False,disposal=2)
overview.save(O/'overview.png');gif(flat,O/'preview.gif',100);gif(comp,O/'comparison.gif',100);gif(comp,O/'slow.gif',240)
(O/'animation.json').write_text(json.dumps({'status':'review','size':[350,350],'ms':[100]*6,'upperY':B,'joints':joints,'source':'approved Zhao native renderer curves and exact gait phase; Liu original upper unchanged'},indent=2),encoding='utf8')
(O/'index.html').write_text('<meta charset="utf-8"><title>유비 이동 관절 기준 검토</title><style>body{background:#26323c;color:white}img{max-width:100%}</style><h1>이전 유비 / 수정 유비 / 조운</h1><img src="comparison.gif"><h2>느린 재생</h2><img src="slow.gif">',encoding='utf8')
print(O)

