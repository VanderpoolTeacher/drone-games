import { CONFIG, applyMode } from '../config.js';
import { MAP } from './map.js';

export function applyDelivery(state, waveIdx) {
  const delivery = CONFIG.deliveries?.[waveIdx];
  if (!delivery) return;
  for (const type of Object.keys(delivery)) {
    state.inventory[type] = (state.inventory[type] ?? 0) + delivery[type];
  }
  spawnSupplyTrucks(state, delivery);
}

// Supply trucks drive in from the north bridge for each unit delivered.
// Purely decorative; they animate down, pause briefly, then despawn.
const TRUCK_BRIDGE_X = 15;   // matches MAP.js north bridge cols 15-16
const TRUCK_SPEED = 30;      // px/s

function spawnSupplyTrucks(state, delivery) {
  if (!state.trucks) state.trucks = [];
  let staggerMs = 0;
  for (const type of Object.keys(delivery)) {
    for (let i = 0; i < delivery[type]; i++) {
      state.trucks.push({
        type,
        x: TRUCK_BRIDGE_X * 16 + 8,
        y: -8,
        targetY: CONFIG.topBarHeight + 40,
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
