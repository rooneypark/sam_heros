from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cv2,json,shutil
R=Path.cwd();G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411');O=R/'art/terrain/integrated-scene-redraw';O.mkdir(exist_ok=True)
specs=[('tavern','0d058348-94a9-4aba-b5d0-55e8ddbb2b7d','주막'),('blacksmith','88f72066-aece-4f51-b309-2a663df4be3e','대장간'),('training-ground','349d7bb1-6eec-4292-9e55-16e27285c8b2','훈련소')];sets=[];qa={}
for n,src,title in specs:
 d=O/n;d.mkdir(exist_ok=True);shutil.copy2(G/f'exec-{src}.png',d/'source-sheet.png');sheet=Image.open(d/'source-sheet.png').convert('RGB')
 raw=[sheet.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512)) for i in range(6)]
 template=np.asarray(raw[0].crop((155,45,290,115)));frames=[];shifts=[]
 for i,f in enumerate(raw):
  result=cv2.matchTemplate(np.asarray(f),template,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(result);dx,dy=155-loc[0],45-loc[1]
  # Translation of WHOLE scene only; no masks, scaling, paint, or isolated parts.
  frame=Image.fromarray(cv2.warpAffine(np.asarray(f),np.float32([[1,0,dx],[0,1,dy]]),(512,512),flags=cv2.INTER_NEAREST,borderMode=cv2.BORDER_REPLICATE))
  frame.save(d/f'frame-{i+1:02d}.png');frames.append(frame);shifts.append([dx,dy])
 strip=Image.new('RGB',(3072,512))
 for i,f in enumerate(frames):strip.paste(f,(512*i,0))
 strip.save(d/'spritesheet.png');palette=strip.quantize(colors=256);q=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
 q[0].save(d/'preview.gif',save_all=True,append_images=q[1:],duration=[240,160,160,120,160,200],loop=0,disposal=2,optimize=False)
 roi=np.array(frames[0])[30:200,70:450].astype(float);diffs=[round(float(np.abs(np.array(f)[30:200,70:450].astype(float)-roi).mean()),2) for f in frames]
 qa[n]={'frames':6,'method':'complete-scene redraw; whole-scene integer registration only','translation':shifts,'roofMeanAbsoluteRgbDifference':diffs,'backgroundExactlyFixed':all(x==0 for x in diffs),'status':'review-not-final'};sets.append(frames)
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24);combo=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef');draw=ImageDraw.Draw(im)
 for k,s in enumerate(specs):im.paste(sets[k][i].resize((400,400)),(k*400,45));draw.text((k*400+25,10),s[-1],font=font,fill='#27363c')
 combo.append(im)
stack=Image.new('RGB',(1200,2700))
for i,im in enumerate(combo):stack.paste(im,(0,450*i))
pal=stack.quantize(colors=256);q=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in combo]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=[240,160,160,120,160,200],loop=0,disposal=2,optimize=False)
(O/'qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2),encoding='utf-8')
(O/'README.md').write_text('# 통합 장면 재제작 검토본\n\n사용자 요청: 건물+인물을 한 장면으로 다시 제작. 분리 제작·부분 보정 사용하지 않음. 내장 imagegen으로 승인 integrated-animation-concept-v2를 참조해 시설별 전체6장 생성. 포장 시 장면 전체 정수 위치 정렬과 공통 GIF 팔레트만 사용. 지붕 정지 영역 RGB 차이가 남아 배경 완전 고정 조건 미충족. 최종 승인 또는 맵 반영하지 않음. source-sheet.png 원본과 개별 PNG 및 GIF 보존.\n',encoding='utf-8')
print(json.dumps(qa,ensure_ascii=False))
