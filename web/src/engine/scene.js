// Minimal Unity-like scene graph: GameObject + Transform (2D with z-rotation) + components.

export class Transform {
  constructor(go) {
    this.go = go;
    this.parent = null;
    this.children = [];
    this.lp = [0, 0, 0];         // local position
    this.lr = [0, 0, 0, 1];      // local rotation quaternion
    this.ls = [1, 1, 1];         // local scale
    this.rect = null;            // RectTransform data (UI)
  }
  setParent(p) {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = p;
    if (p) p.children.push(this);
  }
  get rotZ() { const [, , z, w] = this.lr; return 2 * Math.atan2(z, w); }
  set rotZ(a) { this.lr = [0, 0, Math.sin(a / 2), Math.cos(a / 2)]; }
  /** world 2D affine: [a b c d tx ty] mapping local (x,y) -> world */
  world() {
    const c = Math.cos(this.rotZ), s = Math.sin(this.rotZ);
    const sx = this.ls[0], sy = this.ls[1];
    const m = [c * sx, s * sx, -s * sy, c * sy, this.lp[0], this.lp[1]];
    if (!this.parent) return m;
    const p = this.parent.world();
    return [p[0] * m[0] + p[2] * m[1], p[1] * m[0] + p[3] * m[1], p[0] * m[2] + p[2] * m[3], p[1] * m[2] + p[3] * m[3],
      p[0] * m[4] + p[2] * m[5] + p[4], p[1] * m[4] + p[3] * m[5] + p[5]];
  }
  get position() { const w = this.world(); return [w[4], w[5]]; }
  set position(v) {
    if (!this.parent) { this.lp[0] = v[0]; this.lp[1] = v[1]; return; }
    const p = this.parent.world();
    const det = p[0] * p[3] - p[1] * p[2];
    const dx = v[0] - p[4], dy = v[1] - p[5];
    this.lp[0] = (p[3] * dx - p[2] * dy) / det;
    this.lp[1] = (-p[1] * dx + p[0] * dy) / det;
  }
  find(path) {
    let t = this;
    for (const part of path.split('/')) {
      if (!part) continue;
      t = t.children.find(c => c.go.name === part);
      if (!t) return null;
    }
    return t;
  }
}

export class GameObject {
  constructor(name = 'GameObject') {
    this.name = name;
    this.activeSelf = true;
    this.layer = 0;
    this.transform = new Transform(this);
    this.components = [];
  }
  get activeInHierarchy() {
    for (let t = this.transform; t; t = t.parent) if (!t.go.activeSelf) return false;
    return true;
  }
  setActive(v) { this.activeSelf = !!v; }
  add(comp) { comp.go = this; comp.transform = this.transform; this.components.push(comp); comp.awake?.(); return comp; }
  get(type) { return this.components.find(c => c instanceof type) || null; }
  getInChildren(type, includeInactive = true) {
    const out = [];
    const walk = t => {
      if (!includeInactive && !t.go.activeSelf) return;
      for (const c of t.go.components) if (c instanceof type) out.push(c);
      for (const ch of t.children) walk(ch);
    };
    walk(this.transform);
    return out;
  }
  find(path) { const t = this.transform.find(path); return t ? t.go : null; }
  *walk() {
    const st = [this.transform];
    while (st.length) { const t = st.pop(); yield t.go; for (const c of t.children) st.push(c); }
  }
}

export class Component {
  constructor() { this.go = null; this.transform = null; this.enabled = true; }
}
