// 삼국히어로즈 타이틀 인트로 (개발 시안). 디자이너 최종 애니메이션이 오기 전까지 게임 시작 화면으로 쓴다.
// 시안 페이지(samguk/docs/design/intro/intro_prototype.html)도 이 모듈을 그대로 재생한다 — 타이밍 원본은 STEPS.
// 흐름: 어둠 → 붉은 해·먹산 → 관우·장비·유비가 잔상(그림자)을 끌며 달려와 착지 → 이름패 → 로고 낙관 → 터치하여 시작.


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
  if (!document.getElementById('sgi-css')) { const s = document.createElement('link'); s.id = 'sgi-css'; s.rel = 'stylesheet'; s.href = '/samguk/art/ui/intro/style.css'; document.head.appendChild(s); }
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
