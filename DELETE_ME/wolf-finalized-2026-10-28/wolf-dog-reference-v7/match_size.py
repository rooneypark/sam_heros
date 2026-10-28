from pathlib import Path
from PIL import Image,ImageDraw
import shutil,json,hashlib
r=Path.cwd();p=r/'chapter-1/yellow-turban-wolf';backup=r/'DELETE_ME/wolf-before-size-match-2026-10-28'
if not backup.exists():shutil.copytree(p,backup)
runhash={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in (p/'run').glob('frame-*.png')}
scale=.93
for folder,pattern in [('original','original.png'),('idle','frame-*.png'),('basic-attack','frame-*.png')]:
 for f in (backup/folder).glob(pattern):
  im=Image.open(f).convert('RGBA'); small=im.resize((round(350*scale),round(350*scale)),Image.Resampling.LANCZOS);out=Image.new('RGBA',(350,350));out.alpha_composite(small,(175-round(175*scale),245-round(245*scale)));out.save(p/folder/f.name)
 if folder!='original':
  m=json.loads((p/folder/'animation.json').read_text());m['size_match_scale']=scale;m['size_match_basis']='approved run, root (175,245), uniform scaling of every frame';(p/folder/'animation.json').write_text(json.dumps(m,indent=2))
fs={m:[Image.open(f).convert('RGBA') for f in sorted((p/m).glob('frame-*.png'))] for m in ['idle','run','basic-attack']}
bg=(229,237,240)
def flat(im):
 b=Image.new('RGBA',im.size,bg+(255,));b.alpha_composite(im);return b.convert('RGB')
allim=[im for seq in fs.values() for im in seq];palim=Image.new('RGB',(350*len(allim),350),bg)
for i,im in enumerate(allim):palim.paste(flat(im),(350*i,0))
pal=palim.quantize(colors=256)
for m in ['idle','basic-attack']:
 seq=fs[m];d=p/m;tim=json.loads((d/'animation.json').read_text())['durations_ms'];sheet=Image.new('RGBA',(350*len(seq),350));ov=Image.new('RGB',(240*len(seq),260),bg)
 for i,im in enumerate(seq):sheet.alpha_composite(im,(350*i,0));ov.paste(flat(im).crop((90,140,260,265)).resize((238,175)),(240*i,50))
 sheet.save(d/'spritesheet.png');ov.save(d/'frames-overview.png');gif=[flat(im).quantize(palette=pal,dither=Image.Dither.NONE) for im in seq]
 for suffix,mul in [('',1),('-slow',3)]:gif[0].save(d/f'preview{suffix}.gif',save_all=True,append_images=gif[1:],duration=[t*mul for t in tim],loop=0,disposal=2,optimize=False)
frames=[]
for t in range(0,2400,20):
 c=Image.new('RGB',(750,260),bg);dr=ImageDraw.Draw(c)
 for j,(m,seq) in enumerate(fs.items()):
  times=json.loads((p/m/'animation.json').read_text())['durations_ms'];local=t%sum(times);i=0
  while local>=times[i]:local-=times[i];i+=1
  c.paste(flat(seq[i]).crop((110,155,240,260)).resize((250,202)),(j*250,35));dr.text((j*250+10,10),m,fill='black')
 frames.append(c.quantize(palette=pal,dither=Image.Dither.NONE))
frames[0].save(p/'all-motions.gif',save_all=True,append_images=frames[1:],duration=20,loop=0,disposal=2,optimize=False)
ov=Image.new('RGB',(1440,630),bg);dr=ImageDraw.Draw(ov)
for y,(m,seq) in enumerate(fs.items()):
 for i,im in enumerate(seq):ov.paste(flat(im).crop((90,135,260,270)).resize((180,143)),(i*180,y*210+38));dr.text((i*180+7,y*210+10),f'{m} {i+1}',fill='black')
ov.save(p/'all-frames.png')
comp=Image.new('RGB',(900,310),bg);dr=ImageDraw.Draw(comp)
for j,(name,im) in enumerate([('original',Image.open(p/'original/original.png').convert('RGBA')),('run',fs['run'][0]),('attack',fs['basic-attack'][0])]):comp.paste(flat(im).crop((110,160,240,260)).resize((300,231)),(j*300,40));dr.text((j*300+10,10),name,fill='black')
comp.save(p/'size-comparison.png')
assert runhash=={f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in (p/'run').glob('frame-*.png')}
manifest=r/'chapter-1/FINAL_MANIFEST.json';data=json.loads(manifest.read_text());
for f in p.rglob('*.png'):data['sha256'][str(f.relative_to(r/'chapter-1'))]=hashlib.sha256(f.read_bytes()).hexdigest()
manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
note='\n2026-10-28 size match: original/idle/attack uniformly scaled 0.93 about (175,245) to approved Move size. Move PNGs unchanged. No per-frame fitting or redraw.\n'
for dest in [p/'README.md',r/'AGENTS.md']:dest.write_text(dest.read_text(encoding='utf-8')+note,encoding='utf-8')
print('PASS: run 6 PNG unchanged; original/idle/attack scaled .93; shared GIF palette rebuilt')
