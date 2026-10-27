import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makePackClip, registerCustomMotion } from '../web/src/packs/customMotion.js';
import { packFrame } from '../web/src/packs/artFrames.js';
import { Animator, SpriteRenderer } from '../web/src/engine/components.js';
import { GameObject } from '../web/src/engine/scene.js';
import { makeSkill } from '../web/src/game/skill/Skill.js';
import { SKILL_TYPE } from '../web/src/game/defs.js';
import { UnitActor } from '../web/src/game/actor/UnitActor.js';
import { Timing } from '../web/src/game/core/Timing.js';
const root=fileURLToPath(new URL('../', import.meta.url));
const units=JSON.parse(fs.readFileSync(root+'content/samguk/units.json')).units.filter(u=>u.motion);
const t=Object.fromEntries(['TableUnit','TableSkill','TableSkillAction','TableRangeData'].map(n=>[n,JSON.parse(fs.readFileSync('re/extract/tables/'+n+'.json')).rows]));
const tables={t,skill:k=>t.TableSkill[k],skillAction:k=>t.TableSkillAction[k],range:k=>t.TableRangeData[k]};
const before=JSON.stringify(t),assets={anims:{}};
for(const u of units){const base=t.TableUnit[u.base],row={};registerCustomMotion(u,base,row,assets,tables);
 for(const [state,m] of Object.entries(u.motion)){
  const clip=assets.anims[row.motionClips[state]],go=new GameObject('body'),sr=go.add(new SpriteRenderer());
  const a=go.add(new Animator(assets,{states:{[state]:{clip:row.motionClips[state]}}}));let hits=0;a.listeners.push(fn=>{if(fn==='OnAttackEvent')hits++});a.play(state,0);
  for(let ms=0;ms<Math.ceil(clip.length*1000);ms++){a.update(.001);assert.ok(packFrame(sr.sprite,sr.animationClip,base.prefab,u.art.frames,null,p=>fs.existsSync(root+p)));}
  assert.equal(hits,m.hits.length,u.id+' '+state);
  if(m.loop){a.time=clip.length+.001;a.sample();assert.match(sr.sprite,/_1$/);}
 }
 for(const [slot, skill] of Object.entries(u.skills || {}))assert.equal(t.TableSkill[u.id+'_'+slot].animationKey,row.motionClips[skill.state]);
}
const old=JSON.parse(before);for(const [table,rows] of Object.entries(old))for(const [key,row] of Object.entries(rows))assert.deepEqual(t[table][key],row,'Original row mutated '+key);
let heal=0,shield=0;const owner={Team:0,IsDead:()=>false};const ally={Team:0,isUnit:true,IsDead:()=>false,Damage:v=>heal-=v,AddShield:v=>shield+=v};
makeSkill(SKILL_TYPE.HEAL,owner).OnSkill(25,{data:{}},[ally],0,0);assert.equal(heal,25);
makeSkill(SKILL_TYPE.SHIELD,owner).OnSkill(30,{data:{}},[ally],5,0);assert.equal(shield,30);
const enemy={Team:1,isUnit:true,IsDead:()=>false,Target:null,UnitData:{EliteType:0}};
makeSkill(SKILL_TYPE.TAUNT,owner).OnSkill(0,{data:{packTaunt:true}},[enemy],4,0);
assert.equal(enemy.Target,owner);assert.equal(UnitActor.prototype.IsTaunt.call(enemy),true);Timing.time+=4.01;assert.equal(UnitActor.prototype.IsTaunt.call(enemy),false);
console.log(`PASS: ${units.length} units, ${units.reduce((n,u)=>n+Object.keys(u.motion).length,0)} clips, all frame remaps, exact event counts, loop wrap, skill bindings, original table isolation, healing/shield/taunt and expiry.`);
