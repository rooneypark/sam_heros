"""Rebuild review GIFs/sheets from registered PNGs without changing any frame pixels."""
from pathlib import Path
import json,html
from PIL import Image, ImageDraw, ImageFont
R=Path(__file__).resolve().parents[1]
units=json.loads((R/'content/samguk/units.json').read_text(encoding='utf8'))['units']
head='<meta charset="utf-8"><style>body{background:#18252e;color:#eef;font:16px system-ui;padding:24px}a{color:#69e4ba}.row{display:flex;flex-wrap:wrap}figure{margin:8px}img{width:280px;background:#e5edef;border-radius:8px}figcaption{padding:8px}</style>'
index=head+'<h1>캐릭터별 현재 모션</h1><p>실제 units.json 등록 PNG로 만든 미리보기. 승인 상태는 기존 기록을 유지합니다.</p>'
for u in units:
 root=R/Path(u['art']['frames']['Idle'][0]).parents[1]
 page=head+f'<h1>{html.escape(u["name"])}</h1><div class="row">'
 for state,paths in u['art']['frames'].items():
  folder=(R/paths[0]).parent;frames=[Image.open(R/p).convert('RGBA') for p in paths];ms=u['motion'][state]['ms']
  sheet=Image.new('RGBA',(350*len(frames),350));bg=[]
  for i,f in enumerate(frames):
   sheet.alpha_composite(f,(i*350,0));g=Image.new('RGBA',(350,350),'#e5edef');g.alpha_composite(f);bg.append(g.convert('RGB'))
  sheet.save(folder/'spritesheet.png')
  if (folder/'frames-overview.png').exists():
   columns=min(4,len(frames));rows=(len(frames)+columns-1)//columns
   overview=Image.new('RGBA',(columns*350,rows*380),'#e5edef');draw=ImageDraw.Draw(overview)
   font=ImageFont.truetype('C:/Windows/Fonts/malgun.ttf',18)
   for i,f in enumerate(frames):
    x=(i%columns)*350;y=(i//columns)*380
    overview.alpha_composite(f,(x,y+30));draw.text((x+10,y+5),f'{i+1} / {len(frames)}',font=font,fill='#17231b')
   overview.save(folder/'frames-overview.png')
  atlas=Image.new('RGB',(350*len(bg),350))
  for i,f in enumerate(bg):atlas.paste(f,(350*i,0))
  pal=atlas.quantize(colors=256);gif=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in bg]
  for name,mult in [('preview.gif',1),('preview-slow.gif',2)]:gif[0].save(folder/name,save_all=True,append_images=gif[1:],duration=[x*mult for x in ms],loop=0,disposal=2,optimize=False)
  info={'size':[350,350],'pivot':u['art'].get('pivot',[.5,.3]),'ppu':u['art'].get('ppu',100),'facing':u['art'].get('facing','left'),'ms':ms,'hits':u['motion'][state].get('hits',[]),'loop':u['motion'][state].get('loop',False),'frames':[Path(p).name for p in paths],'source':'content/samguk/units.json; existing approval unchanged'}
  (folder/'animation.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf8')
  page+=f'<figure><img src="../{folder.name}/preview.gif"><figcaption>{state} · {len(frames)}장 <a href="../{folder.name}/spritesheet.png">전체 프레임</a></figcaption></figure>'
 (root/'preview').mkdir(exist_ok=True);(root/'preview/index.html').write_text(page+'</div>',encoding='utf8')
 readme=root/'README.md';prior=readme.read_text(encoding='utf8') if readme.exists() else ''
 marker='<!-- CURRENT_LAYOUT -->'
 if marker not in prior:
  readme.write_text(marker+f'\n# {u["name"]} — 현재 리소스\n\nID `{u["id"]}`. [전체 모션 미리보기](preview/index.html). 등록 원본은 `content/samguk/units.json`.\n\n현재 모션: '+', '.join(f'`{Path(v[0]).parent.name}/` ({k}, {len(v)}장)' for k,v in u['art']['frames'].items())+'\n\n개별 frame PNG가 실행 원본이며 같은 폴더에 시트·GIF·시간정보를 둡니다. sources/는 제작 근거, archive/는 대체된 파일로 실행에 사용하지 않습니다. 이번 정리는 그림 변경이나 추가 승인이 아닙니다.\n\n---\n\n'+prior,encoding='utf8')
 index+=f'<p><a href="{root.name}/preview/index.html">{html.escape(u["name"])}</a> · {u["id"]}</p>'
(R/'characters/index.html').write_text(index,encoding='utf8')
print('Rebuilt registered motion previews for',len(units),'characters; frame PNGs untouched')
