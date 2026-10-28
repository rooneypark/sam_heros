// Motion viewer (maker tab): plays each unit's original animation clips (frames, per-frame times, hit events from
// anims.json) without the simulation, several units side by side in sync. Pack units show their own art (remap).
import { G } from '../game/registry.js';
import { Tables } from '../game/data/Tables.js';
import { TEAM } from '../game/defs.js';
import { ActorSkill } from '../game/skill/Skill.js';
import { loadWorld, stepWorld, drawWorld } from '../boot.js';
import { newDoc } from './mapdoc.js';

const STATES = ['Idle', 'Move', 'Attack', 'Skill_01', 'Skill_02', 'Skill_03', 'Gather', 'Die'];
const STATE_KO = { Idle: '숨쉬기', Move: '이동', Attack: '공격', Skill_01: '스킬 1', Skill_02: '스킬 2', Skill_03: '스킬 3', Gather: '채집', Die: '사망' };
const HIT = ['OnAttackEvent', 'OnSkillEvent', 'OnGatherEvent'];
const CELL = 220, ZOOM = 0.62;          // canvas px per cell, sprite px -> canvas px

const images = new Map();
function image(file) {
  if (!images.has(file)) {
    const img = new Image();
    img.src = file.startsWith('/') ? encodeURI(file) : `/re/extract/media/textures/${encodeURIComponent(file)}`;
    images.set(file, new Promise(res => { img.onload = () => res(img); img.onerror = () => res(null); }));
  }
  return images.get(file);
}
const loaded = new Map();   // file -> Image (sync access while drawing)

function clipData(c) {
  const tracks = (c.sprites || []).map(t => t.frames).filter(f => f?.length);
  if (!tracks.length) return null;
  const frames = tracks.reduce((a, b) => (b.length > a.length ? b : a)).filter(([, n]) => typeof n === 'string');
  const hit = (c.events || []).find(e => HIT.includes(e.fn))?.t ?? null;
  return { length: c.length || 0.5, loop: !!c.loop, frames, hit };
}
/** clips of a unit: state -> {length, loop, frames:[[t, sprite]], hit}. The prefab's original clips, overridden by
 *  a pack unit's own timing (row.motionClips from packs/customMotion.js, stored as <prefab>_<unitId>_<state>) */
function clipsOf(row) {
  const prefab = row.prefab, out = {};
  // Delivered pack units expose only the states actually supplied by the artist.
  // In particular residents have no attack/skills, and Zhao Yun has no death art.
  for (const [k, c] of Object.entries(row.motionClips ? {} : G.assets.anims)) {
    if (!k.startsWith(prefab + '_') || k.endsWith('_Test')) continue;
    const state = k.slice(prefab.length + 1);
    if (/^SG_[A-Z]\d+_/.test(state)) continue;            // another pack unit's clip on the same base prefab
    const d = clipData(c); if (d) out[state] = d;
  }
  for (const [state, key] of Object.entries(row.motionClips || {})) {
    const d = G.assets.anims[key] && clipData(G.assets.anims[key]);
    if (d) out[state] = { ...d, custom: true };
  }
  return out;
}

/** draw a sprite (untrimmed canvas placed by its pivot) at the cell's ground point */
function drawSprite(ctx, name, gx, gy, flip) {
  const m = G.assets.sprites[name];
  if (!m?.tex) return;
  const img = loaded.get(m.tex);
  if (!img) { image(m.tex).then(i => i && loaded.set(m.tex, i)); return; }
  const mm = /-(\d+)x(\d+)-/.exec(m.tex);
  const lw = mm ? +mm[1] : img.naturalWidth, lh = mm ? +mm[2] : img.naturalHeight;
  const kx = img.naturalWidth / lw, ky = img.naturalHeight / lh;
  const [x, y, w, h] = m.rect, [fw, fh] = m.size || [w, h], [ox, oy] = m.offset || [0, 0];
  const k = ZOOM * 100 / (m.ppu || 100);
  // trimmed rect inside the full canvas (bottom-left origin), full canvas placed so its pivot is on (gx, gy)
  const left = -m.pivot[0] * fw + ox, bottom = -m.pivot[1] * fh + oy;
  ctx.save();
  ctx.translate(gx, gy);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, x * kx, (lh - y - h) * ky, w * kx, h * ky, left * k, -(bottom + h) * k, w * k, h * k);
  ctx.restore();
}

