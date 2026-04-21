// Web Audio SFX — all sounds synthesized from oscillators + noise buffers.
// No assets. Master GainNode gates mute. AudioContext is lazy-initialized
// on first playSfx call so we satisfy browser autoplay policy.

const MUTED_KEY = 'droneDefense.muted';

let audioCtx = null;
let masterGain = null;
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
  gain.connect(masterGain);
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
  nGain.connect(masterGain);
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
  oGain.connect(masterGain);
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
  nGain.connect(masterGain);
  nSrc.start(t);
  nSrc.stop(t + 0.26);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 80;
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.45, t);
  oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(oGain);
  oGain.connect(masterGain);
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
    g.connect(masterGain);
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
  lowGain.connect(masterGain);
  low.start(t);
  low.stop(t + 0.51);

  const mid = ctx.createOscillator();
  mid.type = 'sine';
  mid.frequency.value = 200;
  const midGain = ctx.createGain();
  midGain.gain.setValueAtTime(0.4, t);
  midGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  mid.connect(midGain);
  midGain.connect(masterGain);
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
  nGain.connect(masterGain);
  nSrc.start(t);
  nSrc.stop(t + 0.7);

  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 40;
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.6, t);
  subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  sub.connect(subGain);
  subGain.connect(masterGain);
  sub.start(t);
  sub.stop(t + 0.61);

  const crackle = ctx.createBufferSource();
  crackle.buffer = makeNoiseBuffer(ctx, 0.2);
  const crackleGain = ctx.createGain();
  crackleGain.gain.setValueAtTime(0.2, t + 0.15);
  crackleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  crackle.connect(crackleGain);
  crackleGain.connect(masterGain);
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
    g.connect(masterGain);
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
    g.connect(masterGain);
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
  g.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.81);
}

// --- Public API --------------------------------------------------------

const ONE_SHOTS = {
  uiClick: playUiClick,
  interceptorLaunch: playInterceptorLaunch,
  droneKill: playDroneKill,
  laserOverheat: playLaserOverheat,
  hpmPulse: playHpmPulse,
  structureDestroyed: playStructureDestroyed,
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
