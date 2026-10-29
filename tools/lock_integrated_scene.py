from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageFont
import numpy as np,cv2,warnings,json
O=Path('art/terrain/locked-scene-animation');names=['tavern','blacksmith','training-ground'];titles=['주막 · 조리','대장간 · 망치질','훈련소 · 목인 타격']
# Masks follow hands, sleeves and tools, not a rectangular background patch.
polys={
'blacksmith':[
[[(194,310),(204,306),(216,307),(223,314),(221,343),(215,348),(198,346),(192,339)],[(219,320),(233,312),(242,303),(251,308),(256,326),(239,332),(221,332)]],
[[(206,278),(216,266),(231,269),(244,280),(232,307),(222,312),(207,307),(202,299)],[(218,305),(231,300),(239,311),(250,311),(258,326),(252,335),(237,334),(224,327)]],
[[(231,222),(242,216),(253,217),(264,229),(260,242),(251,250),(239,246),(228,235)],[(239,244),(247,248),(234,280),(224,277)],[(216,268),(228,264),(239,273),(237,286),(233,299),(241,301),(250,303),(258,320),(252,331),(239,326),(226,316),(217,301),(211,294),(211,280)]],
[[(194,310),(204,306),(217,308),(224,316),(223,344),(216,349),(199,347),(193,339)],[(220,318),(232,311),(242,304),(252,310),(258,328),(239,333),(222,331)]],
[[(204,269),(216,256),(231,259),(242,271),(232,298),(221,303),(206,299),(201,290)],[(219,296),(231,292),(239,304),(251,308),(258,326),(252,334),(237,330),(223,317)]]],
 'training-ground':[
 [[(109,284),(121,286),(177,329),(171,343),(109,300)],[(173,319),(185,320),(189,333),(216,336),(230,331),(244,341),(239,354),(220,359),(196,356),(177,350),(166,342)]],
 [[(110,250),(120,250),(177,310),(169,325),(110,265)],[(167,305),(181,300),(190,313),(187,324),(209,323),(229,329),(239,343),(231,351),(208,351),(189,348),(173,335),(163,319)]],
 [[(110,226),(122,228),(173,288),(165,302),(111,240)],[(169,282),(179,280),(188,293),(182,302),(192,309),(190,320),(211,319),(229,324),(236,340),(225,349),(203,346),(188,337),(173,326),(163,315),(160,301)]],
 [[(112,279),(124,280),(179,326),(169,340),(110,295)],[(170,315),(181,311),(191,324),(188,334),(214,333),(230,338),(238,350),(224,358),(200,354),(182,347),(168,336)]],
 [[(110,292),(121,291),(179,327),(173,340),(111,305)],[(172,317),(183,316),(191,329),(187,338),(214,336),(231,341),(239,354),(225,360),(202,357),(182,351),(168,339)]]],
 'tavern':[
 [[(181,313),(190,310),(199,312),(215,293),(215,285),(224,284),(234,294),(232,305),(226,310),(218,306),(204,321),(194,327),(181,325)],[(227,302),(236,306),(252,316),(257,327),(248,332),(237,320),(223,314)]],
 [[(185,314),(190,310),(197,310),(215,288),(215,280),(226,276),(237,283),(236,294),(228,301),(219,295),(203,320),(195,327),(185,325)],[(232,294),(243,299),(254,310),(260,322),(251,328),(239,313),(226,304)]],
 [[(177,317),(187,312),(198,313),(215,292),(214,285),(224,283),(235,291),(233,303),(225,308),(219,302),(203,322),(193,327),(177,326)],[(230,301),(243,306),(256,318),(256,330),(247,331),(237,316),(223,310)]],
 [[(181,317),(192,313),(206,313),(223,306),(233,308),(236,317),(228,323),(219,320),(203,323),(192,328),(180,325)],[(229,310),(241,315),(253,321),(256,332),(244,333),(235,325),(222,320)]],
 [[(187,316),(198,312),(213,298),(213,290),(224,286),(235,292),(233,304),(225,310),(219,305),(205,322),(194,327),(186,324)],[(231,302),(244,308),(255,320),(256,331),(246,332),(237,318),(224,311)]]]
}
allframes=[];qareport={}
for name in names:
 D=O/name;raws=[np.asarray(Image.open(D/f'input-{i+1:02d}.png').convert('RGB')) for i in range(5)];masks=[]
 for i,raw in enumerate(raws):
  m=Image.new('L',(512,512));d=ImageDraw.Draw(m)
  for poly in polys[name][i]:d.polygon(poly,fill=255)
  action=np.array(m).copy()
  if name=='training-ground':
   d.ellipse((158,224,267,316),fill=255);d.ellipse((231,200,273,246),fill=255)
   d.polygon([(177,302),(245,301),(261,314),(263,349),(274,368),(260,380),(262,398),(280,409),(274,418),(245,421),(229,411),(218,384),(193,384),(184,407),(179,418),(155,419),(149,410),(159,395),(163,375),(171,358),(164,334)],fill=255)
  elif name=='blacksmith':
   d.ellipse((242,215,335,318),fill=255);d.polygon([(325,247),(345,247),(354,259),(346,269),(352,283),(337,285),(327,272)],fill=255)
   d.polygon([(244,299),(315,296),(332,306),(340,324),(340,342),(328,353),(293,349),(271,345),(249,328),(236,316)],fill=255)
  elif name=='tavern':
   d.ellipse((218,263,295,324),fill=255);d.ellipse((217,239,304,294),fill=255);d.ellipse((249,222,310,271),fill=255)
   d.polygon([(286,244),(310,247),(322,273),(307,285),(295,274)],fill=255)
   d.polygon([(234,309),(278,309),(298,320),(303,340),(310,355),(294,365),(267,360),(244,346),(232,335),(219,319)],fill=255)
  rough=np.array(m);outer=cv2.dilate(rough,np.ones((5,5),np.uint8));inner=np.maximum(cv2.erode(rough,np.ones((13,13),np.uint8)),cv2.erode(action,np.ones((3,3),np.uint8)))
  gc=np.zeros((512,512),np.uint8);gc[outer>0]=2;gc[rough>0]=3;gc[inner>0]=1
  cv2.grabCut(raw,gc,None,np.zeros((1,65),np.float64),np.zeros((1,65),np.float64),4,cv2.GC_INIT_WITH_MASK)
  mask=np.where((gc==1)|(gc==3),255,0).astype('uint8');mask[cv2.dilate(action,np.ones((21,21),np.uint8))==0]=0;masks.append(mask);Image.fromarray(mask).save(D/f'motion-mask-{i+1:02d}.png')
 # Build a single immutable scene, using visible background observations under the original tools.
 observations=np.stack(raws).astype(float);hidden=np.stack([cv2.dilate(m,np.ones((5,5),np.uint8))>0 for m in masks]);observations[hidden]=np.nan
 with warnings.catch_warnings():warnings.simplefilter('ignore');visible=np.nanmedian(observations,axis=0)
 base=raws[0].copy();erase=cv2.dilate(masks[0],np.ones((3,3),np.uint8))>0;valid=erase&np.isfinite(visible).all(axis=2);base[valid]=visible[valid].astype('uint8');base=Image.fromarray(base);base.save(D/'locked-scene.png')
 frames=[];alphas=[]
 for i in range(5):
  alpha=Image.fromarray(masks[i]).filter(ImageFilter.GaussianBlur(.3));frame=Image.composite(Image.fromarray(raws[i]),base,alpha);frames.append(frame);alphas.append(np.array(alpha)>0)
 frames.append(frames[0].copy());duration=[240,160,160,120,160,200]
 for i,f in enumerate(frames):f.save(D/f'frame-{i+1:02d}.png')
 sheet=Image.new('RGB',(3072,512))
 for i,f in enumerate(frames):sheet.paste(f,(512*i,0))
 sheet.save(D/'spritesheet.png');pal=sheet.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
 q[0].save(D/'preview.gif',save_all=True,append_images=q[1:],duration=duration,loop=0,optimize=False,disposal=2)
 static=~np.logical_or.reduce(alphas);diff=[int(np.count_nonzero(np.any(np.asarray(f)!=np.asarray(frames[0]),axis=2)&static)) for f in frames]
 qareport[name]={'frames':6,'unchangedPixelsOutsideMotionSilhouettes':bool(not any(diff)),'changedStaticPixelsPerFrame':diff,'firstLastEqual':np.array_equal(np.array(frames[0]),np.array(frames[-1])),'method':'original integrated scene locked; in-scene NPC and tool silhouette masks'}
 review=Image.new('RGB',(1536,512),'#eeeeee')
 for i in range(5):
  isolated=Image.composite(Image.fromarray(raws[i]),Image.new('RGB',(512,512),'#eeeeee'),Image.fromarray(masks[i]));review.paste(isolated.resize((256,256)),(i*256,0));review.paste(frames[i].resize((256,256)),(i*256,256))
 review.save(D/'boundary-review.png');allframes.append(frames)
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24);combined=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef');d=ImageDraw.Draw(im)
 for k in range(3):im.paste(allframes[k][i].resize((400,400),Image.Resampling.LANCZOS),(k*400,45));d.text((k*400+25,10),titles[k],font=font,fill='#27363c')
 combined.append(im)
stack=Image.new('RGB',(1200,2700))
for i,f in enumerate(combined):stack.paste(f,(0,450*i))
pal=stack.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in combined]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=duration,loop=0,optimize=False,disposal=2)
(O/'qa.json').write_text(json.dumps(qareport,ensure_ascii=False,indent=2),encoding='utf-8');print(qareport)