/** visible pixels of a sprite relative to its pivot, in sprite px: {top, bottom, height} (bottom > 0 = floating) */
const metrics = new Map();
function measure(name) {
  if (metrics.has(name)) return metrics.get(name);
  const m = G.assets.sprites[name], img = m?.tex && loaded.get(m.tex);
  if (!img) return null;
  const mm = /-(\d+)x(\d+)-/.exec(m.tex);
  const lw = mm ? +mm[1] : img.naturalWidth, lh = mm ? +mm[2] : img.naturalHeight;
  const kx = img.naturalWidth / lw, ky = img.naturalHeight / lh;
  const [x, y, w, h] = m.rect, fh = (m.size || [w, h])[1], oy = (m.offset || [0, 0])[1];
  const cw = Math.max(1, Math.round(w)), ch = Math.max(1, Math.round(h));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, x * kx, (lh - y - h) * ky, w * kx, h * ky, 0, 0, cw, ch);
  const a = ctx.getImageData(0, 0, cw, ch).data;
  let top = -1, bot = -1;
  for (let r = 0; r < ch && top < 0; r++) for (let c = 0; c < cw; c++) if (a[(r * cw + c) * 4 + 3] > 40) { top = r; break; }
  for (let r = ch - 1; r >= 0 && bot < 0; r--) for (let c = 0; c < cw; c++) if (a[(r * cw + c) * 4 + 3] > 40) { bot = r; break; }
  if (top < 0) { metrics.set(name, null); return null; }
  // rows from the top of the trimmed rect -> height above the pivot line
  const base = -m.pivot[1] * fh + oy;               // rect bottom relative to the pivot
  const res = { top: base + (ch - top), bottom: base + (ch - 1 - bot), height: bot - top + 1 };
  metrics.set(name, res);
  return res;
}
const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0; };

/** QA notes of one state of a cell: uneven / slow timing, size change against Idle, feet off the ground line */
function checkState(cell, state) {
  const clip = cell.clips[state];
  if (!clip) return [];
  const notes = [];
  const ms = clip.frames.map(([t], i) => ((clip.frames[i + 1]?.[0] ?? clip.length) - t) * 1000).filter(v => v > 20);   // the 17 ms closing key is not a pose
  // cyclic states only: attacks / skills hold their wind-up frame on purpose
  if ((state === 'Idle' || state === 'Move') && ms.length > 1 && Math.max(...ms) / Math.min(...ms) > 2.2) notes.push(`프레임 시간 들쭉날쭉 (${Math.round(Math.min(...ms))}~${Math.round(Math.max(...ms))}ms)`);
  const base = cell.baseClips[state];
  if (clip.custom && base && cell.row.motionTimingBasis !== 'authored') {
    const r = clip.length / base.length;
    if (r > 1.3) notes.push(`원작보다 ${r.toFixed(1)}배 느림 (${Math.round(clip.length * 1000)} / ${Math.round(base.length * 1000)}ms)`);
    else if (r < 0.7) notes.push(`원작보다 ${(1 / r).toFixed(1)}배 빠름`);
  }
  // geometry is judged against the base original (weapons make absolute sizes meaningless): pack units only
  if (!cell.remap) return notes;
  const own = n => cell.remap(n) || n;
  const ms2 = (c, f) => c ? c.frames.map(([, n]) => measure(f(n))).filter(Boolean) : [];
  const cur = ms2(clip, own), idle = ms2(cell.clips.Idle, own);
  const bcur = ms2(base, n => n), bidle = ms2(cell.baseClips.Idle, n => n);
  if (cur.length && idle.length && bcur.length && bidle.length && state !== 'Idle' && state !== 'Die') {
    // size change Idle -> this state, compared with the same change in the base
    const d = median(cur.map(q => q.height)) / median(idle.map(q => q.height)) - median(bcur.map(q => q.height)) / median(bidle.map(q => q.height));
    if (Math.abs(d) > 0.15) notes.push(`숨쉬기 대비 크기 변화가 원작과 ${Math.round(Math.abs(d) * 100)}% 다름`);
  }
  if (cur.length && bcur.length && state !== 'Die') {
    // lowest point (feet) and the bounce: highest lift over the cycle, both against the base
    const low = Math.min(...cur.map(q => q.bottom)), blow = Math.min(...bcur.map(q => q.bottom));
    // floating = the lowest pixel is clearly above the ground line AND higher than the base's (a base weapon dipping
    // below the ground must not flag a pack unit standing on the line)
    if (low > 6 && low - blow > 8) notes.push(`발이 원작보다 ${Math.round(low - Math.max(blow, 0))}px 떠 있음`);
    if (state === 'Move' || state === 'Idle') {
      const lift = Math.max(...cur.map(q => q.bottom)) - low, blift = Math.max(...bcur.map(q => q.bottom)) - blow;
      if (state === 'Move' && blift > 6 && lift < blift * 0.5) notes.push(`걸음 튀어오름이 약함 (${Math.round(lift)}px, 원작 ${Math.round(blift)}px)`);
      if (lift > blift + 12) notes.push(`위아래 흔들림이 과함 (${Math.round(lift)}px, 원작 ${Math.round(blift)}px)`);
    }
  }
  return notes;
}

