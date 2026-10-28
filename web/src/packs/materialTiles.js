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
      ctx.lineWidth=.5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#fff';
      if(ends.length===2){p.moveTo(ends[0][1],ends[0][2]);p.quadraticCurveTo(.5,.5,ends[1][1],ends[1][2]);}
      else for(const [,x,y] of ends){p.moveTo(.5,.5);p.lineTo(x,y);}
      ctx.stroke(p);
      if(!ends.length){ctx.beginPath();ctx.arc(.5,.5,.25,0,Math.PI*2);ctx.fill();}
      ctx.globalCompositeOperation='source-in';
    }else{
      const inset=t.shape==='ground'?0:.06;
      const x0=mask&1?0:inset,x1=mask&2?1:1-inset,y0=mask&4?0:inset,y1=mask&8?1:1-inset;
      p.rect(x0,y0,x1-x0,y1-y0);
    }
    if(t.shape!=='road')ctx.clip(p);ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(img,0,0,400,240);
    // A restrained bank on exposed edges only. Connected sides have no stroke.
    if(t.shape==='area'){
      ctx.setTransform(200,-120,-200,-120,200,240);ctx.strokeStyle=t.shore;ctx.lineWidth=.035;
      for(const [bit,x,y,X,Y] of [[1,.065,0,.065,1],[2,.935,0,.935,1],[4,0,.065,1,.065],[8,0,.935,1,.935]]){
        if(!(mask&bit)){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(X,Y);ctx.stroke();}
      }
    }
    const name=`${t.id}#${mask}`,key=`generated:${name}`;
    const tex=assets.renderer.createTexture(c);assets.texReady.set(key,tex);assets.textures.set(key,Promise.resolve(tex));
    assets.sprites[name]={tex:key,rect:[0,0,400,240],size:[400,240],offset:[0,0],pivot:[.5,.5],ppu:120};
    names.push({sprite:name});
  }
  assets.tiles[t.id]={name:t.id,script:'SamgukMaterialTile',f:{m_Sprites:names,shape:t.shape}};
}
