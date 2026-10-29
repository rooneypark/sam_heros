// WebGL2 sprite batcher with Unity-like sorting (sorting layer -> order -> transparency sort axis Y).
// World space is Unity units; camera is orthographic (size = half of vertical extent).
// Sprites are quads, or triangle meshes for tight-packed atlas sprites.

const VS = `#version 300 es
in vec2 aPos; in vec2 aUV; in vec4 aColor; in float aMode; in vec4 aHit;
uniform mat3 uView;
out vec2 vUV; out vec4 vColor; flat out int vMode; out vec4 vHit;
void main(){ vec3 p = uView * vec3(aPos, 1.0); gl_Position = vec4(p.xy, 0.0, 1.0); vUV = aUV; vColor = aColor; vMode = int(aMode); vHit = aHit; }`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUV; in vec4 vColor; flat in int vMode; in vec4 vHit; uniform sampler2D uTex;
out vec4 o;
void main(){
  vec4 t = texture(uTex, vUV);                       // premultiplied texture
  if (vMode == 7) { o = vec4(t.rgb * vColor.rgb * vColor.a, 0.0); }   // additive (premultiplied, alpha 0)
  else if (vMode == 1) { o = vec4(vColor.rgb * t.a, t.a) * vColor.a; }       // solid tint (hit flash / silhouette)
  else if (vMode >= 4) {                               // TMP SDF: vHit = (outlineW, weight, gradientScale, texWidth)
    float sdf = t.a;
    float tpp = max(fwidth(vUV.x * vHit.w), 1e-4);
    float ppa = 2.0 * vHit.z / tpp;                    // screen pixels per SDF alpha unit
    float dist = (sdf - (0.5 - vHit.y)) * ppa;
    float ol = vHit.x * ppa;
    float face = clamp(dist - ol * 0.5 + 0.5, 0.0, 1.0);
    float outer = clamp(dist + ol * 0.5 + 0.5, 0.0, 1.0);
    vec3 oc = vMode == 5 ? vec3(1.0) : vec3(0.0);
    vec3 col = mix(oc, vColor.rgb, face);
    if (vMode == 6) col = vColor.rgb;
    o = vec4(col, 1.0) * outer * vColor.a;
  }
  else if (vMode == 3) { float d = length(vUV * 2.0 - 1.0); float k = 1.0 - smoothstep(0.55, 1.0, d); o = vec4(vColor.rgb, 1.0) * vColor.a * k; }
  else { vec3 c = t.rgb * vColor.rgb; c = mix(c, vHit.rgb * t.a, vHit.a); o = vec4(c, t.a) * vColor.a; }   // _HitEffectBlend
}`;

const MAX_VERTS = 65536 * 2;
const FPV = 13; // x y u v r g b a mode hr hg hb hblend

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: false, antialias: false });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.prog = this._program(VS, FS);
    this.uView = gl.getUniformLocation(this.prog, 'uView');
    this.vbuf = gl.createBuffer();
    this.ibuf = gl.createBuffer();
    this.verts = new Float32Array(MAX_VERTS * FPV);
    this.idx = new Uint32Array(MAX_VERTS * 3);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.verts.byteLength, gl.DYNAMIC_DRAW);
    const stride = FPV * 4;
    const loc = n => gl.getAttribLocation(this.prog, n);
    gl.enableVertexAttribArray(loc('aPos')); gl.vertexAttribPointer(loc('aPos'), 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc('aUV')); gl.vertexAttribPointer(loc('aUV'), 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(loc('aColor')); gl.vertexAttribPointer(loc('aColor'), 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(loc('aMode')); gl.vertexAttribPointer(loc('aMode'), 1, gl.FLOAT, false, stride, 32);
    gl.enableVertexAttribArray(loc('aHit')); gl.vertexAttribPointer(loc('aHit'), 4, gl.FLOAT, false, stride, 36);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.idx.byteLength, gl.DYNAMIC_DRAW);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.white = this._solidTexture([255, 255, 255, 255]);
    this.items = [];
    this.seq = 0;
    this.stats = { draws: 0, quads: 0 };
  }

  _program(vs, fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  _solidTexture(rgba) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    return { gl: t, w: 1, h: 1 };
  }

  createTexture(img) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { gl: t, w: img.width, h: img.height };
  }

  resize(w, h, dpr = 1) {
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  begin() { this.items.length = 0; this.seq = 0; }

  /**
   * Queue a sprite. it: {sp (resolved sprite), x,y, sx,sy, rot, r,g,b,a, mode, layer, order, sortY}
   * or a raw quad: {tex, u0,v0,u1,v1, w,h, px,py, ...}
   */
  draw(it) { it.seq = this.seq++; this.items.push(it); }

  flush(view) {
    const gl = this.gl;
    const items = this.items;
    items.sort((a, b) => ((a.layer || 0) - (b.layer || 0)) || ((a.order || 0) - (b.order || 0)) || ((b.sortY || 0) - (a.sortY || 0)) || ((a.sub || 0) - (b.sub || 0)) || (a.seq - b.seq));
    gl.useProgram(this.prog);
    gl.uniformMatrix3fv(this.uView, false, view);
    gl.bindVertexArray(this.vao);
    let nv = 0, ni = 0, curTex = null;
    this.stats.draws = 0; this.stats.quads = items.length;
    const V = this.verts, I = this.idx;
    const emit = () => {
      if (!ni) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, V.subarray(0, nv * FPV));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibuf);
      gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, I.subarray(0, ni));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, curTex.gl);
      gl.drawElements(gl.TRIANGLES, ni, gl.UNSIGNED_INT, 0);
      this.stats.draws++;
      nv = 0; ni = 0;
    };
    for (const it of items) {
      const sp = it.sp;
      const tex = (sp ? sp.tex : it.tex) || this.white;
      const mesh = sp && sp.mesh;
      const vcount = mesh ? mesh.n : 4;
      if ((tex !== curTex && ni) || nv + vcount > MAX_VERTS) emit();
      curTex = tex;
      const sx = it.sx ?? 1, sy = it.sy ?? 1;
      const rot = it.rot || 0;
      const c = Math.cos(rot), s = Math.sin(rot);
      const r = it.r ?? 1, g = it.g ?? 1, b = it.b ?? 1, a = it.a ?? 1, mode = it.mode || 0;
      const hit = it.hit, hr = hit ? hit[0] : 0, hg = hit ? hit[1] : 0, hb = hit ? hit[2] : 0, hk = hit ? hit[3] : 0;
      const x = it.x, y = it.y;
      const base = nv;
      let o = nv * FPV;
      const put = (lx, ly, u, vv) => {
        lx *= sx; ly *= sy;
        V[o++] = x + lx * c - ly * s; V[o++] = y + lx * s + ly * c;
        V[o++] = u; V[o++] = vv; V[o++] = r; V[o++] = g; V[o++] = b; V[o++] = a; V[o++] = mode;
        V[o++] = hr; V[o++] = hg; V[o++] = hb; V[o++] = hk;
      };
      if (mesh) {
        const pv = mesh.pos, uv = mesh.uv;
        for (let k = 0; k < mesh.n; k++) put(pv[k * 2], pv[k * 2 + 1], uv[k * 2], uv[k * 2 + 1]);
        for (const t of mesh.tris) I[ni++] = base + t;
      } else {
        const q = sp || it;
        const w = q.w, h = q.h;
        const x0 = -q.px * w, y0 = -q.py * h, x1 = x0 + w, y1 = y0 + h;
        put(x0, y0, q.u0, q.v1); put(x1, y0, q.u1, q.v1); put(x1, y1, q.u1, q.v0); put(x0, y1, q.u0, q.v0);
        I[ni++] = base; I[ni++] = base + 1; I[ni++] = base + 2; I[ni++] = base; I[ni++] = base + 2; I[ni++] = base + 3;
      }
      nv += vcount;
    }
    emit();
    gl.bindVertexArray(null);
  }

  clear(r, g, b) {
    const gl = this.gl;
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

/** Orthographic view matrix (column-major mat3) for a camera at (cx,cy) with Unity ortho size. */
export function orthoView(cx, cy, size, aspect) {
  const sy = 1 / size, sx = 1 / (size * aspect);
  return new Float32Array([sx, 0, 0, 0, sy, 0, -cx * sx, -cy * sy, 1]);
}
