"""Build documentation from final assets; never export or modify character assets."""
from pathlib import Path
import importlib.util, hashlib, json
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / 'visuals'
OUT.mkdir(exist_ok=True)
spec = importlib.util.spec_from_file_location('approved_motion', ROOT/'tools/character-motion/render.py')
rig = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rig)
names = ['liu-bei', 'guan-yu', 'zhang-fei']
light = '#e5ecee'
frames = [[Image.open(ROOT/n/'run'/f'frame-{i+1:02}.png').convert('RGBA') for i in range(6)] for n in names]
debug = [[rig.render(h,i,True)[0] for i in range(6)] for h in range(3)]

def sheet(collection, filename, background=light, crop=None):
    cellw, cellh = (400,464) if crop is None else (400,284)
    canvas = Image.new('RGB',(cellw*6,cellh*3),background)
    d=ImageDraw.Draw(canvas)
    for h in range(3):
        for i in range(6):
            x,y=i*cellw,h*cellh
            im=collection[h][i]
            if crop: im=im.crop(crop).resize((400,260),Image.Resampling.NEAREST)
            canvas.paste(im,(x,y+24),im)
            d.text((x+8,y+6),f'{names[h]} | {i+1}/6',fill='#111111' if background==light else '#ffffff')
            d.rectangle((x,y,x+cellw-1,y+cellh-1),outline='#82949c')
    canvas.save(OUT/filename)

sheet(frames,'approved-18-frames.png')
sheet(debug,'joint-18-frames.png')
sheet(frames,'legs-light.png',crop=(100,280,300,410))
sheet(frames,'legs-dark.png',background='#222830',crop=(100,280,300,410))

def gif(collection,filename,duration):
    sequence=[]
    for i in range(6):
        im=Image.new('RGB',(1200,464),light); d=ImageDraw.Draw(im)
        for h,n in enumerate(names):
            im.paste(collection[h][i],(h*400,24),collection[h][i])
            d.text((h*400+10,6),f'{n} | {i+1}/6',fill='#111111')
        sequence.append(im)
    sequence[0].save(OUT/filename,save_all=True,append_images=sequence[1:],duration=duration,loop=0,disposal=2)

gif(frames,'approved-run.gif',100)
gif(frames,'approved-run-slow.gif',240)
gif(debug,'joint-run-slow.gif',240)
idle=Image.new('RGB',(1200,464),light); d=ImageDraw.Draw(idle)
for h,n in enumerate(names):
    im=Image.open(ROOT/n/'idle/idle.png').convert('RGBA')
    idle.paste(im,(400*h,24),im);d.text((400*h+10,6),n,fill='#111111')
idle.save(OUT/'idle-reference.png')

sources=[ROOT/'tools/character-motion'/n for n in ['render.py','joint-data.json','parts-atlas.png']]
sources+=list((ROOT/'tools/character-motion/idle-sources').glob('*.png'))
for n in names:
    sources+=list((ROOT/n/'run').glob('*'))+[ROOT/n/'idle/idle.png']
manifest={'recorded':'2026-10-26','purpose':'Approved source snapshot for documentation; no original-game motion claims',
          'sha256':{p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sources if p.is_file()}}
(HERE/'source-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
checks=json.loads((ROOT/'tools/character-motion/run-checksums.json').read_text(encoding='utf-8-sig'))
assert all(hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==v for p,v in checks.items()),'Approved run assets changed'
for h in range(3):
    for f in range(6):
        assert frames[h][f].tobytes()==rig.render(h,f)[0].tobytes(), 'Renderer differs from final PNG'
print('8 guide visuals created; approved run hashes and all 18 rendered frames verified.')
