"""Package whole painted sprites, using one delivery scale per source sheet, no rigging/morphing."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from scipy import ndimage
import numpy as np,json,shutil,hashlib
R=Path(__file__).resolve().parents[2];G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411')
SPECS=[
 ('yellow-turban-spearman','황건 창병','SG_M0005','96d3d803-417d-4947-8d0b-0724ef191f2a','b0d4b581-20a1-42a1-8766-71fcd6494b2b','cc2447fc-dc96-4a3a-8073-5f726aefbc2b'),
 ('yellow-turban-archer','황건 궁병','SG_M0006','260315a6-bc39-44b6-bb47-c3ff53afdab8','bf591c70-4a1f-4e38-9c40-5b54bdee7737','332dc5a7-e0ba-4644-b5ff-81bf888fea37'),
 ('village-blacksmith','대장장이','SG_N0004','2f94ece6-9fdc-4022-aeb8-f0f8fa7dd559','bc3c9a6b-8423-40a3-8a44-0a73ca6c10af',None),
 ('village-hostess','주모','SG_N0005','9af41d60-d9c2-4742-b1e8-2e9a7b673593','5ffa8a40-b01d-474e-8f18-9d45b01a3df1',None)]
def face(im):
 a=np.array(im);m=(a[:,:,0]>180)&(a[:,:,1]>90)&(a[:,:,1]<210)&(a[:,:,2]>65)&(a[:,:,2]<200)&(a[:,:,3]>220)
 lab,n=ndimage.label(m);sizes=np.bincount(lab.ravel());sizes[0]=0
 yy,xx=np.where(lab==sizes.argmax());return (xx.min(),yy.min(),xx.max()+1,yy.max()+1)
def gif(frames,path,ms):
 bg=[]
 for f in frames:
  im=Image.new('RGBA',(350,350),'#e5edef');im.alpha_composite(f);bg.append(im.convert('RGB'))
 atlas=Image.new('RGB',(350*len(bg),350))
 for i,f in enumerate(bg):atlas.paste(f,(350*i,0))
 pal=atlas.quantize(colors=256)
 frames=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in bg]
 frames[0].save(path,save_all=True,append_images=frames[1:],duration=ms,loop=0,disposal=2,optimize=False)
units=json.loads((R/'content/samguk/units.json').read_text(encoding='utf8'))
units['units']=[u for u in units['units'] if u['id'] not in [s[2] for s in SPECS]]
gallery=[];manifest={}
for slug,name,uid,idle,run,atk in SPECS:
 root=R/'chapter-1'/slug;(root/'sources').mkdir(parents=True,exist_ok=True)
 framesBy={};meta={};targetFace=None
 for state,source,cols,rows in [('idle',idle,4,1),('run',run,3,2)]+([('basic-attack',atk,4,2)] if atk else []):
  sourcefile=root/'sources'/(state+'.png')
  if not sourcefile.exists():shutil.copy2(G/('exec-'+source+'.png'),sourcefile)
  sheet=Image.open(sourcefile).convert('RGBA');cw=sheet.width/cols;ch=sheet.height/rows
  cells=[sheet.crop((round(i%cols*cw),round(i//cols*ch),round((i%cols+1)*cw),round((i//cols+1)*ch))) for i in range(cols*rows)]
  faces=[face(im) for im in cells]
  if targetFace is None:
   box=cells[0].getchannel('A').point(lambda a:255 if a>20 else 0).getbbox();scale=123/(box[3]-box[1]);targetFace=np.median([b[2]-b[0] for b in faces])*scale
  else:scale=float(targetFace/np.median([b[2]-b[0] for b in faces]))
  out=[];offsets=[]
  for i,(im,fb) in enumerate(zip(cells,faces)):
   a=np.array(im);ys,xs=np.where(a[:,:,3]>100);bottom=int(ys.max())
   # Face-centre anchor stays slightly forward of body root; source exports have different resolutions.
   cx=(fb[0]+fb[2])/2;dx=round(162-cx*scale);dy=round(245-bottom*scale)
   resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
   canvas=Image.new('RGBA',(350,350));canvas.alpha_composite(resized,(dx,dy));out.append(canvas);offsets.append([dx,dy])
  if state=='idle':out[3]=out[1].copy()
  if state=='basic-attack':out[0]=framesBy['idle'][0].copy();out[6]=framesBy['idle'][0].copy();out[7]=framesBy['idle'][0].copy()
  folder=root/state;folder.mkdir(exist_ok=True)
  for i,im in enumerate(out):im.save(folder/f'frame-{i+1:02}.png')
  strip=Image.new('RGBA',(350*len(out),350))
  for i,im in enumerate(out):strip.alpha_composite(im,(350*i,0))
  strip.save(folder/'spritesheet.png')
  ms=[300]*4 if state=='idle' else [100]*6 if state=='run' else [180,110,100,90,100,120,160,300]
  gif(out,folder/'preview.gif',ms);gif(out,folder/'preview-slow.gif',[x*2 for x in ms])
  info={'size':[350,350],'pivot':[.5,.3],'root':[175,245],'facing':'left','ms':ms,'sourceScale':scale,'translations':offsets,'status':'review'}
  (folder/'animation.json').write_text(json.dumps(info,indent=2),encoding='utf8');framesBy[state]=out;meta[state]=info
 (root/'original').mkdir(exist_ok=True);framesBy['idle'][0].save(root/'original/original.png')
 art={'icon':f'chapter-1/{slug}/original/original.png','portrait':f'chapter-1/{slug}/original/original.png','static':f'chapter-1/{slug}/original/original.png','ppu':100,'pivot':[.5,.3],'facing':'left','frames':{}}
 motion={}
 for folder,state in [('idle','Idle'),('run','Move'),('basic-attack','Attack')]:
  if folder not in framesBy:continue
  n=len(framesBy[folder]);art['frames'][state]=[f'chapter-1/{slug}/{folder}/frame-{i+1:02}.png' for i in range(n)]
  motion[state]={'sequence':list(range(1,n+1)),'ms':meta[folder]['ms'],'loop':state!='Attack','hits':[480] if state=='Attack' else []}
 u={'id':uid,'name':name,'faction':'군' if atk else '주민','base':'Unit000146' if atk else 'Unit000001','grade':'','gradeType':'NORMAL','art':art,'motion':motion,'motionTimingBasis':'authored','skills':{},'levels':[{'level':1,'defaultSkill':'','skillA':'','skillB':'','gatheringSkill':''}],'memo':'2026-10-28 신규 검토본. 승인 전. 기본/숨쉬기4/이동6'+('/공격8' if atk else '')}
 if atk:
  archer='archer' in slug
  action={'base':'SkillAction102000' if archer else 'SkillAction100000','patch':{'hitEffect':'','startEffect':''}}
  u['skills']={'defaultSkill':{'base':'Skill100000','state':'Attack','actions':[action],'patch':{'skillDistance':5.5 if archer else 2.0,'skillDelay':0,'skillCoolTime':0,'startEffect':'','castEffect':'','condition':''}}}
  u['levels'][0]['defaultSkill']=uid+'_defaultSkill'
  if archer:u['projectileArt']={'sprite':'chapter-1/yellow-turban-archer/projectile/arrow.png','pivot':[.5,.5],'ppu':100,'facing':'left'}
 units['units'].append(u);gallery.append((slug,name,list(framesBy)))
 manifest[uid]={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('frame-*.png')}
 (root/'README.md').write_text(f'# {name}\n\n2026-10-28 신규 검토본, 사용자 승인 전. 350×350 RGBA, 왼쪽, pivot(0.5,0.3).\n원본은 original, 숨쉬기4는 idle, 이동6은 run'+('、공격8은 basic-attack' if atk else '')+'. 각 폴더 GIF/개별프레임/시트/시간메타데이터 참조. sources는 내장 image_gen 제작 원본. 원작 애니메이션 분석값으로 주장하지 않는다.\n',encoding='utf8')
arrow_source=R/'chapter-1/yellow-turban-archer/sources/arrow.png'
if not arrow_source.exists():shutil.copy2(G/'exec-e7c5a835-42a4-4b4c-962e-63cf051e4cad.png',arrow_source)
arrow=Image.open(arrow_source).convert('RGBA');arrow=arrow.crop(arrow.getbbox());arrow=arrow.resize((65,round(arrow.height*65/arrow.width)),Image.Resampling.LANCZOS)
out=R/'chapter-1/yellow-turban-archer/projectile';out.mkdir(exist_ok=True);arrow.save(out/'arrow.png')
(R/'content/samguk/units.json').write_text(json.dumps(units,ensure_ascii=False,indent=2),encoding='utf8')
review=R/'chapter-1/expansion-review';review.mkdir(exist_ok=True)
(review/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
html='<meta charset="utf-8"><title>황건소탕 신규 병종·주민</title><style>body{background:#17232c;color:#eee;font:16px system-ui;margin:24px}.row{display:flex;flex-wrap:wrap}figure{margin:8px;background:#e5edef;color:#123;border-radius:12px}img{width:280px}h2{margin-top:35px}figcaption{padding:10px;text-align:center}</style><h1>황건소탕 신규 병종 · 주민</h1><p>검토본 · 350×350 · 숨쉬기4 / 이동6 / 공격8 · 마지막→처음 반복</p>'
for slug,name,folders in gallery:
 html+=f'<h2>{name}</h2><div class="row"><figure><img src="../{slug}/original/original.png"><figcaption>원본</figcaption></figure>'
 for f in folders:html+=f'<figure><img src="../{slug}/{f}/preview.gif"><figcaption>{f} · <a href="../{slug}/{f}/preview-slow.gif">느리게</a></figcaption></figure>'
 html+='</div>'
(review/'index.html').write_text(html,encoding='utf8')
print('Packaged 4 characters, 56 animation frames; registered units and review gallery')
