raise SystemExit('Superseded by approved single-sword design; use build_liu_single_sword.py')
"""Export six whole-drawing frames; never splice torso/legs."""
from pathlib import Path
import json, shutil, hashlib
import numpy as np
from PIL import Image, ImageDraw
from export_liu_commander import face
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';W=C/'sources/commander-motions'
D=W/'run-clean-redraw';D.mkdir(exist_ok=True)
source=D/'source.png'
assert source.exists(), 'Use the approved repository source, not a machine-local generated image'
sheet=Image.open(D/'source.png').convert('RGBA');cw=sheet.width//3;ch=sheet.height//2
cells=[sheet.crop((i%3*cw,i//3*ch,(i%3+1)*cw,(i//3+1)*ch)) for i in range(6)]
ref=Image.open(C/'original/original.png').convert('RGBA');target=face(ref)
scale=target[2]/face(cells[0])[2]
frames=[];records=[]
for i,im in enumerate(cells):
    anchor=face(im);scaled=im.resize((round(cw*scale),round(ch*scale)),Image.Resampling.LANCZOS)
    bob=[0,-1,-2,0,-1,-2][i]
    offset=(round(target[0]-anchor[0]*scale),round(target[1]+bob-anchor[1]*scale))
    out=Image.new('RGBA',(350,350));out.alpha_composite(scaled,offset)
    out.save(C/'run'/f'frame-{i+1:02}.png');out.save(W/'prepared/run'/f'frame-{i+1:02}.png')
    frames.append(out);records.append({'frame':i+1,'scale':scale,'offset':offset})
overview=Image.new('RGBA',(1050,700),'#e5edef')
for i,im in enumerate(frames):overview.alpha_composite(im,(i%3*350,i//3*350))
overview.save(D/'overview.png')
(D/'alignment.json').write_text(json.dumps(records,indent=2))
(D/'README.md').write_text('全身再作画 / 이동 6프레임 검토본\n\nBuilt-in imagegen. References: current original and Move-poses.png. Prompt: preserve six old poses and twin swords, redraw whole figures in orange/plum commander costume with complete closed hem, transparent background. No torso/leg splicing or local outline patches. One scale for all six cells; integer translation aligns face and small bob. 350x350; existing 100ms timing. Prior spliced run retained in archive/commander-run-spliced. New result requires user review.\n',encoding='utf8')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((W/'manifest.json').read_text(encoding='utf8'))
for e in m['assets']:
    if e.get('state')=='Move':e['after']=sha(R/e['path'])
m['notes']=[n for n in m['notes'] if not n.startswith('Move uses')]
m['notes'].append('Move review: six full-body imagegen redraws; no torso-leg splice. sources/commander-motions/run-clean-redraw.')
m['stateApprovals']={'Move':'review-clean-redraw'}
(W/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
cm=json.loads((R/'characters/manifest.json').read_text(encoding='utf8'))
for e in m['assets']:
    if e['path'] in cm['sha256']:cm['sha256'][e['path']]=e['after']
(R/'characters/manifest.json').write_text(json.dumps(cm,ensure_ascii=False,indent=2),encoding='utf8')
print('Six whole-body redraws installed, one common scale; other motions untouched')
