// 삼국히어로즈 타이틀 인트로 (개발 시안). 디자이너 최종 애니메이션이 오기 전까지 게임 시작 화면으로 쓴다.
// 시안 페이지(samguk/docs/design/intro/intro_prototype.html)도 이 모듈을 그대로 재생한다 — 타이밍 원본은 STEPS.
// 흐름: 어둠 → 붉은 해·먹산 → 관우·장비·유비가 잔상(그림자)을 끌며 달려와 착지 → 이름패 → 로고 낙관 → 터치하여 시작.
const CSS = `
.sgi { position:absolute; inset:0; overflow:hidden; z-index:50; background:#0b0806; font-family:'Black Han Sans','Malgun Gothic','Apple SD Gothic Neo',sans-serif; color:#fff; cursor:pointer; user-select:none; --u: min(1vh, calc(var(--w) / 46)); }
.sgi * { box-sizing:border-box; }
.sgi .sky { position:absolute; inset:0; opacity:0; transition:opacity 1s; background:
  radial-gradient(circle at 50% 38%, #ffcf6e 0, #ff8a3d calc(var(--u)*7), rgba(214,64,30,.85) calc(var(--u)*13), rgba(120,28,20,0) calc(var(--u)*30)),
  linear-gradient(#3a120c 0%, #7a2414 45%, #2a0f0a 70%, #120806 100%); }
.sgi .sun { position:absolute; left:50%; top:38%; width:calc(var(--u)*22); height:calc(var(--u)*22); margin:calc(var(--u)*-11) 0 0 calc(var(--u)*-11); border-radius:50%;
  background:#ffdf9a; box-shadow:0 0 calc(var(--u)*8) #ffb24d; transform:scale(0); transition:transform 1.1s cubic-bezier(.2,1.4,.4,1); }
.sgi .mt { position:absolute; left:-10%; right:-10%; bottom:30%; height:28%; opacity:0; transform:translateY(20%); transition:opacity 1s .2s, transform 1.2s .2s; }
.sgi .mt.a { background:#2b0f0b; clip-path:polygon(0 100%,0 55%,12% 30%,22% 52%,35% 18%,47% 48%,58% 28%,70% 50%,82% 22%,93% 45%,100% 35%,100% 100%); }
.sgi .mt.b { bottom:22%; background:#170807; clip-path:polygon(0 100%,0 70%,10% 50%,20% 66%,32% 40%,44% 64%,56% 46%,68% 68%,80% 44%,90% 60%,100% 52%,100% 100%); }
.sgi .ground { position:absolute; left:0; right:0; bottom:0; height:24%; background:linear-gradient(#170807,#0b0403); }
.sgi.on .sky, .sgi.on .mt { opacity:1; transform:none; } .sgi.on .sun { transform:scale(1); }
.sgi .hero { position:absolute; bottom:4%; width:calc(var(--u)*30); height:calc(var(--u)*30); transform:translateX(130vw); }
.sgi .hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; transform-origin:50% 70%; }
.sgi .hero .trail { filter:brightness(0) saturate(0); }
.sgi .hero .shadow { position:absolute; left:50%; bottom:28%; width:46%; height:9%; margin-left:-23%; border-radius:50%; background:rgba(0,0,0,.55); transform-origin:0 50%; }
.sgi .hero.go { transition:transform .42s cubic-bezier(.15,.85,.25,1); }
.sgi .hero.go .shadow { animation:sgiShadow .5s ease-out; }
.sgi .hero.land img.body { animation:sgiLand .35s ease-out; }
.sgi .hero.go .trail { animation:sgiTrail .5s ease-out forwards; }
@keyframes sgiShadow { 0%{ transform:scaleX(7); opacity:.8 } 100%{ transform:scaleX(1); opacity:1 } }
@keyframes sgiTrail { 0%{ opacity:var(--o) } 100%{ opacity:0; transform:translateX(var(--d)) } }
@keyframes sgiLand { 0%{ transform:scale(1.1,.86) } 45%{ transform:scale(.95,1.08) translateY(-4%) } 100%{ transform:none } }
.sgi .dust { position:absolute; bottom:12%; width:calc(var(--u)*24); height:calc(var(--u)*6); border-radius:50%; background:radial-gradient(rgba(255,214,160,.55),rgba(255,214,160,0) 70%);
  animation:sgiDust .6s ease-out forwards; }
@keyframes sgiDust { 0%{ transform:scale(.3); opacity:1 } 100%{ transform:scale(1.4,1); opacity:0 } }
.sgi .plate { position:absolute; bottom:9%; transform:translate(-50%, 30%); opacity:0; transition:opacity .25s, transform .25s; text-align:center; white-space:nowrap;
  font-size:calc(var(--u)*2.6); padding:.2em .7em; border-radius:.4em; background:rgba(20,8,4,.75); border:2px solid #d9a447; color:#ffe6a8; letter-spacing:.08em; }
.sgi .plate small { display:block; font-size:.62em; color:#f0c47a; letter-spacing:.2em; }
.sgi .plate.on { opacity:1; transform:translate(-50%,0); }
.sgi .logo { position:absolute; left:0; right:0; top:11%; text-align:center; opacity:0; transform:scale(2.4); }
.sgi .logo.on { animation:sgiStamp .45s cubic-bezier(.3,1.6,.5,1) forwards; }
@keyframes sgiStamp { 0%{ opacity:0; transform:scale(2.4) } 60%{ opacity:1; transform:scale(.94) } 100%{ opacity:1; transform:scale(1) } }
.sgi .logo .s { font-size:calc(var(--u)*4); color:#ffd27a; letter-spacing:.5em; text-indent:.5em; -webkit-text-stroke:2px #3a1208; paint-order:stroke; }
.sgi .logo .t { font-size:calc(var(--u)*6.6); line-height:1.05; white-space:nowrap; letter-spacing:-.02em; color:#fff3d2; -webkit-text-stroke:calc(var(--u)*.7) #5a1a0c; paint-order:stroke fill;
  text-shadow:0 calc(var(--u)*.8) 0 #2a0a05, 0 0 calc(var(--u)*3) rgba(255,160,60,.6); }
.sgi .logo .seal { display:inline-block; margin-top:calc(var(--u)*1.2); padding:.15em .45em; font-size:calc(var(--u)*2.4); color:#ffe9d0; background:#b3261e; border-radius:.2em;
  transform:rotate(-4deg); box-shadow:0 0 0 2px #ffd9a0 inset; letter-spacing:.15em; }
.sgi .flash { position:absolute; inset:0; background:#fff; opacity:0; pointer-events:none; }
.sgi .flash.on { animation:sgiFlash .35s ease-out; }
@keyframes sgiFlash { 0%{ opacity:.85 } 100%{ opacity:0 } }
.sgi.shake { animation:sgiShake .3s linear; }
@keyframes sgiShake { 0%,100%{ transform:none } 20%{ transform:translate(-1.2%,.8%) } 40%{ transform:translate(1%,-1%) } 60%{ transform:translate(-.6%,.6%) } 80%{ transform:translate(.4%,-.3%) } }
.sgi .tap { position:absolute; left:0; right:0; bottom:2.5%; text-align:center; font-size:calc(var(--u)*2.6); color:#ffe6a8; opacity:0; letter-spacing:.15em; }
.sgi .tap.on { animation:sgiBlink 1.2s ease-in-out infinite; }
@keyframes sgiBlink { 0%,100%{ opacity:.25 } 50%{ opacity:1 } }
.sgi .ember { position:absolute; width:4px; height:4px; border-radius:50%; background:#ffb45a; box-shadow:0 0 6px #ff8a2a; animation:sgiEmber linear infinite; opacity:0; }
@keyframes sgiEmber { 0%{ transform:translateY(0); opacity:0 } 15%{ opacity:.9 } 100%{ transform:translateY(-60vh) translateX(6vw); opacity:0 } }
.sgi.out { transition:opacity .5s; opacity:0; }
`;

