from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cv2,json,shutil
R=Path.cwd();G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411');O=R/'art/terrain/work-area-overlays';O.mkdir(exist_ok=True)
specs=[('tavern','7f94933d-9f67-43c2-8fa1-7e2848c63321','1d933623-b33d-4c99-835b-f7becfdddd98',.45,(226,438),(170,350,340,430),325,'주막 · 조리'),('blacksmith','e6b3f511-a90f-492d-b633-7db895bd9de0','0941c89c-0cb0-4daf-97ef-941ed414c46a',.42,(270,425),(150,428,292,487),360,'대장간 · 망치질'),('training-ground',None,'3fdea31b-97e5-40d1-bb84-286a1f5686c5',.40,(185,402),(230,451,422,489),431,'훈련소 · 목인 타격')]
sets=[];report={}
for name,bgsrc,works,scale,anchor,patch,freeze,title in specs:
 D=O/name;D.mkdir(exist_ok=True);S=D/'sources';S.mkdir(exist_ok=True)
 if name=='blacksmith' and (D/'frame-06.png').exists():
  previews=[]
  for i in range(6):
   b=Image.new('RGBA',(512,512),'#e7edef');b.alpha_composite(Image.open(D/f'frame-{i+1:02d}.png').convert('RGBA'));previews.append(b.convert('RGB'))
  sets.append(previews);report[name]=json.loads((D/'animation.json').read_text(encoding='utf-8'));continue
 bgpath=G/f'exec-{bgsrc}.png' if bgsrc else R/'art/terrain/facilities/training-ground/building.png'
 shutil.copy2(bgpath,S/'background-source.png');shutil.copy2(G/f'exec-{works}.png',S/'work-area-source.png')
 bg=Image.open(bgpath).convert('RGBA').resize((512,512),Image.Resampling.LANCZOS);bg.save(D/'background.png')
 sheet=Image.open(S/'work-area-source.png').convert('RGBA');raw=[sheet.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512)) for i in range(6)]
 # Align the entire group by fixed workstation/boot feature; common scale, never resize parts.
 template=np.asarray(raw[0].convert('RGB').crop(patch));registered=[];translations=[]
 for f in raw:
  a=np.asarray(f);res=cv2.matchTemplate(a[:,:,:3],template,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(res);dx,dy=patch[0]-loc[0],patch[1]-loc[1]
  assert abs(dx)<100 and abs(dy)<100,(name,dx,dy)
  reg=Image.fromarray(cv2.warpAffine(a,np.float32([[1,0,dx],[0,1,dy]]),(512,512),flags=cv2.INTER_NEAREST,borderMode=cv2.BORDER_CONSTANT));registered.append(reg);translations.append([dx,dy])
 # Fixed table/anvil base or lowerbody inside the whole work-area layer.
 if name=='tavern':
  tablemask=Image.new('L',(512,512));ImageDraw.Draw(tablemask).polygon([(0,238),(146,238),(146,298),(282,298),(405,322),(405,278),(512,278),(512,512),(0,512)],fill=255)
  registered=[Image.composite(registered[0],im,tablemask) for im in registered]
  tablemask.save(D/'fixed-table-mask.png')
 # Training sword descends below the former horizontal freeze line.
 # Keep the whole work-area frame intact instead of replacing its bottom band.
 if name=='training-ground':registered[-1]=registered[0].copy()
 ar=np.asarray(registered[0]);ys,xs=np.where(ar[:,:,3]>128);bottom=int(ys.max());left=int(xs.min());right=int(xs.max());cx=(left+right)/2
 size=round(512*scale);pos=(round(anchor[0]-cx*scale),round(anchor[1]-bottom*scale))
 frames=[];alphas=[]
 for i,im in enumerate(registered):
  work=Image.new('RGBA',(512,512));work.alpha_composite(im.resize((size,size),Image.Resampling.LANCZOS),pos);work.save(D/f'work-{i+1:02d}.png');alphas.append(np.asarray(work.getchannel('A'))>0)
  combined=bg.copy();combined.alpha_composite(work);combined.save(D/f'frame-{i+1:02d}.png');frames.append(combined)
 strip=Image.new('RGBA',(3072,512))
 for i,f in enumerate(frames):strip.alpha_composite(f,(512*i,0))
 strip.save(D/'spritesheet.png')
 previews=[]
 for f in frames:
  b=Image.new('RGBA',(512,512),'#e7edef');b.alpha_composite(f);previews.append(b.convert('RGB'))
 palimg=Image.new('RGB',(3072,512))
 for i,f in enumerate(previews):palimg.paste(f,(i*512,0))
 pal=palimg.quantize(colors=256);indexed=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in previews];times=[240,160,160,120,160,200]
 indexed[0].save(D/'preview.gif',save_all=True,append_images=indexed[1:],duration=times,loop=0,optimize=False,disposal=2)
 static=~np.logical_or.reduce(alphas);diff=[int(np.any(np.asarray(f)!=np.asarray(bg),axis=2)[static].sum()) for f in frames];assert not any(diff)
 meta={'status':'review','frames':6,'ms':times,'canvas':[512,512],'background':'background.png','overlays':[f'work-{i+1:02d}.png' for i in range(6)],'uniformScale':scale,'position':pos,'wholeWorkAreaRegistration':translations,'changedBackgroundPixels':diff,'fixedWorkstationFromSourceY':None,'fixedFurnitureMask':'fixed-table-mask.png' if name=='tavern' else None,'fullSwordPreserved':name=='training-ground'}
 (D/'animation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');report[name]=meta;sets.append(previews)
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24);combo=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef');d=ImageDraw.Draw(im)
 for k,s in enumerate(specs):im.paste(sets[k][i].resize((400,400)),(k*400,45));d.text((k*400+25,10),s[-1],font=font,fill='#27363c')
 combo.append(im)
stack=Image.new('RGB',(1200,2700))
for i,f in enumerate(combo):stack.paste(f,(0,i*450))
pal=stack.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in combo]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=times,loop=0,optimize=False,disposal=2);combo[0].save(O/'overview.png');(O/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(report)


