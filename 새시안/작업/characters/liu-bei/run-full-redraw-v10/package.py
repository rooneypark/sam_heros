from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
p=Path('새시안/작업/characters/liu-bei/run-full-redraw-v10');s=Image.open(p/'source.png').convert('RGBA');scale=135/420
frames=[]
for idx,hop in [(0,0),(1,15),(1,23),(3,0),(4,15),(4,23)]:
 x=(idx%3)*512;y=(idx//3)*512;c=s.crop((x,y,x+512,y+512))
 c.putalpha(c.getchannel('A').point(lambda a:0 if a<180 else a))
 c=c.resize((round(512*scale),round(512*scale)),Image.Resampling.LANCZOS)
 anchor=[310,260,210,310,260,210][idx];footY=460 if idx<3 else 435
 b=Image.new('RGBA',(350,350));b.paste(c,(round(175-anchor*scale),round(245-footY*scale)-hop));frames.append(b)
for i in range(4): frames[i]=Image.open(p/'base-frames'/f'frame-{i+1:02}.png').convert('RGBA')
for n,b in enumerate(frames,1):b.save(p/f'frame-{n:02}.png')
bgs=[]
for b in frames:
 bg=Image.new('RGBA',(350,350),'#819467');bg.alpha_composite(b);bgs.append(bg.convert('RGB'))
for name,d in [('preview.gif',80),('preview-slow.gif',250)]:bgs[0].save(p/name,save_all=True,append_images=bgs[1:],duration=d,loop=0,disposal=2)
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',20);c=Image.new('RGB',(800,440),'#819467');dr=ImageDraw.Draw(c)
for col,idx in enumerate([1,4]):
 c.paste(bgs[idx].crop((95,85,240,245)).resize((290,320),Image.Resampling.NEAREST),(55+400*col,75));dr.text((45+400*col,22),['왼발 앞으로 점프','오른발 앞으로 · 뒤 왼발도 표현'][col],font=font,fill='white')
c.save(p/'jump-comparison.png')
assert frames[1].crop((0,8,350,350)).tobytes()==frames[2].crop((0,0,350,342)).tobytes()
assert frames[4].crop((0,8,350,350)).tobytes()==frames[5].crop((0,0,350,342)).tobytes()
(p/'animation.json').write_text(json.dumps({'frames':[f'frame-{i:02}.png' for i in range(1,7)],'durations':[83]*6,'loop':True,'status':'review','method':'Full-body redraw; common scale, no old-part composites. Each airborne pose held with 8px height difference.'},indent=2),encoding='utf8')
print('6 transparent frames; both airborne poses verified fixed.')
