from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
p=Path('새시안/작업/원작분석/npc-monster-guide');p.mkdir(parents=True,exist_ok=True)
t=Path('re/extract/media/textures')
refs=[('NPC Boat',t/'sactx-0-256x256-ASTC 8x8-NPC_Boat-8fe2ccaa__762.png',(0,30,110,140)),('NPC Fisherman',t/'sactx-0-1024x2048-ASTC 8x8-NPC_Fisherman-260ffc83__604.png',(0,100,105,235)),('NPC Mine / parts',t/'sactx-0-256x256-ASTC 8x8-NPC_Mine-ed648d7d__912.png',(0,0,256,256)),('NPC WoodCutter / parts',t/'sactx-0-256x256-ASTC 8x8-NPC_WoodCutter-0de2027b__567.png',(0,0,256,256))]
b=Image.new('RGB',(1200,380),'#dedbce');d=ImageDraw.Draw(b);font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',17)
for i,(name,path,rect) in enumerate(refs):
 im=Image.open(path).convert('RGBA').crop(rect);im.thumbnail((270,290),Image.Resampling.NEAREST)
 if i<2: im=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST)
 b.paste(im,(i*300+(300-im.width)//2,50),im);d.text((i*300+12,15),name,font=font,fill='#222222')
b.save(p/'npc-original-evidence.png')
print(str(p))
