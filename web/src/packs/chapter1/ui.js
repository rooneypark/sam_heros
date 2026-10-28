// 1장 화면 UI (DOM 오버레이): 챕터 제목, 대화창(화자·초상·넘기기·건너뛰기), 현재 목표, 자원, 보스 HP, 월드 마커,
// 시설 창(훈련·다리·휴식), 선택창, 완료 화면, 안내 토스트 + 바닥 예고용 2D 캔버스. 원작 HUD 대신 사용한다.


export class ChapterUI {
  constructor(stage) {
    this.stage = stage;
    if (!document.getElementById('c1css')) { const s = document.createElement('link'); s.id = 'c1css'; s.rel = 'stylesheet'; s.href = '/samguk/art/ui/chapter1/theme.css'; document.head.appendChild(s); }
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
    this.winEl.dataset.screen = spec.screen || 'generic';
    this.winEl.style.display = 'flex';
    this.winEl.onpointerdown = e => e.stopPropagation();
    return { close: () => { this.winEl.style.display = 'none'; }, update: render };
  }
  choice(question, options) {
    return new Promise(res => {
      const w = this.window({ screen: 'choice', title: question, buttons: options.map((o, i) => ({ label: o, sub: i > 0, onClick: () => { w.close(); res(i); } })) });
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