// ------------------------------------------------------------------ effect stage (engine): the real skill with its
// cast / start / hit effects and bullets, forced (no condition / cooldown) at a dummy, in step with the viewer clock
const DUMMY = 'SG_M0001', GAP = 6, DUMMY_DX = -2.2;
function createStage(canvas, renderer) {
  const S = { units: [], ready: false, building: null, cam: { position: [0, 12], size: 4, tween: null } };
  async function build(cells, level) {
    S.ready = false;
    const doc = newDoc('motion_stage', 16);
    if (G.assets.tiles.sg2_ground) {
      doc.mapData.forEach(t=>t.n='sg2_ground');
      doc.environmentArt={groundTile:'sg2_ground'};
    }
    doc.maker.units = []; doc.BonfirePos = { x: 0, y: 12 };
    await loadWorld('motion_stage', [], doc);
    G.HeroManager.Control = false;                  // no AI: the stage only does what it is told
    S.units = [];
    for (let i = 0; i < cells.length; i++) {
      const x = (i - (cells.length - 1) / 2) * GAP + 1.2, y = 12;
      const a = await G.UnitManager.spawnActor(cells[i].key, Math.max(0, level - 1), TEAM.PLAYER, x, y);
      const d = await G.UnitManager.spawnActor(DUMMY, Math.max(0, level - 1), TEAM.ENEMY, x + DUMMY_DX, y);
      d.UnitData.AddStat(0, 1e9); d.UnitData.RestoreHp();
      S.units.push({ cell: cells[i], a, d, cycle: -1 });
    }
    const n = Math.max(1, cells.length);
    S.cam.position = [0.6, 12.6]; S.cam.size = Math.max(3.2, (n * GAP) / 2 / (canvas.clientWidth / canvas.clientHeight) + 0.6);
    S.ready = true;
  }
  /** the skill of `actor` that plays the clip of `state` (pack clips first) */
  function skillFor(u, state) {
    const row = Tables.unit(u.Key);
    // pack units keep the base skills (animationKey = <prefab>_<state>) and play their own clip for it, or define
    // skills on the pack clip: accept either name
    const clips = [row.motionClips?.[state], `${row.prefab}_${state}`].filter(Boolean);
    const own = u._skills.find(s => clips.includes(s.TableSkillData.animationKey));
    if (own) return own;
    // a skill of a higher-level group that this level has not unlocked yet: build it from the table
    const data = Object.values(Tables.t.TableSkill).find(s => clips.includes(s.animationKey));
    return data ? new ActorSkill(u, data) : null;
  }
  function play(state) {
    for (const s of S.units) cast(s, state);
  }
  function cast(s, state) {
    const { a, d } = s;
    if (a.IsDead()) return;
    a.DisableEffect?.();
    a.CurrentSkill = null; a.Target = null;
    a.Body.SetIdle();
    a.SetState?.(0);
    a.Body.SetDirection(true);
    const an = a.Body.animator;
    if (state === 'Idle') return;
    if (state === 'Move') { an?.setFloat('Move', 1); an?.play('Move'); return; }
    if (state === 'Die') { an?.play('Die'); return; }
    const sk = skillFor(a, state);
    if (!sk) return;
    const g = a._tableSkillGroupData || {};
    // the pack's own clip for the state (with its hit / effect events) wins over the base skill's clip
    const clip = Tables.unit(a.Key)?.motionClips?.[state] || sk.TableSkillData.animationKey;
    // put the clip on the Attack slot the way SetCurrentSkill does (default / gathering / A / B)
    const idx = sk.key === g.defaultSkill ? 0 : sk.key === g.gatheringSkill ? 1 : sk.key === g.skillA ? 2 : sk.key === g.skillB ? 3 : 2;
    a.Body._animationClips[idx] = clip; a.Body.currentIndex = -1;
    a._firstAttack = a.Body.ChangeAnimation(idx);
    sk._coolTime = 0; sk._delay = 0;
    // the dummy stands inside the skill's reach (GetSkillDistSqrt is squared) so the hit lands and shows its number
    const [ax, ay] = a.transform.position, reach = Math.sqrt(sk.GetSkillDistSqrt());
    d.transform.position = [ax - Math.min(-DUMMY_DX, Math.max(0.6, reach * 0.85)), ay];
    a.Target = d;
    a.CurrentSkill = sk;
    a.OnAttack(null, true);
  }
  function frame(dt, playing, state, clocks) {
    if (!S.ready) return;
    // restart each unit's action when its viewer clip loops, so the stage stays in step with the cells
    for (const s of S.units) {
      const c = clocks(s.cell);
      if (c !== s.cycle) { s.cycle = c; cast(s, state); }
    }
    if (playing) stepWorld(dt);
    renderer.clear(0.14, 0.22, 0.29);
    drawWorld(renderer, S.cam, canvas.clientWidth / canvas.clientHeight);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    renderer.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), window.devicePixelRatio || 1);
  }
  return { build, play, frame, resize, get ready() { return S.ready; }, reset() { for (const s of S.units) s.cycle = -1; } };
}

