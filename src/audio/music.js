import { CONFIG } from '../config.js';
import { getAudioContext, getMasterGain } from './sfx.js';

const TRACK_DIR = './src/music/';

// key → { audio, source, gain }
const cache = new Map();

let musicGain = null;
let currentKey = null;

function ensureMusicGain() {
  if (musicGain) return musicGain;
  const ctx = getAudioContext();
  musicGain = ctx.createGain();
  musicGain.gain.value = CONFIG.music.volume;
  musicGain.connect(getMasterGain());
  return musicGain;
}

function getOrCreateTrack(key) {
  let entry = cache.get(key);
  if (entry) return entry;

  const ctx = getAudioContext();
  const audio = new Audio(TRACK_DIR + encodeURIComponent(key) + '.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  const source = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(gain);
  gain.connect(ensureMusicGain());

  entry = { audio, source, gain };
  cache.set(key, entry);
  return entry;
}

function playTrack(key) {
  if (key === currentKey) return;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') ctx.resume();

  const fadeSec = CONFIG.music.crossfadeMs / 1000;
  const t = ctx.currentTime;

  // Fade the old track down, then pause + rewind.
  const prevKey = currentKey;
  if (prevKey) {
    const prev = cache.get(prevKey);
    if (prev) {
      prev.gain.gain.cancelScheduledValues(t);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, t);
      prev.gain.gain.linearRampToValueAtTime(0, t + fadeSec);
      setTimeout(() => {
        if (currentKey === prevKey) return;  // came back — leave it playing
        prev.audio.pause();
        try { prev.audio.currentTime = 0; } catch (_e) { /* ignore */ }
      }, CONFIG.music.crossfadeMs + 20);
    }
  }

  // Start / fade in the new track.
  const next = getOrCreateTrack(key);
  const playPromise = next.audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => { /* autoplay block — next frame will retry */ });
  }
  next.gain.gain.cancelScheduledValues(t);
  next.gain.gain.setValueAtTime(0, t);
  next.gain.gain.linearRampToValueAtTime(1, t + fadeSec);

  currentKey = key;
}

function musicKeyForState(state) {
  if (state.screenPhase === 'start') return CONFIG.music.title;
  if (state.loseFlag) return CONFIG.music.lose;
  if (state.winFlag) return CONFIG.music.win;
  const entry = CONFIG.music.waves[state.wave.number - 1];
  if (!entry) return null;
  if (state.wave.phase === 'prep')   return entry.prep;
  if (state.wave.phase === 'active') return entry.active;
  if (state.wave.phase === 'won')    return CONFIG.music.win;
  return null;
}

export function updateMusic(state) {
  const key = musicKeyForState(state);
  if (key === null) return;
  if (key === currentKey) return;

  // Gate on AudioContext existing (i.e., user has clicked at least once so
  // SFX has spun up the context). Music can't play before the first gesture.
  const ctx = getAudioContext();
  if (!ctx || ctx.state === 'closed') return;

  playTrack(key);
}

export function stopMusic() {
  if (!currentKey) return;
  const entry = cache.get(currentKey);
  if (entry) {
    entry.audio.pause();
    try { entry.audio.currentTime = 0; } catch (_e) { /* ignore */ }
  }
  currentKey = null;
}

export function setMusicVolume(v) {
  ensureMusicGain().gain.value = v;
}
