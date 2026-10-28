// Editable UI resources for the samguk pack. The original /re/extract data is never rewritten.
import { G } from '../game/registry.js';
const ROOT = '/samguk/art/ui/';

export async function loadUiDesign(assets) {
  if (assets.uiDesignReady) return assets.uiDesignReady;
  assets.uiDesignReady = (async () => {
    const response = await fetch(ROOT + 'manifest.json');
    if (!response.ok) throw new Error(`UI design manifest: ${response.status}`);
    const manifest = await response.json();
    const spriteNames = [];
    for (const [name, spec] of Object.entries(manifest.sprites || {})) {
      assets.sprites[name] = {
        ...spec.meta, tex: ROOT + spec.file, rect: [0,0,spec.width,spec.height],
      };
      spriteNames.push(name);
    }
    G.uiDesign = {
      gameplay: manifest.gameplay || {},
      prefabs: Object.fromEntries(Object.entries(manifest.prefabs || {}).map(([key, file]) => [key, ROOT + file])),
    };
    if (G.UI?.joy && manifest.gameplay?.joystick?.radius) G.UI.joy.radius = manifest.gameplay.joystick.radius;
    await assets.preloadSprites(spriteNames);
    return manifest;
  })();
  return assets.uiDesignReady;
}

export function barColor(key, fallback) {
  const c = G.Chapter ? G.uiDesign?.gameplay?.bars?.[key] || fallback : fallback;
  return { r:c[0], g:c[1], b:c[2] };
}

export function barSize(key, fallback) {
  return G.Chapter ? G.uiDesign?.gameplay?.bars?.[key] ?? fallback : fallback;
}
