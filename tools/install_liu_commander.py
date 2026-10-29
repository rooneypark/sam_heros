"""Install the user's requested commander redesign; preserve motion metadata."""
from pathlib import Path
import json,hashlib,shutil
from PIL import Image
import numpy as np
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';W=C/'sources/commander-motions';P=W/'prepared'
if (W/'run-full-redraw/source.png').exists():
    raise SystemExit('Superseded installer: preserve full-body Move redraw; use liu_run_full_redraw.py.')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
old=json.loads((W/'timing-source.json').read_text(encoding='utf8'))
now=next(u for u in json.loads((R/'content/samguk/units.json').read_text(encoding='utf8'))['units'] if u['id']=='SG_U0001')
assert old==now,'Registration, timing or skill metadata changed since preparation'
entries=[]
for state,files in now['art']['frames'].items():
    for path in files:
        dest=R/path;src=P/dest.parent.name/dest.name
        im=Image.open(src);assert im.mode=='RGBA' and im.size==(350,350)
        assert im.getchannel('A').getextrema()==(0,255)
        backup=C/'archive/before-commander'/dest.relative_to(C);assert backup.exists()
        shutil.copy2(src,dest)
        entries.append({'path':path,'before':sha(backup),'after':sha(dest),'state':state})
for folder,name,srcname in [('original','original.png','original.png'),('portrait','portrait.png','portrait.png')]:
    dest=C/folder/name;shutil.copy2(P/srcname,dest)
    entries.append({'path':dest.relative_to(R).as_posix(),'before':sha(C/'archive/before-commander'/folder/name),'after':sha(dest)})
for state in ['basic-attack','skill-1','skill-2']:
    assert sha(C/state/'frame-08.png')==sha(C/'idle/frame-01.png')
assert sha(C/'gather/frame-09.png')==sha(C/'gather/frame-01.png')
for i in range(1,7):
    name=f'frame-{i:02}.png'
    assert np.array_equal(np.array(Image.open(C/'run'/name))[230:],np.array(Image.open(C/'archive/before-commander/run'/name))[230:]),name
for i in range(2,5):
    assert np.array_equal(np.array(Image.open(C/'idle'/f'frame-{i:02}.png'))[224:],np.array(Image.open(C/'idle/frame-01.png'))[224:])
manifest={'status':'review-installed','basis':'commander-concept/concept.png; prior poses and timing-source.json',
          'timingAndRegistrationUnchanged':True,'frames':44,'assets':entries,
          'notes':['Imagegen costume redraw; fixed per-source-sheet resolution calibration, integer alignment; no per-frame bbox scaling.',
                   'Move uses approved prior lower body and new upper body, preserving exact leg alternation.',
                   'Breathing derives from one ready drawing with fixed lower body; subtle upper rise/fall.',
                   'Pose choreography retained; generated line/weapon/hand contours are redrawn, not pixel-identical to old art.']}
(W/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
cm=json.loads((R/'characters/manifest.json').read_text(encoding='utf8'))
for e in entries:
    if e['path'] in cm['sha256']:cm['sha256'][e['path']]=e['after']
cm['commanderReview']='characters/liu-bei/sources/commander-motions/manifest.json'
(R/'characters/manifest.json').write_text(json.dumps(cm,ensure_ascii=False,indent=2),encoding='utf8')
print('Installed 44 frames + original + portrait; timing/registration unchanged; return frames exact')
