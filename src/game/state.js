import { CONFIG, applyMode } from '../config.js';
import { MAP } from './map.js';
import { playSfx } from '../audio/sfx.js';

const BACKDROP_KEY = 'droneDefense.backdropAlpha';
const BACKDROP_CYCLE = [1, 0.66, 0.33, 0];   // B key cycles through these

function loadBackdropFromStorage() {
  try {
    const v = localStorage.getItem(BACKDROP_KEY);
    if (v === null) return 1;
    const f = parseFloat(v);
    return isFinite(f) ? Math.max(0, Math.min(1, f)) : 1;
  } catch (_e) {
    return 1;
  }
}

export function toggleBackdrop(state) {
  // Snap current alpha to the nearest cycle slot, advance to the next.
  const cur = state.backdropAlpha ?? 1;
  let idx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < BACKDROP_CYCLE.length; i++) {
    const d = Math.abs(BACKDROP_CYCLE[i] - cur);
    if (d < bestDiff) { bestDiff = d; idx = i; }
  }
  const next = BACKDROP_CYCLE[(idx + 1) % BACKDROP_CYCLE.length];
  state.backdropAlpha = next;
  // Manual press wins until the wave phase next changes.
  if (state.backdropAuto) state.backdropAuto.manualOverride = true;
  try {
    localStorage.setItem(BACKDROP_KEY, String(next));
  } catch (_e) {
    // private mode — ignore.
  }
}

// Auto-toggle backdrop based on wave phase. Prep = grid (0), active = image
// (1). Other phases (won/lost) are left alone. Cleared override on every
// phase transition so the auto value wins when waves change.
export function applyBackdropAutoForPhase(state) {
  if (state.screenPhase !== 'playing') return;
  const phase = state.wave?.phase;
  const auto = state.backdropAuto;
  if (!auto) return;
  if (phase === auto.lastPhase) return;
  auto.lastPhase = phase;
  auto.manualOverride = false;
  if (phase === 'prep') state.backdropAlpha = 0;
  else if (phase === 'active') state.backdropAlpha = 1;
}

export function applyDelivery(state, waveIdx) {
  const delivery = CONFIG.deliveries?.[waveIdx];
  if (!delivery) return;

  // Supplies flow as long as ANY bridge survives. All bridges down → 0 supply.
  const live = liveBridgeCount(state);
  const frac = live > 0 ? 1 : 0;

  // Transit modifier: if BOTH transit hubs are down, delivery ×0.75.
  const transits = MAP.structures.filter(s => s.type === 'transit');
  const transitsDown = transits.length > 0
    && transits.every(s => (state.structureHp[s.id] ?? 0) <= 0);
  const transitMult = transitsDown ? 0.75 : 1;

  const scaled = {};
  for (const type of Object.keys(delivery)) {
    const effective = Math.round(delivery[type] * frac * transitMult);
    if (effective <= 0) continue;
    state.inventory[type] = (state.inventory[type] ?? 0) + effective;
    scaled[type] = effective;
  }
  spawnSupplyTrucks(state, scaled);
}

// Supply trucks drive in from a live bridge for each unit delivered.
// Purely decorative; they animate from the bridge tile toward Midtown.
const TRUCK_SPEED = 30;   // px/s

function tilePixel(tile) {
  return {
    x: tile.x * MAP.tileSize + MAP.tileSize / 2,
    y: CONFIG.topBarHeight + MAP.padTop + tile.y * MAP.tileSize + MAP.tileSize / 2,
  };
}

function spawnSupplyTrucks(state, delivery) {
  if (!state.trucks) state.trucks = [];
  const liveBridges = MAP.bridges.filter(b => (state.bridgeHp?.[b.id] ?? 0) > 0);
  if (liveBridges.length === 0) return;

  let staggerMs = 0;
  let anySpawned = false;
  for (const type of Object.keys(delivery)) {
    for (let i = 0; i < delivery[type]; i++) {
      const bridge = liveBridges[Math.floor(Math.random() * liveBridges.length)];
      const start = tilePixel(bridge.tile);
      state.trucks.push({
        type,
        x: start.x,
        y: start.y,
        targetY: CONFIG.topBarHeight + MAP.padTop + 4 * MAP.tileSize,
        delayMs: staggerMs,
        phase: 'waiting',
      });
      staggerMs += 350;
      anySpawned = true;
    }
  }
  if (anySpawned) playSfx('truckDelivery');
}

