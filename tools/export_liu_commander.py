from pathlib import Path
import json,shutil,hashlib
import numpy as np
from scipy import ndimage
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';W=C/'sources/commander-motions';P=W/'prepared'
layout=json.loads((W/'layout.json').read_text());u=json.loads((W/'timing-source.json').read_text(encoding='utf8'))

def face(im):
    a=np.array(im).astype(float);r,g,b,alpha=a.transpose(2,0,1)
    m=(r>175)&(g>125)&(b>85)&(r-b>28)&(r-g>12)&(g-b>5)&(alpha>180)
    labels,n=ndimage.label(m);sizes=np.bincount(labels.ravel());sizes[0]=0
    if not n:return None
    mask=labels==sizes.argmax();yy,xx=np.where(mask)
    return (float(xx.mean()),float(yy.mean()),int(xx.max()-xx.min()+1),int(yy.max()-yy.min()+1))

def cells(state):
    d=layout[state];f=W/(state+'-generated.png');im=Image.open(f).convert('RGBA');cw=im.width/d['cols'];ch=im.height/d['rows']
    assert abs(cw/ch-1)<.04,(state,im.size)
    return [im.crop((round(i%d['cols']*cw),round(i//d['cols']*ch),round((i%d['cols']+1)*cw),round((i//d['cols']+1)*ch))).resize((350,350),Image.Resampling.LANCZOS) for i in range(d['count'])]

def make():
    if (W/'run-full-redraw/source.png').exists():
        raise SystemExit('Superseded: full-body run redraw exists. Use liu_run_full_redraw.py; do not regenerate spliced Move.')
    P.mkdir(exist_ok=True);records=[];all_frames={}
    for s,d in layout.items():
        if not (W/(s+'-generated.png')).exists():continue
        ims=cells(s);base=face(ims[0]);scale=46/base[2] if s!='Die' else 1.0
        made=[]
        for i,im in enumerate(ims):
            old=Image.open(C/'archive/before-commander'/Path(d['paths'][i]).relative_to('characters/liu-bei')).convert('RGBA')
            if s=='Die':
                b0=old.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox();b1=im.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox()
                scale=(b0[2]-b0[0])/(b1[2]-b1[0]);anchor=((b1[0]+b1[2])/2,(b1[1]+b1[3])/2);target=((b0[0]+b0[2])/2,(b0[1]+b0[3])/2)
            else:
                anchor=face(im)[:2];target=face(old)[:2]
                # Healing overlay occludes the face: use stable eye/head centres,
                # not the remaining visible skin sliver as a scale reference.
                if s=='Skill_01' and i in (2,3,4,5):
                    anchor=(face(ims[0])[0]+(i==5)*2,face(im)[1]);target=(169,157)
                if s=='Gather' and i==5:anchor=(180,164);target=(156,154)
            size=round(350*scale);scaled=im.resize((size,size),Image.Resampling.LANCZOS)
            dx=round(target[0]-anchor[0]*scale);dy=round(target[1]-anchor[1]*scale)
            out=Image.new('RGBA',(350,350));out.alpha_composite(scaled,(dx,dy))
            if s not in ('Die','Move'):
                def boot_bottom(pic):
                    z=np.array(pic);m=(z[:,:,0]<115)&(z[:,:,1]<115)&(z[:,:,2]<115)&(z[:,:,3]>150)
                    m[:205,:]=False;m[:,:125]=False;m[:,225:]=False
                    ys=np.where(m)[0];return int(ys.max()) if len(ys) else 244
                shift=boot_bottom(old)-boot_bottom(out)
                shifted=Image.new('RGBA',(350,350));shifted.alpha_composite(out,(0,shift));out=shifted;dy+=shift
            made.append(out)
            records.append({'state':s,'frame':i+1,'sourceSheetScale':scale,'translation':[dx,dy],'face':face(out)})
        all_frames[s]=made
    # Build one breathing cycle from one clean redrawn ready pose, without
    # independently generated head/boot/costume variation between idle frames.
    if 'Idle' in all_frames:
        base=all_frames['Attack'][0].copy();a=np.array(base);yy,xx=np.indices((350,350),dtype=float)
        idle=[]
        for bounce in [0,-1,-2,-1]:
            weight=np.clip((224-yy)/16,0,1)
            coords=np.array([yy-bounce*weight,xx]);out=np.stack([ndimage.map_coordinates(a[:,:,k],coords,order=1,mode='constant',cval=0) for k in range(4)],-1).astype(np.uint8)
            idle.append(Image.fromarray(out))
        all_frames['Idle']=idle
        # Ready -> action -> same ready; no morphing during a still return.
        for s in ['Attack','Skill_01','Skill_02']:
            if s in all_frames:all_frames[s][0]=base.copy();all_frames[s][-1]=base.copy()
        if 'Attack' in all_frames:all_frames['Attack'][-2]=base.copy()
        base.save(P/'original.png')
        # Approved six-frame lower-body cycle, not a new rig or new joints.
        # The costume's closed hem occludes the overlap above the original hips.
        # Trace the actual closed robe hem inside its black outer stroke.
        # A horizontal crop truncates the plum panel and orange lower edging.
        points=[(0,210),(145,210),(151,216),(160,220),(166,220),
                (168,223),(180,226),(186,226),(195,224),(204,220),
                (214,216),(220,211),(349,211)]
        hem=np.interp(np.arange(350),[p[0] for p in points],[p[1] for p in points])
        upper=a.copy();upper[:,:,3]=np.where(yy<hem[None,:],a[:,:,3],0)
        upper=Image.fromarray(upper)
        old_ref=face(Image.open(C/'archive/before-commander/run/frame-01.png').convert('RGBA'))
        runs=[]
        for i in range(6):
            old=Image.open(C/f'archive/before-commander/run/frame-{i+1:02}.png').convert('RGBA');oa=np.array(old)
            oa[:218,:,3]=0
            # Remove old green hem remnants only, not the white trousers/boots.
            og=oa[:,:,:3].astype(float);green=(og[:,:,1]>og[:,:,0]+25)&(og[:,:,1]>og[:,:,2]+5)
            oa[:,:,:][green & (yy<225),3]=0
            canvas=Image.fromarray(oa);bob=round(face(old)[1]-old_ref[1]);canvas.alpha_composite(upper,(0,bob));runs.append(canvas)
        all_frames['Move']=runs
    if 'Gather' in all_frames:all_frames['Gather'][-1]=all_frames['Gather'][0].copy()
    font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
    page='<meta charset="utf-8"><style>body{background:#202824;color:#f6f3e7;font:16px system-ui;padding:24px}.grid{display:flex;flex-wrap:wrap;gap:15px}figure{margin:0;background:#e5edef;color:#202824;border-radius:12px;padding:12px}img{width:350px}a{color:#00a67f}</style><h1>유비 · 군주 복식 모션 검토</h1><p>기존 자세 순서·프레임 수·시간을 기준으로 재작화. 새 결과는 검토본입니다.</p><div class="grid">'
    for s,frames in all_frames.items():
        folder=P/Path(layout[s]['paths'][0]).parent.name;folder.mkdir(exist_ok=True)
        for i,f in enumerate(frames):f.save(folder/f'frame-{i+1:02}.png')
        sheet=Image.new('RGBA',(350*len(frames),350));bg=[]
        for i,f in enumerate(frames):
            sheet.alpha_composite(f,(350*i,0));b=Image.new('RGBA',(350,350),'#e5edef');b.alpha_composite(f);bg.append(b.convert('RGB'))
        sheet.save(folder/'spritesheet.png');atlas=Image.new('RGB',(350*len(bg),350))
        for i,f in enumerate(bg):atlas.paste(f,(i*350,0))
        pal=atlas.quantize(colors=256);gif=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in bg]
        for suffix,m in [('',1),('-slow',2)]:gif[0].save(folder/f'preview{suffix}.gif',save_all=True,append_images=gif[1:],duration=[t*m for t in u['motion'][s]['ms']],loop=0,disposal=2,optimize=False)
        cols=layout[s]['cols'];rows=layout[s]['rows'];overview=Image.new('RGBA',(350*cols,380*rows),'#e5edef');draw=ImageDraw.Draw(overview)
        for i,f in enumerate(frames):x=i%cols*350;y=i//cols*380;overview.alpha_composite(f,(x,y+30));draw.text((x+8,y+4),f'{s} {i+1}/{len(frames)}',font=font,fill='#17231b')
        overview.save(folder/'overview.png')
        page+=f'<figure><img src="{folder.name}/preview.gif"><figcaption>{s} · {len(frames)}장 · <a href="{folder.name}/overview.png">프레임 펼치기</a> · <a href="{folder.name}/preview-slow.gif">느리게</a></figcaption></figure>'
    portrait=W/'Portrait-generated.png'
    if portrait.exists():Image.open(portrait).convert('RGBA').resize((350,350),Image.Resampling.LANCZOS).save(P/'portrait.png')
    (P/'index.html').write_text(page+'</div><h2>초상화</h2><img src="portrait.png">',encoding='utf8')
    (W/'alignment.json').write_text(json.dumps(records,indent=2),encoding='utf8')
    print('Exported',sum(map(len,all_frames.values())),'frames to review, not installed')

if __name__=='__main__':make()
