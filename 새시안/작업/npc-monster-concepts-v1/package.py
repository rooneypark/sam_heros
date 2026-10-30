from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json
p=Path('새시안/작업/npc-monster-concepts-v1')
# source cell index, local feet anchor, body height excluding tools, design target height
specs=[('주모','village-hostess','npc',0,300,500,435,115),('노인','village-elder','npc',1,285,500,390,112),('소년','village-boy','npc',2,270,500,330,95),('대장장이','village-blacksmith','npc',3,310,465,430,120),('경비병','armory-guard','npc',4,290,465,400,120),('아낙','village-woman','npc',5,285,465,390,112),('늑대','yellow-turban-wolf','monster',0,290,500,220,75),('황건 졸병','yellow-turban-soldier','monster',1,280,500,290,120),('황건 창병','yellow-turban-spearman','monster',2,300,500,300,120),('황건 궁병','yellow-turban-archer','monster',3,295,440,290,120),('관해','guan-hai','monster',4,290,440,380,165),('장각','zhang-jiao','monster',5,300,440,360,160)]
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
line=Image.new('RGB',(3600,330),'#819467');d=ImageDraw.Draw(line);d.line((0,245,3600,245),fill='#d5dfca',width=1)
manifest=[]
for n,(label,key,group,idx,fx,fy,bh,target) in enumerate(specs):
 s=Image.open(p/f'{group}-source.png').convert('RGBA');cw=s.width//3;ch=s.height//2;x=idx%3*cw;y=idx//3*ch
 c=s.crop((x,y,x+cw,y+ch));c.putalpha(c.getchannel('A').point(lambda a:0 if a<180 else a));scale=target/bh
 c=c.resize((round(cw*scale),round(ch*scale)),Image.Resampling.LANCZOS)
 b=Image.new('RGBA',(350,350));b.paste(c,(round(175-fx*scale),round(245-fy*scale)))
 dest=p/key;dest.mkdir(exist_ok=True);b.save(dest/'concept-350.png')
 tile=b.crop((25,0,325,330));line.paste(tile,(n*300,0),tile);d.text((n*300+150,275),label,font=font,fill='white',anchor='mt')
 manifest.append({'key':key,'name':label,'height_target':target,'body_height_source_estimate':bh,'scale':scale,'status':'review'})
line.save(p/'all-12-lineup.png');line.resize((7200,660),Image.Resampling.NEAREST).save(p/'all-12-lineup-2x.png')
line.crop((0,0,1800,330)).save(p/'npc-lineup.png');line.crop((1800,0,3600,330)).save(p/'monster-lineup.png')
(p/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('12 RGBA 350x350 concepts and one-row comparison saved.')
