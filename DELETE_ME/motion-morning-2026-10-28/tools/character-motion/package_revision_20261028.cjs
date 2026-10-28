// Packaging only: generated artwork is retained verbatim in sources/.
// One scale per motion; no per-frame bbox fitting, morphing, or body-part resizing.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'motion-review-2026-10-28');
if(fs.existsSync(path.join(out,'zhang-fei/skill-1/APPROVED_2026-10-28.json')))throw Error('Retired initial packager: would overwrite approved Zhang Fei skill1. Use final_review_v4_20261028.cjs for current corrections.');
const cache='C:/Users/user/.codex/generated_images/01a17fb9-9c81-7692-b985-606cf0c7d4c3';
const specs=[
 ['zhang-fei','basic-attack','f1914b8a-a6ce-4755-ac36-7a9e55516d70',.5],
 ['zhang-fei','skill-1','9e828844-c464-47ce-a8be-4fff4f768735',.6],
 ['zhang-fei','skill-2','f3b15d88-3cd1-4baa-94cf-f473e75723bd',.5],
 ['guan-yu','basic-attack','21193729-bdde-4013-9ebf-b6eb79bbeb28',.5],
 ['guan-yu','skill-1','898a50f2-9c18-4850-bf13-8b4b145bf0d9',.6],
 ['guan-yu','skill-2','26fed212-88fd-4f36-bcf2-bebe0c77686e',.55],
 ['liu-bei','skill-1','f6539564-5a78-4e33-925f-0589f40c5a75',1],
 ['liu-bei','skill-2','34a5fcda-c973-46f6-a2de-3b9103d0c22b',1],
];
const blank=()=>sharp({create:{width:350,height:350,channels:4,background:'#00000000'}});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function place(buf,left,top){
 const m=await sharp(buf).metadata();let sx=Math.max(0,-left),sy=Math.max(0,-top),w=Math.min(m.width-sx,350-Math.max(0,left)),h=Math.min(m.height-sy,350-Math.max(0,top));
 if(w<=0||h<=0)return blank().png().toBuffer();
 const clip=await sharp(buf).extract({left:sx,top:sy,width:w,height:h}).toBuffer();
 return blank().composite([{input:clip,left:Math.max(0,left),top:Math.max(0,top)}]).png().toBuffer();
}
async function feet(buf,hero){
 const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});let pts=[];
 for(let y=290;y<445;y++)for(let x=65;x<435;x++){
  const i=(y*info.width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
  const ok=hero==='zhang-fei'?Math.max(r,g,b)-Math.min(r,g,b)<18&&r>52&&r<115:r>35&&r<100&&g>65&&g<140&&b>65&&b<140&&g-r>12;
  if(data[i+3]>210&&ok)pts.push([x,y]);
 }
 if(!pts.length)throw Error('No shoe anchor '+hero);
 const maxY=Math.max(...pts.map(p=>p[1]));pts=pts.filter(p=>p[1]>maxY-24);
 return [Math.round((Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2),maxY];
}
(async()=>{
 fs.mkdirSync(path.join(out,'sources'),{recursive:true});let motions=[],checks=[];
 for(const [hero,motion,id,scale] of specs){
  const source=path.join(out,'sources',hero+'-'+motion+'.png');fs.copyFileSync(path.join(cache,'exec-'+id+'.png'),source);
  const grid=await sharp(source).resize(1800,900).png().toBuffer(),dir=path.join(out,hero,motion);fs.mkdirSync(dir,{recursive:true});
  const srcDir=path.join(root,hero,motion),old=JSON.parse(fs.readFileSync(path.join(srcDir,'animation.json'),'utf8').replace(/^\uFEFF/,''));
  let times=old.durations_ms;if(times.length!==8)times=[180,110,90,70,140,100,110,180];
  let frames=[],offsets=[];
  for(let i=0;i<8;i++){
   const cell=await sharp(grid).extract({left:(i%4)*450,top:Math.floor(i/4)*450,width:450,height:450}).png().toBuffer();
   let frame;
   if(hero==='liu-bei'){
    let fx;
    if(i===0||i===7)fx=await blank().png().toBuffer();
    else if(motion==='skill-1'){
     const small=await sharp(cell).resize(193,193).png().toBuffer();fx=await place(small,79,89);
    }else{
     const full=await sharp(cell).resize(350,350).png().toBuffer();fx=await place(full,0,-18);
    }
    const original=path.join(srcDir,`frame-${String(i+1).padStart(2,'0')}.png`);
    fs.copyFileSync(original,path.join(dir,`body-${String(i+1).padStart(2,'0')}.png`));
    await sharp(fx).toFile(path.join(dir,`fx-${String(i+1).padStart(2,'0')}.png`));
    frame=await sharp(original).composite([{input:fx}]).png().toBuffer();
    checks.push({file:path.relative(root,original).replaceAll('\\','/'),sha256:hash(original),body_copy_identical:hash(original)===hash(path.join(dir,`body-${String(i+1).padStart(2,'0')}.png`))});
   }else if(i===0||i===7){frame=fs.readFileSync(path.join(root,hero,'original/original.png'));offsets.push({frame:i+1,source:'approved-original'});}
   else{
    const anchor=await feet(cell,hero),size=Math.round(450*scale),scaled=await sharp(cell).resize(size,size).png().toBuffer();
    const left=175-Math.round(anchor[0]*scale),top=245-Math.round(anchor[1]*scale);
    frame=await place(scaled,left,top);offsets.push({frame:i+1,detected_shoe_anchor:anchor,scale,left,top});
   }
   const file=`frame-${String(i+1).padStart(2,'0')}.png`;fs.writeFileSync(path.join(dir,file),frame);frames.push(file);
  }
  const meta={status:'review-not-approved',motion,cell:[350,350],frames,frame_count:8,durations_ms:times,facing:'left',direction:'down-left',foot_anchor:[175,245],ppu:100,pivot:[.5,.3],source:path.relative(out,source).replaceAll('\\','/'),tool:'built-in image_gen',scale_per_motion:hero==='liu-bei'?null:scale,alignment:offsets,qa:hero==='liu-bei'?'Original body copies byte-identical; effect overlay only.':'Generated pose draft: appearance, local weapon lengths/grips and transition continuity require further correction; not production-ready.'};
  fs.writeFileSync(path.join(dir,'animation.json'),JSON.stringify(meta,null,2));
  const layers=[];for(let i=0;i<8;i++)layers.push({input:path.join(dir,frames[i]),left:(i%4)*350,top:Math.floor(i/4)*350});
  await sharp({create:{width:1400,height:700,channels:4,background:'#00000000'}}).composite(layers).png().toFile(path.join(dir,'frames-overview.png'));
  motions.push({hero,motion,path:`${hero}/${motion}`,label:hero+' '+motion,qa:meta.qa});
 }
 fs.copyFileSync(path.join(cache,'exec-bb6e9f79-68eb-42aa-8adc-cdd7f741f238.png'),path.join(out,'sources/guan-yu-run-generated-not-used.png'));
 fs.writeFileSync(path.join(out,'motions.json'),JSON.stringify(motions,null,2));
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({status:'draft',original_body_copies:checks,generated_run_not_used:'Generated whole sheet altered body; blade-only correction must preserve source body pixels.'},null,2));
 console.log('Packaged',motions.length,'motion drafts; protected Liu Bei bodies:',checks.length);
})().catch(e=>{console.error(e);process.exit(1)});
