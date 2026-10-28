// 1장 화면 UI (DOM 오버레이): 챕터 제목, 대화창(화자·초상·넘기기·건너뛰기), 현재 목표, 자원, 보스 HP, 월드 마커,
// 시설 창(훈련·다리·휴식), 선택창, 완료 화면, 안내 토스트 + 바닥 예고용 2D 캔버스. 원작 HUD 대신 사용한다.
const CSS = `
#c1 { position:absolute; inset:0; pointer-events:none; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#fff; overflow:hidden; }
#c1 canvas.fx { position:absolute; inset:0; width:100%; height:100%; }
#c1 .obj { position:absolute; left:2.5%; top:5.5%; max-width:68%; background:rgba(20,16,10,.72); border:1px solid #b08a4a; border-radius:8px; padding:.5em .7em; font-size:var(--fs); line-height:1.35; }
#c1 .obj .q { color:#ffd27a; font-weight:700; font-size:.85em; }
#c1 .obj .t.done::before { content:'✓ '; color:#7dff8a; }
#c1 .res { position:absolute; right:2.5%; top:5.5%; background:rgba(20,16,10,.72); border:1px solid #b08a4a; border-radius:8px; padding:.35em .6em; font-size:var(--fs); }
#c1 .res span { margin-left:.5em; }
#c1 .boss { position:absolute; left:15%; right:15%; top:13.5%; display:none; text-align:center; font-size:var(--fs); }
#c1 .boss .bar { height:.8em; background:#300; border:1px solid #f9c; border-radius:4px; overflow:hidden; margin-top:.2em; }
#c1 .boss .fill { height:100%; background:linear-gradient(#f44,#a00); width:100%; }
#c1 .toast { position:absolute; left:10%; right:10%; top:22%; text-align:center; font-size:var(--fs); }
#c1 .toast div { display:inline-block; background:rgba(0,0,0,.75); border-radius:16px; padding:.35em .9em; margin:.15em 0; animation:c1fade 2.6s forwards; }
@keyframes c1fade { 0%{opacity:0;transform:translateY(6px)} 10%{opacity:1;transform:none} 80%{opacity:1} 100%{opacity:0} }
#c1 .hint { position:absolute; left:8%; right:8%; bottom:24%; text-align:center; font-size:var(--fs); display:none; }
#c1 .hint div { display:inline-block; background:rgba(40,70,40,.85); border:1px solid #9f9; border-radius:10px; padding:.4em .8em; }
#c1 .mk { position:absolute; transform:translate(-50%,-100%); pointer-events:auto; cursor:pointer; text-align:center; font-size:calc(var(--fs)*.85); white-space:nowrap; }
#c1 .mk .b { display:inline-block; background:rgba(25,20,12,.85); border:1px solid #d8b56a; border-radius:12px; padding:.15em .55em; }
#c1 .mk.hl .b { border-color:#ffe48a; box-shadow:0 0 8px #ffd34a; animation:c1bob 1s infinite alternate; }
#c1 .mk.lock .b { border-color:#888; color:#ccc; }
#c1 .mk.check .b { border-color:#7dff8a; color:#bfffc8; }
@keyframes c1bob { from{transform:translateY(0)} to{transform:translateY(-4px)} }
#c1 .dlg { position:absolute; left:3%; right:3%; bottom:4%; min-height:17%; background:rgba(16,12,8,.92); border:2px solid #c9a35c; border-radius:12px; display:none; pointer-events:auto; font-size:var(--fs); }
#c1 .dlg .pt { position:absolute; left:3%; bottom:100%; height:150%; max-height:24vh; pointer-events:none; }
#c1 .dlg .nm { position:absolute; left:3%; top:-.9em; background:#c9a35c; color:#221; font-weight:700; padding:.1em .7em; border-radius:6px; }
#c1 .dlg .tx { padding:1.1em 1em .9em; line-height:1.5; font-size:1.05em; }
#c1 .dlg .nx { position:absolute; right:.8em; bottom:.4em; color:#ffd27a; animation:c1bob .6s infinite alternate; }
#c1 .dlg .sk { position:absolute; right:.6em; top:-2.1em; background:rgba(0,0,0,.6); border:1px solid #aaa; border-radius:8px; padding:.15em .6em; font-size:.85em; cursor:pointer; }
#c1 .dlg.narr { background:rgba(0,0,0,.82); border-color:#666; text-align:center; }
#c1 .dim { position:absolute; inset:0; background:#000; opacity:0; transition:opacity .5s; pointer-events:none; }
#c1 .title { position:absolute; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center; background:#000; pointer-events:auto; }
#c1 .title .a { font-size:calc(var(--fs)*1.4); color:#c9a35c; letter-spacing:.3em; }
#c1 .title .b { font-size:calc(var(--fs)*2.4); font-weight:800; margin-top:.2em; }
#c1 .win { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:rgba(0,0,0,.45); pointer-events:auto; font-size:var(--fs); }
#c1 .win .box { width:82%; background:#1d1710; border:2px solid #c9a35c; border-radius:12px; padding:1em; }
#c1 .win h3 { margin:0 0 .6em; color:#ffd27a; font-size:1.2em; }
#c1 .win .row { display:flex; justify-content:space-between; margin:.25em 0; }
#c1 .win .btns { display:flex; gap:.6em; margin-top:.9em; }
#c1 .win button, #c1 .done button { flex:1; font:inherit; padding:.55em; border-radius:8px; border:1px solid #c9a35c; background:#5a3d16; color:#fff; cursor:pointer; }
#c1 .win button:disabled { background:#333; color:#888; border-color:#555; cursor:default; }
#c1 .win button.sub { background:#2a2a2a; }
#c1 .win .note { color:#ffb3a0; font-size:.9em; margin-top:.4em; min-height:1.2em; }
#c1 .done { position:absolute; inset:0; display:none; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,.8); pointer-events:auto; font-size:var(--fs); text-align:center; }
#c1 .done .a { font-size:1.8em; font-weight:800; color:#ffd27a; }
#c1 .done .b { margin:.8em 1.5em 1.4em; }
#c1 .tag { position:absolute; left:2.5%; bottom:1%; font-size:calc(var(--fs)*.7); color:#ffcf6b; opacity:.8; }
`;

