// Generated raster materials clipped to tile geometry at load time.
// No original tile images are sampled. Mask bits: -x,+x,-y,+y.
export async function registerMaterialTiles(assets, t, root) {
  const img = await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=root+t.material;});
  const names=[];
  for(let mask=0;mask<16;mask++){
    const c=document.createElement('canvas');c.width=400;c.height=240;
    const ctx=c.getContext('2d');
    // Work in an ordinary unit square, projected to the isometric diamond.
    ctx.setTransform(200,-120,-200,-120,200,240);
    const p=new Path2D();
    if(t.shape==='road'){
      const ends=[[1,0,.5],[2,1,.5],[4,.5,0],[8,.5,1]].filter(([bit])=>mask&bit);
      ctx.lineWidth=.64;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';
      if(ends.length===2){p.moveTo(ends[0][1],ends[0][2]);p.quadraticCurveTo(.5,.5,ends[1][1],ends[1][2]);}
      else for(const [,x,y] of ends){p.moveTo(.5,.5);p.lineTo(x,y);}
      ctx.stroke(p);
      if(!ends.length){ctx.beginPath();ctx.arc(.5,.5,.25,0,Math.PI*2);ctx.fill();}
      ctx.globalCompositeOperation='source-in';
    }else{
      const inset=t.shape==='ground'?0:.06;
      const x0=mask&1?0:inset,x1=mask&2?1:1-inset,y0=mask&4?0:inset,y1=mask&8?1:1-inset;
      const r=t.id==='sg2_river'?.40:.20;
      p.roundRect(x0,y0,x1-x0,y1-y0,[!(mask&1)&&!(mask&4)?r:0,!(mask&2)&&!(mask&4)?r:0,!(mask&2)&&!(mask&8)?r:0,!(mask&1)&&!(mask&8)?r:0]);
    }
    if(t.shape!=='road')ctx.clip(p);ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(img,0,0,400,240);
    // A soft dirt lip under paths. It follows the same connected centerline, with no tile-end caps.
    if(t.shape==='road'){
      ctx.globalCompositeOperation='destination-over';ctx.setTransform(200,-120,-200,-120,200,240);
      ctx.lineWidth=.70;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(131,112,64,.30)';ctx.stroke(p);
      ctx.globalCompositeOperation='source-over';
    }
    // Rounded shores and yard edges: draw only exposed boundaries, never internal tile seams.
    if(t.shape==='area'){
      ctx.globalCompositeOperation='source-over';ctx.setTransform(200,-120,-200,-120,200,240);
      const x0=mask&1?0:.06,x1=mask&2?1:.94,y0=mask&4?0:.06,y1=mask&8?1:.94;
      const radius=t.id==='sg2_river'?.40:.20;
      const tl=!(mask&1)&&!(mask&4)?radius:0,tr=!(mask&2)&&!(mask&4)?radius:0;
      const br=!(mask&2)&&!(mask&8)?radius:0,bl=!(mask&1)&&!(mask&8)?radius:0;
      const bank=new Path2D();
      if(!(mask&4)){bank.moveTo(x0+tl,y0);bank.lineTo(x1-tr,y0);if(tr)bank.quadraticCurveTo(x1,y0,x1,y0+tr);}
      if(!(mask&2)){bank.moveTo(x1,y0+tr);bank.lineTo(x1,y1-br);if(br)bank.quadraticCurveTo(x1,y1,x1-br,y1);}
      if(!(mask&8)){bank.moveTo(x1-br,y1);bank.lineTo(x0+bl,y1);if(bl)bank.quadraticCurveTo(x0,y1,x0,y1-bl);}
      if(!(mask&1)){bank.moveTo(x0,y1-bl);bank.lineTo(x0,y0+tl);if(tl)bank.quadraticCurveTo(x0,y0,x0+tl,y0);}
      const water=t.id==='sg2_river';
      ctx.lineWidth=water?.12:.065;ctx.strokeStyle=water?'#97bd90':'rgba(115,105,58,.32)';ctx.stroke(bank);
      if(water){ctx.lineWidth=.035;ctx.strokeStyle='#b9e2cc';ctx.stroke(bank);}
    }
    const name=`${t.id}#${mask}`,key=`generated:${name}`;
    const tex=assets.renderer.createTexture(c);assets.texReady.set(key,tex);assets.textures.set(key,Promise.resolve(tex));
    assets.sprites[name]={tex:key,rect:[0,0,400,240],size:[400,240],offset:[0,0],pivot:[.5,.5],ppu:120};
    names.push({sprite:name});
  }
  assets.tiles[t.id]={name:t.id,script:'SamgukMaterialTile',f:{m_Sprites:names,shape:t.shape}};
}
