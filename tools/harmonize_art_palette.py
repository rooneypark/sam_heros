"""User-authorized RGB-only correction. Never fit/warp/re-time animation frames.

Run without --apply to prepare comparison assets; --apply installs the reviewed
colour pass. Backups are immutable and every run derives from those originals.
"""
from pathlib import Path
import argparse, json, hashlib, shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'art/style-review/hero-palette'
HEROES = {'liu-bei','guan-yu','zhang-fei','zhao-yun'}
STATES = {'original','idle','run','basic-attack','skill-1','skill-2','gather','work','die','portrait'}
# Small flat colour families, shared across all frames, never fitted per image.
COMMON = ['000000','171918','343735','524d4d','787675','a4a4a6','c5c7cb','e9e8e8','fffdf7',
          '653c2c','996441','c58d59','e8b882','ffcfaa','ffbc94','df9676',
          '745039','a6774a','cca36b','e8c68d','f6dfa9',
          '806829','bb972e','e5b436','ffcd31','ffe275',
          'a52d36','dc3e49','ff535a','fa7a19','ffae24','9d6270','ca8a99','ecc0c6',
          '274b40','447266','008e6b','00bb8b','4dd2aa','a2e3c5',
          '143f80','005ae3','4385ec','a5c3ee','483b58','785f88']
TERRAIN = COMMON + ['287751','389365','64b978','91ce8c','b9dba1',
                    'b79b6b','d8bb86','efd4a3','81bcca','579aae','35758e']

def palette_lut(colours):
    palette=np.array([[int(h[i:i+2],16) for i in (0,2,4)] for h in colours],dtype=np.float32)
    rgb=np.stack(np.meshgrid(np.arange(32),np.arange(32),np.arange(32),indexing='ij'),-1).reshape(-1,3)*8+3.5
    # Perceptually weighted RGB; family colours stay within the existing identity.
    distance=((rgb[:,None,:]-palette[None,:,:])**2*np.array([.27,.56,.17])).sum(2)
    weights=np.exp(-(distance-distance.min(1,keepdims=True))/380)
    mapped=weights@palette/weights.sum(1,keepdims=True)
    # Neutral fabric/fur must not acquire purple or green speckles.
    chroma=rgb.max(1)-rgb.min(1)
    neutral=np.clip((34-chroma)/20,0,1)[:,None]
    grey=(mapped*np.array([.27,.56,.17])).sum(1,keepdims=True)
    return (mapped*(1-neutral)+grey*neutral).reshape(32,32,32,3)

def lookup(rgb,kind):
    # Interpolate the fixed LUT, avoiding noisy colour jumps at quantisation edges.
    pos=np.clip((rgb-3.5)/8,0,31);lo=np.floor(pos).astype(np.int32);hi=np.minimum(lo+1,31);f=pos-lo
    result=np.zeros_like(rgb);lut=LUTS[kind]
    for a in (0,1):
        for b in (0,1):
            for c in (0,1):
                w=(f[:,:,0] if a else 1-f[:,:,0])*(f[:,:,1] if b else 1-f[:,:,1])*(f[:,:,2] if c else 1-f[:,:,2])
                result+=lut[hi[:,:,0] if a else lo[:,:,0],hi[:,:,1] if b else lo[:,:,1],hi[:,:,2] if c else lo[:,:,2]]*w[:,:,None]
    return result

LUTS={'character':palette_lut(COMMON),'terrain':palette_lut(TERRAIN)}

def correct(im,kind):
    src=np.array(im.convert('RGBA')); rgb=src[:,:,:3].astype(np.float32)
    target=lookup(rgb,kind)
    if kind=='terrain':
        # Foliage is one green family; yellow-green highlights must not become gold dots.
        green=np.clip((rgb[:,:,1]-rgb[:,:,0])/24,0,1)*np.clip((rgb[:,:,1]-rgb[:,:,2])/40,0,1)
        lum0=rgb[:,:,0]*.27+rgb[:,:,1]*.56+rgb[:,:,2]*.17
        ramp=np.array([[28,65,49],[40,119,81],[56,147,101],[100,185,120],[145,206,140],[185,219,161]])
        foliage=np.stack([np.interp(lum0,[35,80,115,155,200,245],ramp[:,i]) for i in range(3)],-1)
        target=target*(1-green[:,:,None])+foliage*green[:,:,None]
    strength=.70 if kind=='character' else .92
    result=rgb*(1-strength)+target*strength
    # Dark coloured environmental contours become neutral black; not thickened.
    lum=rgb[:,:,0]*.27+rgb[:,:,1]*.56+rgb[:,:,2]*.17
    if kind=='terrain':
        ink=np.clip((66-lum)/36,0,1)[:,:,None]
        grey=np.minimum(lum*.34,18)[:,:,None]
        result=result*(1-ink)+grey*ink
    else:
        ink=np.clip((32-lum)/20,0,1)[:,:,None]
        result=result*(1-ink)+rgb*.45*ink
    src[:,:,:3]=np.clip(np.rint(result),0,255).astype(np.uint8)
    return Image.fromarray(src)

