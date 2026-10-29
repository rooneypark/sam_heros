"""Reproduce idle-breathing.md/run-spec.md displacement on existing artwork.
No new parts, redraw, color correction, scaling, or combat changes.
"""
from pathlib import Path
import json, hashlib
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import map_coordinates

D=Path('characters/liu-bei/sources/two-hand-sword/compact-guard/motion-rework')
O=D/'bounce-review';O.mkdir(exist_ok=True)
orig=Image.open(D/'original-350.png').convert('RGBA')
font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',16)
combat={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for f in ['basic-attack','skill-1','skill-2'] for p in (D/'prepared'/f).glob('frame-*.png')}

def breathe(amount):
    if not amount:return orig.copy()
    a=np.asarray(orig).astype(float)/255
    # Head, arms, held sword and torso translate rigidly. Only hidden
    # thigh/hem connection tapers. Boots and lower leg area remain exact.
    y,x=np.mgrid[0:350,0:350].astype(float)
    t=np.clip((y-224)/10,0,1);weight=1-t*t*(3-2*t)
    sy=y+amount*weight
    alpha=map_coordinates(a[:,:,3],[sy,x],order=1,mode='constant')
    rgb=np.stack([map_coordinates(a[:,:,c]*a[:,:,3],[sy,x],order=1,mode='constant') for c in range(3)],axis=-1)
    rgb=np.divide(rgb,alpha[:,:,None],out=np.zeros_like(rgb),where=alpha[:,:,None]>0)
    out=np.clip(np.rint(np.dstack([rgb,alpha])*255),0,255).astype('uint8')
    out[234:]=np.asarray(orig)[234:]
    return Image.fromarray(out)

idle=[breathe(n) for n in [0,1,2,1]]
run=[]
for i,bob in enumerate([0,-1,-3,0,-1,-3]):
    im=Image.open(D/'prepared/run'/f'frame-{i+1:02}.png').convert('RGBA')
    out=Image.new('RGBA',(350,350));out.alpha_composite(im,(0,bob));run.append(out)

def gif(images,path,durations):
    atlas=Image.new('RGB',(images[0].width*len(images),images[0].height))
    for i,im in enumerate(images):atlas.paste(im,(im.width*i,0))
    pal=atlas.quantize(colors=256)
    fs=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in images]
    fs[0].save(path,save_all=True,append_images=fs[1:],duration=durations,loop=0,disposal=2,optimize=False)

for name,frames,ms in [('idle',idle,300),('run',run,100)]:
    dest=O/name;dest.mkdir(exist_ok=True);bg=[]
    sheet=Image.new('RGBA',(350*len(frames),350));overview=Image.new('RGBA',(350*len(frames),380),'#e5edef')
    draw=ImageDraw.Draw(overview)
    for i,im in enumerate(frames):
        im.save(dest/f'frame-{i+1:02}.png');sheet.alpha_composite(im,(350*i,0));overview.alpha_composite(im,(350*i,30));draw.text((350*i+10,8),f'{name} {i+1}',font=font,fill='#26323c')
        b=Image.new('RGBA',(350,350),'#e5edef');b.alpha_composite(im);bg.append(b.convert('RGB'))
    sheet.save(dest/'spritesheet.png');overview.save(dest/'overview.png');gif(bg,dest/'preview.gif',ms);gif(bg,dest/'slow.gif',450 if name=='idle' else 240)
    (dest/'animation.json').write_text(json.dumps({'frames':[f'frame-{i+1:02}.png' for i in range(len(frames))],'ms':[ms]*len(frames),'loop':True},indent=2),encoding='utf8')

gallery=[]
for tick in range(60):
    out=Image.new('RGBA',(960,440),'#e5edef');draw=ImageDraw.Draw(out)
    for j,(label,im) in enumerate([('승인 원화',orig),('숨쉬기 · 상체만',idle[(tick//3)%4]),('이동 · 다리와 상체',run[tick%6])]):
        # Uniform enlargement for review only; PNG exports stay 350x350.
        crop=im.crop((85,110,235,260)).resize((300,300),Image.Resampling.NEAREST)
        out.alpha_composite(crop,(j*320+10,80));draw.text((j*320+20,20),label,font=font,fill='#26323c')
    gallery.append(out.convert('RGB'))
gif(gallery,O/'comparison.gif',100)
assert all(np.array_equal(np.asarray(im)[234:],np.asarray(orig)[234:]) for im in idle)
assert all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==h for p,h in combat.items())
report={'idleUpperY':[0,-1,-2,-1],'idleFixedFromY':234,'idleFixedPixelsExact':True,'runY':[0,-1,-3,0,-1,-3],'combatUnchanged':True,'status':'idle/run review; combat approved','method':'guide displacement of existing art; no scaling','combatChecksums':combat}
(O/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(O/'index.html').write_text('<meta charset="utf-8"><title>유비 숨쉬기·이동 바운스 검토</title><style>body{background:#26323c;color:white;font:18px sans-serif}img{max-width:100%}a{color:#80e0c0}</style><h1>유비 숨쉬기·이동 바운스 검토</h1><p>공격·스킬1·2 승인본 유지. 아래 두 모션만 재검토.</p><img src="comparison.gif"><p><a href="idle/overview.png">숨쉬기4 전체 프레임</a> · <a href="run/overview.png">이동6 전체 프레임</a></p><h2>이동 느린 재생</h2><img src="run/slow.gif">',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='combatChecksums'},ensure_ascii=False))
