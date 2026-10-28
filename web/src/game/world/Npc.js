// NPCActor (prefab/actor/npc/*) with NavMeshAgent movement and Idle/Move animation.
import { G } from '../registry.js';
import { loadJSON } from '../../engine/assets.js';
import { loadPrefab, instantiate, spriteNamesInTree } from '../../engine/prefab.js';
import { Animator, drawTree } from '../../engine/components.js';
import { NavMeshAgent } from '../../engine/navmesh.js';
import { Tables } from '../data/Tables.js';

export function drawPackResident(renderer, row, x, y, time = 0, moving = false, flip = false, restingState = 'Idle') {
  const art = row?.npcArt;
  const state = moving ? 'Move' : (art?.frames[restingState]?.length ? restingState : 'Idle');
  const frames = art?.frames[state] || art?.frames.Idle;
  if (!frames?.length) return;
  const ms = art.motion[state]?.ms || frames.map(() => 150);
  let t = time * 1000 % ms.reduce((a,b) => a+b,0), i = 0;
  while (i < ms.length - 1 && t >= ms[i]) t -= ms[i++];
  const sp = G.assets.sprite(frames[i % frames.length]);
  if (sp) renderer.draw({sp,x,y,sx:flip?-1:1,sy:1,r:1,g:1,b:1,a:1,layer:0,order:0,sortY:y});
}

export class Npcs {
  constructor() { this.list = []; }
  async spawn(name, x, y, restingState = 'Idle') {
    const row = Tables.unit(name), pack = row?.npcArt ? row : null;
    if (pack) await pack.artReady;
    const idx = await loadJSON('prefab_index.json');
    const path = idx[pack ? 'npc_1' : name.toLowerCase()];
    if (!path) return null;
    const json = await loadPrefab(path);
    const go = instantiate(json, G.assets);
    await G.assets.preloadSprites(spriteNamesInTree(json));
    const names = new Set();
    for (const a of go.getInChildren(Animator)) for (const st of Object.values(a.controller?.states || {})) {
      for (const tr of G.assets.anims[st.clip]?.sprites || []) for (const [, n] of tr.frames) if (typeof n === 'string') names.add(n);
    }
    await G.assets.preloadSprites(names);
    const ad = (go.builtins || []).find(c => c.type === 'NavMeshAgent') || { m_Speed: 3.5 };
    const agent = new NavMeshAgent(go.transform, ad);
    agent.nav = G.MapManager.navmesh;
    agent.warp(x, y);
    agent.isStopped = true;
    const npc = { go, agent, anims: go.getInChildren(Animator), pack, elapsed:0, moving:false, flip:false, restingState };
    this.list.push(npc);
    return npc;
  }
  despawn(n) { const i = this.list.indexOf(n); if (i >= 0) this.list.splice(i, 1); }
  update(dt) {
    for (const n of this.list) {
      const before = n.go.transform.position;
      n.agent.update(dt, null);
      const after = n.go.transform.position;
      const moving = Math.hypot(after[0] - before[0], after[1] - before[1]) > 1e-4;
      n.elapsed += dt; n.moving = moving;
      if (moving) n.flip = after[0] > before[0];
      for (const a of n.anims) {
        if (a.hasState('Move')) a.setFloat('Move', moving ? 1 : 0);
        a.update(dt);
      }
      if (moving && Math.abs(after[0] - before[0]) > 1e-4) {
        const body = n.anims[0]?.go; if (body) body.transform.ls[0] = Math.abs(body.transform.ls[0]) * (after[0] < before[0] ? 1 : -1);
      }
    }
  }
  draw(renderer, view) { for (const n of this.list) {
    if (n.pack) { const p=n.go.transform.position; drawPackResident(renderer,n.pack,p[0],p[1],n.elapsed,n.moving,n.flip,n.restingState); }
    else drawTree(renderer, G.assets, n.go, view);
  } }
}
