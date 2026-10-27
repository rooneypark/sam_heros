// Instantiate exported prefab JSON (re/extract/prefabs/**) into the scene graph.
// Built-in components become engine components; MonoBehaviours are kept as {script, fields} on go.scripts
// so game classes can bind to them (go.script('UnitActor')).
import { GameObject } from './scene.js';
import { SpriteRenderer, SortingGroup, Animator } from './components.js';
import { loadJSON } from './assets.js';
import { ParticleSystem, registerPS } from './particles.js';

let controllers = null;
export async function initPrefabs() { controllers = await loadJSON('media/controllers.json'); }

export function controllerByRef(ref) {
  if (!ref || !ref.ref) return null;
  const c = controllers[ref.ref];
  if (!c) return null;
  if (c.type === 'AnimatorOverrideController') {
    const base = controllers[c.base];
    return base ? { ...base, overridesFromAsset: c.overrides } : null;
  }
  return c;
}

const prefabCache = new Map();
export function loadPrefab(path) {
  if (!prefabCache.has(path)) prefabCache.set(path, loadJSON(`prefabs/${path}.json`));
  return prefabCache.get(path);
}

export function instantiate(json, assets, parent = null) {
  const nodes = new Map();
  const build = (n, par) => {
    const go = new GameObject(n.name);
    go.activeSelf = n.active !== false;
    go.layer = n.layer || 0;
    go.scripts = [];
    nodes.set(n.id, go);
    if (par) go.transform.setParent(par.transform);
    const tf = n.tf;
    if (tf) {
      go.transform.lp = [...tf.p]; go.transform.lr = [...tf.r]; go.transform.ls = [...tf.s];
      if (tf.type === 'RectTransform') go.transform.rect = { aMin: tf.aMin, aMax: tf.aMax, aPos: tf.aPos, size: tf.size, pivot: tf.pivot };
    }
    for (const c of n.comps || []) {
      switch (c.type) {
        case 'SpriteRenderer':
          go.add(new SpriteRenderer({
            sprite: c.m_Sprite?.sprite || null,
            color: c.m_Color, flipX: c.m_FlipX, flipY: c.m_FlipY,
            layer: sortingLayerIndex(c.m_SortingLayer), order: c.m_SortingOrder, enabled: c.m_Enabled !== false && c.m_Enabled !== 0,
          })).materials = c.materials || [];
          break;
        case 'SortingGroup':
          go.add(new SortingGroup({ layer: sortingLayerIndex(c.m_SortingLayer), order: c.m_SortingOrder, enabled: !!c.m_Enabled }));
          break;
        case 'Animator': {
          const ctrl = controllerByRef(c.m_Controller);
          go.pendingAnimator = ctrl;
          break;
        }
        case 'ParticleSystem': go.pendingPS = c; break;
        case 'ParticleSystemRenderer': go.pendingPSR = c; break;
        case 'MB':
          go.scripts.push({ script: c.script, f: c.f || {}, enabled: c.enabled !== 0 });
          break;
        default:
          (go.builtins ||= []).push(c);
      }
    }
    for (const ch of n.children || []) build(ch, go);
    return go;
  };
  const root = build(json, parent);
  // Animators are created after the hierarchy exists (binding paths need children)
  for (const go of nodes.values()) {
    if (go.pendingAnimator !== undefined) {
      const a = new Animator(assets, go.pendingAnimator);
      if (go.pendingAnimator?.overridesFromAsset) Object.assign(a.overrides, go.pendingAnimator.overridesFromAsset);
      go.add(a);
      delete go.pendingAnimator;
    }
    if (go.pendingPS) {
      const ps = new ParticleSystem(go.pendingPS, go.pendingPSR);
      ps.go = go;
      ps.layer = sortingLayerIndex(go.pendingPSR?.m_SortingLayer); ps.order = go.pendingPSR?.m_SortingOrder || 0;
      ps.rendererEnabled = go.pendingPSR ? go.pendingPSR.m_Enabled !== false && go.pendingPSR.m_Enabled !== 0 : false;
      go.ps = ps; registerPS(ps, assets);
      delete go.pendingPS; delete go.pendingPSR;
    }
  }
  root.nodeById = nodes;
  root.script = name => findScript(root, name);
  return root;
}

export function findScript(go, name) {
  for (const g of go.walk()) {
    const s = (g.scripts || []).find(x => x.script === name || x.script.endsWith('.' + name));
    if (s) return { go: g, ...s };
  }
  return null;
}

// Sorting layers: Default(0)=0, BULLET(1), FX(2) by m_SortingLayer index in TagManager order
function sortingLayerIndex(v) { return v || 0; }

export function spriteNamesInTree(json) {
  const out = new Set();
  const walk = n => {
    for (const c of n.comps || []) if (c.type === 'SpriteRenderer' && c.m_Sprite?.sprite) out.add(c.m_Sprite.sprite);
    for (const ch of n.children || []) walk(ch);
  };
  walk(json);
  return out;
}
