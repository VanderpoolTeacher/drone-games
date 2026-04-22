import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { applyDamage } from './structures.js';
import { playSfx } from '../audio/sfx.js';

const DRONE_SIZE = 16;
const WAYPOINT_REACH_PX = 2;
const ISR_JITTER_PX = 12;

const payloadSprite = new Image();
payloadSprite.src = './src/images/drone-heavy-payload.png';
const TRAIL_SAMPLE_MS = 50;
const TRAIL_MAX_SAMPLES = 8;
const TRAIL_MAX_AGE_S = 1.2;
const PAYLOAD_AOE_RADIUS = 48;  // TODO(tuning): promote to CONFIG.structures.payloadAoeRadius

export function spawnDrone(state, type) {
  const corridors = MAP.corridors[type];
  if (!corridors || corridors.length === 0) return null;

  const corridorIdx = Math.floor(Math.random() * corridors.length);

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
    jitterOffset: type === 'isr' ? rollIsrJitter() : null,
    trail: type === 'isr' ? [] : null,
    trailSampleTimer: 0,
    commitLineFrame: 0,
    speedMultiplier: 1,
  };
  state.drones.push(drone);
  return drone;
}

export function renderDrones(ctx, state) {
  for (const d of state.drones) {
    if (d.type === 'isr' && d.trail?.length) {
      renderIsrTrail(ctx, d.trail);
    }
  }

  for (const d of state.drones) {
    if (d.type === 'owa' && d.commitLineFrame > 0) {
      const target = structurePixelPos(d.targetId);
      if (target) {
        ctx.strokeStyle = CONFIG.colors.alertAmber;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x + 0.5, d.y + 0.5);
        ctx.lineTo(target.x + 0.5, target.y + 0.5);
        ctx.stroke();
      }
    }
  }

  for (const d of state.drones) {
    const left = Math.floor(d.x - DRONE_SIZE / 2);
    const top = Math.floor(d.y - DRONE_SIZE / 2);

    if (d.type === 'payloadDelivery' && payloadSprite.complete && payloadSprite.naturalWidth > 0) {
      // Source sprite points "up" (nose = -Y). Rotate so nose tracks velocity.
      const heading = Math.atan2(d.vy ?? 0, d.vx ?? 0);
      ctx.save();
      ctx.translate(Math.floor(d.x), Math.floor(d.y));
      ctx.rotate(heading + Math.PI / 2);
      ctx.drawImage(payloadSprite, -DRONE_SIZE / 2, -DRONE_SIZE / 2, DRONE_SIZE, DRONE_SIZE);
      ctx.restore();
      continue;
    }

    ctx.fillStyle = bodyColorFor(d.type);
    ctx.fillRect(left, top, DRONE_SIZE, DRONE_SIZE);

    const accent = accentFor(d.type);
    if (accent) {
      const { color, dx, dy } = accent;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(d.x) + dx, Math.floor(d.y) + dy, 2, 2);
    }
  }
}

export function bodyColorFor(type) {
  if (type === 'isr') return CONFIG.colors.droneIsr;
  if (type === 'owa') return CONFIG.colors.droneOwa;
  if (type === 'payloadDelivery') return CONFIG.colors.dronePayload;
  return CONFIG.colors.threatRed;
}

