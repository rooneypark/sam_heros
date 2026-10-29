from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import numpy as np,cv2,json,shutil
R=Path.cwd();G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411');O=R/'art/terrain/facilities';O.mkdir(exist_ok=True)
specs=[('tavern','029d7aca-0313-49e0-9055-d9388c41f6ee','346ac43d-db5d-4e3b-8fcd-d3ba5ef01510',.26,(252,340),'주막'),('blacksmith','0d5bd260-d934-4140-9891-cd78e86905e6','7eb097ca-9864-45d6-af90-3bb0123d6a90',.30,(300,385),'대장간'),('training-ground','63957942-dfca-4537-a65f-281aaa80b061','44ed5a8f-6d3e-436f-a0c0-ca36856ed5af',.36,(225,405),'훈련소')]
allframes=[];manifest={}
for name,bgfile,npcfile,scale,foot,title in specs:
 D=O/name;D.mkdir(exist_ok=True);S=D/'sources';S.mkdir(exist_ok=True)
 shutil.copy2(G/f'exec-{bgfile}.png',S/'building.png');shutil.copy2(G/f'exec-{npcfile}.png',S/'npc-sheet.png')
 bg=Image.open(S/'building.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS);bg.save(D/'building.png')
 a=Image.open(S/'npc-sheet.png').convert('RGBA');ar=np.asarray(a)
 _,lab,stats,cents=cv2.connectedComponentsWithStats((ar[:,:,3]>128).astype('uint8'),8)
 components=[(tuple(s),tuple(c)) for s,c in zip(stats[1:],cents[1:]) if s[4]>10000]
 components=sorted(components,key=lambda z:z[1][1]);components=sorted(components[:3],key=lambda z:z[1][0])+sorted(components[3:],key=lambda z:z[1][0])
 assert len(components)==6,(name,len(components))
 frames=[]; masks=[]
 foreground=Image.new('L',(512,512));draw=ImageDraw.Draw(foreground)
 if name=='tavern':
  draw.polygon([(130,334),(304,358),(304,440),(110,440),(110,337)],fill=255)
  draw.polygon([(80,0),(512,0),(512,252),(80,252)],fill=255)
 elif name=='blacksmith':draw.polygon([(179,339),(232,324),(281,335),(280,346),(304,350),(300,361),(277,366),(275,412),(219,430),(197,420),(196,376),(184,363)],fill=255)
 fg=bg.copy();fg.putalpha(Image.fromarray((np.asarray(bg.getchannel('A')).astype(float)*np.asarray(foreground)/255).astype('uint8')));fg.save(D/'foreground.png')
 for i,(stat,cent) in enumerate(components):
  x,y,w,h,_=stat;pad=3;x0=max(0,x-pad);y0=max(0,y-pad);x1=min(a.width,x+w+pad);y1=min(a.height,y+h+pad)
  sprite=a.crop((x0,y0,x1,y1));sa=np.asarray(sprite)
  # Whole-sprite placement only: one shared scale, foot anchor; no pixel repaint or part masks.
  ys,xs=np.where(sa[:,:,3]>128);bot=ys.max();bx=xs[ys>bot-12];ax=float(np.median(bx)) if len(bx) else sprite.width/2
  sprite=sprite.resize((round(sprite.width*scale),round(sprite.height*scale)),Image.Resampling.LANCZOS)
  pos=(round(foot[0]-ax*scale),round(foot[1]-bot*scale))
  layer=Image.new('RGBA',(512,512));layer.alpha_composite(sprite,pos);layer.save(D/f'npc-{i+1:02d}.png')
  frame=bg.copy();frame.alpha_composite(layer);frame.alpha_composite(fg);frame.save(D/f'frame-{i+1:02d}.png');frames.append(frame);masks.append(np.asarray(layer.getchannel('A'))>0)
 sheet=Image.new('RGBA',(3072,512))
 for i,f in enumerate(frames):sheet.alpha_composite(f,(512*i,0))
 sheet.save(D/'spritesheet.png')
 duration=[240,150,180,120,160,200]
 preview=[]
 for f in frames:
  c=Image.new('RGBA',(512,512),'#e7edef');c.alpha_composite(f);preview.append(c.convert('RGB'))
 strip=Image.new('RGB',(3072,512))
 for i,f in enumerate(preview):strip.paste(f,(512*i,0))
 pal=strip.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in preview]
 q[0].save(D/'preview.gif',save_all=True,append_images=q[1:],duration=duration,loop=0,disposal=2,optimize=False)
 union=np.logical_or.reduce(masks);outside=~union
 assert all(np.array_equal(np.asarray(f)[outside],np.asarray(frames[0])[outside]) for f in frames)
 meta={'status':'review','frames':[f'frame-{i+1:02d}.png' for i in range(6)],'ms':duration,'canvas':[512,512],'fixedBackground':True,'npcWholeSpriteScale':scale,'foot':foot,'backgroundPixelCheck':True}
 (D/'animation.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8');manifest[name]=meta;allframes.append(preview)
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24);combo=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef');draw=ImageDraw.Draw(im)
 for k,s in enumerate(specs):im.paste(allframes[k][i].resize((400,400)),(k*400,45));draw.text((k*400+25,10),s[-1],font=font,fill='#27363c')
 combo.append(im)
strip=Image.new('RGB',(1200,2700))
for i,f in enumerate(combo):strip.paste(f,(0,i*450))
pal=strip.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in combo]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=duration,loop=0,disposal=2,optimize=False)
combo[0].save(O/'overview.png');(O/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('saved',O)

