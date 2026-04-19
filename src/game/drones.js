import { CONFIG } from '../config.js';
import { MAP } from './map.js';

const DRONE_SIZE = 16;
const WAYPOINT_REACH_PX = 2;

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

export function updateDrones(state, dt) {
  runDevSpawner(state, dt);

  for (const d of state.drones) {
    if (d.type === 'isr') updateIsr(d, dt);
    else if (d.type === 'owa') advanceCruise(d, dt);
    else if (d.type === 'payloadDelivery') advanceCruise(d, dt);
  }

  state.drones = state.drones.filter(d => !isOffGrid(d));
}

function advanceCruise(d, dt) {
  const corridor = MAP.corridors[d.type][d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  const target = tileToPixel(corridor.waypoints[d.wpIdx]);
  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= WAYPOINT_REACH_PX) {
    d.wpIdx += 1;
    return;
  }

  const speed = CONFIG.drones[d.type].speed;
  const step = speed * dt;
  if (step >= dist) {
    d.x = target.x;
    d.y = target.y;
    d.wpIdx += 1;
    return;
  }

  d.vx = (dx / dist) * speed;
  d.vy = (dy / dist) * speed;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}

function isOffGrid(d) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;
  return d.x < -24 || d.x > w + 24 || d.y < -24 || d.y > h + 24;
}

function runDevSpawner(state, dt) {
  if (!CONFIG.devSpawner || !CONFIG.devSpawner.enabled) return;
  const dtMs = dt * 1000;
  for (const type of ['isr', 'owa', 'payloadDelivery']) {
    state.devSpawnTimer[type] += dtMs;
    const interval = CONFIG.devSpawner.intervalMs[type];
    while (state.devSpawnTimer[type] >= interval) {
      state.devSpawnTimer[type] -= interval;
      spawnDrone(state, type);
    }
  }
}

function updateIsr(d, dt) {
  if (d.phase === 'exiting') {
    d.vx = 0;
    d.vy = CONFIG.drones.isr.speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return;
  }

  const corridor = MAP.corridors.isr[d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  advanceCruise(d, dt);
}
