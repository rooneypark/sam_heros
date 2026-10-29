"""Validate colour-only motion invariants and publish current review checksums."""
from pathlib import Path
import json,hashlib,argparse
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[1]
read=lambda p:json.loads((R/p).read_text(encoding='utf8'))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report=read('art/style-review/hero-palette/manifest.json')
parser=argparse.ArgumentParser();parser.add_argument('--record',action='store_true');args=parser.parse_args()
assert report['status']=='applied-review'
changed=set()
for a in report['assets']:
    before=R/a['backup'];after=R/a['path']
    assert sha(before)==a['beforeSha256'],a['backup']
    assert sha(after)==a['afterSha256'],a['path']
    b=Image.open(before).convert('RGBA');n=Image.open(after).convert('RGBA')
    assert b.size==n.size,a['path']
    if not a['redrawn']:
        assert np.array_equal(np.array(b.getchannel('A')),np.array(n.getchannel('A'))),a['path']
    changed.add(a['path'])
old_manifest=R/'characters/archive/before-hero-palette-manifest.json'
current=read('characters/manifest.json')
if not old_manifest.exists():
    old_manifest.parent.mkdir(parents=True,exist_ok=True)
    old_manifest.write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf8')
original=json.loads(old_manifest.read_text(encoding='utf8'))
for p,h in original['sha256'].items():
    if Path(p).parts[1] in {'liu-bei','guan-yu','zhang-fei','zhao-yun'}:
        redesign=R/'characters/liu-bei/sources/commander-motions/manifest.json'
        if Path(p).parts[1]=='liu-bei' and redesign.exists():
            replacements={a['path']:a for a in json.loads(redesign.read_text(encoding='utf8'))['assets']}
            assert replacements[p]['before']==h,p
            assert sha(R/p)==replacements[p]['after'],p
        else:assert sha(R/p)==h,p
if args.record:
    current['purpose']='Current active PNG checksums; NPC/monster RGB palette review applied, motion geometry preserved'
    current['priorManifest']='characters/archive/before-hero-palette-manifest.json'
    current['paletteReview']='art/style-review/hero-palette/manifest.json'
    for p in current['sha256']:
        if p in changed:current['sha256'][p]=sha(R/p)
    (R/'characters/manifest.json').write_text(json.dumps(current,ensure_ascii=False,indent=2),encoding='utf8')
    imported=read('import-manifest.json');over=imported.setdefault('local_overrides',{})
    for u in read('content/samguk/units.json')['units']:
        for frames in u['art']['frames'].values():
            folder=Path(frames[0]).parent
            for name in ['spritesheet.png','preview.gif','preview-slow.gif','animation.json','frames-overview.png']:
                changed.add((folder/name).as_posix())
    changed.update({'AGENTS.md','docs/DESIGN_GUIDE.md','characters/liu-bei/README.md','docs/motion-guide/CURRENT_CHARACTER_RULES.md'})
    redesign=R/'characters/liu-bei/sources/commander-motions/manifest.json'
    if redesign.exists():changed.update(a['path'] for a in json.loads(redesign.read_text(encoding='utf8'))['assets'])
    for p in imported['sha256']:
        if p in changed and (R/p).exists():over[p]=sha(R/p)
    imported['paletteReview']='art/style-review/hero-palette/manifest.json; review, not user approval'
    (R/'import-manifest.json').write_text(json.dumps(imported,ensure_ascii=False,indent=2),encoding='utf8')
print('PASS',len(report['assets']),'palette assets; alpha/dimensions exact; hero baseline or declared redesign checksums verified')
