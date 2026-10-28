from pathlib import Path
from PIL import Image, ImageDraw
import json, shutil, hashlib

R=Path(__file__).resolve().parent
G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411')
S=R/'sources';S.mkdir(exist_ok=True)
specs={
 'idle':('exec-cdd75693-a7c3-40a4-9a8c-e12e9a083377.png',2,2,.198,[(445,473),(357,473),(445,460),(357,463)],[300]*4),
 'run':('exec-2c7d9fb7-e850-4d5a-ba7c-36e0627e9ff5.png',3,2,.26,[(300,447),(268,447),(236,447),(300,416),(268,416),(236,416)],[100]*6),
 'basic-attack':('exec-a356fb09-e76b-4703-acee-aefebd159a1c.png',4,2,.29,[(250,402),(250,402),(240,402),(250,402),(254,370),(254,368),(243,368),(235,368)],[180,110,100,70,100,120,160,360]),
}
frames={}
for motion,(filename,cols,rows,scale,anchors,ms) in specs.items():
 shutil.copy2(G/filename,S/(motion+'.png'))
 im=Image.open(S/(motion+'.png')).convert('RGBA'); out=[]
 for i,(ax,ay) in enumerate(anchors):
  box=(round(i%cols*im.width/cols),round(i//cols*im.height/rows),round((i%cols+1)*im.width/cols),round((i//cols+1)*im.height/rows))
  cell=im.crop(box);cell=cell.resize((round(cell.width*scale),round(cell.height*scale)),Image.Resampling.LANCZOS)
  dst=Image.new('RGBA',(350,350));dst.alpha_composite(cell,(175-round(ax*scale),245-round(ay*scale)));out.append(dst)
 frames[motion]=out
frames['idle'][3]=frames['idle'][1].copy()
original=frames['idle'][0]
(R/'original').mkdir(exist_ok=True);original.save(R/'original/original.png')
for i in (0,6,7):frames['basic-attack'][i]=original.copy()

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
