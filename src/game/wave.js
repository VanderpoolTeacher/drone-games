import { CONFIG } from '../config.js';
import { spawnDrone } from './drones.js';
import { playSfx, stopAllContinuous } from '../audio/sfx.js';

function jitterInterval(ms) {
  return ms * (0.85 + Math.random() * 0.3);   // ±15%
}

function jitterCount(base) {
  const delta = Math.floor(Math.random() * 5) - 2;   // -2..+2 inclusive
  return Math.max(1, base + delta);
}

export function updateWave(state, dt) {
  if (state.wave.phase === 'prep') {
    state.wave.prepMs -= dt * 1000;
    if (state.wave.prepMs <= 0) {
      state.wave.phase = 'active';
      state.wave.spawnProgress = CONFIG.waves[state.wave.number - 1].drones.map(d => ({
        type: d.type,
        count: jitterCount(d.count),
        spawnInterval: d.spawnInterval,
        spawnDelayMs: d.spawnDelayMs ?? 0,
        timerMs: 0,
        spawned: 0,
        currentDelay: jitterInterval(d.spawnInterval),
      }));
      playSfx('waveStart');
    }
    return;
  }

  if (state.wave.phase === 'active') {
    for (const p of state.wave.spawnProgress) {
      if (p.spawned >= p.count) continue;
      p.timerMs += dt * 1000;
      if (p.timerMs < p.spawnDelayMs) continue;

      while (p.spawned < p.count && (p.timerMs - p.spawnDelayMs) >= p.currentDelay) {
        spawnDrone(state, p.type);
        p.spawned += 1;
        p.timerMs -= p.currentDelay;
        p.currentDelay = jitterInterval(p.spawnInterval);
      }
    }

    const allSpawned = state.wave.spawnProgress.every(p => p.spawned >= p.count);
    if (allSpawned && state.drones.length === 0) {
      if (state.wave.number < CONFIG.waves.length) {
        state.resources += CONFIG.resourcesPerWaveBonus;
        state.wave.number += 1;
        state.wave.phase = 'prep';
        state.wave.prepMs = CONFIG.prepTimeBetweenWaves;
        state.wave.spawnProgress = [];
      } else {
        // Final wave cleared — no bonus paid; winFlag fires instead.
        state.wave.phase = 'won';
        state.winFlag = true;
        stopAllContinuous();
        playSfx('win');
      }
    }
    return;
  }
}
