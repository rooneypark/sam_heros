from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import numpy as np, cv2, shutil, json
R=Path.cwd(); O=R/'art/terrain/facility-animation-review'; O.mkdir(parents=True,exist_ok=True)
G=Path('C:/Users/user/.codex/generated_images/01a1663a-63e5-7b42-adf1-562f75af5411')
specs=[('tavern','exec-72ca69ed-3cbf-4ae5-87c0-32c6ba4f641e.png',(218,228,281,293),[(140,241),(210,241),(220,282),(249,294),(288,301),(290,335),(220,335),(219,318),(145,314)],'주막 · 조리'),('blacksmith','exec-f7ad1a01-6d6e-443a-b89e-10a50a97827a.png',(254,260,315,307),[(185,199),(313,193),(321,255),(330,288),(347,319),(346,352),(267,355),(241,372),(171,366),(165,333),(202,298),(199,247)],'대장간 · 망치질'),('training-ground','exec-770e03fe-7f0d-40fc-912f-314d10eb7f22.png',(195,211,252,280),[(106,166),(171,140),(280,130),(284,198),(267,234),(269,289),(280,326),(205,335),(173,328),(159,297),(99,286)],'훈련소 · 목인 타격')]
allframes=[]; report={}
for name,src,patch,poly,title in specs:
 D=O/name; D.mkdir(exist_ok=True); shutil.copy2(G/src,D/'source-sheet.png')
 sheet=Image.open(G/src).convert('RGB'); frames=[sheet.crop((i%3*512,i//3*512,i%3*512+512,i//3*512+512)) for i in range(6)]; base=frames[0]
 m=Image.new('L',(512,512)); ImageDraw.Draw(m).polygon(poly,fill=255); m=m.filter(ImageFilter.GaussianBlur(1))
 template=np.asarray(base.crop(patch)); aligned=[]; shifts=[]
 for i,f in enumerate(frames):
  a=np.asarray(f); res=cv2.matchTemplate(a,template,cv2.TM_CCOEFF_NORMED); _,score,_,loc=cv2.minMaxLoc(res)
  dx,dy=patch[0]-loc[0],patch[1]-loc[1]; shifts.append([dx,dy,round(score,4)])
  shifted=Image.fromarray(cv2.warpAffine(a,np.float32([[1,0,dx],[0,1,dy]]),(512,512),borderMode=cv2.BORDER_REPLICATE))
  frame=Image.composite(shifted,base,m) if i not in (0,5) else base.copy()
  frame.save(D/f'frame-{i+1:02d}.png'); aligned.append(frame)
 # One palette across every frame: no frame-specific palette flicker
 contact=Image.new('RGB',(3072,512))
 for i,f in enumerate(aligned): contact.paste(f,(i*512,0))
 palette=contact.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
 indexed=[f.quantize(palette=palette,dither=Image.Dither.NONE) for f in aligned]
 indexed[0].save(D/'preview.gif',save_all=True,append_images=indexed[1:],duration=[240,160,160,120,160,200],loop=0,disposal=2,optimize=False)
 contact.save(D/'spritesheet.png'); m.save(D/'work-area-mask.png')
 frozen=np.asarray(m)==0
 report[name]={'frames':6,'canvas':[512,512],'durationMs':[240,160,160,120,160,200],'registrationTranslations':shifts,'outsideWorkAreaPixelsUnchanged':all(np.array_equal(np.asarray(f)[frozen],np.asarray(base)[frozen]) for f in aligned),'firstLastIdentical':np.array_equal(np.asarray(aligned[0]),np.asarray(aligned[-1]))}
 allframes.append(aligned)
font=ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf',24)
combined=[]
for i in range(6):
 im=Image.new('RGB',(1200,450),'#e7edef'); draw=ImageDraw.Draw(im)
 for k,s in enumerate(specs):
  im.paste(allframes[k][i].resize((400,400),Image.Resampling.LANCZOS),(400*k,45)); draw.text((400*k+25,10),s[-1],font=font,fill='#27363c')
 combined.append(im)
palbase=Image.new('RGB',(1200,450*6))
for i,f in enumerate(combined): palbase.paste(f,(0,450*i))
pal=palbase.quantize(colors=256,method=Image.Quantize.MEDIANCUT)
q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in combined]
q[0].save(O/'all-facilities.gif',save_all=True,append_images=q[1:],duration=[240,160,160,120,160,200],loop=0,disposal=2,optimize=False)
review=Image.new('RGB',(1536,768))
for k,frames in enumerate(allframes):
 for i,f in enumerate(frames): review.paste(f.resize((256,256)),(i*256,k*256))
review.save(O/'all-18-frames.png')
(O/'qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
(O/'README.md').write_text('# 시설 작업 애니메이션 검토본\n\n승인 시안 integrated-animation-concept-v2 기반. imagegen으로 시설별 6프레임 생성 후 얼굴 기준 정수 이동 정렬. 첫 프레임을 고정 바탕으로 두고 작업 마스크 안만 합성. 공통 GIF 팔레트. 512×512 불투명 배경 검토 PNG이며 게임용 투명 납품·맵 등록 전 단계. 마지막 프레임은 처음과 동일. 기존 지형/NPC 실행 자산은 변경하지 않음.\n\n주막: 국자 젓기. 대장간: 붉은 두건 대장장이 망치질. 훈련소: 은발 푸른 도복 교관 목인 타격.\n\nsource-sheet.png는 생성 원본, work-area-mask.png는 움직임 허용 영역. qa.json의 고정 픽셀 검사는 마스크 바깥만 보장하며 작업 영역 안 형태 일관성은 시각 검수 대상.\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
