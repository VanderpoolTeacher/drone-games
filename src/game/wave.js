import { CONFIG } from '../config.js';
import { spawnDrone } from './drones.js';
import { applyDelivery, liveBridgeCount } from './state.js';
import { playSfx, stopAllContinuous } from '../audio/sfx.js';

function jitterInterval(ms) {
  return ms * (0.85 + Math.random() * 0.3);   // ±15%
}

function jitterCount(base) {
  const delta = Math.floor(Math.random() * 5) - 2;   // -2..+2 inclusive
  return Math.max(1, base + delta);
}

// Convert prior-wave ISR intel points (seconds scanned outside RF jamming)
// into a drone-count multiplier for the CURRENT wave.
function intelMultiplier(intelPoints) {
  if (intelPoints <= 5)  return 1.0;
  if (intelPoints <= 20) return 1.25;
  if (intelPoints <= 45) return 1.50;
  return 1.75;   // overwhelming — massive attack
}

// The more defenses the player has on the board, the more committed the
// enemy response. Dynamic difficulty: player investment → enemy intensity.
function defenseMultiplier(defenseCount) {
  if (defenseCount <= 2)  return 1.0;
  if (defenseCount <= 5)  return 1.30;
  if (defenseCount <= 9)  return 1.70;
  if (defenseCount <= 14) return 2.20;
  if (defenseCount <= 19) return 2.70;
  return 3.20;   // fortress — overwhelm with mass
}

