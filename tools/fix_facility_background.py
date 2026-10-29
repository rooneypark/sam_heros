from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageFont
import numpy as np,cv2,json,warnings
R=Path.cwd(); SRC=R/'art/terrain/facility-animation-review'; O=R/'art/terrain/facility-animation-fixed'; O.mkdir(exist_ok=True)
NAMES=['tavern','blacksmith','training-ground']; titles=['주막 · 조리','대장간 · 망치질','훈련소 · 목인 타격']
def polygon(m,pts): ImageDraw.Draw(m).polygon(pts,fill=255)
def ellipse(m,box): ImageDraw.Draw(m).ellipse(box,fill=255)
def shape(name,i):
 m=Image.new('L',(512,512))
 if name=='training-ground':
  ellipse(m,(184,190,282,282));ellipse(m,(244,170,283,210))
  polygon(m,[(202,272),(256,272),(275,323),(271,337),(192,337),(179,318),(180,292)])
  arms=[[(186,288),(212,291),(230,303),(226,326),(195,324),(179,312)],[(180,259),(198,251),(213,274),(248,279),(248,311),(214,310),(188,296),(178,281)],[(152,230),(169,220),(187,224),(195,245),(188,265),(208,278),(229,282),(228,304),(197,300),(176,288),(162,267),(152,248)],[(179,280),(200,281),(225,294),(225,317),(193,317),(177,306)],[(183,264),(203,257),(218,280),(248,283),(250,312),(214,311),(190,297),(180,282)]]
  blades=[[(107,254),(122,259),(190,300),(183,315),(108,270)],[(125,177),(143,184),(197,259),(182,275)],[(182,225),(267,145),(285,140),(280,157),(198,237)],[(104,253),(121,255),(188,280),(182,300),(105,269)],[(123,181),(141,187),(198,269),(182,282)]]
  polygon(m,arms[min(i,4)]);polygon(m,blades[min(i,4)])
 elif name=='blacksmith':
  ellipse(m,(249,228,347,319));polygon(m,[(320,249),(352,250),(361,271),(348,286),(341,279)])
  polygon(m,[(254,305),(322,305),(341,317),(350,338),(342,354),(268,351),(242,336)])
  arms=[[(225,311),(244,308),(265,316),(264,335),(237,333),(222,324)],[(211,253),(221,245),(239,248),(249,263),(246,282),(269,291),(267,318),(243,310),(224,293),(215,274)],[(227,239),(239,225),(257,222),(274,232),(269,251),(254,265),(253,284),(269,303),(267,320),(244,310),(225,293),(224,269)],[(230,314),(250,311),(264,325),(259,342),(234,341)],[(228,308),(248,307),(264,321),(258,338),(233,334)]]
  weapons=[[(199,297),(217,292),(238,303),(230,320),(217,337),(199,332),(191,319)],[(232,251),(250,220),(248,211),(261,199),(279,208),(288,225),(277,238),(265,234),(246,267)],[(258,234),(288,221),(287,211),(301,201),(320,211),(329,230),(315,241),(302,232),(265,250)],[(206,302),(225,300),(239,306),(235,331),(227,344),(208,342),(202,331)],[(199,291),(218,289),(238,303),(231,322),(215,331),(198,321)]]
  polygon(m,arms[min(i,4)]);polygon(m,weapons[min(i,4)])
 else:
  # Only ladle/left hand: head, other arm, counter and cooking vessel stay original.
  hands=[[(181,276),(195,275),(218,289),(218,309),(203,310),(188,293)],[(182,279),(198,278),(219,289),(220,306),(203,308),(188,294)],[(173,280),(187,277),(202,283),(221,290),(220,309),(201,303),(190,291),(179,297)],[(173,269),(188,265),(205,276),(220,280),(220,300),(196,291),(182,281),(175,286)],[(177,267),(192,264),(205,275),(222,280),(224,300),(198,290),(184,282),(177,284)]]
  ladles=[[(148,246),(158,242),(173,252),(194,280),(208,298),(202,309),(193,304),(177,278),(155,269)],[(163,247),(172,241),(181,249),(193,279),(204,299),(201,309),(189,306),(181,285)],[(182,288),(199,295),(220,300),(220,312),(201,307),(180,298)],[(183,280),(201,288),(227,304),(222,313),(198,300),(180,288)],[(188,278),(208,290),(230,303),(224,312),(201,301),(184,287)]]
  polygon(m,hands[min(i,4)]);polygon(m,ladles[min(i,4)])
 return m
