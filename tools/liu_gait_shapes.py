from PIL import Image, ImageDraw, ImageChops, ImageFont
from pathlib import Path
import math,json

def point(p,length,angle):
 a=math.radians(angle);return(p[0]+.82*length*math.sin(a),p[1]+length*math.cos(a)+.48*length*math.sin(a))

def curved_part(size,start,curves,color,stripe=False):
 scale=4; pts=[start];last=start
 for a,b,end in curves:
  for j in range(1,25):
   t=j/24;u=1-t
   pts.append((u*u*u*last[0]+3*u*u*t*a[0]+3*u*t*t*b[0]+t*t*t*end[0],u*u*u*last[1]+3*u*u*t*a[1]+3*u*t*t*b[1]+t*t*t*end[1]))
  last=end
 im=Image.new('RGBA',(size[0]*scale,size[1]*scale));d=ImageDraw.Draw(im)
 poly=[(round(x*scale),round(y*scale)) for x,y in pts]
 d.polygon(poly,fill=color)
 if stripe:
  decoration=Image.new('RGBA',im.size);dd=ImageDraw.Draw(decoration)
  band=[(43,19),(49,23),(44,29),(40,36),(39,44),(44,53),(34,54),(29,45),(30,35),(35,26)]
  dd.polygon([(x*scale,y*scale) for x,y in band],fill='#eee9db')
  decoration.putalpha(ImageChops.multiply(decoration.getchannel('A'),im.getchannel('A')));im.alpha_composite(decoration)
 d=ImageDraw.Draw(im);d.line(poly+[poly[0]],fill='#0c0d0d',width=14,joint='curve')
 return im.resize(size,Image.Resampling.LANCZOS)

def leg_parts(h):
 trouser='#f9f9f7';boot='#504a4d'
 thigh=curved_part((64,58),(15,3),[
 ((22,0),(42,0),(49,5)),((58,12),(61,29),(57,41)),
 ((54,53),(43,56),(32,56)),((20,56),(9,52),(6,42)),
 ((2,29),(6,11),(15,3))],trouser)
 shin=curved_part((74,56),(17,2),[
 ((25,0),(41,0),(48,5)),((53,10),(48,17),(54,23)),
 ((62,28),(72,33),(72,42)),((72,51),(57,54),(38,54)),
 ((19,54),(4,51),(3,43)),((1,34),(11,25),(12,17)),
 ((13,11),(12,5),(17,2))],boot,True)
 d=ImageDraw.Draw(shin);d.line([(15,12),(25,14),(36,14),(47,12)],fill='#f9ce22',width=5);return thigh,shin

