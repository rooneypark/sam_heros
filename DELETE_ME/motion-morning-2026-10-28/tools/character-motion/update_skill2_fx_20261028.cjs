const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../../motion-review-2026-10-28');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function silhouette(data,hero){
 const w=350,n=w*w,dark=new Uint8Array(n),closed=new Uint8Array(n),outside=new Uint8Array(n),q=[];
 for(let p=0;p<n;p++){const i=p*4,r=data[i],g=data[i+1],b=data[i+2];if(data[i+3]>100&&Math.max(r,g,b)<100&&Math.max(r,g,b)-Math.min(r,g,b)<30)dark[p]=1;}
 // Close one-pixel outline gaps before exterior flood fill.
 for(let y=1;y<w-1;y++)for(let x=1;x<w-1;x++){let p=y*w+x;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dark[p+dy*w+dx])closed[p]=1;}
 for(let x=0;x<w;x++){q.push(x,(w-1)*w+x);outside[x]=outside[(w-1)*w+x]=1;}for(let y=1;y<w-1;y++){q.push(y*w,y*w+w-1);outside[y*w]=outside[y*w+w-1]=1;}
 for(let k=0;k<q.length;k++){const p=q[k],x=p%w,y=Math.floor(p/w);for(const j of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<w-1?p+w:-1])if(j>=0&&!outside[j]&&!closed[j]){outside[j]=1;q.push(j);}}
 const mask=new Uint8Array(n),out=Buffer.alloc(data.length);
 for(let p=0;p<n;p++)if(!outside[p]){const i=p*4,r=data[i],g=data[i+1],b=data[i+2];
  // Exclude colored legacy aura outside the dark contour itself.
  const blue=b>r+35&&b>80,cyan=g>r+40&&b>r+40;
  if(hero!=='zhang-fei'||(!blue&&!cyan)){mask[p]=1;data.copy(out,i,i,i+4);}
 }
 return {mask,out};
}
(async()=>{
 const configs=JSON.parse(fs.readFileSync(path.join(root,'sources/skill2-fx-v2.json'),'utf8'));
 for(const cfg of configs){const dir=path.join(root,cfg.hero,'skill-2'),backup=path.join(dir,'before-fx-v2');fs.mkdirSync(backup,{recursive:true});
  const meta=JSON.parse(fs.readFileSync(path.join(dir,'animation.json'),'utf8')),source=path.join(root,'sources',cfg.hero+'-skill-2-fx-v2.png');fs.copyFileSync(cfg.image,source);
  const grid=await sharp(source).resize(1400,700).png().toBuffer();let checks=[],layers=[],bodylayers=[];
  for(let f=1;f<=8;f++){
   const name=`frame-${String(f).padStart(2,'0')}.png`,old=path.join(backup,name);if(!fs.existsSync(old))fs.copyFileSync(path.join(dir,name),old);
   const {data,info}=await sharp(old).ensureAlpha().raw().toBuffer({resolveWithObject:true});let body,mask;
   if(f===1||f===8){body=Buffer.from(data);mask=new Uint8Array(350*350);for(let p=0;p<mask.length;p++)if(data[p*4+3])mask[p]=1;}
   else{const got=silhouette(data,cfg.hero);body=got.out;mask=got.mask;}
   // Keep the original weapon tube where legacy glow interrupted its contour.
   if(f>1&&f<8){
    let gold=[];for(let y=30;y<245;y++)for(let x=85;x<160;x++){const i=(y*350+x)*4;if(data[i+3]>230&&data[i]>180&&data[i+1]>130&&data[i+2]<65)gold.push([x,y]);}
    if(gold.length){
     if(cfg.hero==='zhang-fei'){
      const low=gold.filter(p=>p[1]>205);const cx=Math.round(low.reduce((s,p)=>s+p[0],0)/low.length);
      for(let y=138;y<244;y++)for(let x=cx-3;x<=cx+3;x++){const p=y*350+x,i=p*4;if(data[i+3]){mask[p]=1;data.copy(body,i,i,i+4);}}
      // Recover shaft hidden by the old mouth flare from the same grounded weapon
      // in frame 2; no change to hand, arm, or weapon position/length.
      const donor=await sharp(path.join(backup,'frame-02.png')).ensureAlpha().raw().toBuffer();
      let donorXs=[];for(let x=125;x<150;x++){let i=(220*350+x)*4;if(donor[i]>180&&donor[i+1]>130&&donor[i+2]<65&&donor[i+3]>230)donorXs.push(x);}
      const donorCx=Math.round(donorXs.reduce((a,b)=>a+b,0)/donorXs.length);
      if(f>=3&&f<=6)for(let y=143;y<166;y++)for(let dx=-3;dx<=3;dx++){const p=y*350+cx+dx,i=p*4,di=(y*350+donorCx+dx)*4;if(donor[di+3]){donor.copy(body,i,di,di+4);mask[p]=2;}}
      // Gold mouth emission is not part of the character silhouette.
      for(let y=145;y<184;y++)for(let x=141;x<160;x++){let p=y*350+x,i=p*4;if(data[i+2]<110&&data[i]>data[i+2]*1.5&&data[i+1]>data[i+2]*1.3&&data[i]>50&&data[i+1]>35){mask[p]=0;body.fill(0,i,i+4);}}
     }else{
      // Original thin golden shaft and existing blade remain unchanged.
      const bottom=gold.reduce((a,p)=>p[1]>a[1]?p:a,gold[0]),top=gold.reduce((a,p)=>p[1]<a[1]?p:a,gold[0]);
      const dx=bottom[0]-top[0],dy=bottom[1]-top[1],len2=dx*dx+dy*dy;
      for(let y=10;y<245;y++)for(let x=80;x<170;x++){const t=((x-top[0])*dx+(y-top[1])*dy)/len2,dist=Math.abs((x-top[0])*dy-(y-top[1])*dx)/Math.sqrt(len2);if(t>=-.05&&t<=1.03&&dist<4.5){let p=y*350+x,i=p*4;if(data[i+3]){mask[p]=1;data.copy(body,i,i,i+4);}}}
     }
    }
   }
   const fx=f===1||f===8?Buffer.alloc(263*263*4):await sharp(grid).extract({left:((f-1)%4)*350,top:Math.floor((f-1)/4)*350,width:350,height:350}).resize(263,263).ensureAlpha().raw().toBuffer();
   // Position the generated ring's visual ground at the existing foot line.
   const shifted=Buffer.alloc(data.length);for(let y=0;y<263;y++)for(let x=0;x<263;x++)fx.copy(shifted,((y+8)*350+x+44)*4,(y*263+x)*4,(y*263+x)*4+4);
   // New effect behind the original silhouette: protected character pixels are copied exactly.
   const result=Buffer.from(shifted);for(let p=0;p<mask.length;p++)if(mask[p])body.copy(result,p*4,p*4,p*4+4);
   await sharp(body,{raw:info}).png().toFile(path.join(dir,`body-${String(f).padStart(2,'0')}.png`));
   await sharp(shifted,{raw:info}).png().toFile(path.join(dir,`fx-${String(f).padStart(2,'0')}.png`));
   await sharp(result,{raw:info}).png().toFile(path.join(dir,name));
   let changed=0,protectedCount=0;for(let p=0;p<mask.length;p++)if(mask[p]===1){protectedCount++;for(let ch=0;ch<4;ch++)if(result[p*4+ch]!==data[p*4+ch])changed++;}
   checks.push({frame:f,source_sha256:sha(old),protected_character_pixels:protectedCount,protected_channel_changes:changed});layers.push({input:path.join(dir,name),left:((f-1)%4)*350,top:Math.floor((f-1)/4)*350});bodylayers.push({input:path.join(dir,`body-${String(f).padStart(2,'0')}.png`),left:((f-1)%4)*350,top:Math.floor((f-1)/4)*350});
  }
  for(const [file,ls] of [['frames-overview.png',layers],['bodies-overview.png',bodylayers]])await sharp({create:{width:1400,height:700,channels:4,background:'#00000000'}}).composite(ls).png().toFile(path.join(dir,file));
  meta.fx_revision={date:'2026-10-28',palette:cfg.palette,description:cfg.description,character:'Existing pose/color/size/position pixels inside extracted dark silhouette retained exactly',source:path.relative(root,source).replaceAll('\\','/')};fs.writeFileSync(path.join(dir,'animation.json'),JSON.stringify(meta,null,2));fs.writeFileSync(path.join(dir,'fx-v2-verification.json'),JSON.stringify(checks,null,2));
  console.log(cfg.hero,checks);
 }
})().catch(e=>{console.error(e);process.exit(1)});
