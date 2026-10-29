from pathlib import Path
import json,shutil
from PIL import Image
R=Path(__file__).resolve().parents[1]; C=R/'characters/liu-bei'; W=C/'sources/commander-motions';W.mkdir(parents=True,exist_ok=True)
u=json.loads((R/'content/samguk/units.json').read_text(encoding='utf8'))['units'][0]
(W/'timing-source.json').write_text(json.dumps(u,ensure_ascii=False,indent=2),encoding='utf8')
for folder in ['original','idle','run','basic-attack','skill-1','skill-2','gather','die','portrait']:
    dst=C/'archive/before-commander'/folder
    if not dst.exists():shutil.copytree(C/folder,dst)
layout={}
for state,paths in u['art']['frames'].items():
    n=len(paths);cols=3 if n in (6,9) else 2 if n==4 else 4 if n==8 else 1;rows=(n+cols-1)//cols
    sheet=Image.new('RGBA',(350*cols,350*rows))
    for i,p in enumerate(paths):sheet.alpha_composite(Image.open(R/p).convert('RGBA'),((i%cols)*350,(i//cols)*350))
    sheet.save(W/(state+'-poses.png'));layout[state]={'cols':cols,'rows':rows,'count':n,'paths':paths}
(W/'layout.json').write_text(json.dumps(layout,indent=2),encoding='utf8')
im=Image.open(C/'sources/commander-concept/concept.png').convert('RGBA');bb=im.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox();im=im.crop(bb)
im=im.resize((round(im.width*135/im.height),135),Image.Resampling.LANCZOS);canvas=Image.new('RGBA',(350,350));canvas.alpha_composite(im,(175-im.width//2,245-im.height));canvas.save(W/'original.png')
print('Prepared reference sheets, immutable backups and 350px new original')
