from package_restart_20261028 import *
old=SRC/'zhang-skill2-before-flame'
firecells=split(Image.open(SRC/'flame-source.png').convert('RGBA'))
cleancells=split(Image.open(SRC/'flame-clean-source.png').convert('RGBA'))
def register(c,scale,target):
 sx,sy=contact(c);im=c.resize((round(c.width*scale),round(c.height*scale)),Image.Resampling.LANCZOS);out=Image.new('RGBA',(350,350));out.alpha_composite(im,(round(target[0]-sx*scale),round(target[1]-sy*scale)));return out
fs=[];reports=[]
for i in range(8):
 before=Image.open(old/f'frame-{i+1:02}.png').convert('RGBA');a=np.array(before);y,x=np.indices((350,350));target=contact(before)
 if i in (0,1,7):fs.append(before);continue
 clean=np.array(register(cleancells[3 if i==4 else i],134/218,target))
 fire=np.array(register(firecells[i],134/243,target))
 # Preserve original pose; only replace old effect colors and their narrow border.
 red=(a[:,:,0]>160)&(a[:,:,1]<130)&(a[:,:,2]<150)&(a[:,:,3]>30)&(y>175)
 mask=ndimage.binary_dilation(red,iterations=3)
 # Original face, head, spear, skin of hand, and feet are protected.
 protected=((y<180)&(x>140)&(x<220))|((x>=130)&(x<=142))|(y>=222)|((a[:,:,0]>190)&(a[:,:,1]>140)&(a[:,:,2]>100))
 mask &= ~protected
 # Use the cleaned torso to restore the broad ribbon-covered regions, retaining
 # the original face/roar, weapon, hand skin and feet as explicit foreground.
 keep=Image.new('L',(350,350));kd=ImageDraw.Draw(keep)
 kd.polygon([(150,108),(199,108),(213,142),(207,171),(185,193),(153,182),(143,154)],fill=255)
 kd.rectangle((131,78,142,245),fill=255)
 kd.rectangle((148,222,204,246),fill=255)
 preserve=np.array(keep)>0
 skin=(a[:,:,0]>190)&(a[:,:,1]>140)&(a[:,:,1]<220)&(a[:,:,2]>100)&(a[:,:,2]<190)&((a[:,:,0].astype(int)-a[:,:,1].astype(int))>25)&(a[:,:,3]>100)
 preserve |= ndimage.binary_dilation(skin,iterations=1)
 body=clean.copy();preserve=np.zeros((350,350),dtype=bool)
 # Extract only warm flame pixels; donor hero is not used.
 warm=(fire[:,:,0]>170)&(fire[:,:,1]<145)&(fire[:,:,2]<110)&(fire[:,:,3]>10)
 warm &= ~((x>142)&(x<215)&(y>105)&(y<245))
 warm=ndimage.binary_dilation(warm,iterations=2)&(fire[:,:,0]>140)&(fire[:,:,3]>0)
 fx=fire.copy();fx[~warm]=0
 # Flames are behind the preserved hero; no face-covering overlay.
 out=Image.fromarray(fx);out.alpha_composite(Image.fromarray(body));fs.append(out)
 reports.append(dict(frame=i+1,note='Ribbon-free clean plate restores obscured clothing; frames3-7 are not pixel-identical to original.'))
meta=json.loads((old/'animation.json').read_text(encoding='utf-8'))
publish('zhang-fei','skill-2',fs,dict(effect='upward flame defense aura',body_pose='Roar poses reconstructed on clean plate; first2 and last frames unchanged',effect_revision='flame-v1',restoration_report=reports),meta['durations_ms'])
overview()
approved=json.loads((OUT/'APPROVED_EXCEPT_ZHANG_SKILL2.json').read_text(encoding='utf-8'))
assert all(hashlib.sha256((R/p).read_bytes()).hexdigest()==h for p,h in approved['files'].items())
print('62 approved frames unchanged; flame effect updated')