export function updateTrucks(state, dt) {
  const dtMs = dt * 1000;
  for (const t of state.trucks) {
    if (t.phase === 'done') continue;
    if (t.phase === 'waiting') {
      t.delayMs -= dtMs;
      if (t.delayMs <= 0) t.phase = 'driving';
      continue;
    }
    // driving
    t.y += TRUCK_SPEED * dt;
    if (t.y >= t.targetY) t.phase = 'done';
  }
  state.trucks = state.trucks.filter(t => t.phase !== 'done');

  // Supplies flow whenever bridges live — faster during prep (to stage a
  // loadout), slower during combat. Paused while commander briefing is open.
  if (state.screenPhase !== 'playing') return;
  if (state.briefing?.phase === 'visible') return;
  if (liveBridgeCount(state) === 0) return;
  state.supplyTrickleMs = (state.supplyTrickleMs ?? 0) + dtMs;
  const TRICKLE_MS = 15000;   // every 15 s during prep AND combat
  while (state.supplyTrickleMs >= TRICKLE_MS) {
    state.supplyTrickleMs -= TRICKLE_MS;
    // More live bridges = more trucks per delivery — 1 truck per 3 bridges.
    const live = liveBridgeCount(state);
    const count = Math.max(1, Math.ceil(live / 3));
    // Each type caps at 5 in stockpile — once full, that type is skipped.
    // Forces the player to actually place defenses instead of hoarding them.
    const CAP = 5;
    const available = () => ['rfJammer', 'interceptor', 'laser', 'hpm']
      .filter(t => (state.inventory?.[t] ?? 0) < CAP);
    for (let i = 0; i < count; i++) {
      const pool = available();
      if (pool.length === 0) break;   // nothing to deliver — full up
      // Same weighting (40/30/22/8) but filtered through what's not capped.
      const weights = { rfJammer: 0.4, interceptor: 0.3, laser: 0.22, hpm: 0.08 };
      let total = 0;
      for (const t of pool) total += weights[t];
      let r = Math.random() * total;
      let type = pool[pool.length - 1];
      for (const t of pool) {
        r -= weights[t];
        if (r <= 0) { type = t; break; }
      }
      state.inventory[type] = (state.inventory[type] ?? 0) + 1;
      spawnSupplyTrucks(state, { [type]: 1 });
    }
  }
}

function makeStructureMap(initial) {
  const out = {};
  for (const s of MAP.structures) out[s.id] = initial;
  return out;
}

function makeApartmentMap() {
  const out = {};
  for (const apt of MAP.apartments) {
    out[apt.tile.x + ',' + apt.tile.y] = apt.maxPop;
  }
  return out;
}

function makeBridgeMap() {
  const out = {};
  for (const b of MAP.bridges) out[b.id] = b.maxHp;
  return out;
}

const SKYSCRAPER_HP = 2;
function makeSkyscraperMap(initial) {
  const out = {};
  for (const s of (MAP.skyscrapers ?? [])) {
    out[s.tile.x + ',' + s.tile.y] = initial;
  }
  return out;
}

// Connected bridge pieces (adjacent or stacked tiles) count as ONE bridge.
// Cached on first use since MAP.bridges is static per session.
let _bridgeClusters = null;
function getBridgeClusters() {
  if (_bridgeClusters) return _bridgeClusters;
  const parent = new Map();
  const find = (a) => {
    while (parent.get(a) !== a) {
      parent.set(a, parent.get(parent.get(a)));
      a = parent.get(a);
    }
    return a;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const b of MAP.bridges) parent.set(b.id, b.id);
  for (let i = 0; i < MAP.bridges.length; i++) {
    for (let j = i + 1; j < MAP.bridges.length; j++) {
      const a = MAP.bridges[i], c = MAP.bridges[j];
      const dx = Math.abs(a.tile.x - c.tile.x);
      const dy = Math.abs(a.tile.y - c.tile.y);
      // Same tile, edge-adjacent, OR diagonal all count as the same bridge
      // (covers real bridge footprints spanning multiple cells + ramps).
      if (Math.max(dx, dy) <= 1) union(a.id, c.id);
    }
  }
  const groups = new Map();
  for (const b of MAP.bridges) {
    const root = find(b.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(b.id);
  }
  _bridgeClusters = Array.from(groups.values());
  return _bridgeClusters;
}

export function liveBridgeCount(state) {
  let live = 0;
  for (const cluster of getBridgeClusters()) {
    if (cluster.some(id => (state.bridgeHp?.[id] ?? 0) > 0)) live += 1;
  }
  return live;
}

export function totalBridgeCount() {
  return getBridgeClusters().length;
}

export const gameState = {
  drones: [],
  explosions: [],
  defenses: [],
  projectiles: [],
  droneIdCounter: 0,
  defenseIdCounter: 0,
  projectileIdCounter: 0,
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
  inventory: { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 },
  trucks: [],
  placementMode: null,
  hoverTile: null,
  structureHp: makeStructureMap(CONFIG.structures.maxHP),
  structureFlash: makeStructureMap(0),
  apartmentPop: makeApartmentMap(),
  apartmentFlash: {},
  bridgeHp: makeBridgeMap(),
  bridgeFlash: {},
  skyscraperHp: makeSkyscraperMap(SKYSCRAPER_HP),
  skyscraperFlash: {},
  financialPenalty: 0,
  // ISR recon: drones that escape alive hand enemy intel → next-wave boost.
  isrEscapedThisWave: 0,
  lastWaveIsrEscaped: 0,
  isrIntelThisWave: 0,
  lastWaveIsrIntel: 0,
  observedStructuresThisWave: new Set(),
  lastWaveObservedStructures: new Set(),
  payloadPool: 60,   // finite enemy payload stockpile per run
  laneIntelThisWave: {},
  lastWaveLaneIntel: {},
  observedDefenseTypesThisWave: { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 },
  lastWaveObservedDefenseTypes: { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 },
  stats: {
    droneKills: { isr: 0, owa: 0, payloadDelivery: 0 },
    defensesLost: 0,
    structuresLost: 0,
    runStartMs: 0,
    runEndMs: 0,
  },
  loseFlag: false,
  wave: {
    number: 1,
    phase: 'prep',
    prepMs: CONFIG.prepTimeBetweenWaves,
    spawnProgress: [],
  },
  winFlag: false,
  screenPhase: 'idle',
  mode: 'campaign',
  backdropAlpha: loadBackdropFromStorage(),
  // Phase-driven backdrop auto-toggle (issue #45). Auto sets grid during prep
  // and the city image during attack. A manual B-key toggle wins for the
  // current phase only; the next phase change clears the override.
  backdropAuto: {
    lastPhase: null,
    manualOverride: false,
  },
  tooltipKey: null,
  helpVisible: false,
  changelogVisible: false,
  // Sim harness — when true, main loop fast-forwards and auto-places defenses
  // per a scripted strategy. See tools/sim-runner.js + main.js frame loop.
  simMode: false,
  simSpeed: 10,             // updates per render frame while simming
  simSkipRender: false,     // keep rendering so the sim is visible
  simStats: null,           // collected per-wave counters + final summary
  simLog: [],               // rolling event log shown in the sidebar
  batch: {                  // batch mode — N runs back-to-back, no render
    active: false,
    total: 0,
    done: 0,
    wins: 0,
    strategy: null,
    abort: false,
    _runStarted: false,
    _prevSpeed: 10,
    _prevSkip: false,
  },
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
    pageIdx: 0,
  },
};

