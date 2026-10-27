from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
r=Path.cwd()
for hero in ['liu-bei','guan-yu','zhang-fei']:
 hp=r/hero; motions=[];pool=[]
 for name in ['idle','run','basic-attack','skill-1','skill-2']:
  d=hp/name;fs=[Image.open(p).convert('RGBA') for p in sorted(d.glob('frame-*.png'))]
  if not fs:continue
  bgs=[]
  for f in fs:
   bg=Image.new('RGBA',f.size,(40,47,53,255));bg.alpha_composite(f);bgs.append(bg.convert('RGB'))
  pool+=bgs;motions.append((name,d,fs,bgs))
 atlas=Image.new('RGB',(350,350*len(pool)))
 for i,b in enumerate(pool):atlas.paste(b,(0,i*350))
 pal=atlas.quantize(colors=256)
 for name,d,fs,bgs in motions:
  meta=json.loads((d/'animation.json').read_text(encoding='utf-8-sig'));times=meta.get('durations_ms',[100]*len(fs))
  if not isinstance(times,list) or len(times)!=len(fs):times=[100]*len(fs)
  if hero=='zhang-fei' and name in ['basic-attack','skill-1','skill-2']:
   meta.update(status='approved',approval_date='2026-10-27',palette='original-matched; GIF uses shared hero palette');(d/'animation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
  quant=[b.quantize(palette=pal,dither=Image.Dither.NONE) for b in bgs]
  for file,t in [('preview.gif',times),('preview-slow.gif',300)]:
   tmp=d/('new-'+file);quant[0].save(tmp,save_all=True,append_images=quant[1:],duration=t,loop=0,disposal=2,optimize=False);tmp.replace(d/file)
  strip=Image.new('RGBA',(350*len(fs),350));sheet=Image.new('RGBA',(1400,350*((len(fs)+3)//4)))
  for i,f in enumerate(fs):strip.paste(f,(i*350,0));sheet.paste(f,((i%4)*350,(i//4)*350))
  for file,img in [('spritesheet.png',strip),('frames-overview.png',sheet)]:
   tmp=d/('new-'+file);img.save(tmp);tmp.replace(d/file)
 html='<meta charset="utf-8"><style>body{background:#282f35;color:white;font:16px sans-serif}section{display:flex;flex-wrap:wrap}img{width:350px}</style><h1>'+hero+' 최종 승인본</h1><section>'
 for name in ['original','portrait']+[m[0] for m in motions]:html+='<article><h2>'+name+'</h2><img src="../'+name+'/'+('original.png' if name=='original' else 'portrait.png' if name=='portrait' else 'preview.gif')+'"></article>'
 (hp/'preview/index.html').write_text(html+'</section>',encoding='utf-8')
 entries=[]
 for p in sorted(hp.rglob('frame-*.png')):
  if p.parent.name in ['idle','run','basic-attack','skill-1','skill-2'] and p.parent.parent==hp:entries.append(p)
 entries +=[hp/'original/original.png',hp/'portrait/portrait.png']
 if hero=='liu-bei':allentries=[]
 allentries+=entries
manifest={'status':'approved','facing':'left','files':[{'file':p.relative_to(r).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in allentries]}
(r/'tools/character-motion/final-left-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Shared palettes, approved metadata, previews and manifest rebuilt:',len(allentries))
