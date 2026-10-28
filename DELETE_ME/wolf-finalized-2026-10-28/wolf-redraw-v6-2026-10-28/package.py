from pathlib import Path
from PIL import Image, ImageDraw
import json, shutil, hashlib
R=Path(__file__).resolve().parent
P=R.parent/'wolf-bound-2026-10-28'
S=R/'sources';S.mkdir(exist_ok=True)
G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411/exec-a22ecdea-4e52-4d82-8f35-117fbbc6389f.png')
shutil.copy2(G,S/'run.png')
frames={m:[Image.open(f).convert('RGBA') for f in sorted((P/m).glob('frame-*.png'))] for m in ['idle','basic-attack']}
im=Image.open(S/'run.png').convert('RGBA')
boxes=[(0,0,512,512),(512,0,1024,512),(1024,0,1536,512),(0,512,512,1024),(512,512,1024,1024),(1024,512,1536,1024)]
anchors=[(280,469),(780,472),(1280,465),(280,900),(780,907),(1280,898)]
scale=.26;run=[]
for box,(ax,ay) in zip(boxes,anchors):
 cell=im.crop(box);cell=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
 dst=Image.new('RGBA',(350,350));dst.alpha_composite(cell,(175-round((ax-box[0])*scale),245-round((ay-box[1])*scale)));run.append(dst)
frames={'idle':frames['idle'],'run':run,'basic-attack':frames['basic-attack']}
specs={m:(None,None,None,1,[(175,245)]*len(fs),json.loads((P/m/'animation.json').read_text())['durations_ms']) for m,fs in frames.items()}
specs['run']=(None,None,None,scale,anchors,[100]*6)
original=frames['idle'][0];(R/'original').mkdir(exist_ok=True);original.save(R/'original/original.png')
# A single palette for all GIFs prevents frame-local palette color changes.
bg=(229,237,240)
def flatten(im):
 b=Image.new('RGBA',im.size,bg+(255,));b.alpha_composite(im);return b.convert('RGB')
allimgs=[im for fs in frames.values() for im in fs]
palimg=Image.new('RGB',(350*len(allimgs),350),bg)
for i,im in enumerate(allimgs):palimg.paste(flatten(im),(350*i,0))
palette=palimg.quantize(colors=256)
for motion,fs in frames.items():
 d=R/motion;d.mkdir(exist_ok=True);ms=specs[motion][-1]
 for i,im in enumerate(fs):im.save(d/f'frame-{i+1:02}.png')
 sheet=Image.new('RGBA',(350*len(fs),350))
 overview=Image.new('RGB',(240*len(fs),260),bg);draw=ImageDraw.Draw(overview)
 for i,im in enumerate(fs):
  sheet.alpha_composite(im,(350*i,0))
  # Enlarged display only; actual delivered PNGs remain 350 square.
  overview.paste(flatten(im).crop((90,140,260,265)).resize((238,175)),(240*i,50));draw.text((240*i+10,12),str(i+1),fill='#25333a')
 sheet.save(d/'spritesheet.png');overview.save(d/'frames-overview.png')
 gifs=[flatten(im).quantize(palette=palette,dither=Image.Dither.NONE) for im in fs]
 for suffix,mult in [('',1),('-slow',3)]:gifs[0].save(d/f'preview{suffix}.gif',save_all=True,append_images=gifs[1:],duration=[t*mult for t in ms],loop=0,disposal=2,optimize=False)
 meta={'status':'review','cell':[350,350],'frame_count':len(fs),'frames':[f'frame-{i+1:02}.png' for i in range(len(fs))],'durations_ms':ms,'facing':'left','pivot':[.5,.3],'ppu':100,'foot_anchor':[175,245],'uniform_source_scale':specs[motion][3],'source_anchors':specs[motion][4]}
 (d/'animation.json').write_text(json.dumps(meta,indent=2),encoding='utf-8')

# Simultaneous GIF: idle, run and bite, using the delivered frames and times.
timeline=[]
for t in range(0,2400,20):
 canvas=Image.new('RGB',(750,270),bg);draw=ImageDraw.Draw(canvas)
 for j,(motion,fs) in enumerate(frames.items()):
  ms=specs[motion][-1];local=t%sum(ms);idx=0
  while local>=ms[idx]:local-=ms[idx];idx+=1
  canvas.paste(flatten(fs[idx]).crop((90,135,260,270)).resize((250,198)),(j*250,42));draw.text((j*250+15,12),motion,fill='#25333a')
 timeline.append(canvas.quantize(palette=palette,dither=Image.Dither.NONE))
timeline[0].save(R/'all-motions.gif',save_all=True,append_images=timeline[1:],duration=20,loop=0,disposal=2,optimize=False)
overview=Image.new('RGB',(8*180,3*210),bg);draw=ImageDraw.Draw(overview)
for y,(motion,fs) in enumerate(frames.items()):
 for i,im in enumerate(fs):
  overview.paste(flatten(im).crop((90,135,260,270)).resize((180,143)),(i*180,y*210+38));draw.text((i*180+7,y*210+10),f'{motion} {i+1}',fill='#25333a')
overview.save(R/'all-frames.png')
manifest={'status':'review-not-approved','files':{p.relative_to(R).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in R.rglob('frame-*.png')}}
(R/'MANIFEST.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Packaged',len(manifest['files']),'frames')
