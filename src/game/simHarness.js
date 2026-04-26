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
import { resetGameState } from './state.js';
import { applyMode } from '../config.js';

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
  // Sensor-first archetype (#50): place radar wave 1 before any effector,
  // layer effectors as deliveries arrive.
  'radar-first': [
    { waveNumber: 1, type: 'radar',       tile: { x: 18, y: 9 } },
    { waveNumber: 2, type: 'laser',       tile: { x: 22, y: 9 } },
    { waveNumber: 3, type: 'rfJammer',    tile: { x: 16, y: 9 } },
    { waveNumber: 3, type: 'interceptor', tile: { x: 24, y: 8 } },
    { waveNumber: 3, type: 'radar',       tile: { x: 12, y: 8 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 14, y: 10 } },
    { waveNumber: 4, type: 'laser',       tile: { x: 20, y: 10 } },
    { waveNumber: 5, type: 'hpm',         tile: { x: 18, y: 6 }, facingRad: Math.PI / 2 },
  ],
  // Kinetic-only archetype (#50): interceptors only. Tests finite magazine
  // + no DEW + no RF. Scripts more attempts than per-wave delivery to ride
  // on the auto-trickle.
  'kinetic-only': [
    { waveNumber: 3, type: 'interceptor', tile: { x: 22, y: 9 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 14, y: 10 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 25, y: 9 } },
    { waveNumber: 5, type: 'interceptor', tile: { x: 16, y: 9 } },
    { waveNumber: 5, type: 'interceptor', tile: { x: 20, y: 9 } },
  ],
  // DEW-only archetype (#50): laser + HPM only. Tests directed-energy
  // economy under saturation; no kinetic, no RF, no sensors.
  'dew-only': [
    { waveNumber: 2, type: 'laser', tile: { x: 18, y: 9 } },
    { waveNumber: 4, type: 'laser', tile: { x: 22, y: 9 } },
    { waveNumber: 4, type: 'laser', tile: { x: 14, y: 10 } },
    { waveNumber: 5, type: 'hpm',   tile: { x: 18, y: 6 }, facingRad: Math.PI / 2 },
  ],
  // Optimal layered (#50): one of every defense type as it becomes
  // available. Should be the high-water mark for win rate.
  'balanced-stack': [
    { waveNumber: 1, type: 'rfJammer',    tile: { x: 16, y: 9 } },
    { waveNumber: 1, type: 'radar',       tile: { x: 22, y: 9 } },
    { waveNumber: 2, type: 'laser',       tile: { x: 14, y: 10 } },
    { waveNumber: 3, type: 'rfJammer',    tile: { x: 25, y: 9 } },
    { waveNumber: 3, type: 'interceptor', tile: { x: 18, y: 6 } },
    { waveNumber: 3, type: 'radar',       tile: { x: 12, y: 8 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 20, y: 10 } },
    { waveNumber: 4, type: 'laser',       tile: { x: 27, y: 9 } },
    { waveNumber: 5, type: 'hpm',         tile: { x: 18, y: 7 }, facingRad: Math.PI / 2 },
  ],
};

export function listStrategies() { return Object.keys(STRATEGIES); }

const SIM_LOG_KEY = 'droneDefense.simRuns';

// Append one stats block to the persistent sim log in localStorage. Returns
// the total number of recorded runs (for console feedback).
function appendSimRun(stats) {
  let log = [];
  try {
    const raw = localStorage.getItem(SIM_LOG_KEY);
    if (raw) log = JSON.parse(raw);
    if (!Array.isArray(log)) log = [];
  } catch (_) { log = []; }
  log.push({ ...stats, recordedAt: new Date().toISOString() });
  try { localStorage.setItem(SIM_LOG_KEY, JSON.stringify(log)); }
  catch (_) { /* quota / private mode — ignore */ }
  return log.length;
}

