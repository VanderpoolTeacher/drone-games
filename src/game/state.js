import { CONFIG, applyMode } from '../config.js';
import { MAP } from './map.js';

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
  try {
    localStorage.setItem(BACKDROP_KEY, String(next));
  } catch (_e) {
    // private mode — ignore.
  }
}

export function applyDelivery(state, waveIdx) {
  const delivery = CONFIG.deliveries?.[waveIdx];
  if (!delivery) return;

  // Delivery scales with bridge status: each live bridge contributes 1/N
  // of the authored supply. Lose bridges → lose supply.
  const total = totalBridgeCount();
  const live = liveBridgeCount(state);
  const frac = total > 0 ? live / total : 1;

  const scaled = {};
  for (const type of Object.keys(delivery)) {
    const effective = Math.round(delivery[type] * frac);
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
    }
  }
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

export function liveBridgeCount(state) {
  let live = 0;
  for (const b of MAP.bridges) {
    if ((state.bridgeHp?.[b.id] ?? 0) > 0) live += 1;
  }
  return live;
}

export function totalBridgeCount() {
  return MAP.bridges.length;
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
  tooltipKey: null,
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
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
  gameState.tooltipKey = null;
}