export function updateWave(state, dt) {
  if (state.wave.phase === 'prep') {
    // Hold the inbound timer while the commander briefing is still on screen
    // so the player always gets to read it fully before drones start spawning.
    if (state.briefing?.phase === 'visible') return;
    state.wave.prepMs -= dt * 1000;
    if (state.wave.prepMs <= 0) {
      state.wave.phase = 'active';
      const intelMult = intelMultiplier(state.lastWaveIsrIntel ?? 0);
      const defMult   = defenseMultiplier(state.defenses?.length ?? 0);
      const mult = intelMult * defMult;
      state.wave.intelMult = intelMult;
      state.wave.defenseMult = defMult;
      state.wave.spawnProgress = CONFIG.waves[state.wave.number - 1].drones.map(d => ({
        type: d.type,
        count: Math.round(jitterCount(d.count) * mult),
        spawnInterval: d.spawnInterval,
        spawnDelayMs: d.spawnDelayMs ?? 0,
        timerMs: 0,
        spawned: 0,
        currentDelay: jitterInterval(d.spawnInterval),
        targetBridges: d.targetBridges === true,
      }));
      // Intel-driven escalation: when prior-wave intel was high, inject
      // attack drone types (OWA / payload) that weren't originally scheduled.
      const hasType = t => state.wave.spawnProgress.some(p => p.type === t);
      if (mult >= 1.5 && !hasType('owa')) {
        state.wave.spawnProgress.push({
          type: 'owa',
          count: Math.round(6 * mult),
          spawnInterval: 5000,
          spawnDelayMs: 5000,
          timerMs: 0, spawned: 0, currentDelay: jitterInterval(5000),
        });
      }
      if (mult >= 1.75 && !hasType('payloadDelivery')) {
        state.wave.spawnProgress.push({
          type: 'payloadDelivery',
          count: 3,
          spawnInterval: 10000,
          spawnDelayMs: 15000,
          timerMs: 0, spawned: 0, currentDelay: jitterInterval(10000),
        });
      }
      // Counter-meta: ISR reported defense types, enemy sends counters.
      const seen = state.lastWaveObservedDefenseTypes ?? {};
      const COUNTER_THRESHOLD = 4;   // seconds of observation
      if ((seen.rfJammer ?? 0) >= COUNTER_THRESHOLD) {
        // RF seen heavily → more OWA (preprogrammed, RF can't jam).
        const owa = state.wave.spawnProgress.find(p => p.type === 'owa');
        if (owa) owa.count += 3;
        else state.wave.spawnProgress.push({
          type: 'owa', count: 4, spawnInterval: 5000, spawnDelayMs: 8000,
          timerMs: 0, spawned: 0, currentDelay: jitterInterval(5000),
        });
      }
      if ((seen.interceptor ?? 0) >= COUNTER_THRESHOLD) {
        // Interceptors seen → armored payload (tanks through kinetic).
        const pay = state.wave.spawnProgress.find(p => p.type === 'payloadDelivery');
        if (pay) pay.count += 2;
        else state.wave.spawnProgress.push({
          type: 'payloadDelivery', count: 2, spawnInterval: 12000, spawnDelayMs: 18000,
          timerMs: 0, spawned: 0, currentDelay: jitterInterval(12000),
        });
      }
      if ((seen.laser ?? 0) >= COUNTER_THRESHOLD) {
        // Lasers seen → swarm ISR first to saturate single-beam lasers.
        const isr = state.wave.spawnProgress.find(p => p.type === 'isr');
        if (isr) isr.count += 8;
        else state.wave.spawnProgress.push({
          type: 'isr', count: 10, spawnInterval: 3500, spawnDelayMs: 0,
          timerMs: 0, spawned: 0, currentDelay: jitterInterval(3500),
        });
      }
      // Reset live counters; old values are preserved in lastWaveIsr* fields.
      state.isrEscapedThisWave = 0;
      state.isrIntelThisWave = 0;
      state.wave.activeElapsedMs = 0;
      state.wave.activeStartWallMs = Date.now();   // wall-clock anchor
      state.wave.annihilationFired = false;
      state.wave.carpetBombFired = false;
      state.wave.bridgesLostFired = false;
      state.observedStructuresThisWave = new Set();
      state.laneIntelThisWave = {};
      state.observedDefenseTypesThisWave = { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 };
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
        spawnDrone(state, p.type, {
          carpetBomb: p.carpetBomb === true,
          targetBridges: p.targetBridges === true,
        });
        p.spawned += 1;
        p.timerMs -= p.currentDelay;
        p.currentDelay = jitterInterval(p.spawnInterval);
      }
    }

    // Annihilation trigger: if the player has placed NOTHING by ~45 s into
    // an active wave, enemy commits a devastating OWA swarm. Fires once.
    // Use wall-clock elapsed (Date.now) so lag / dt-capping doesn't drift.
    state.wave.activeElapsedMs = state.wave.activeStartWallMs
      ? Date.now() - state.wave.activeStartWallMs
      : (state.wave.activeElapsedMs ?? 0) + dt * 1000;
    const noDefenses = (state.defenses?.length ?? 0) === 0;
    if (!state.wave.annihilationFired
        && state.wave.activeElapsedMs >= 45000
        && noDefenses) {
      state.wave.annihilationFired = true;
      state.wave.spawnProgress.push({
        type: 'owa',
        count: 20,
        spawnInterval: 1800,
        spawnDelayMs: 0,
        timerMs: 0, spawned: 0, currentDelay: jitterInterval(1800),
      });
    }
    // Carpet-bomb trigger: end-of-wave, still nothing placed → rain payload
    // drones across the whole map, dropping on RANDOM land tiles.
    // All-bridges-lost trigger: once the city is cut off from supply, enemy
    // commits a finishing strike — heavy carpet-bomb payload rush.
    if (!state.wave.bridgesLostFired && liveBridgeCount(state) === 0) {
      state.wave.bridgesLostFired = true;
      state.wave.spawnProgress.push({
        type: 'payloadDelivery',
        count: 25,
        spawnInterval: 1200,
        spawnDelayMs: 1000,
        timerMs: 0, spawned: 0, currentDelay: jitterInterval(1200),
        carpetBomb: true,
      });
    }
    if (!state.wave.carpetBombFired
        && state.wave.activeElapsedMs >= 50000
        && noDefenses) {
      state.wave.carpetBombFired = true;
      state.wave.spawnProgress.push({
        type: 'payloadDelivery',
        count: 20,
        spawnInterval: 1500,
        spawnDelayMs: 0,
        timerMs: 0, spawned: 0, currentDelay: jitterInterval(1500),
        carpetBomb: true,   // payload spawn reads this to fly straight to random land
      });
    }

    // Hard wave timer (#49). Stop spawning 5 s before maxMs so the last
    // drones in flight have time to die or escape; at maxMs, force-clear
    // any survivors so the wave-complete check below fires this frame.
    const maxMs = CONFIG.waves[state.wave.number - 1]?.activeMaxMs;
    if (maxMs) {
      if (state.wave.activeElapsedMs >= maxMs - 5000) {
        for (const p of state.wave.spawnProgress) {
          if (p.spawned < p.count) p.spawned = p.count;
        }
      }
      if (state.wave.activeElapsedMs >= maxMs) {
        state.drones.length = 0;
      }
    }

    const allSpawned = state.wave.spawnProgress.every(p => p.spawned >= p.count);
    if (allSpawned && state.drones.length === 0) {
      if (state.wave.number < CONFIG.waves.length) {
        // Stash ISR recon results for the NEXT wave's intelMultiplier +
        // intel-guided OWA corridor selection.
        state.lastWaveIsrEscaped = state.isrEscapedThisWave ?? 0;
        state.lastWaveIsrIntel = state.isrIntelThisWave ?? 0;
        state.lastWaveObservedStructures = new Set(state.observedStructuresThisWave ?? []);
        state.lastWaveLaneIntel = { ...(state.laneIntelThisWave ?? {}) };
        state.lastWaveObservedDefenseTypes = { ...(state.observedDefenseTypesThisWave ?? {}) };
        state.wave.number += 1;
        state.wave.phase = 'prep';
        state.wave.prepMs = CONFIG.prepTimeBetweenWaves;
        state.wave.spawnProgress = [];
        applyDelivery(state, state.wave.number - 1);
      } else {
        // Final wave cleared — no bonus paid; winFlag fires instead.
        state.wave.phase = 'won';
        state.winFlag = true;
        state.stats.runEndMs = Date.now();
        stopAllContinuous();
        playSfx('win');
      }
    }
    return;
  }
}
