from pathlib import Path
from PIL import Image, ImageDraw
import json
p=Path('wolf-dog-reference-v7'); fs=[Image.open(f).convert('RGBA') for f in sorted((p/'run').glob('frame-*.png'))]
assert len(fs)==6 and all(im.size==(350,350) for im in fs)
images=[]
for n in range(18):
 c=Image.new('RGB',(600,250),(229,237,240));d=ImageDraw.Draw(c)
 for j,i in enumerate([n%6,(n//3)%6]):
  b=Image.new('RGBA',(350,350),(229,237,240,255)); b.alpha_composite(fs[i]); c.paste(b.convert('RGB').crop((110,160,235,260)).resize((275,220)),(j*300+12,30)); d.text((j*300+15,8),('NORMAL' if j==0 else 'SLOW x3')+'  '+str(i+1)+'/6',fill='black')
 images.append(c)
pal=Image.new('RGB',(600*18,250));[pal.paste(im,(i*600,0)) for i,im in enumerate(images)]; pal=pal.quantize(colors=256)
images=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in images];images[0].save(p/'run-review.gif',save_all=True,append_images=images[1:],duration=80,loop=0,disposal=2,optimize=False)
g=Image.open(p/'run/preview.gif');assert g.n_frames==6
(p/'README.md').write_text('''# Wolf six-frame dog-reference redraw — review only

Built-in imagegen, continuous full-frame drawings; no cutout rig or part deformation. Current small wolf identity is wolf-bound-2026-10-28/original/original.png. All frames use one scale 0.21; fixed root (175,245), 350x350 RGBA, left facing. No per-frame bbox scale.

Reference: GandalfHardcore Doggy Companion https://gandalfhardcore.itch.io/2d-pixel-art-male-and-female-character/devlog/748840/added-free-doggy-companion-
Public preview has 24 display frames at80ms; the dog repeats six poses. First six extracted for motion study. Reference is not a runtime asset.

Choreography: gather/support, hind push/front tuck, takeoff, extended flight, front contact, recovery. Maintain grey/ivory fur, yellow bandana, short paws and continuous contours. Generation source is sources/run.png. Existing final wolf and other characters remain unchanged.

QA: Six transparent350 PNGs, shared GIF palette,80ms frames,480ms cycle. Sheet examined including6-to1; browser preview loads. Actual generated body geometry is visually approximate, not a proven exact match. User approval pending.
''',encoding='utf-8')
print('PASS: 6 RGBA350 frames, GIF 6 frames/480ms; review GIF normal+slow')