allframes=[]; qa={}
for name in NAMES:
 D=O/name;D.mkdir(exist_ok=True)
 raws=[np.asarray(Image.open(SRC/name/f'aligned-{i+1}.png').convert('RGB')) for i in range(5)]
 oldmask=np.asarray(Image.open(SRC/name/'work-area-mask.png'))>0
 masks=[]
 for i,raw in enumerate(raws):
  rough=np.array(shape(name,i)); outer=cv2.dilate(rough,np.ones((11,11),np.uint8));inner=cv2.erode(rough,np.ones((11,11),np.uint8))
  gc=np.zeros((512,512),np.uint8);gc[outer>0]=cv2.GC_PR_BGD;gc[rough>0]=cv2.GC_PR_FGD;gc[inner>0]=cv2.GC_FGD
  cv2.grabCut(raw,gc,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
  mask=np.where((gc==1)|(gc==3),255,0).astype('uint8')
  # Tight foreground masks replace the old broad work-area clipping.
  count, labels, stats, _=cv2.connectedComponentsWithStats(mask,8)
  for component in range(1,count):
   if stats[component,cv2.CC_STAT_AREA]<18: mask[labels==component]=0
  masks.append(mask)
  Image.fromarray(mask).save(D/f'foreground-mask-{i+1:02d}.png')
 # One clean plate; replace the old foreground only where it becomes exposed.
 stack=np.stack(raws).astype(float); forbidden=np.stack([cv2.dilate(m,np.ones((3,3),np.uint8))>0 for m in masks])
 stack[forbidden]=np.nan
 with warnings.catch_warnings():
  warnings.simplefilter('ignore'); clean=np.nanmedian(stack,axis=0)
 base=raws[0].copy(); removable=cv2.dilate(masks[0],np.ones((3,3),np.uint8))>0
 valid=np.isfinite(clean).all(axis=2)&removable
 base[valid]=np.clip(clean[valid],0,255).astype('uint8')
 baseim=Image.fromarray(base);baseim.save(D/'fixed-background.png')
 frames=[]
 for i in range(5):
  alpha=Image.fromarray(masks[i]).filter(ImageFilter.GaussianBlur(.35))
  im=Image.composite(Image.fromarray(raws[i]),baseim,alpha)
  frames.append(im)
 frames.append(frames[0].copy())
 for i,f in enumerate(frames): f.save(D/f'frame-{i+1:02d}.png')
 sheet=Image.new('RGB',(3072,512))
 for i,f in enumerate(frames):sheet.paste(f,(512*i,0))
 sheet.save(D/'spritesheet.png');pal=sheet.quantize(colors=256)
 q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
 q[0].save(D/'preview.gif',save_all=True,append_images=q[1:],duration=[240,160,160,120,160,200],loop=0,optimize=False,disposal=2)
 allframes.append(frames)
 review=Image.new('RGB',(1536,512),'#eeeeee')
 for i in range(5):
  f=Image.composite(Image.fromarray(raws[i]),Image.new('RGB',(512,512),'#eeeeee'),Image.fromarray(masks[i]));review.paste(f.resize((256,256)),(i*256,0))
  review.paste(frames[i].resize((256,256)),(i*256,256))
 review.save(D/'mask-review.png')
 qa[name]={'frames':6,'background':'one immutable clean plate','lastEqualsFirst':True}
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24); combined=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef');d=ImageDraw.Draw(im)
 for k in range(3):im.paste(allframes[k][i].resize((400,400),Image.Resampling.LANCZOS),(k*400,45));d.text((k*400+25,10),titles[k],font=font,fill='#27363c')
 combined.append(im)
contact=Image.new('RGB',(1200,2700))
for i,im in enumerate(combined):contact.paste(im,(0,i*450))
pal=contact.quantize(colors=256);q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in combined]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=[240,160,160,120,160,200],loop=0,optimize=False,disposal=2)
(O/'qa.json').write_text(json.dumps(qa,indent=2),encoding='utf-8')

