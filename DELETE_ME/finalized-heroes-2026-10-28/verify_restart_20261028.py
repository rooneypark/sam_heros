from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,numpy as np
R=Path(__file__).resolve().parents[2];O=R/'motion-restart-2026-10-28'
reports=[]
for p in O.glob('*/*/animation.json'):
 m=json.loads(p.read_text());fs=[Image.open(p.parent/f).convert('RGBA') for f in m['frames']]
 assert len(fs)==m['frame_count'] and all(f.size==(350,350) for f in fs)
 gif=Image.open(p.parent/'preview.gif');duration=0
 for i in range(gif.n_frames):gif.seek(i);duration+=gif.info.get('duration',0)
 assert duration==sum(m['durations_ms']),(p,duration,m['durations_ms'])
 reports.append({'motion':p.parent.relative_to(O).as_posix(),'frames':len(fs),'gif_encoded_frames':gif.n_frames,'gif_total_ms':duration})
for motion in ['skill-1','skill-2']:
 for i in range(1,9):
  a=np.array(Image.open(R/'liu-bei'/motion/f'frame-{i:02}.png'));b=np.array(Image.open(O/'liu-bei'/motion/f'body-{i:02}.png'));assert np.array_equal(a,b)
before=json.loads((O/'sources/protected-sha256.json').read_text());assert all(hashlib.sha256((R/p).read_bytes()).hexdigest()==h for p,h in before.items())
for hero,motions in [('zhang-fei',['basic-attack','skill-1','skill-2']),('guan-yu',['basic-attack','skill-1','skill-2']),('liu-bei',['skill-1','skill-2'])]:
 seq=[]
 for i in range(8):
  tile=Image.new('RGBA',(350*(len(motions)+1),380),'#dfe9ed');d=ImageDraw.Draw(tile)
  tile.alpha_composite(Image.open(R/hero/'original/original.png').convert('RGBA'),(0,30));d.text((15,10),'ORIGINAL',fill='#192a32')
  for k,m in enumerate(motions):tile.alpha_composite(Image.open(O/hero/m/f'frame-{i+1:02}.png').convert('RGBA'),((k+1)*350,30));d.text(((k+1)*350+15,10),f'{m}  {i+1}/8',fill='#192a32')
  seq.append(tile.convert('RGB'))
 atlas=Image.new('RGB',(seq[0].width,380*8))
 for i,f in enumerate(seq):atlas.paste(f,(0,380*i))
 pal=atlas.quantize(colors=256);q=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in seq]
 q[0].save(O/f'{hero}-compare.gif',save_all=True,append_images=q[1:],duration=[180,120,120,90,150,120,150,240],loop=0,optimize=False,disposal=2)
out=dict(motions=reports,protected_pngs=len(before),protected_changes=0,liu_body_frames_equal=16,browser_replay='blocked by file URL policy',local_geometry='not proven; Zhang Fei thrust grip mismatch remains')
(O/'verification.json').write_text(json.dumps(out,indent=2),encoding='utf-8');print(json.dumps(out,indent=2))
