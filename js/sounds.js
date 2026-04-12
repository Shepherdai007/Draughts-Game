/**
 * sounds.js - Sound manager using Web Audio API
 * All sounds are synthesized - no audio files required (works offline)
 */

class SoundManager {
  constructor() {
    this._ctx = null;
    this._muted = false;
    this._volume = 0.7;
    this._load();
  }

  _load() {
    try {
      const saved = localStorage.getItem('kingsmakers_sound');
      if (saved) {
        const s = JSON.parse(saved);
        this._muted = s.muted || false;
        this._volume = s.volume !== undefined ? s.volume : 0.7;
      }
    } catch (e) {}
  }

  _save() {
    try {
      localStorage.setItem('kingsmakers_sound', JSON.stringify({ muted: this._muted, volume: this._volume }));
    } catch (e) {}
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  isMuted() { return this._muted; }
  setMuted(v) { this._muted = v; this._save(); }
  toggleMute() { this._muted = !this._muted; this._save(); return this._muted; }
  setVolume(v) { this._volume = Math.max(0, Math.min(1, v)); this._save(); }

  _master(ctx) {
    const g = ctx.createGain();
    g.gain.value = this._muted ? 0 : this._volume;
    g.connect(ctx.destination);
    return g;
  }

  /** Short click for piece move */
  playMove() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(master);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /** Crunch/explosion for capturing a piece */
  playCapture() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    // Noise burst
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 1.5;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(ctx.currentTime);
    // Add a punch
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.connect(og); og.connect(master);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.15);
    og.gain.setValueAtTime(0.7, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** Fanfare for king promotion */
  playKingPromotion() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /** Victory melody when player wins */
  playVictory() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const melody = [523, 659, 784, 1047, 1175, 1047, 784, 1047];
    const dur = 0.18;
    melody.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = 'square';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * dur;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur - 0.01);
      osc.start(t);
      osc.stop(t + dur);
    });
  }

  /** Sad tones when computer wins */
  playDefeat() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const notes = [440, 392, 349, 294];
    const dur = 0.4;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(master);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * dur;
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9);
      osc.start(t);
      osc.stop(t + dur * 0.9);
    });
  }

  /** Dramatic intro sting */
  playIntroStrike() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    // Bass hit
    const bass = ctx.createOscillator();
    const bg = ctx.createGain();
    bass.connect(bg); bg.connect(master);
    bass.type = 'sawtooth';
    bass.frequency.setValueAtTime(110, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.8);
    bg.gain.setValueAtTime(0.9, ctx.currentTime);
    bg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.8);
    // Sparkle
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(master);
      osc.type = 'sine';
      osc.frequency.value = 880 + i * 200;
      const t = ctx.currentTime + 0.05 + i * 0.06;
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t); osc.stop(t + 0.25);
    }
  }

  /** Explosion sound for board intro burst */
  playExplosion() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(ctx.currentTime);
    // Rumble
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.connect(og); og.connect(master);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.0);
    og.gain.setValueAtTime(0.8, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.0);
  }

  /** UI button click */
  playClick() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(master);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.06);
  }

  /** Select a piece */
  playSelect() {
    if (this._muted) return;
    const ctx = this._getCtx();
    const master = this._master(ctx);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(master);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.1);
  }
}
