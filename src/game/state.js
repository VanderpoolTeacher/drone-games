import { CONFIG } from '../config.js';
import { MAP } from './map.js';

function makeStructureMap(initial) {
  const out = {};
  for (const s of MAP.structures) out[s.id] = initial;
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
  resources: CONFIG.startingResources,
  placementMode: null,
  hoverTile: null,
  structureHp: makeStructureMap(CONFIG.structures.maxHP),
  structureFlash: makeStructureMap(0),
  loseFlag: false,
  wave: {
    number: 1,
    phase: 'prep',
    prepMs: CONFIG.prepTimeBetweenWaves,
    spawnProgress: [],
  },
  winFlag: false,
  briefing: {
    phase: 'idle',
    visibleMs: 0,
    expandedOnce: false,
    activeBriefingIndex: -1,
  },
};

export function resetGameState() {
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
  gameState.resources = CONFIG.startingResources;
  gameState.placementMode = null;
  gameState.hoverTile = null;
  for (const id of Object.keys(gameState.structureHp)) {
    gameState.structureHp[id] = CONFIG.structures.maxHP;
    gameState.structureFlash[id] = 0;
  }
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
}