/** 장면 타이밍(ms). 시안 문서의 표와 같은 값 */
export const STEPS = {
  sky: 150,                                   // 붉은 하늘·해·먹산 등장 (1.0~1.2초 전환)
  heroes: [                                   // 등장 순서: 오른쪽 화면 밖에서 잔상과 긴 그림자를 끌며 달려와 착지
    { at: 900, slot: 0.22, scale: 0.92, key: 'guan-yu', name: '관우', sub: '운장' },
    { at: 1350, slot: 0.78, scale: 0.92, key: 'zhang-fei', name: '장비', sub: '익덕' },
    { at: 1850, slot: 0.50, scale: 1.08, key: 'liu-bei', name: '유비', sub: '현덕' },
  ],
  logo: 2700,                                 // 흰 섬광 + 로고 낙관 + 화면 흔들림
  tap: 3400,                                  // '화면을 터치하세요'
};

/**
 * Play the title intro inside `container` (the game stage). Resolves after the player taps once the logo is up
 * (a tap before that jumps to the finished title). opts: { root: '/samguk/', autoEnd: ms (auto finish, previews/tests) }
 */
export function playIntro(container, opts = {}) {
  const root = opts.root || '/samguk/';
  if (!document.getElementById('sgi-css')) { const s = document.createElement('style'); s.id = 'sgi-css'; s.textContent = CSS; document.head.appendChild(s); }
  const el = document.createElement('div');
  el.className = 'sgi';
  el.style.setProperty('--w', (container.clientWidth || window.innerWidth) + 'px');
  el.innerHTML = `<div class="sky"></div><div class="sun"></div><div class="mt a"></div><div class="mt b"></div><div class="ground"></div>
    <div class="flash"></div><div class="logo"><div class="s">도원의 세 영웅</div><div class="t">삼국히어로즈</div><div class="seal">1장 황건 소탕</div></div>
    <div class="tap">화면을 터치하세요</div>`;
  container.appendChild(el);
  for (let i = 0; i < 14; i++) {
    const e = document.createElement('div'); e.className = 'ember';
    e.style.left = Math.random() * 100 + '%'; e.style.bottom = Math.random() * 30 + '%';
    e.style.animationDuration = 3 + Math.random() * 3 + 's'; e.style.animationDelay = Math.random() * 3 + 's';
    el.appendChild(e);
  }
  const timers = [], later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const heroes = STEPS.heroes.map(h => {
    const d = document.createElement('div'); d.className = 'hero';
    const src = `${root}${h.key}/original/original.png`;
    d.innerHTML = `<div class="shadow"></div>` + [0.45, 0.3, 0.18].map((o, i) => `<img class="trail" src="${src}" style="--o:${o};--d:${(i + 1) * 9}%;transform:translateX(${(i + 1) * 9}%)">`).join('') + `<img class="body" src="${src}">`;
    d.style.left = `calc(${h.slot * 100}% - var(--u)*${15 * h.scale})`;
    d.style.width = d.style.height = `calc(var(--u)*${30 * h.scale})`;
    el.appendChild(d);
    const p = document.createElement('div'); p.className = 'plate'; p.style.left = h.slot * 100 + '%';
    p.innerHTML = `${h.name}<small>${h.sub}</small>`;
    el.appendChild(p);
    return { h, d, p };
  });
  const land = ({ h, d, p }) => {
    d.classList.add('go'); d.style.transform = 'translateX(0)';
    setTimeout(() => {
      d.classList.add('land');
      const dust = document.createElement('div'); dust.className = 'dust'; dust.style.left = `calc(${h.slot * 100}% - var(--u)*12)`; el.appendChild(dust);
      setTimeout(() => dust.remove(), 700);
      p.classList.add('on');
    }, 380);
  };
  const showLogo = () => {
    el.querySelector('.flash').classList.add('on');
    el.querySelector('.logo').classList.add('on');
    el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 320);
  };
  let ready = false;
  const finishTitle = () => {           // tap before the end: everything in place at once
    timers.forEach(clearTimeout); timers.length = 0;
    el.classList.add('on');
    heroes.forEach(x => { x.d.classList.add('go'); x.d.style.transform = 'translateX(0)'; x.p.classList.add('on'); });
    el.querySelector('.logo').classList.add('on');
    el.querySelector('.tap').classList.add('on'); ready = true;
  };
  return new Promise(res => {
    const end = () => { el.classList.add('out'); setTimeout(() => { el.remove(); res(); }, 500); };
    later(STEPS.sky, () => el.classList.add('on'));
    heroes.forEach(x => later(x.h.at, () => land(x)));
    later(STEPS.logo, showLogo);
    later(STEPS.tap, () => { el.querySelector('.tap').classList.add('on'); ready = true; if (opts.autoEnd) later(opts.autoEnd, end); });
    el.addEventListener('pointerdown', e => { e.stopPropagation(); if (ready) end(); else finishTitle(); });
  });
}