export function createMotionView({ root, units, unitDef, stage: stageEl, renderer }) {
  const V = { cells: [], state: 'Idle', playing: true, speed: 1, t: 0, step: 0, filter: '', game: 'samguk' };
  root.innerHTML = `
    <aside class="mv-side">
      <h3>유닛 추가 <small id="mvCount"></small></h3>
      <div class="tabs games" id="mvGames"></div>
      <input id="mvSearch" class="search" placeholder="이름·키 검색">
      <div id="mvList" class="mv-list"></div>
    </aside>
    <section class="mv-main">
      <div class="mv-bar">
        <div class="tabs" id="mvStates"></div>
        <button id="mvPlay">일시정지</button><button id="mvStep" title="한 프레임 앞으로 (일시정지 중)">▶|</button>
        <select id="mvSpeed"><option value="0.25">0.25배</option><option value="0.5">0.5배</option><option value="1" selected>1배</option><option value="2">2배</option></select>
        <label class="mv-chk"><input type="checkbox" id="mvRight"> 오른쪽 보기</label>
        <label class="mv-chk" title="삼국 유닛의 팩 전용 타이밍 대신 base 원작 박자로 재생"><input type="checkbox" id="mvBase"> 원작 박자로 보기</label>
        <label class="mv-chk" title="게임 엔진으로 스킬을 허수아비에게 강제 발동: 시전·투사체·피격 이펙트 포함"><input type="checkbox" id="mvFx"> 이펙트 시연</label>
        <label class="mv-chk" title="시연 레벨 (레벨에 따라 스킬 단계가 바뀜)">Lv <input type="number" id="mvLv" value="60" min="1" max="999" style="width:58px"></label>
        <button id="mvClear">모두 지우기</button>
      </div>
      <div id="mvStageWrap" class="mv-stage"></div>
      <div id="mvGrid" class="mv-grid"><div class="empty">왼쪽에서 유닛을 눌러 추가하세요. 여러 유닛을 놓고 같은 동작을 동시에 비교할 수 있습니다.</div></div>
      <div class="mv-hint">파란 선 = 발 기준선 · 빨간 테두리 = 타격 프레임(데미지가 들어가는 순간) · 원작 프레임 시간 그대로 재생 · 삼국 유닛은 팩 전용 타이밍(units.json motion)이 있으면 그것, 없으면 base 타이밍에 팩 그림</div>
    </section>`;
  const $ = s => root.querySelector(s);
  // effect stage: the engine canvas moves into the viewer while 이펙트 시연 is on
  const stage = stageEl && renderer ? createStage(stageEl, renderer) : null;
  if (stage) $('#mvStageWrap').appendChild(stageEl);
  let fxDirty = true;
  const rebuildStage = async () => {
    if (!stage || !$('#mvFx').checked) return;
    fxDirty = false;
    stage.resize();
    await stage.build(V.cells.slice(0, 8), Number($('#mvLv').value) || 60);
  };
  if (!stage) { $('#mvFx').disabled = true; }
  $('#mvFx').onchange = () => { root.classList.toggle('fx', $('#mvFx').checked); fxDirty = true; };
  $('#mvLv').onchange = () => { fxDirty = true; };
  window.addEventListener('resize', () => stage?.resize());

  const buildList = () => {
    const games = [['samguk', '삼국히어로즈']];
    $('#mvGames').innerHTML = games.map(([id, n]) => `<button data-g="${id}" class="${V.game === id ? 'on' : ''}">${n}</button>`).join('');
    for (const b of root.querySelectorAll('#mvGames button')) b.onclick = () => { V.game = b.dataset.g; buildList(); };
    const q = V.filter.trim().toLowerCase();
    const list = units().filter(u => u.source === V.game && (!q || u.name.toLowerCase().includes(q) || u.key.toLowerCase().includes(q)));
    $('#mvCount').textContent = list.length;
    $('#mvList').innerHTML = list.slice(0, 200).map(u => `<button data-k="${u.key}" title="${u.key}">${u.name} <small>${u.kind}</small></button>`).join('');
    for (const b of root.querySelectorAll('#mvList button')) b.onclick = () => add(b.dataset.k);
  };
  $('#mvSearch').oninput = e => { V.filter = e.target.value; buildList(); };

  const buildStates = () => {
    const have = new Set(V.cells.flatMap(c => Object.keys(c.clips)));
    const list = [...STATES.filter(s => have.has(s)), ...[...have].filter(s => !STATES.includes(s)).sort()];
    if (!list.includes(V.state) && list.length) V.state = list[0];
    $('#mvStates').innerHTML = (list.length ? list : STATES.slice(0, 1)).map(s => `<button data-s="${s}" class="${V.state === s ? 'on' : ''}">${STATE_KO[s] || s}</button>`).join('');
    for (const b of root.querySelectorAll('#mvStates button')) b.onclick = () => { V.state = b.dataset.s; V.t = 0; buildStates(); stage?.reset(); };
  };

  function add(key) {
    const row = Tables.unit(key);
    if (!row || V.cells.length >= 16) return;
    const def = unitDef(key);
    const el = document.createElement('div');
    el.className = 'mv-cell';
    el.innerHTML = `<canvas width="${CELL}" height="${CELL}"></canvas><div class="mv-name">${def?.name || key} <small>${row.prefab}</small></div>
      <div class="mv-info"></div><div class="mv-warn"></div><button class="mv-x" title="빼기">×</button>`;
    const packClips = clipsOf(row), baseClips = clipsOf({ prefab: row.prefab });
    const cell = { key, row, el, canvas: el.querySelector('canvas'), info: el.querySelector('.mv-info'), warn: el.querySelector('.mv-warn'),
      packClips, baseClips, clips: packClips, remap: row.spriteRemap || null, artFlip: !!row.artFlip };
    el.querySelector('.mv-x').onclick = () => { V.cells.splice(V.cells.indexOf(cell), 1); el.remove(); buildStates(); fxDirty = true; };
    if (!V.cells.length) $('#mvGrid').innerHTML = '';
    $('#mvGrid').appendChild(el);
    V.cells.push(cell);
    // preload every frame texture of the unit
    const files = new Set();
    for (const c of Object.values(cell.clips)) for (const [, n] of c.frames) {
      const s = G.assets.sprites[(cell.remap && cell.remap(n)) || n]; if (s?.tex) files.add(s.tex);
    }
    for (const f of Object.values(row.motionFx || {}).flat()) for (const n of f.sprites) { const s = G.assets.sprites[n]; if (s?.tex) files.add(s.tex); }
    for (const f of files) image(f).then(i => i && loaded.set(f, i));
    buildStates();
    fxDirty = true;
  }
  $('#mvClear').onclick = () => { V.cells.length = 0; $('#mvGrid').innerHTML = ''; buildStates(); fxDirty = true; };
  $('#mvPlay').onclick = () => { V.playing = !V.playing; $('#mvPlay').textContent = V.playing ? '일시정지' : '재생'; };
  $('#mvSpeed').onchange = e => { V.speed = Number(e.target.value); };
  $('#mvStep').onclick = () => { V.playing = false; $('#mvPlay').textContent = '재생'; V.step++; };

  function frameAt(clip, t) {
    let i = 0;
    for (let k = 0; k < clip.frames.length; k++) if (clip.frames[k][0] <= t + 1e-6) i = k;
    return i;
  }
  function draw() {
    const right = $('#mvRight').checked, baseTiming = $('#mvBase').checked;
    for (const c of V.cells) {
      c.clips = baseTiming ? c.baseClips : c.packClips;
      // QA notes (sprites must be loaded to be measured; recomputed until they are)
      const qk = `${V.state}|${baseTiming}`;
      if (c.qaKey !== qk || !c.qaDone) {
        const notes = checkState(c, V.state);
        const clip = c.clips[V.state];
        c.qaDone = !!clip && clip.frames.every(([, n]) => metrics.has((c.remap && c.remap(n)) || n));
        c.qaKey = qk;
        c.warn.innerHTML = notes.map(n => `⚠ ${n}`).join('<br>');
        c.el.classList.toggle('warned', notes.length > 0);
      }
      const ctx = c.canvas.getContext('2d');
      ctx.clearRect(0, 0, CELL, CELL);
      const gx = CELL / 2, gy = CELL * 0.78;
      ctx.strokeStyle = '#5ac8ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, gy); ctx.lineTo(CELL - 8, gy); ctx.stroke();
      const clip = c.clips[V.state];
      if (!clip) { c.info.textContent = `${STATE_KO[V.state] || V.state} 없음`; c.el.classList.remove('hit'); continue; }
      const t = V.t % clip.length;
      const i = frameAt(clip, t);
      const [t0, name] = clip.frames[i];
      const next = clip.frames[i + 1]?.[0] ?? clip.length;
      const own = c.remap && c.remap(name);
      // original sprites face left; pack art drawn facing right is mirrored like in the game
      const flip = (own && c.artFlip ? !right : right);
      const fxs = clip.custom ? (c.row.motionFx?.[V.state] || []) : [];
      const fxAt = layer => {
        // pack effects of the clip at this moment (forward = the facing; px are sprite px)
        const fwd = right ? 1 : -1, k = ZOOM;
        for (const f of fxs) {
          if ((f.layer === 'back') !== (layer === 'back')) continue;
          const rel = t * 1000 - (f.at || 0), life = f.life || f.sprites.length * (f.ms || 83);
          if (rel < 0 || rel >= life) continue;
          let n = Math.floor(rel / (f.ms || 83)); n = f.loop ? n % f.sprites.length : Math.min(f.sprites.length - 1, n);
          const [ox, oy] = f.offset || [0, 0], [vx, vy] = f.move || [0, 0];
          drawSprite(ctx, f.sprites[n], gx + fwd * (ox + vx * rel / 1000) * k, gy - (oy + vy * rel / 1000) * k, right);
        }
      };
      fxAt('back');
      drawSprite(ctx, own || name, gx, gy, flip);
      fxAt('front');
      const isHit = clip.hit != null && t0 <= clip.hit + 1e-4 && clip.hit < next - 1e-4;
      c.el.classList.toggle('hit', isHit);
      c.info.textContent = `${STATE_KO[V.state] || V.state} · ${i + 1}/${clip.frames.length}프레임 · ${Math.round(t0 * 1000)}ms / ${Math.round(clip.length * 1000)}ms`
        + (clip.hit != null ? ` · 타격 ${Math.round(clip.hit * 1000)}ms` : '') + (clip.loop ? ' · 반복' : '') + (clip.custom ? ' · 팩 타이밍' : '');
    }
  }
  let last = performance.now(), visible = false;
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (visible) {
      const t0 = V.t;
      if (V.playing) V.t += dt * V.speed;
      else if (V.step) {
        // ▶|: jump to the next frame start of the first unit's clip (the others follow the same clock)
        const clip = V.cells.map(c => c.clips[V.state]).find(Boolean);
        if (clip) { const t = V.t % clip.length, nx = clip.frames.find(([ft]) => ft > t + 1e-4)?.[0] ?? clip.length; V.t += nx - t + 1e-4; }
        V.step = 0;
      }
      draw();
      if (stage && $('#mvFx').checked) {
        if (fxDirty && !V.building) { V.building = true; rebuildStage().finally(() => { V.building = false; }); }
        // the stage advances by the same time as the viewer clock; each unit restarts its action when its clip loops
        const adv = V.t - t0;
        stage.frame(adv, adv > 0, V.state, cell => { const c = cell.clips[V.state]; return c ? Math.floor(V.t / c.length) : 0; });
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  buildList(); buildStates();
  return {
    show(v) { visible = v; if (v) buildList(); },
    add,
  };
}
