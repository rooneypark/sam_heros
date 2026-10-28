const fs=require('fs'),path=require('path'),sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../motion-review-2026-10-28'),repo=path.resolve(root,'..');
if(fs.existsSync(path.join(root,'zhang-fei/skill-1/APPROVED_2026-10-28.json')))throw Error('This v3 redraw script is retired; approved Zhang Fei skill1 must not be overwritten.');
const cfg=[['zhang-fei','8adcf071-6d4e-4314-b669-f6bcff9ed9c4'],['guan-yu','758c8cea-49c9-4b7c-a6f9-398b5c9b21ee']];
(async()=>{for(const [hero,id]of cfg){const dir=path.join(root,hero,'skill-1'),bak=path.join(dir,'rejected-before-v3');fs.mkdirSync(bak,{recursive:true});
 const src=path.join(root,'sources',hero+'-skill1-redraw-v3.png');fs.copyFileSync('C:/Users/user/.codex/generated_images/01a17fb9-9c81-7692-b985-606cf0c7d4c3/exec-'+id+'.png',src);
 const grid=await sharp(src).resize(1800,900).png().toBuffer(),meta=JSON.parse(fs.readFileSync(path.join(dir,'animation.json'),'utf8')),align=[];
 const {data:orig}=await sharp(path.join(repo,hero,'original/original.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});const paletteMap=new Map();for(let i=0;i<orig.length;i+=4)if(orig[i+3]>250){const c=[orig[i],orig[i+1],orig[i+2]],k=c.join(',');paletteMap.set(k,(paletteMap.get(k)||0)+1);}const palette=[...paletteMap].filter(([k,n])=>n>20).map(([k])=>k.split(',').map(Number));
 for(let f=1;f<=8;f++){const name=`frame-${String(f).padStart(2,'0')}.png`;if(!fs.existsSync(path.join(bak,name)))fs.copyFileSync(path.join(dir,name),path.join(bak,name));let buf;
 if(f===1||f===8)buf=fs.readFileSync(path.join(repo,hero,'original/original.png'));
 else{const cell=await sharp(grid).extract({left:((f-1)%4)*450,top:Math.floor((f-1)/4)*450,width:450,height:450}).png().toBuffer(),{data}=await sharp(cell).ensureAlpha().raw().toBuffer({resolveWithObject:true});let pts=[];
 for(let y=290;y<445;y++)for(let x=65;x<435;x++){let i=(y*450+x)*4,r=data[i],g=data[i+1],b=data[i+2];const ok=hero==='zhang-fei'?Math.max(r,g,b)-Math.min(r,g,b)<18&&r>52&&r<115:r>35&&r<100&&g>65&&g<140&&b>65&&b<140&&g-r>12;if(data[i+3]>210&&ok)pts.push([x,y]);}
 const yy=Math.max(...pts.map(p=>p[1]));pts=pts.filter(p=>p[1]>yy-22);const xx=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2,scale=.65,left=175-Math.round(xx*scale),top=245-Math.round(yy*scale);
 const small=await sharp(cell).resize(293,293).ensureAlpha().raw().toBuffer();
 // Snap only nearly-flat opaque character colors to the approved source palette;
 // retain bright cyan-white effects and antialias edge colors.
 for(let i=0;i<small.length;i+=4)if(small[i+3]>250){let r=small[i],g=small[i+1],b=small[i+2];if(g>r+55&&b>r+55&&b>150)continue;let best,dist=1e9;for(const c of palette){const d=(r-c[0])**2+(g-c[1])**2+(b-c[2])**2;if(d<dist){dist=d;best=c;}}if(dist<2000)for(let c=0;c<3;c++)small[i+c]=best[c];}
 const frame=Buffer.alloc(350*350*4);for(let y=0;y<293;y++)for(let x=0;x<293;x++){const xx=x+left,yy=y+top;if(xx>=0&&xx<350&&yy>=0&&yy<350)small.copy(frame,(yy*350+xx)*4,(y*293+x)*4,(y*293+x)*4+4);}buf=await sharp(frame,{raw:{width:350,height:350,channels:4}}).png().toBuffer();align.push({frame:f,scale,left,top});}
 fs.writeFileSync(path.join(dir,name),buf);
 }
 const layers=meta.frames.map((n,i)=>({input:path.join(dir,n),left:(i%4)*350,top:Math.floor(i/4)*350}));await sharp({create:{width:1400,height:700,channels:4,background:'#00000000'}}).composite(layers).png().toFile(path.join(dir,'frames-overview.png'));
 meta.source='sources/'+hero+'-skill1-redraw-v3.png';meta.revision='v3-original-template-redraw';meta.alignment=align;meta.scale_per_motion=.65;meta.qa='Original template used; redrawn arms/weapon/action. Common scale and approved palette matching, pending user review.';
 const timing=JSON.parse(fs.readFileSync(path.join(repo,hero,'skill-2/animation.json'),'utf8'));meta.durations_ms=timing.durations_ms;fs.writeFileSync(path.join(dir,'animation.json'),JSON.stringify(meta,null,2));console.log(hero,'new template redraw packaged');
}})().catch(e=>{console.error(e);process.exit(1)});