def checksum(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def targets():
    out=[]
    for root in sorted((ROOT/'characters').iterdir()):
        if not root.is_dir() or root.name in HEROES: continue
        for state in sorted(STATES):
            folder=root/state
            if not folder.exists(): continue
            for p in sorted(folder.glob('*.png')):
                if p.name in ('original.png','portrait.png') or p.name.startswith('frame-'):
                    out.append((p,'character',root/'archive/before-hero-palette'/p.relative_to(root)))
    tiles=json.loads((ROOT/'content/samguk/tiles.json').read_text(encoding='utf8'))['tiles']
    files=set()
    for t in tiles:
        files.update(t.get('sprites',[]))
        for k in ('sprite','material'):
            if t.get(k): files.add(t[k])
    for f in sorted(files):
        p=ROOT/f
        out.append((p,'terrain',p.parent/'archive/before-hero-palette'/p.name))
    return out

def comparison(rows):
    font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
    chosen=['liu-bei','guan-yu','zhang-fei','zhao-yun','yellow-turban-soldier','yellow-turban-archer',
            'guan-hai','zhang-jiao','village-woman','village-blacksmith','village-hostess','yellow-turban-wolf']
    board=Image.new('RGB',(1200,300*4),'#e5edef'); d=ImageDraw.Draw(board)
    for i,name in enumerate(chosen):
        x=i%3*400;y=i//3*300;p=ROOT/'characters'/name/'original/original.png'
        after=OUT/'prepared'/p.relative_to(ROOT)
        old=ROOT/'characters'/name/'archive/before-hero-palette/original/original.png'
        if not old.exists():old=p
        for j,f in enumerate([old,after if after.exists() else p]):
            im=Image.open(f).convert('RGBA');box=im.getbbox();im=im.crop(box);im.thumbnail((165,235))
            board.paste(im,(x+j*200+(200-im.width)//2,y+35+235-im.height),im)
        d.text((x+10,y+4),name+(' (reference)' if name in HEROES else ' | before / after'),font=font,fill='#182321')
    board.save(OUT/'characters-comparison.png')
    terrain=[r for r in rows if r['kind']=='terrain']
    board=Image.new('RGB',(1200,240*((len(terrain)+3)//4)),'#e5edef');d=ImageDraw.Draw(board)
    for i,r in enumerate(terrain):
        x=i%4*300;y=i//4*240;p=ROOT/r['path'];old=ROOT/r['backup'];new=OUT/'prepared'/r['path']
        d.text((x+8,y+5),p.stem,font=font,fill='#182321')
        for j,f in enumerate([old,new]):
            im=Image.open(f).convert('RGBA');im.thumbnail((142,195))
            board.paste(im,(x+j*150+(150-im.width)//2,y+35+(195-im.height)//2),im)
    board.save(OUT/'terrain-comparison.png')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    OUT.mkdir(parents=True,exist_ok=True);rows=[]
    baseline={str(p.relative_to(ROOT)):checksum(p) for h in HEROES for p in (ROOT/'characters'/h).glob('*/frame-*.png')}
    for p,kind,backup in targets():
        backup.parent.mkdir(parents=True,exist_ok=True)
        if not backup.exists():shutil.copy2(p,backup)
        before=Image.open(backup).convert('RGBA');after=correct(before,kind)
        redraw=p.parent/'sources/hero-style/redraw.png'
        redrawn=kind=='terrain' and redraw.exists()
        if redrawn:
            source=Image.open(redraw).convert('RGBA')
            bbox=source.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()
            targetbox=before.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()
            source=source.crop(bbox);source.thumbnail((targetbox[2]-targetbox[0],targetbox[3]-targetbox[1]),Image.Resampling.LANCZOS)
            after=Image.new('RGBA',before.size)
            after.alpha_composite(source,((targetbox[0]+targetbox[2]-source.width)//2,targetbox[3]-source.height))
            after=correct(after,kind)
        prepared=OUT/'prepared'/p.relative_to(ROOT);prepared.parent.mkdir(parents=True,exist_ok=True)
        after.save(prepared)
        assert before.size==after.size
        alpha_same=np.array_equal(np.array(before.getchannel('A')),np.array(after.getchannel('A')))
        assert alpha_same or redrawn
        rows.append({'path':str(p.relative_to(ROOT)).replace('\\','/'),'kind':kind,
                     'backup':str(backup.relative_to(ROOT)).replace('\\','/'),'size':list(before.size),
                     'beforeSha256':checksum(backup),'afterSha256':checksum(prepared),'alphaUnchanged':bool(alpha_same),'redrawn':redrawn})
        if args.apply:shutil.copy2(prepared,p)
    assert all(checksum(ROOT/p)==v for p,v in baseline.items())
    comparison(rows)
    (OUT/'manifest.json').write_text(json.dumps({'status':'applied-review' if args.apply else 'prepared',
        'method':'RGB-only fixed shared palette, no frame fitting; alpha/size unchanged',
        'heroFramesUnchanged':len(baseline),'assets':rows},ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'assets':len(rows),'characters':sum(r['kind']=='character' for r in rows),
                      'terrain':sum(r['kind']=='terrain' for r in rows),'applied':args.apply}))

if __name__=='__main__':main()