export class ChapterUI {
  constructor(stage) {
    this.stage = stage;
    if (!document.getElementById('c1css')) { const s = document.createElement('style'); s.id = 'c1css'; s.textContent = CSS; document.head.appendChild(s); }
    const root = this.root = document.createElement('div');
    root.id = 'c1';
    root.innerHTML = `<canvas class="fx"></canvas><div class="dim"></div><div class="marks"></div>
      <div class="obj"><div class="q"></div><div class="t"></div></div><div class="res"></div>
      <div class="boss"><div class="n"></div><div class="bar"><div class="fill"></div></div></div>
      <div class="toast"></div><div class="hint"><div></div></div>
      <div class="dlg"><img class="pt" alt=""><div class="nm"></div><div class="tx"></div><div class="nx">▼</div><div class="sk">건너뛰기 ▶▶</div></div>
      <div class="win"><div class="box"></div></div>
      <div class="done"></div><div class="title"><div class="a"></div><div class="b"></div></div><div class="tag"></div>`;
    stage.appendChild(root);
    const $ = s => root.querySelector(s);
    Object.assign(this, { cv: $('canvas.fx'), dimEl: $('.dim'), marksEl: $('.marks'), objEl: $('.obj'), resEl: $('.res'), bossEl: $('.boss'),
      toastEl: $('.toast'), hintEl: $('.hint'), dlgEl: $('.dlg'), winEl: $('.win'), doneEl: $('.done'), titleEl: $('.title'), tagEl: $('.tag') });
    this.ctx = this.cv.getContext('2d');
    this.marks = new Map();
    this.portraits = {};
    this.resize();
  }
  get busy() { return this.dlgEl.style.display === 'block' || this.winEl.style.display === 'flex' || this.doneEl.style.display === 'flex' || this.titleEl.style.display === 'flex'; }
  resize() {
    const w = this.stage.clientWidth || 400, h = this.stage.clientHeight || 860, dpr = window.devicePixelRatio || 1;
    this.w = w; this.h = h;
    this.root.style.setProperty('--fs', Math.max(11, Math.round(w / 26)) + 'px');
    this.cv.width = w * dpr; this.cv.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setTag(t) { this.tagEl.textContent = t; }

  // ------------------------------------------------------------ HUD
  objective(quest, text, done = false) {
    this.objEl.querySelector('.q').textContent = quest || '';
    const t = this.objEl.querySelector('.t');
    t.textContent = text || ''; t.classList.toggle('done', !!done);
    this.objEl.style.display = text ? 'block' : 'none';
  }
  resources(tree, stone) { this.resEl.innerHTML = `🪵<span>나무 ${tree}</span><span>⛏ 광석 ${stone}</span>`; }
  boss(name, rate) {
    if (!name) { this.bossEl.style.display = 'none'; return; }
    this.bossEl.style.display = 'block';
    this.bossEl.querySelector('.n').textContent = name;
    this.bossEl.querySelector('.fill').style.width = (Math.max(0, Math.min(1, rate)) * 100).toFixed(1) + '%';
  }
  toast(text) {
    const d = document.createElement('div'); d.textContent = text;
    this.toastEl.appendChild(document.createElement('br')); this.toastEl.appendChild(d);
    while (this.toastEl.children.length > 6) this.toastEl.firstChild.remove();
    setTimeout(() => { d.previousSibling?.remove(); d.remove(); }, 2600);
  }
  hint(text) { this.hintEl.style.display = text ? 'block' : 'none'; this.hintEl.firstChild.textContent = text || ''; }
  dim(a, sec = 0.5) { this.dimEl.style.transition = `opacity ${sec}s`; this.dimEl.style.opacity = a; return new Promise(r => setTimeout(r, sec * 1000)); }

  // ------------------------------------------------------------ title / dialog
  title(a, b, sec = 1.5) {
    return new Promise(res => {
      const el = this.titleEl; el.querySelector('.a').textContent = a; el.querySelector('.b').textContent = b;
      el.style.display = 'flex';
      const end = () => { clearTimeout(h); el.onclick = null; el.style.display = 'none'; res(); };
      const h = setTimeout(end, sec * 1000);
      el.onclick = end;
    });
  }
  /** lines: [{ name, text, portrait }]; resolves 'done' | 'skip' */
  dialog(lines) {
    return new Promise(res => {
      const el = this.dlgEl; let i = 0;
      const show = () => {
        const l = lines[i];
        el.classList.toggle('narr', !l.name);
        el.querySelector('.nm').style.display = l.name ? 'block' : 'none';
        el.querySelector('.nm').textContent = l.name || '';
        el.querySelector('.tx').textContent = l.text;
        const pt = el.querySelector('.pt');
        if (l.portrait) { pt.src = l.portrait; pt.style.display = 'block'; } else pt.style.display = 'none';
      };
      const close = how => { el.onpointerdown = null; el.querySelector('.sk').onpointerdown = null; el.style.display = 'none'; res(how); };
      el.onpointerdown = e => { e.stopPropagation(); if (++i >= lines.length) close('done'); else show(); };
      el.querySelector('.sk').onpointerdown = e => { e.stopPropagation(); close('skip'); };
      el.style.display = 'block'; show();
    });
  }

  // ------------------------------------------------------------ windows
  /** spec: { title, rows: [[label, value]], text, note, buttons: [{ label, disabled, sub, onClick }] } -> close() */
  window(spec) {
    const box = this.winEl.querySelector('.box');
    const render = s => {
      box.innerHTML = `<h3></h3>${s.text ? '<div class="txt"></div>' : ''}${(s.rows || []).map(() => '<div class="row"><span></span><b></b></div>').join('')}<div class="note"></div><div class="btns"></div>`;
      box.querySelector('h3').textContent = s.title;
      if (s.text) box.querySelector('.txt').textContent = s.text;
      box.querySelectorAll('.row').forEach((r, i) => { r.children[0].textContent = s.rows[i][0]; r.children[1].textContent = s.rows[i][1]; });
      box.querySelector('.note').textContent = s.note || '';
      const bs = box.querySelector('.btns');
      for (const b of s.buttons || []) {
        const e = document.createElement('button'); e.textContent = b.label; e.disabled = !!b.disabled; if (b.sub) e.className = 'sub';
        e.onclick = ev => { ev.stopPropagation(); if (!e.disabled) b.onClick?.(); };
        bs.appendChild(e);
      }
    };
    render(spec);
    this.winEl.style.display = 'flex';
    this.winEl.onpointerdown = e => e.stopPropagation();
    return { close: () => { this.winEl.style.display = 'none'; }, update: render };
  }
  choice(question, options) {
    return new Promise(res => {
      const w = this.window({ title: question, buttons: options.map((o, i) => ({ label: o, sub: i > 0, onClick: () => { w.close(); res(i); } })) });
    });
  }
  complete(a, b, btn) {
    return new Promise(res => {
      const el = this.doneEl;
      el.innerHTML = '<div class="a"></div><div class="b"></div><button></button>';
      el.querySelector('.a').textContent = a; el.querySelector('.b').textContent = b;
      const bt = el.querySelector('button'); bt.textContent = btn;
      el.style.display = 'flex';
      bt.onclick = () => { el.style.display = 'none'; res(); };
    });
  }

  // ------------------------------------------------------------ world markers
  /** list: [{ id, x, y, text, kind: ''|'hl'|'lock'|'check', onClick }]; toScreen(x,y) -> [sx, sy] */
  markers(list, toScreen) {
    const seen = new Set();
    for (const m of list) {
      seen.add(m.id);
      let el = this.marks.get(m.id);
      if (!el) {
        el = document.createElement('div'); el.className = 'mk'; el.innerHTML = '<div class="b"></div>';
        this.marksEl.appendChild(el); this.marks.set(m.id, el);
      }
      el.onpointerdown = e => { e.stopPropagation(); if (!this.busy) m.onClick?.(); };
      const [sx, sy] = toScreen(m.x, m.y);
      const off = sx < -40 || sy < -40 || sx > this.w + 40 || sy > this.h + 40;
      el.style.display = off ? 'none' : 'block';
      el.style.left = sx + 'px'; el.style.top = sy + 'px';
      el.className = 'mk' + (m.kind ? ' ' + m.kind : '');
      const b = el.firstChild; if (b.textContent !== m.text) b.textContent = m.text;
    }
    for (const [id, el] of this.marks) if (!seen.has(id)) { el.remove(); this.marks.delete(id); }
  }
}
