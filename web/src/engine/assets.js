// Asset access over the extracted data in /re/extract (served from the project root).

export const ROOT = '/re/extract';

const jsonCache = new Map();
export async function loadJSON(path) {
  if (!jsonCache.has(path)) {
    jsonCache.set(path, fetch(`${ROOT}/${path}`).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    }));
  }
  return jsonCache.get(path);
}

export async function loadText(path) {
  const r = await fetch(`${ROOT}/${path}`);
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.text();
}

export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.textures = new Map();   // file -> Promise<tex>
    this.texReady = new Map();   // file -> tex
    this.sprites = null;         // name -> meta
    this.anims = null;
    this.tiles = null;
    this.tables = new Map();
  }

  async init() {
    [this.sprites, this.anims, this.tiles] = await Promise.all([
      loadJSON('media/sprites.json'), loadJSON('media/anims.json'), loadJSON('tiles.json'),
    ]);
  }

  async table(name) {
    if (!this.tables.has(name)) this.tables.set(name, (await loadJSON(`tables/${name}.json`)).rows);
    return this.tables.get(name);
  }

  texture(file) {
    if (!this.textures.has(file)) {
      const p = new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => { const t = this.renderer.createTexture(img); this.texReady.set(file, t); res(t); };
        img.onerror = () => rej(new Error('texture ' + file));
        // atlas textures by file name; content-pack images by absolute URL ("/samguk/art/...")
        img.src = file.startsWith('/') ? encodeURI(file) : `${ROOT}/media/textures/${encodeURIComponent(file)}`;
      });
      this.textures.set(file, p);
    }
    return this.textures.get(file);
  }

  /** Resolved sprite: {tex, u0,v0,u1,v1, w,h (units), px,py} or null while its texture loads. */
  sprite(name) {
    const m = this.sprites[name];
    if (!m || !m.tex) return null;
    if (m._r) return m._r;
    const tex = this.texReady.get(m.tex);
    if (!tex) { this.texture(m.tex); return null; }
    const [rx, ry, rw, rh] = m.rect;
    // Unity rects are bottom-left origin; PNGs are top-left
    const u0 = rx / tex.w, u1 = (rx + rw) / tex.w;
    const v0 = (tex.h - (ry + rh)) / tex.h, v1 = (tex.h - ry) / tex.h;
    const ppu = m.ppu || 100;
    // Tight-packed sprites: textureRect excludes transparent border; offset shifts it inside the full rect.
    const fullW = m.size[0], fullH = m.size[1];
    const px = (m.pivot[0] * fullW - m.offset[0]) / rw;
    const py = (m.pivot[1] * fullH - m.offset[1]) / rh;
    let mesh = null;
    if (m.tight && m.verts && m.tris) {
      // vertex (units, relative to pivot) -> pixel inside the trimmed rect -> packing rotation -> atlas UV
      const n = m.verts.length / 2;
      const pos = new Float32Array(m.verts);
      const uv = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) {
        let lx = m.verts[k * 2] * ppu + m.pivot[0] * fullW - m.offset[0];
        let ly = m.verts[k * 2 + 1] * ppu + m.pivot[1] * fullH - m.offset[1];
        if (m.rot === 1 || m.rot === 3) lx = rw - lx;          // FlipHorizontal / Rotate180
        if (m.rot === 2 || m.rot === 3) ly = rh - ly;          // FlipVertical / Rotate180
        if (m.rot === 4) { const t = lx; lx = ly; ly = rw - t; } // Rotate90
        uv[k * 2] = (rx + lx) / tex.w;
        uv[k * 2 + 1] = (tex.h - (ry + ly)) / tex.h;
      }
      mesh = { n, pos, uv, tris: m.tris };
    }
    m._r = { tex, u0, v0, u1, v1, w: rw / ppu, h: rh / ppu, px, py, mesh, ppu };
    return m._r;
  }

  async preloadSprites(names) {
    const files = new Set();
    for (const n of names) { const m = this.sprites[n]; if (m && m.tex) files.add(m.tex); }
    await Promise.all([...files].map(f => this.texture(f)));
  }
}
