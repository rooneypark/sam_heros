// Motion checker page (web/motion.html): the motion viewer on its own — engine data (sprites, clips, tables) and the
// 삼국 pack (units, art, table overrides) are loaded, nothing is simulated.
import { G } from '../game/registry.js';
import { bootEngine } from '../boot.js';
import { units as originalUnits } from '../packs/original.js';
import { loadSamgukUnits, loadSamgukOverrides } from '../packs/samguk.js';
import { createMotionView } from './motion.js';
import { installReviewControls } from '../packs/reviewMode.js';

async function main() {
  installReviewControls();
  const status = document.getElementById('status');
  const stage = document.getElementById('boot');           // the engine canvas doubles as the effect stage
  const { renderer } = await bootEngine(stage, { hud: false });
  await loadSamgukOverrides();
  const UNITS = [...await loadSamgukUnits(G.assets)];
  const unitDef = key => UNITS.find(u => u.key === key);
  const view = createMotionView({ root: document.getElementById('motionView'), units: () => UNITS, unitDef, stage, renderer });
  view.show(true);
  // ?units=SG_U0003,Unit000006 adds units on open
  const requested = new URLSearchParams(location.search).get('units');
  const selected = requested === null ? UNITS.filter(u => u.source === 'samguk').map(u => u.key)
    : requested.split(',').filter(Boolean);
  for (const k of selected) view.add(k);
  status.textContent = `유닛 ${UNITS.length}종 · 삼국 ${UNITS.filter(u => u.source === 'samguk').length}종`;
  window.__G = G;
}

main().catch(e => { document.getElementById('status').textContent = '오류: ' + e.message; console.error(e); });
