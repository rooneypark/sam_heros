// Requested rigid blade reflection. The generated full-sheet edit was rejected
// because it changed protected body pixels. Only the original silver blade is transformed.
const fs=require('fs'),path=require('path'),sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),dir=path.join(root,'motion-review-2026-10-28/guan-yu/run');
(async()=>{fs.mkdirSync(dir,{recursive:true});let checks=[],layers=[],baseline;
for(let f=1;f<=6;f++){
 const file=`frame-${String(f).padStart(2,'0')}.png`,src=path.join(root,'guan-yu/run',file),{data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let white=[];for(let y=70;y<145;y++)for(let x=85;x<145;x++){let i=(y*350+x)*4;if(data[i+3]>180&&data[i]>175&&data[i+1]>175&&data[i+2]>175)white.push([x,y]);}
 let minY=Math.min(...white.map(p=>p[1]));if(f===1)baseline=minY;let dy=minY-baseline;
 const ax=134,ay=130+dy,ux=16/Math.hypot(16,23),uy=23/Math.hypot(16,23),a=2*ux*ux-1,b=2*ux*uy,c=2*uy*uy-1;
 const mask=new Uint8Array(350*350),blade=Buffer.alloc(data.length),out=Buffer.from(data);
 for(let y=75+dy;y<136+dy;y++)for(let x=85;x<145;x++){
  const i=(y*350+x)*4,t=(x-ax)*ux+(y-ay)*uy;
  if(t< -2&&data[i+3]&&!(data[i]>140&&data[i+1]>100&&data[i+2]<110)){
   mask[y*350+x]=1;data.copy(blade,i,i,i+4);out.fill(0,i,i+4);
  }
 }
 // Inverse reflection with bilinear sampling; immutable original body remains underneath.
 let transformed=Buffer.alloc(data.length),support=new Uint8Array(350*350);
 for(let y=65+dy;y<150+dy;y++)for(let x=70;x<160;x++){
  const sx=ax+a*(x-ax)+b*(y-ay),sy=ay+b*(x-ax)+c*(y-ay),x0=Math.floor(sx),y0=Math.floor(sy);let alpha=0,cols=[0,0,0];
  for(let j=0;j<2;j++)for(let k=0;k<2;k++){
   const xx=x0+k,yy=y0+j;if(xx<0||xx>=350||yy<0||yy>=350)continue;
   const w=(k?sx-x0:1-sx+x0)*(j?sy-y0:1-sy+y0),p=(yy*350+xx)*4,aa=blade[p+3]/255*w;
   alpha+=aa;for(let ch=0;ch<3;ch++)cols[ch]+=blade[p+ch]*aa;
  }
  const p=(y*350+x)*4;if(alpha>0.001){support[y*350+x]=1;for(let ch=0;ch<3;ch++)transformed[p+ch]=Math.round(cols[ch]/alpha);transformed[p+3]=Math.round(alpha*255);}
 }
 for(let p=0;p<350*350;p++)if(support[p]){
  const i=p*4,sa=transformed[i+3]/255,da=out[i+3]/255,oa=sa+da*(1-sa);
  for(let ch=0;ch<3;ch++)out[i+ch]=oa?Math.round((transformed[i+ch]*sa+out[i+ch]*da*(1-sa))/oa):0;
  out[i+3]=Math.round(oa*255);
 }
 await sharp(out,{raw:info}).png().toFile(path.join(dir,file));
 const dst=await sharp(path.join(dir,file)).ensureAlpha().raw().toBuffer();let outsideChanged=0,totalChanged=0;
 for(let p=0;p<350*350;p++){let changed=false;for(let ch=0;ch<4;ch++)if(dst[p*4+ch]!==data[p*4+ch])changed=true;if(changed){totalChanged++;if(!mask[p]&&!support[p])outsideChanged++;}}
 if(outsideChanged)throw Error('Protected pixels changed');checks.push({frame:f,blade_vertical_offset:dy,changed_pixels:totalChanged,outside_blade_union_changed:outsideChanged});layers.push({input:path.join(dir,file),left:((f-1)%4)*350,top:Math.floor((f-1)/4)*350});
}
 const meta=JSON.parse(fs.readFileSync(path.join(root,'guan-yu/run/animation.json'),'utf8'));meta.status='review-not-approved';delete meta.approved_date;meta.source='Original run PNG; rigid silver blade reflection about shaft only';fs.writeFileSync(path.join(dir,'animation.json'),JSON.stringify(meta,null,2));
 await sharp({create:{width:1400,height:700,channels:4,background:'#00000000'}}).composite(layers).png().toFile(path.join(dir,'frames-overview.png'));
 fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(checks,null,2));
 const p=path.join(root,'motion-review-2026-10-28/motions.json'),motions=JSON.parse(fs.readFileSync(p,'utf8')).filter(m=>m.path!=='guan-yu/run');motions.push({hero:'guan-yu',motion:'run',path:'guan-yu/run',label:'관우 이동 — 칼날만 반전',qa:'원본 칼날 영역과 반전 후 영역 밖 RGBA 동일; 몸·다리·자루·파지·시간 보존. 연결부 시각 검토 필요.'});fs.writeFileSync(p,JSON.stringify(motions,null,2));console.log(checks);
})().catch(e=>{console.error(e);process.exit(1)});
