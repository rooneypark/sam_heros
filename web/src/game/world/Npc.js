// NPCActor (prefab/actor/npc/*) with NavMeshAgent movement and Idle/Move animation.
import { G } from '../registry.js';
import { loadJSON } from '../../engine/assets.js';
import { loadPrefab, instantiate, spriteNamesInTree } from '../../engine/prefab.js';
import { Animator, drawTree } from '../../engine/components.js';
import { NavMeshAgent } from '../../engine/navmesh.js';

export class Npcs {
  constructor() { this.list = []; }
  async spawn(name, x, y) {
    const idx = await loadJSON('prefab_index.json');
    const path = idx[name.toLowerCase()];
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
    const npc = { go, agent, anims: go.getInChildren(Animator) };
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
      for (const a of n.anims) {
        if (a.hasState('Move')) a.setFloat('Move', moving ? 1 : 0);
        a.update(dt);
      }
      if (moving && Math.abs(after[0] - before[0]) > 1e-4) {
        const body = n.anims[0]?.go; if (body) body.transform.ls[0] = Math.abs(body.transform.ls[0]) * (after[0] < before[0] ? 1 : -1);
      }
    }
  }
  draw(renderer, view) { for (const n of this.list) drawTree(renderer, G.assets, n.go, view); }
}
