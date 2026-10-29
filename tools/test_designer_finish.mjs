import fs from 'node:fs';import assert from 'node:assert/strict';
import {GridNav,BLOCKING_DECO,BLOCKING_FOOTPRINT} from '../web/src/engine/gridnav.js';
import {SPEAKERS} from '../web/src/packs/chapter1/script.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read('maps/chapter-1/history/polish/before.map.json'),after=read('maps/chapter-1/map.json');
for(const k of ['mapData','waterData','blockData','Buildings','Spawners','FootSwitch','BonfirePos','npcs','maker','buildingDefs'])assert.deepEqual(after[k],before[k],k);
const tiles=read('content/samguk/tiles.json').tiles;
for(const t of tiles){if(t.blocks){BLOCKING_DECO.add(t.id);BLOCKING_FOOTPRINT.set(t.id,t.footprint||[1,1]);}if(t.sprite)assert(fs.existsSync(''+t.sprite));}
const a=new GridNav(before),b=new GridNav(after);let count=0;
for(let x=-5;x<225;x++)for(let y=-5;y<225;y++){assert.equal(a.walkable(x,y),b.walkable(x,y),`Walkability changed ${x},${y}`);if(b.walkable(x,y))count++;}
const existing=new Set(after.roadData.map(t=>`${t.x},${t.y},${t.n}`));for(const t of before.roadData)assert(existing.has(`${t.x},${t.y},${t.n}`));
const units=read('content/samguk/units.json').units;
for(const who of Object.values(SPEAKERS)){if(!who.unit)continue;const u=units.find(u=>u.id===who.unit);assert(u?.art.portrait);assert(fs.existsSync(''+u.art.portrait));}
for(const u of units.slice(0,4)){const f=u.art.frames.Gather;assert.deepEqual(fs.readFileSync(''+f[0]),fs.readFileSync(''+f.at(-1)));assert.deepEqual(u.motion.Gather.hits,[500]);}
console.log(`PASS: all ${230*230} nav cells unchanged (${count} walkable), scenario and original roads preserved, all dialogue portraits resolve, four gather cycles return exactly to first pose.`);
