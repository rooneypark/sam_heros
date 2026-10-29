raise SystemExit('Superseded by approved single-sword design; use build_liu_single_sword.py')
"""Preserve approved art; lock the full upper silhouette at source resolution."""
from pathlib import Path
import json,shutil,hashlib
import numpy as np
from PIL import Image,ImageDraw
from export_liu_commander import face
R=Path(__file__).resolve().parents[1];C=R/'characters/liu-bei';W=C/'sources/commander-motions';D=W/'run-fixed-hem';D.mkdir(exist_ok=True)
backup=C/'archive/before-fixed-hem'
if not backup.exists():shutil.copytree(C/'run',backup)
s=Image.open(W/'run-full-redraw/source.png').convert('RGBA');cells=[s.crop((i%3*512,i//3*512,(i%3+1)*512,(i//3+1)*512)) for i in range(6)]
edges=[[(205,362),(225,368),(245,370),(270,377),(295,377),(320,368),(345,352),(365,340)],
[(205,365),(230,375),(250,380),(280,384),(310,379),(340,365),(365,347)],
[(210,361),(240,370),(265,378),(285,381),(310,376),(340,365),(355,359)],
[(200,311),(230,325),(260,337),(285,341),(310,334),(335,321),(355,306)],
[(205,316),(235,331),(265,340),(295,342),(320,334),(345,320),(365,306)],
[(210,333),(240,338),(270,342),(295,340),(320,333),(345,320),(365,306)]]
def mask(edge,upper):
 m=Image.new('L',(512,512));d=ImageDraw.Draw(m)
 if upper:d.polygon([(0,0),(511,0),(511,edge[-1][1])]+list(reversed(edge))+[(0,edge[0][1])],fill=255)
 else:d.polygon([(0,edge[0][1])]+edge+[(511,edge[-1][1]),(511,511),(0,511)],fill=255)
 return np.array(m)
up=np.array(cells[0]);up[:,:,3]=np.minimum(up[:,:,3],mask([(x,y+2) for x,y in edges[0]],True));up=Image.fromarray(up)
ref=face(Image.open(C/'original/original.png').convert('RGBA'));anchor=face(cells[0]);scale=ref[2]/anchor[2];sz=round(512*scale)
outframes=[]
for i,cell in enumerate(cells):
 # Exclude the old hem's lower antialiased black stroke as well as its fill.
 a=np.array(cell);a[:,:,3]=np.minimum(a[:,:,3],mask(edges[i],False));
 if i==1:a[:382,:225,3]=0
 legs=Image.fromarray(a)
 f=face(cell);delta=(round(anchor[0]-f[0]),round(anchor[1]-f[1]));canvas=Image.new('RGBA',(512,512));canvas.alpha_composite(legs,delta)
 canvas.alpha_composite(up)
 small=canvas.resize((sz,sz),Image.Resampling.LANCZOS);out=Image.new('RGBA',(350,350));bob=[0,-1,-2,0,-1,-2][i]
 out.alpha_composite(small,(round(ref[0]-anchor[0]*scale),round(ref[1]-anchor[1]*scale)+bob));outframes.append(out);out.save(D/f'frame-{i+1:02}.png')
view=Image.new('RGBA',(1050,700),'#e5edef')
for i,f in enumerate(outframes):view.alpha_composite(f,(i%3*350,i//3*350))
view.save(D/'overview.png')
print(D)
