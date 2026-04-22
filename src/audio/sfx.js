// Web Audio SFX — all sounds synthesized from oscillators + noise buffers.
// No assets. Master GainNode gates mute. AudioContext is lazy-initialized
// on first playSfx call so we satisfy browser autoplay policy.

const MUTED_KEY = 'droneDefense.muted';

const SFX_VOLUME = 0.45;           // sits under music/voice without squashing SFX

let audioCtx = null;
let masterGain = null;
let sfxGain = null;
let muted = loadMutedFromStorage();

function loadMutedFromStorage() {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch (_e) {
    return false;
  }
}

function saveMutedToStorage(val) {
  try {
    localStorage.setItem(MUTED_KEY, val ? '1' : '0');
  } catch (_e) {
    // localStorage can throw in private mode; silently ignore.
  }
}

function getCtx() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 1;
  masterGain.connect(audioCtx.destination);
  sfxGain = audioCtx.createGain();
  sfxGain.gain.value = SFX_VOLUME;
  sfxGain.connect(masterGain);
  return audioCtx;
}

// --- Synthesis helpers -------------------------------------------------

function makeNoiseBuffer(ctx, durationSec) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

// --- Per-sound functions ----------------------------------------------

function playUiClick() {
  const ctx = getCtx();
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 800;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.3, t + 0.005);
  gain.gain.linearRampToValueAtTime(0, t + 0.05);
  osc.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.06);
}

function playInterceptorLaunch() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const nSrc = ctx.createBufferSource();
  nSrc.buffer = makeNoiseBuffer(ctx, 0.05);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.25, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  nSrc.connect(nGain);
  nGain.connect(sfxGain);
  nSrc.start(t);
  nSrc.stop(t + 0.06);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.linearRampToValueAtTime(800, t + 0.15);
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.3, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(oGain);
  oGain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.16);
}

function playDroneKill() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const nSrc = ctx.createBufferSource();
  nSrc.buffer = makeNoiseBuffer(ctx, 0.25);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.35, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  nSrc.connect(nGain);
  nGain.connect(sfxGain);
  nSrc.start(t);
  nSrc.stop(t + 0.26);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 80;
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.45, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(oGain);
  oGain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.26);
}

function playLaserOverheat() {
  const ctx = getCtx();
  const t0 = ctx.currentTime;

  function beep(startAt) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, startAt);
    g.gain.linearRampToValueAtTime(0.25, startAt + 0.005);
    g.gain.linearRampToValueAtTime(0, startAt + 0.04);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(startAt);
    osc.stop(startAt + 0.05);
  }

  beep(t0);
  beep(t0 + 0.08);
}

function playHpmPulse() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const low = ctx.createOscillator();
  low.type = 'sine';
  low.frequency.value = 60;
  const lowGain = ctx.createGain();
  lowGain.gain.setValueAtTime(0.5, t);
  lowGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  low.connect(lowGain);
  lowGain.connect(sfxGain);
  low.start(t);
  low.stop(t + 0.51);

  const mid = ctx.createOscillator();
  mid.type = 'sine';
  mid.frequency.value = 200;
  const midGain = ctx.createGain();
  midGain.gain.setValueAtTime(0.4, t);
  midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  mid.connect(midGain);
  midGain.connect(sfxGain);
  mid.start(t);
  mid.stop(t + 0.31);
}

function playStructureDestroyed() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const nSrc = ctx.createBufferSource();
  nSrc.buffer = makeNoiseBuffer(ctx, 0.7);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.5, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  nSrc.connect(nGain);
  nGain.connect(sfxGain);
  nSrc.start(t);
  nSrc.stop(t + 0.7);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 40;
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.6, t);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  sub.connect(subGain);
  subGain.connect(sfxGain);
  sub.start(t);
  sub.stop(t + 0.61);

  const crackle = ctx.createBufferSource();
  crackle.buffer = makeNoiseBuffer(ctx, 0.2);
  const crackleGain = ctx.createGain();
  crackleGain.gain.setValueAtTime(0.2, t + 0.15);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  crackle.connect(crackleGain);
  crackleGain.connect(sfxGain);
  crackle.start(t + 0.15);
  crackle.stop(t + 0.36);
}

function playWaveStart() {
  const ctx = getCtx();
  const t0 = ctx.currentTime;

  function note(freq, offsetSec) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0 + offsetSec);
    g.gain.linearRampToValueAtTime(0.25, t0 + offsetSec + 0.01);
    g.gain.linearRampToValueAtTime(0, t0 + offsetSec + 0.08);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0 + offsetSec);
    osc.stop(t0 + offsetSec + 0.09);
  }

  note(523.25, 0.00);
  note(659.25, 0.08);
  note(783.99, 0.16);
}

function playWin() {
  const ctx = getCtx();
  const t0 = ctx.currentTime;

  function note(freq, offsetSec) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0 + offsetSec);
    g.gain.linearRampToValueAtTime(0.25, t0 + offsetSec + 0.01);
    g.gain.linearRampToValueAtTime(0, t0 + offsetSec + 0.1);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0 + offsetSec);
    osc.stop(t0 + offsetSec + 0.11);
  }

  note(523.25, 0.00);
  note(659.25, 0.10);
  note(783.99, 0.20);
  note(1046.50, 0.30);
}