function accentFor(type) {
  if (type === 'isr') return { color: CONFIG.colors.friendlyCyan, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
  if (type === 'owa') return { color: CONFIG.colors.threatRed, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
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
    else if (d.type === 'owa') updateOwa(d, dt, state);
    else if (d.type === 'payloadDelivery') updatePayload(d, dt, state);
  }

  for (const d of state.drones) {
    if (d.hp <= 0 && d.phase !== 'done') {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      playSfx('droneKill');
      state.resources += CONFIG.resourcesPerDroneKill[d.type] ?? 0;
      d.phase = 'done';
    }
  }

  state.drones = state.drones.filter(d => d.phase !== 'done' && !isOffGrid(d));
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

  const speed = CONFIG.drones[d.type].speed * (d.speedMultiplier ?? 1);
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
  updateIsrTrail(d, dt);

  if (d.phase === 'exiting') {
    d.vx = 0;
    d.vy = CONFIG.drones.isr.speed * (d.speedMultiplier ?? 1);
    d.y += d.vy * dt;
    return;
  }

  const corridor = MAP.corridors.isr[d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  const waypointPx = tileToPixel(corridor.waypoints[d.wpIdx]);
  const target = {
    x: waypointPx.x + (d.jitterOffset?.dx ?? 0),
    y: waypointPx.y + (d.jitterOffset?.dy ?? 0),
  };

  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy);

  const speed = CONFIG.drones.isr.speed * (d.speedMultiplier ?? 1);

  if (dist <= WAYPOINT_REACH_PX) {
    d.wpIdx += 1;
    d.jitterOffset = rollIsrJitter();
    return;
  }

  const step = speed * dt;
  if (step >= dist) {
    d.x = target.x;
    d.y = target.y;
    d.wpIdx += 1;
    d.jitterOffset = rollIsrJitter();
    return;
  }

  d.vx = (dx / dist) * speed;
  d.vy = (dy / dist) * speed;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}

function rollIsrJitter() {
  return {
    dx: (Math.random() * 2 - 1) * ISR_JITTER_PX,
    dy: (Math.random() * 2 - 1) * ISR_JITTER_PX,
  };
}

function updateIsrTrail(d, dt) {
  d.trailSampleTimer += dt * 1000;
  while (d.trailSampleTimer >= TRAIL_SAMPLE_MS) {
    d.trailSampleTimer -= TRAIL_SAMPLE_MS;
    d.trail.push({ x: d.x, y: d.y, age: 0 });
    if (d.trail.length > TRAIL_MAX_SAMPLES) d.trail.shift();
  }
  for (const s of d.trail) s.age += dt;
  d.trail = d.trail.filter(s => s.age < TRAIL_MAX_AGE_S);
}

function renderIsrTrail(ctx, trail) {
  for (const s of trail) {
    const alphaStep = 1 - s.age / TRAIL_MAX_AGE_S;
    if (alphaStep <= 0) continue;
    ctx.fillStyle = quantizeTrailColor(alphaStep);
    ctx.fillRect(Math.floor(s.x - 1), Math.floor(s.y - 1), 2, 2);
  }
}

function quantizeTrailColor(alphaStep) {
  if (alphaStep > 0.66) return CONFIG.colors.threatRed;
  if (alphaStep > 0.33) return CONFIG.colors.threatRedMid;
  return CONFIG.colors.threatRedDim;
}

const OWA_ARRIVAL_PX = 8;

function updateOwa(d, dt, state) {
  if (d.commitLineFrame > 0) d.commitLineFrame -= 1;

  if (d.phase === 'cruise') {
    const corridor = MAP.corridors.owa[d.corridorIdx];
    if (d.wpIdx >= corridor.waypoints.length) {
      d.phase = 'terminal';
      d.commitLineFrame = 1;
      return;
    }
    advanceCruise(d, dt);
    return;
  }

  if (d.phase === 'terminal') {
    const target = structurePixelPos(d.targetId);
    if (!target) { d.phase = 'exiting'; return; }

    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy);

    const speed = CONFIG.drones.owa.speed * (d.speedMultiplier ?? 1);
    const step = speed * dt;

    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      applyDamage(state, d.targetId, CONFIG.structures.damageFromOWAStrike);
      d.phase = 'done';
      return;
    }

    d.vx = (dx / dist) * speed;
    d.vy = (dy / dist) * speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
  }
}

function structurePixelPos(id) {
  const s = MAP.structures.find(x => x.id === id);
  if (!s) return null;
  return tileToPixel(s.tile);
}

const PAYLOAD_DROP_PX = 8;

function updatePayload(d, dt, state) {
  advanceCruise(d, dt);

  if (!d.dropPoint) return;
  const drop = tileToPixel(d.dropPoint);
  const dx = drop.x - d.x;
  const dy = drop.y - d.y;
  if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
    state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
    for (const s of MAP.structures) {
      const sp = tileToPixel(s.tile);
      if (Math.hypot(sp.x - drop.x, sp.y - drop.y) <= PAYLOAD_AOE_RADIUS) {
        applyDamage(state, s.id, CONFIG.structures.damageFromPayloadDrop);
      }
    }
    d.phase = 'done';
  }
}
