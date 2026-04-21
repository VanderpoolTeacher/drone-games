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

// --- Public API --------------------------------------------------------

const ONE_SHOTS = {
  uiClick: playUiClick,
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
