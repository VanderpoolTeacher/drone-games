import { CONFIG } from '../config.js';
import { MAP } from './map.js';

const DRONE_SIZE = 16;

export function spawnDrone(state, type) {
  const corridors = MAP.corridors[type];
  if (!corridors || corridors.length === 0) return null;

  const corridorIdx = state.spawnRotation[type] % corridors.length;
  state.spawnRotation[type] = (state.spawnRotation[type] + 1) % corridors.length;

  const corridor = corridors[corridorIdx];
  const first = corridor.waypoints[0];
  const { x, y } = tileToPixel(first);

  const cfg = CONFIG.drones[type];
  const drone = {
    id: ++state.droneIdCounter,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.hp,
    corridorIdx,
    wpIdx: 1,
    phase: 'cruise',
    targetId: type === 'owa' ? corridor.targetStructureId : null,
    dropPoint: type === 'payloadDelivery' ? corridor.dropPoint : null,
    jitterOffset: null,
    trail: type === 'isr' ? [] : null,
    trailSampleTimer: 0,
    commitLineFrame: 0,
  };
  state.drones.push(drone);
  return drone;
}

export function renderDrones(ctx, state) {
  for (const d of state.drones) {
    ctx.fillStyle = CONFIG.colors.threatRed;
    ctx.fillRect(Math.floor(d.x - DRONE_SIZE / 2), Math.floor(d.y - DRONE_SIZE / 2), DRONE_SIZE, DRONE_SIZE);

    const accent = accentFor(d.type);
    if (accent) {
      const { color, dx, dy } = accent;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(d.x) + dx, Math.floor(d.y) + dy, 2, 2);
    }
  }
}

function accentFor(type) {
  if (type === 'isr') return { color: CONFIG.colors.friendlyCyan, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
  if (type === 'owa') return { color: CONFIG.colors.alertAmber, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
  if (type === 'payloadDelivery') return { color: CONFIG.colors.alertAmber, dx: -1, dy: -1 };
  return null;
}

export function tileToPixel(tile) {
  const { tileSize, padTop } = MAP;
  return {
    x: tile.x * tileSize + tileSize / 2,
    y: CONFIG.topBarHeight + padTop + tile.y * tileSize + tileSize / 2,
  };
}
