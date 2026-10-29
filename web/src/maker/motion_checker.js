// Motion checker page (web/motion.html): the motion viewer on its own — engine data (sprites, clips, tables) and the
// 삼국 pack (units, art, table overrides) are loaded, nothing is simulated.
import { G } from '../game/registry.js';
import { bootEngine } from '../boot.js';
import { units as originalUnits } from '../packs/original.js';
import { loadSamgukUnits, loadSamgukOverrides, loadSamgukTiles } from '../packs/samguk.js';
import { createMotionView } from './motion.js';
import { installReviewControls } from '../packs/reviewMode.js';

async function main() {
  installReviewControls();
  const status = document.getElementById('status');
  const stage = document.getElementById('boot');           // the engine canvas doubles as the effect stage
  const { renderer } = await bootEngine(stage, { hud: false });
  await loadSamgukOverrides();
  const UNITS = [...originalUnits(G.assets), ...await loadSamgukUnits(G.assets)];
  await loadSamgukTiles(G.assets);
  const unitDef = key => UNITS.find(u => u.key === key);
  const view = createMotionView({ root: document.getElementById('motionView'), units: () => UNITS, unitDef, stage, renderer });
  view.show(true);
  // ?units=SG_U0003,Unit000006 adds units on open
  const requested = new URLSearchParams(location.search).get('units');
  const selected = requested === null ? UNITS.filter(u => u.source === 'samguk').map(u => u.key)
    : requested.split(',').filter(Boolean);
  for (const k of selected) view.add(k);
  // Optional static art reference uses exactly the viewer's scale and foot anchor.
  const reference = new URLSearchParams(location.search).get('reference');
  if (reference) {
    const style = document.createElement('style');
    style.textContent = '#mvGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}#mvGrid .mv-cell{width:auto;min-width:0}#mvGrid .mv-cell canvas{width:100%;height:auto}';
    document.head.appendChild(style);
    const response = await fetch('/samguk/content/samguk/units.json', { cache: 'no-store' });
    const def = (await response.json()).units.find(u => u.id === reference);
    if (def?.art?.icon) {
      const card = document.createElement('div'); card.className = 'mv-cell';
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 220;
      const label = document.createElement('div'); label.className = 'mv-name'; label.textContent = `${def.name} · 승인 원화 (정지)`;
      card.append(canvas, label); document.getElementById('mvGrid').prepend(card);
      const img = new Image(); img.onload = () => {
        const ctx = canvas.getContext('2d'); const y = 220 * .78;
        ctx.strokeStyle = '#5ac8ff'; ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(212, y); ctx.stroke();
        ctx.drawImage(img, 110 - 175 * .62, y - 245 * .62, 350 * .62, 350 * .62);
      }; img.src = '/samguk/' + def.art.icon;
    }
  }
  if (new URLSearchParams(location.search).get('test') === 'gather') view.testGather();
  status.textContent = `유닛 ${UNITS.length}종 · 삼국 ${UNITS.filter(u => u.source === 'samguk').length}종`;
  window.__G = G;
}

main().catch(e => { document.getElementById('status').textContent = '오류: ' + e.message; console.error(e); });