function playLose() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.linearRampToValueAtTime(175, t + 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.81);
}

function playStructureHit() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const nSrc = ctx.createBufferSource();
  nSrc.buffer = makeNoiseBuffer(ctx, 0.08);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.15, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  nSrc.connect(nGain);
  nGain.connect(sfxGain);
  nSrc.start(t);
  nSrc.stop(t + 0.09);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 100;
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.2, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(oGain);
  oGain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.13);
}

function playStructureHitHeavy() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const nSrc = ctx.createBufferSource();
  nSrc.buffer = makeNoiseBuffer(ctx, 0.25);
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.35, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  nSrc.connect(nGain);
  nGain.connect(sfxGain);
  nSrc.start(t);
  nSrc.stop(t + 0.26);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 55;
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.5, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(oGain);
  oGain.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.31);
}

// --- Continuous sounds -------------------------------------------------

// id → { nodes: [...], gain } — nodes are stopped and disconnected on stopSfx.
const continuous = new Map();

function makeLaserFireNodes() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 220;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2000;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.2, t, 0.02);    // 20ms fade-in

  // LFO on gain for subtle amp wobble at 8 Hz.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 8;
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 0.03;       // ±3% wobble
  lfo.connect(lfoAmp);
  lfoAmp.connect(gain.gain);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  lfo.start(t);

  return { osc, lfo, gain };
}

function makeRfJamNodes() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Looping 1-second noise buffer.
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, 1.0);
  src.loop = true;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1000;
  bp.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.15, t, 0.03);   // 30ms fade-in

  // Slow amp modulation at 3 Hz for that "electronic hum" feel.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 3;
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 0.04;
  lfo.connect(lfoAmp);
  lfoAmp.connect(gain.gain);

  src.connect(bp);
  bp.connect(gain);
  gain.connect(sfxGain);
  src.start(t);
  lfo.start(t);

  return { src, lfo, gain };
}

function makeStructuresAlarmNodes() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // Two-tone siren: osc center 550 Hz modulated ±110 Hz by a 1 Hz square
  // LFO → alternates 440 / 660 Hz every 0.5 s.
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 550;

  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 1;
  const lfoAmp = ctx.createGain();
  lfoAmp.gain.value = 110;
  lfo.connect(lfoAmp);
  lfoAmp.connect(osc.frequency);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1500;

  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(0.08, t, 0.1);   // soft 100ms fade-in, quiet

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);
  osc.start(t);
  lfo.start(t);

  return { osc, lfo, gain };
}

const CONTINUOUS_FACTORIES = {
  laserFire: makeLaserFireNodes,
  rfJam: makeRfJamNodes,
  structuresAlarm: makeStructuresAlarmNodes,
};

export function startSfx(name, id) {
  if (continuous.has(id)) return;   // idempotent — already running
  const factory = CONTINUOUS_FACTORIES[name];
  if (!factory) {
    console.warn('[sfx] unknown continuous sound: ' + name);
    return;
  }
  continuous.set(id, factory());
}

export function stopSfx(id) {
  const entry = continuous.get(id);
  if (!entry) return;
  continuous.delete(id);

  const ctx = getCtx();
  const t = ctx.currentTime;
  // Ramp gain to 0 over 30ms to avoid click, then hard-stop.
  entry.gain.gain.cancelScheduledValues(t);
  entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
  entry.gain.gain.linearRampToValueAtTime(0, t + 0.03);

  const stopAt = t + 0.05;
  if (entry.osc) entry.osc.stop(stopAt);
  if (entry.src) entry.src.stop(stopAt);
  if (entry.lfo) entry.lfo.stop(stopAt);
}

export function stopAllContinuous() {
  for (const id of [...continuous.keys()]) stopSfx(id);
}

// --- Public API --------------------------------------------------------

const ONE_SHOTS = {
  uiClick: playUiClick,
  interceptorLaunch: playInterceptorLaunch,
  droneKill: playDroneKill,
  laserOverheat: playLaserOverheat,
  hpmPulse: playHpmPulse,
  structureDestroyed: playStructureDestroyed,
  structureHit: playStructureHit,
  structureHitHeavy: playStructureHitHeavy,
  waveStart: playWaveStart,
  win: playWin,
  lose: playLose,
};

export function playSfx(name) {
  const fn = ONE_SHOTS[name];
  if (!fn) {
    console.warn('[sfx] unknown sound: ' + name);
    return;
  }
  fn();
}

export function toggleMute() {
  muted = !muted;
  saveMutedToStorage(muted);
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
}

export function isMuted() {
  return muted;
}

// For sibling audio modules (e.g., music.js) that need to route through the
// same AudioContext + masterGain so mute works uniformly.
export function getAudioContext() {
  return getCtx();
}

export function getMasterGain() {
  getCtx();       // ensure masterGain exists
  return masterGain;
}
