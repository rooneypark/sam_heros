from pathlib import Path
import sys,json,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
sys.path.insert(0,'tools')
from export_liu_commander import face
D=Path('characters/liu-bei/sources/two-hand-sword/compact-guard/motion-rework');O=D/'whole-leg-run'
sheet=Image.open(O/'source.png').convert('RGBA');cw=sheet.width/3;ch=sheet.height/2
cells=[sheet.crop((round(i%3*cw),round(i//3*ch),round((i%3+1)*cw),round((i//3+1)*ch))) for i in range(6)]
orig=Image.open(D/'original-350.png').convert('RGBA');target=face(orig);scale=target[2]/face(cells[0])[2]
frames=[];measure=[]
for i,im in enumerate(cells):
    im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS);f=face(im)
    offset=(round(target[0]-f[0]),round(target[1]+[0,-1,-3,0,-1,-3][i]-f[1]))
    out=Image.new('RGBA',(350,350));out.alpha_composite(im,offset);frames.append(out);out.save(O/f'frame-{i+1:02}.png');measure.append({'face':face(out),'translation':offset,'scale':scale})
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
def gif(fs,path,ms):
    atlas=Image.new('RGB',(fs[0].width*len(fs),fs[0].height))
    for i,im in enumerate(fs):atlas.paste(im,(i*im.width,0))
    pal=atlas.quantize(colors=256);fs=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in fs]
    fs[0].save(path,save_all=True,append_images=fs[1:],duration=ms,loop=0,disposal=2,optimize=False)
overview=Image.new('RGBA',(1050,760),'#e5edef');draw=ImageDraw.Draw(overview);sheet=Image.new('RGBA',(2100,350));preview=[];comparison=[]
for i,im in enumerate(frames):
    sheet.alpha_composite(im,(350*i,0));overview.alpha_composite(im,(350*(i%3),380*(i//3)+30));draw.text((350*(i%3)+10,380*(i//3)+5),str(i+1),font=font,fill='#26323c')
    bg=Image.new('RGBA',(350,350),'#e5edef');bg.alpha_composite(im);preview.append(bg.convert('RGB'))
    comp=Image.new('RGBA',(960,380),'#e5edef');dr=ImageDraw.Draw(comp)
    old=Image.open(D/'bounce-review/run'/f'frame-{i+1:02}.png').convert('RGBA');zhao=Image.open(Path('characters/zhao-yun/run')/f'frame-{i+1:02}.png').convert('RGBA')
    for j,(label,pic) in enumerate([('이전 유비',old),('다시 그린 유비',im),('조운 기준',zhao)]):
        crop=pic.crop((85,110,235,265)).resize((300,310),Image.Resampling.NEAREST);comp.alpha_composite(crop,(j*320+10,50));dr.text((j*320+12,12),label,font=font,fill='#26323c')
    comparison.append(comp.convert('RGB'))
sheet.save(O/'spritesheet.png');overview.save(O/'overview.png');gif(preview,O/'preview.gif',100);gif(comparison,O/'comparison.gif',160);gif(comparison,O/'comparison-slow.gif',300)
protected=json.loads((O/'protected-before.json').read_text());assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==v for p,v in protected.items())
(O/'verification.json').write_text(json.dumps({'status':'review','protected29PNGUnchanged':True,'commonScale':scale,'measurements':measure},indent=2),encoding='utf8')
(O/'index.html').write_text('<meta charset="utf-8"><title>유비 다리 전체 교대 검토</title><style>body{background:#26323c;color:white;font:18px sans-serif}img{max-width:100%}a{color:#80dcc0}</style><h1>이전 유비 / 수정 유비 / 조운</h1><img src="comparison.gif"><p><a href="overview.png">6프레임 전체</a></p><h2>느린 비교</h2><img src="comparison-slow.gif">',encoding='utf8')
print(json.dumps(measure))
