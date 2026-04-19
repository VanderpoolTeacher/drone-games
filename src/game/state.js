import { CONFIG } from '../config.js';

export const gameState = {
  drones: [],
  explosions: [],
  defenses: [],
  projectiles: [],
  droneIdCounter: 0,
  defenseIdCounter: 0,
  projectileIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
  resources: CONFIG.startingResources,
  placementMode: null,
  hoverTile: null,
};
