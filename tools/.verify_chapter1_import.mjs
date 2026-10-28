import fs from 'node:fs';
import assert from 'node:assert/strict';
import {GridNav,BLOCKING_DECO,BLOCKING_FOOTPRINT} from '../web/src/engine/gridnav.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read('docs/design/maps/chapter-1/layout-before-art.map.json');
const after=read('content/samguk/maps/1장_황건소탕.map.json');
for(const k of ['Buildings','FootSwitch','BonfirePos'])assert.deepEqual(after[k],before[k],k);
// The character expansion intentionally replaces unit IDs, but keeps scenario topology and conditions.
for (const [key,row] of Object.entries(before.buildingDefs)) {
 const {heroKey,...a}=row, {heroKey:replacement,...b}=after.buildingDefs[key];
 assert.deepEqual(b,a,key); assert(!replacement || replacement.startsWith('SG_'));
}
assert.deepEqual(after.maker.units.map(({key,...u})=>u),before.maker.units.map(({key,...u})=>u));
assert(after.maker.units.every(u=>u.key.startsWith('SG_')));
assert.deepEqual(after.Spawners.map(s=>({...s,SpawnerDatas:s.SpawnerDatas.map(({key,...d})=>d)})),before.Spawners.map(s=>({...s,SpawnerDatas:s.SpawnerDatas.map(({key,...d})=>d)})));
for(const k of ['mapData','waterData','blockData'])assert.deepEqual(after[k].map(({x,y})=>[x,y]),before[k].map(({x,y})=>[x,y]),k);
// Designer polish may fill tiny dirt junction gaps; all original route cells must remain.
const roadCells = new Set(after.roadData.map(({x,y})=>`${x},${y}`));
for (const {x,y} of before.roadData) assert(roadCells.has(`${x},${y}`), `Removed road ${x},${y}`);
const old=new GridNav(before);
const tiles=read('content/samguk/tiles.json').tiles;
for(const t of tiles){if(t.sprite)assert(fs.existsSync(t.sprite),t.sprite);if(t.material)assert(fs.existsSync(t.material),t.material);if(t.blocks){BLOCKING_DECO.add(t.id);BLOCKING_FOOTPRINT.set(t.id,t.footprint);}}
const ids=new Set(tiles.map(t=>t.id));
for(const k of ['mapData','roadData','waterData','blockData','decoData'])for(const t of after[k])assert(t.n.startsWith('sg2_')&&ids.has(t.n),`Unreplaced tile ${t.n}`);
const nav=new GridNav(after);
for(const p of [...after.maker.units,...after.Buildings.map(b=>b.pos)]){
 if(old.findPoly(p.x,p.y)>0)assert(nav.findPoly(p.x,p.y)>0,`New obstacle at actor ${p.x},${p.y}`);
}
// Flood the true walkable grid: GridNav.path has a direct fallback, so it is not proof of connectivity.
function flood(n){const p=n.closest(0,19),s=n.cellOf(p.x,p.y),q=[[s.x,s.y]],seen=new Set([`${s.x},${s.y}`]);
 for(let i=0;i<q.length;i++){const [x,y]=q[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=`${a},${b}`;if(!seen.has(k)&&n.walkable(a,b)){seen.add(k);q.push([a,b]);}}}return seen;}
const a=flood(old),b=flood(nav);
const points=[[9,9],[24,23],[12,37],[44,13],[35,35],[44,43],[49,50],[56,56],[62,61]];
for(const [x,y] of points){const wx=1.66*(x-y),wy=x+y+1;const p=nav.closest(wx,wy),c=nav.cellOf(p.x,p.y);assert(b.has(`${c.x},${c.y}`),`Disconnected ${x},${y}`);}
for(const n of after.npcs || []) assert(nav.findPoly(n.x,n.y)>0,`NPC in obstacle: ${n.id}`);
console.log('PASS scenario conditions preserved; 9 route anchors connected; NPC positions walkable; sprites exist;',a.size,b.size,'reachable cells');
