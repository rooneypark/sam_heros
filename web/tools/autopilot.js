// Debug autopilot (browser console / test harness): plays the main quest chain with the real game rules.
// Usage: const ap = await import('/web/tools/autopilot.js'); await ap.play(60)  // seconds of wall time
export async function play(maxSec = 60, log = []) {
  const G = window.__G;
  const { Timing } = await import('/web/src/game/core/Timing.js');
  // MessageChannel yield: not throttled like setTimeout when the page is in the background
  const mc = new MessageChannel(); let wake = null; mc.port1.onmessage = () => wake?.();
  const tick = () => new Promise(r => { wake = r; mc.port2.postMessage(0); });
  const run = async sec => { for (let t = 0; t < sec; t += 0.05) { G.sim(0.05); await tick(); } };
  const hm = () => G.HeroManager.transform.position;
  const dist = p => Math.hypot(p[0] - hm()[0], p[1] - hm()[1]);
  const tilePos = t => G.MapManager.cellCenter(t.x, t.y);
  const end = performance.now() + maxSec * 1000;
  let lastKey = null, stuck = 0, wipedAt = null, growLog = null;
  // the wipe happens inside a synchronous goto: note it when the defeat flow starts
  const corDefeat = G.Flow.__origDefeat || (G.Flow.__origDefeat = G.Flow.corDefeat);
  G.Flow.corDefeat = function () { wipedAt = Timing.time; log.push('wiped'); return corDefeat.apply(this, arguments); };
  const id = window.__apId = (window.__apId || 0) + 1;   // a newer play() call stops this one
  while (performance.now() < end && window.__apId === id) {
    if (!G.Quest.current) { log.push('no quest'); break; }
    const dlg = G.UI.popups.find(p => p.kind === 'dialog');
    if (dlg) { dlg.closeLock = false; dlg.onClick?.(null); await run(3); continue; }
    await upkeep();
    if (G.Quest.IsComplete()) { const k = G.Quest.current.key; G.Quest.CompleteQuest(); log.push(`done ${k} gold=${G.Inventory.count('GOLD')} lv=${G.UserData.Level + 1}`); await run(1.1); continue; }
    const d = G.Quest.data;
    if (d.key !== lastKey) { lastKey = d.key; stuck = 0; log.push(`quest ${d.key} ${d.questType} ${d.questKey} x${d.questValue}`); }
    if (G.HeroManager.GetHeroCount() === 0) { await run(5); continue; }
    // after a wipe, grow first (training stone / pub gold) for a while instead of walking back into the boss
    if (d.questType === 'MONSTER' && wipedAt !== null && Timing.time - wipedAt < 240) {
      const tr = G.Training.row(G.Training.level);
      const need = tr && G.Training.canUpgrade() === 'res' ? tr.needResource.find((k, i) => G.Inventory.count(k) < tr.needValue[i]) : 'GOLD';
      if (!growLog || growLog !== need) { growLog = need; log.push('grow: gather ' + need); }
      await gather(need); continue;
    }
    if (d.questType === 'MONSTER') {
      const m = G.UnitManager.monsters.filter(u => u.Key === d.questKey && !u.IsDead() && !G.Fog.blocks(...u.transform.position)).sort((a, b) => dist(a.transform.position) - dist(b.transform.position))[0];
      if (m) {
        const mp = [...m.transform.position], before = dist(mp);
        G.goto(mp[0], mp[1], 8, 1.5); await run(2);
        if (!m.IsDead() && Math.abs(dist(mp) - before) < 0.5 && dist(mp) > 4) await unblock(mp);
        continue;
      }
      // all targets hidden in fog: purify the (visible) fog building covering one of them
      const fogged = G.UnitManager.monsters.filter(u => u.Key === d.questKey && !u.IsDead());
      if (fogged.length) {
        const cells = new Set(fogged.map(u => { const c = G.MapManager.worldToCell(...u.transform.position); return `${c.x},${c.y}`; }));
        const fb = G.Buildings.list.filter(b => !b.done && G.Buildings.visible(b) && b.tiles.some(t => cells.has(`${t.x},${t.y}`)))
          .sort((a, b) => dist(a.pos) - dist(b.pos))[0];
        if (fb && await buildSite(fb)) continue;
      }
      const sp = G.MapManager.spawners.filter(s => s.SpawnerDatas.some(x => x.key === d.questKey)).sort((a, b) => dist(tilePos(a.IncludeTiles[0])) - dist(tilePos(b.IncludeTiles[0])))[0];
      if (!sp) { log.push('no spawner for ' + d.questKey); break; }
      const p = tilePos(sp.IncludeTiles[0]);
      // target inside fog: purify the fog building that covers the spawner tile first
      if (G.Fog.blocks(p[0], p[1])) {
        const t0 = sp.IncludeTiles[0];
        const fb = G.Buildings.list.find(b => !b.done && b.tiles.some(t => t.x === t0.x && t.y === t0.y));
        if (fb && await buildSite(fb)) continue;
      }
      const before = dist(p);
      G.goto(p[0], p[1], 15, 2); await run(1);
      if (Math.abs(dist(p) - before) < 0.5 && dist(p) > 3) {
        if (await unblock(p)) continue;
        stuck++; if (stuck > 5) { log.push(`stuck ${d.questKey} at ${hm().map(v => v.toFixed(0))} -> ${p.map(v => v.toFixed(0))}`); break; } }
      continue;
    }
    if (d.questType === 'BUILD') {
      const b = G.Buildings.list.find(x => x.key === d.questKey);
      if (!b) { log.push('no building ' + d.questKey); break; }
      const needs = (b.data.needResources || []).map((k, i) => [k, b.data.needAmount[i]]).filter(([k, n]) => G.Inventory.count(k) < n);
      if (!needs.length && G.Buildings.canInteract(b)) { G.goto(b.pos[0], b.pos[1] - 1.5, 30, 2); G.Buildings.interact(b); await run(2); continue; }
      if (needs.length) { await gather(needs[0][0]); continue; }
      log.push(`cannot build ${d.questKey} rLv=${b.data.rLv} lv=${G.UserData.Level}`); break;
    }
    if (d.questType === 'RESOURCE') { await gather(d.questKey); continue; }
    log.push('unsupported ' + d.questType); break;
  }
  return log;

  /** growth like a player: build pub/training when affordable, hire with gold, level heroes, train */
  async function upkeep() {
    for (const key of ['WorldBuilding014000', 'WorldBuilding010000']) {
      const b = G.Buildings.list.find(x => x.key === key);
      if (b && !b.done && G.Buildings.visible(b) && G.Buildings.canInteract(b)) {
        G.Buildings.interact(b); log.push('built ' + key); await run(1);
      }
    }
    // teleport portals (category 9) the party walks past
    for (const b of G.Buildings.list) {
      if (b.done || b.data.category !== 9 || !G.Buildings.visible(b) || dist(b.pos) > 12 || !G.Buildings.canInteract(b)) continue;
      G.Buildings.interact(b); log.push('built portal ' + b.key); await run(1);
    }
    if (G.Buildings.built.has('WorldBuilding014000')) {
      G.Pub.ensure();
      const c = G.Pub.cost();
      if (c.type === 'GOLD' && G.Inventory.count('GOLD') >= c.amount + 50) { const i = G.Pub.Purchase(); if (i !== null) log.push('hired ' + G.Pub.lineup[i].key + ' x' + G.Pub.lineup[i].count); }
    }
    for (const d of G.UserHero.datas.values()) while (G.UserHero.CanLevelUp(d.key) === 'ok') { G.UserHero.LevelUp(d.key); log.push(`lvup ${d.key} -> ${d.lv + 1}`); }
    if (G.Buildings.built.has('WorldBuilding010000')) while (G.Training.canUpgrade() === 'ok') { G.Training.Upgrade(); log.push('train ' + G.Training.level); }
  }
  /** first fogged point on the navmesh route to p, or null */
  function fogOnRoute(p) {
    const c = G.HeroManager.heroCenterPos;
    const path = [{ x: c[0], y: c[1] }, ...(G.MapManager.navmesh.path(c[0], c[1], p[0], p[1]) || [{ x: p[0], y: p[1] }])];
    for (let i = 0; i + 1 < path.length; i++) {
      for (let s = 0; s <= 1; s += 0.1) {
        const x = path[i].x + (path[i + 1].x - path[i].x) * s, y = path[i].y + (path[i + 1].y - path[i].y) * s;
        if (G.Fog.blocks(x, y)) return [x, y];
      }
    }
    return null;
  }
  /** the route to p crosses fog: purify the fog building on the first fogged waypoint */
  async function unblock(p) {
    const q = fogOnRoute(p);
    if (!q) return false;
    const cell = G.MapManager.worldToCell(q[0], q[1]);
    const fb = G.Buildings.list.filter(b => !b.done && G.Buildings.visible(b) && /^WorldBuilding099/.test(b.key) && b.tiles.some(t => Math.abs(t.x - cell.x) <= 2 && Math.abs(t.y - cell.y) <= 2))
      .sort((a, b) => dist(a.pos) - dist(b.pos))[0];
    return fb ? await buildSite(fb) : false;
  }
  async function buildSite(b) {
    if (!G.Buildings.visible(b)) {
      // purify the prerequisite (prevBuilding) chain first
      const prev = G.Buildings.list.find(x => x.key === b.data.prevBuilding && !x.done);
      if (prev && prev !== b) return buildSite(prev);
      log.push('fog building hidden ' + b.key); return false;
    }
    const needs = (b.data.needResources || []).map((k, i) => [k, b.data.needAmount[i]]).filter(([k, n]) => G.Inventory.count(k) < n);
    if (needs.length) { await gather(needs[0][0]); return true; }
    if (!G.Buildings.canInteract(b)) { log.push('cannot purify ' + b.key); return false; }
    G.goto(b.pos[0], b.pos[1] - 1.5, 30, 2); G.Buildings.interact(b); log.push('purified ' + b.key); await run(2);
    return true;
  }
  async function gather(type) {
    if (type === 'MEAT' || /^Item/.test(type)) {
      const m = G.UnitManager.monsters.filter(u => !u.IsDead() && u.Level < 30).sort((a, b) => dist(a.transform.position) - dist(b.transform.position))
        .slice(0, 20).find(u => !fogOnRoute(u.transform.position));
      if (m) { G.goto(m.transform.position[0], m.transform.position[1], 8, 1.5); await run(2); } else await run(2);
      return;
    }
    const rt = { TREE: 1, STONE: 2, GOLD: 4 }[type];
    const r = G.Resources.actors().filter(a => !a.IsDead() && a.ResourceType === rt).sort((a, b) => dist(a.transform.position) - dist(b.transform.position))
      .slice(0, 30).find(a => !fogOnRoute(a.transform.position));
    if (r) { G.goto(r.transform.position[0], r.transform.position[1], 10, 1.8); await run(3); }
    else {
      const sp = G.MapManager.resourceSpawners.filter(s => s.SpawnerDatas.some(x => x.key === type)).sort((a, b) => dist(tilePos(a.IncludeTiles[0])) - dist(tilePos(b.IncludeTiles[0])))[0];
      if (sp) { const p = tilePos(sp.IncludeTiles[0]); G.goto(p[0], p[1], 15, 2); }
      await run(1);
    }
  }
}
