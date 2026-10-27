// SoundManager port (OnPlay @0x223bc50, OnPlaySFX, OnPlayOneShot, OnBGMFadeOut) on WebAudio.
// TableSound: name -> media/audio/<name>.wav, playType BGM (looping, one source) / SFX (one source, replaced) /
// ONESHOT (overlapping; at most `limit` instances of the same key, released after the clip length).
import { Tables } from '../data/Tables.js';

const AUDIO_ROOT = '/re/extract/media/audio/';

export class SoundManager {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.loading = new Map();
    this.oneShotCount = new Map();
    this.bgmName = null; this.bgmSrc = null; this.bgmGain = null;
    this.sfxSrc = null;
    this.bgmVolume = 1; this.soundVolume = 1;
    this.pendingBgm = null;
  }
  /** browsers start audio only after a user gesture */
  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.pendingBgm) { const b = this.pendingBgm; this.pendingBgm = null; this.bgm(b); }
  }
  _data(key) { return key ? Tables.get('TableSound', key) : null; }
  _load(name) {
    if (this.buffers.has(name)) return Promise.resolve(this.buffers.get(name));
    if (!this.loading.has(name)) {
      this.loading.set(name, fetch(AUDIO_ROOT + name + '.wav').then(r => r.arrayBuffer())
        .then(b => this.ctx.decodeAudioData(b)).then(buf => { this.buffers.set(name, buf); return buf; })
        .catch(() => null));
    }
    return this.loading.get(name);
  }
  _source(buf, volume, loop) {
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = loop;
    const g = this.ctx.createGain(); g.gain.value = volume;
    src.connect(g); g.connect(this.master);
    return { src, g };
  }
  /** OnPlay(name) / OnPlay(string[]): random pick for arrays */
  play(key, delay = 0) {
    if (Array.isArray(key)) key = key[Math.floor(Math.random() * key.length)];
    const d = this._data(key);
    if (!d) return;
    if (d.playType === 'BGM') return this.bgm(key);
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (d.playType === 'SFX') return this._playSFX(d, delay);
    this._playOneShot(key, d, delay);
  }
  async _playOneShot(key, d, delay) {
    const n = this.oneShotCount.get(key) || 0;
    if (n >= (d.limit || 1)) return;
    this.oneShotCount.set(key, n + 1);
    const buf = await this._load(d.name);
    if (!buf) { this.oneShotCount.set(key, Math.max(0, (this.oneShotCount.get(key) || 1) - 1)); return; }
    const { src } = this._source(buf, d.volume * this.soundVolume, false);
    src.start(this.ctx.currentTime + delay);
    setTimeout(() => this.oneShotCount.set(key, Math.max(0, (this.oneShotCount.get(key) || 1) - 1)), (buf.duration + delay) * 1000);
  }
  async _playSFX(d, delay, loop = false) {
    const buf = await this._load(d.name);
    if (!buf) return;
    try { this.sfxSrc?.src.stop(); } catch { /* already stopped */ }
    this.sfxSrc = this._source(buf, d.volume * this.soundVolume, loop);
    this.sfxSrc.src.start(this.ctx.currentTime + delay);
  }
  stopSFX() { try { this.sfxSrc?.src.stop(); } catch { /* */ } this.sfxSrc = null; }
  /** BGM: same name keeps playing; otherwise replace the looping source */
  async bgm(key) {
    const d = this._data(key);
    if (!d) return;
    if (!this.ctx || this.ctx.state !== 'running') { this.pendingBgm = key; return; }
    if (this.bgmName === key && this.bgmSrc) return;
    this.bgmName = key;
    const buf = await this._load(d.name);
    if (!buf || this.bgmName !== key) return;
    this.stopBGM(true);
    this.bgmSrc = this._source(buf, d.volume * this.bgmVolume, true);
    this.bgmSrc.src.start();
  }
  stopBGM(keepName = false) { try { this.bgmSrc?.src.stop(); } catch { /* */ } this.bgmSrc = null; if (!keepName) this.bgmName = null; }
  /** OnBGMFadeOut(duration, nextBgm) */
  bgmFadeOut(duration, next) {
    const s = this.bgmSrc;
    if (!s || !this.ctx) { if (next) this.bgm(next); return; }
    s.g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    setTimeout(() => { if (this.bgmSrc === s) this.stopBGM(); if (next) this.bgm(next); }, duration * 1000);
  }
  GetBGMName() { return this.bgmName; }
  /** option toggles (UIOptionPopup BGM / SFX): volume 1 or 0, applied to the playing BGM at once */
  SetBGM(on) {
    this.bgmVolume = on ? 1 : 0;
    const d = this._data(this.bgmName);
    if (this.bgmSrc && d) this.bgmSrc.g.gain.value = d.volume * this.bgmVolume;
  }
  SetSFX(on) { this.soundVolume = on ? 1 : 0; }
}
