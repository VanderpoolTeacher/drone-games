// Browser fast-forward simulator — issue #43 A1 (minimal).
//
// Usage: call startSim(gameState, { strategy, speed }) from a keybind or UI
// button. Each frame after this will: step the existing update pipeline N
// extra times (speed) and silently follow the strategy script. Renders still
// draw so you can watch, but at ~60 Hz * simSpeed = effective game rate.
//
// When the run ends (win / lose / abort), prints a summary to the console:
//   - outcome, waves survived, intel leaked, drones killed, casualties,
//     structures lost, bridges lost, payloads spawned vs pool.
//
// Strategies are declarative arrays of step objects:
//   { waveNumber: 1, action: 'place', type: 'rfJammer', tile: {x:3,y:4} }
//   { waveNumber: 1, action: 'place', type: 'interceptor', tile: {x:8,y:5} }
// Placement is attempted during PREP of that wave. Steps missing required
// inventory are retried next frame until prep ends or the step succeeds.

import { MAP } from './map.js';
import { placeDefense } from './defenses.js';

const STRATEGIES = {
  // Minimum viable loadout spread across waves 1-4. Tuned to not crash if
  // tiles are occupied — placement just fails silently and the step retires.
  'early-rf': [
    { waveNumber: 1, type: 'rfJammer',   tile: { x: 4,  y: 4 } },
    { waveNumber: 2, type: 'laser',      tile: { x: 10, y: 4 } },
    { waveNumber: 3, type: 'rfJammer',   tile: { x: 16, y: 4 } },
    { waveNumber: 3, type: 'interceptor',tile: { x: 22, y: 8 } },
    { waveNumber: 4, type: 'interceptor',tile: { x: 14, y: 10 } },
    { waveNumber: 4, type: 'laser',      tile: { x: 24, y: 10 } },
    { waveNumber: 5, type: 'hpm',        tile: { x: 18, y: 6 }, facingRad: Math.PI / 2 },
  ],
  'no-defenses': [],
};

export function listStrategies() { return Object.keys(STRATEGIES); }

export function startSim(state, { strategy = 'early-rf', speed = 10 } = {}) {
  if (state.simMode) return;
  state.simMode = true;
  state.simSpeed = speed;
  state.simStats = newStatsBlock(strategy);
  state.simStrategy = (STRATEGIES[strategy] ?? []).map(s => ({ ...s, done: false }));
  state.simStartWallMs = Date.now();
  console.log('[sim] start strategy=' + strategy + ' speed=' + speed + 'x');
}

export function stopSim(state, outcome = 'abort') {
  if (!state.simMode) return;
  state.simMode = false;
  const s = state.simStats;
  if (!s) return;
  s.outcome = outcome;
  s.runMs = Date.now() - state.simStartWallMs;
  s.wavesSurvived = outcome === 'win'
    ? 5
    : Math.max(0, (state.wave?.number ?? 1) - 1);
  // Collect final counters from live state so we don't duplicate tracking.
  s.casualties = totalCasualties(state);
  s.structuresLost = state.stats?.structuresLost ?? 0;
  s.defensesLost = state.stats?.defensesLost ?? 0;
  s.droneKills = { ...(state.stats?.droneKills ?? {}) };
  s.lastIntel = state.lastWaveIsrIntel ?? 0;
  s.payloadPoolRemaining = state.payloadPool ?? 0;
  s.bridgesLive = (state.bridgeHp)
    ? Object.values(state.bridgeHp).filter(h => h > 0).length
    : 0;
  console.log('[sim] end', s);
  console.table?.([{
    strategy: s.strategy,
    outcome: s.outcome,
    waves: s.wavesSurvived + '/5',
    runMs: s.runMs,
    casualties: s.casualties,
    structsLost: s.structuresLost,
    defsLost: s.defensesLost,
    intel: Math.round(s.lastIntel),
    payloadsLeft: s.payloadPoolRemaining,
    isrKills: s.droneKills.isr ?? 0,
    owaKills: s.droneKills.owa ?? 0,
    payloadKills: s.droneKills.payloadDelivery ?? 0,
  }]);
}

// Called once per render frame from main.js while simMode is true. Advances
// strategy steps (attempts placements) + auto-dismisses any visible briefing.
export function tickSim(state) {
  if (!state.simMode) return;
  // Dismiss briefings immediately — the sim doesn't read.
  if (state.briefing?.phase === 'visible') {
    state.briefing.phase = 'idle';
    state.briefing.expandedOnce = true;
  }
  // Prep phase — try to execute this wave's placements.
  if (state.wave?.phase !== 'prep') return;
  const wn = state.wave.number;
  for (const step of state.simStrategy) {
    if (step.done) continue;
    if (step.waveNumber !== wn) continue;
    const stock = state.inventory?.[step.type] ?? 0;
    if (stock <= 0) continue;   // wait for supply
    const d = placeDefense(state, step.type, step.tile, step.facingRad ?? 0);
    if (d) step.done = true;
  }
  // Detect terminal states for reporting.
  if (state.winFlag) stopSim(state, 'win');
  else if (state.loseFlag) stopSim(state, 'lose');
}

function newStatsBlock(strategy) {
  return {
    strategy,
    outcome: 'running',
    runMs: 0,
    wavesSurvived: 0,
    casualties: 0,
    structuresLost: 0,
    defensesLost: 0,
    droneKills: {},
    lastIntel: 0,
    payloadPoolRemaining: 0,
    bridgesLive: 0,
  };
}

function totalCasualties(state) {
  let lost = 0;
  for (const apt of MAP.apartments) {
    const key = apt.tile.x + ',' + apt.tile.y;
    const cur = state.apartmentPop?.[key] ?? apt.maxPop;
    lost += apt.maxPop - cur;
  }
  return lost + (state.financialPenalty ?? 0);
}