export function resetGameState() {
  applyMode(gameState.mode);
  gameState.drones.length = 0;
  gameState.explosions.length = 0;
  gameState.defenses.length = 0;
  gameState.projectiles.length = 0;
  gameState.droneIdCounter = 0;
  gameState.defenseIdCounter = 0;
  gameState.projectileIdCounter = 0;
  gameState.devSpawnTimer.isr = 0;
  gameState.devSpawnTimer.owa = 0;
  gameState.devSpawnTimer.payloadDelivery = 0;
  gameState.inventory.rfJammer = 0;
  gameState.inventory.interceptor = 0;
  gameState.inventory.laser = 0;
  gameState.inventory.hpm = 0;
  gameState.trucks.length = 0;
  applyDelivery(gameState, 0);
  gameState.placementMode = null;
  gameState.hoverTile = null;
  for (const id of Object.keys(gameState.structureHp)) {
    gameState.structureHp[id] = CONFIG.structures.maxHP;
    gameState.structureFlash[id] = 0;
  }
  for (const apt of MAP.apartments) {
    const key = apt.tile.x + ',' + apt.tile.y;
    gameState.apartmentPop[key] = apt.maxPop;
  }
  for (const k of Object.keys(gameState.apartmentFlash)) delete gameState.apartmentFlash[k];
  for (const b of MAP.bridges) gameState.bridgeHp[b.id] = b.maxHp;
  for (const k of Object.keys(gameState.bridgeFlash)) delete gameState.bridgeFlash[k];
  for (const s of (MAP.skyscrapers ?? [])) {
    gameState.skyscraperHp[s.tile.x + ',' + s.tile.y] = SKYSCRAPER_HP;
  }
  for (const k of Object.keys(gameState.skyscraperFlash)) delete gameState.skyscraperFlash[k];
  gameState.financialPenalty = 0;
  gameState.isrEscapedThisWave = 0;
  gameState.lastWaveIsrEscaped = 0;
  gameState.isrIntelThisWave = 0;
  gameState.lastWaveIsrIntel = 0;
  gameState.observedStructuresThisWave?.clear();
  gameState.lastWaveObservedStructures?.clear();
  gameState.payloadPool = 60;
  gameState.stats.droneKills.isr = 0;
  gameState.stats.droneKills.owa = 0;
  gameState.stats.droneKills.payloadDelivery = 0;
  gameState.stats.defensesLost = 0;
  gameState.stats.structuresLost = 0;
  gameState.stats.runStartMs = Date.now();
  gameState.stats.runEndMs = 0;
  gameState.loseFlag = false;
  gameState.wave.number = 1;
  gameState.wave.phase = 'prep';
  gameState.wave.prepMs = CONFIG.prepTimeBetweenWaves;
  gameState.wave.spawnProgress.length = 0;
  gameState.winFlag = false;
  gameState.briefing.phase = 'idle';
  gameState.briefing.visibleMs = 0;
  gameState.briefing.expandedOnce = false;
  gameState.briefing.activeBriefingIndex = -1;
  gameState.briefing.pageIdx = 0;
  gameState.tooltipKey = null;
  gameState.backdropAuto.lastPhase = null;
  gameState.backdropAuto.manualOverride = false;
}