// Export all recorded runs as a downloadable CSV file.
export function downloadSimData() {
  let log = [];
  try {
    const raw = localStorage.getItem(SIM_LOG_KEY);
    if (raw) log = JSON.parse(raw);
  } catch (_) { /* ignore */ }
  if (!Array.isArray(log) || log.length === 0) {
    console.warn('[sim] no recorded runs to export');
    return;
  }
  const cols = [
    'recordedAt', 'strategy', 'outcome', 'wavesSurvived', 'runMs',
    'casualties', 'structuresLost', 'defensesLost',
    'lastIntel', 'payloadPoolRemaining', 'bridgesLive',
    'isrKills', 'owaKills', 'payloadKills',
  ];
  const rows = [cols.join(',')];
  for (const r of log) {
    rows.push(cols.map(c => {
      if (c === 'isrKills') return r.droneKills?.isr ?? 0;
      if (c === 'owaKills') return r.droneKills?.owa ?? 0;
      if (c === 'payloadKills') return r.droneKills?.payloadDelivery ?? 0;
      const v = r[c];
      if (v == null) return '';
      if (typeof v === 'string' && v.includes(',')) return '"' + v + '"';
      return v;
    }).join(','));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drone-defense-sim-' + Date.now() + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  console.log('[sim] exported ' + log.length + ' runs → CSV');
}

export function clearSimData() {
  try { localStorage.removeItem(SIM_LOG_KEY); } catch (_) { /* ignore */ }
  console.log('[sim] cleared sim log');
}

export function startSim(state, { strategy = 'early-rf', speed = 10 } = {}) {
  if (state.simMode) return;
  state.simMode = true;
  state.simSpeed = speed;
  state.simStats = newStatsBlock(strategy);
  state.simStrategy = (STRATEGIES[strategy] ?? []).map(s => ({ ...s, done: false }));
  state.simStartWallMs = Date.now();
  state.simLog = state.simLog ?? [];
  state.simLastWave = 0;
  state._simRuns = (state._simRuns ?? 0) + 1;
  state.simStats.runIdx = state._simRuns;
  appendLog(state, '-- run ' + state._simRuns + ' --');
  console.log('[sim] start strategy=' + strategy + ' speed=' + speed + 'x');
}

// Add a line to the rolling log, trim to last ~200 entries so memory stays
// bounded across many runs. Messages are intentionally short (≤17 chars) so
// they fit the 120-px sidebar panel at the 6-px Press Start 2P font.
export function appendLog(state, msg) {
  if (!state.simLog) state.simLog = [];
  state.simLog.push(msg);
  if (state.simLog.length > 200) state.simLog.splice(0, state.simLog.length - 200);
}

const TYPE_ABBR = { rfJammer: 'rfJ', interceptor: 'int', laser: 'las', hpm: 'hpm' };

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
  const total = appendSimRun(s);
  appendLog(state, 'end ' + outcome + ' ' + s.wavesSurvived + '/5 c' + s.casualties);
  console.log('[sim] end — recorded run #' + total, s);
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
  // Log wave transitions (fires once per new wave).
  if (state.wave?.number !== state.simLastWave) {
    state.simLastWave = state.wave.number;
    appendLog(state, 'W' + state.wave.number + ' ' + state.wave.phase);
  }
  if (state.wave?.phase === 'prep') {
    const wn = state.wave.number;
    for (const step of state.simStrategy) {
      if (step.done) continue;
      if (step.waveNumber !== wn) continue;
      const stock = state.inventory?.[step.type] ?? 0;
      if (stock <= 0) continue;
      const d = placeDefense(state, step.type, step.tile, step.facingRad ?? 0);
      if (d) {
        step.done = true;
        appendLog(state, '+' + (TYPE_ABBR[step.type] ?? step.type) + ' ' + step.tile.x + ',' + step.tile.y);
      }
    }
  }
  // Detect terminal states for reporting.
  if (state.winFlag) stopSim(state, 'win');
  else if (state.loseFlag) stopSim(state, 'lose');
}

// Batch mode — runs N sims of the same strategy back-to-back with rendering
// disabled, so a tuning sweep can finish in a few seconds. Per-run stats land
// in localStorage via the same path as a single sim, so CSV export works.
export function startBatch(state, { strategy = 'early-rf', total = 10, speed = 60 } = {}) {
  if (state.batch?.active) return;
  state.batch = state.batch ?? {};
  state.batch.active = true;
  state.batch.total = Math.max(1, total | 0);
  state.batch.done = 0;
  state.batch.wins = 0;
  state.batch.strategy = strategy;
  state.batch.abort = false;
  state.batch._runStarted = false;
  state.batch._prevSpeed = state.simSpeed ?? 10;
  state.batch._prevSkip = state.simSkipRender ?? false;
  state.simSpeed = speed;
  state.simSkipRender = true;
  console.log('[batch] start strategy=' + strategy + ' total=' + total + ' speed=' + speed + 'x');
}

export function abortBatch(state) {
  if (!state.batch?.active) return;
  state.batch.abort = true;
  if (state.simMode) stopSim(state, 'abort');
}

// Called every frame from main.js. State machine:
//   - if a run is in progress (simMode), do nothing
//   - if a previous run just ended, count the outcome
//   - if we're done (or aborted), finish and restore speed/render
//   - otherwise reset the world and start the next run
export function tickBatch(state) {
  if (!state.batch?.active) return;
  if (state.simMode) return;

  if (state.batch._runStarted) {
    state.batch.done += 1;
    if (state.simStats?.outcome === 'win') state.batch.wins += 1;
    state.batch._runStarted = false;
  }

  if (state.batch.abort || state.batch.done >= state.batch.total) {
    finishBatch(state);
    return;
  }

  // Fresh world for the next run.
  resetGameState();
  applyMode('campaign');
  state.screenPhase = 'playing';
  state.briefing.phase = 'idle';
  state.briefing.expandedOnce = true;
  startSim(state, { strategy: state.batch.strategy, speed: state.simSpeed });
  state.batch._runStarted = true;
}

function finishBatch(state) {
  const b = state.batch;
  console.log('[batch] end ' + (b.abort ? 'aborted ' : '') +
    b.done + '/' + b.total + ' runs · wins ' + b.wins + ' · ' + b.strategy);
  b.active = false;
  state.simSpeed = b._prevSpeed;
  state.simSkipRender = b._prevSkip;
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
