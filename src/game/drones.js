import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { applyDamage } from './structures.js';
import { isLand } from './map.js';
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

export function spawnDrone(state, type, opts = {}) {
  let corridors = MAP.corridors[type];
  if (!corridors || corridors.length === 0) return null;

  // When a payload spawn is flagged for bridge-only targeting, restrict the
  // corridor pool to the bridge-attack corridors — early waves commit hard
  // against bridges to soften supply lines.
  if (type === 'payloadDelivery' && opts.targetBridges) {
    const filtered = corridors.filter(c => c.isBridgeAttack);
    if (filtered.length > 0) corridors = filtered;
  }

  // Intel-guided targeting: OWA drones prefer corridors whose targetStructureId
  // was observed by ISR in the previous wave (if any). Falls back to all.
  if (type === 'owa' && state.lastWaveObservedStructures?.size > 0) {
    const filtered = corridors.filter(c => state.lastWaveObservedStructures.has(c.targetStructureId));
    if (filtered.length > 0) corridors = filtered;
  }

  // Lane-weighted pick: OWA/payload favor corridors routed through the ISR
  // lane that leaked the most intel last wave.
  let corridorIdx;
  const laneIntel = state.lastWaveLaneIntel;
  if ((type === 'owa' || type === 'payloadDelivery') && laneIntel) {
    const laneXs = [6, 16, 26];   // matches MAP.corridors.isr
    const corrX = (c) => (c.dropPoint ?? c.waypoints?.[c.waypoints.length - 1])?.x ?? 0;
    const weights = corridors.map(c => {
      const cx = corrX(c);
      let nearest = 0, minDx = Infinity;
      for (let i = 0; i < laneXs.length; i++) {
        const dx = Math.abs(laneXs[i] - cx);
        if (dx < minDx) { minDx = dx; nearest = i; }
      }
      return Math.max(0.5, (laneIntel[nearest] ?? 0));   // floor so unseen lanes still possible
    });
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    corridorIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) { corridorIdx = i; break; }
    }
  } else {
    corridorIdx = Math.floor(Math.random() * corridors.length);
  }

  const corridor = corridors[corridorIdx];
  const first = corridor.waypoints[0];
  const { x, y } = tileToPixel(first);

  // Bridge-attack payloads pick a random live bridge tile each spawn so
  // attacks spread across all surviving bridges rather than a fixed cluster.
  let dropPoint = type === 'payloadDelivery' ? corridor.dropPoint : null;
  let directFlight = false;
  if (dropPoint && corridor.isBridgeAttack) {
    const liveBridges = MAP.bridges.filter(b => (state.bridgeHp?.[b.id] ?? 0) > 0);
    if (liveBridges.length > 0) {
      const pick = liveBridges[Math.floor(Math.random() * liveBridges.length)];
      dropPoint = { x: pick.tile.x, y: pick.tile.y };
      directFlight = true;   // dropPoint y may differ from corridor path y
    }
  }
  // Carpet-bomb payloads: random land tile across the whole map.
  if (dropPoint && opts.carpetBomb) {
    const landTiles = [];
    for (let ty = 0; ty < MAP.gridH; ty++) {
      for (let tx = 0; tx < MAP.gridW; tx++) {
        if (isLand(tx, ty)) landTiles.push({ x: tx, y: ty });
      }
    }
    // Fall back to MAP.structures[0] if no land mask (safe default).
    const fallback = landTiles.length > 0
      ? landTiles[Math.floor(Math.random() * landTiles.length)]
      : MAP.structures[0]?.tile;
    if (fallback) dropPoint = { x: fallback.x, y: fallback.y };
  }

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
    dropPoint: dropPoint,
    carpetBomb: opts.carpetBomb === true,
    directFlight: directFlight || opts.carpetBomb === true,
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

  const tMs = performance.now();
  for (const d of state.drones) {
    if (d.type === 'payloadDelivery') {
      drawPayload(ctx, d);
      continue;
    }
    if (d.type === 'isr') { drawIsr(ctx, d, tMs); continue; }
    if (d.type === 'owa') { drawOwa(ctx, d); continue; }

    // Unknown type fallback.
    const left = Math.floor(d.x - DRONE_SIZE / 2);
    const top = Math.floor(d.y - DRONE_SIZE / 2);
    ctx.fillStyle = bodyColorFor(d.type);
    ctx.fillRect(left, top, DRONE_SIZE, DRONE_SIZE);
  }
}

// Payload = MQ-style reaper drone pixel art (inspired by the reference image):
// slim fuselage, wide straight wings, V-tail, munitions on pylons.
function drawPayload(ctx, d) {
  const heading = Math.atan2(d.vy ?? 0, d.vx ?? 0);
  ctx.save();
  ctx.translate(Math.floor(d.x), Math.floor(d.y));
  ctx.rotate(heading + Math.PI / 2);   // nose points up (−Y) before rotation
  // Fuselage — long dark body along flight axis.
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillRect(0, -5, 1, 10);
  // Cockpit bulge near the nose — lighter highlight.
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(0, -4, 1, 1);
  // Main wings — 11-wide, 2 tall, centered above fuselage mid.
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillRect(-5, -1, 11, 2);
  // Wing tips — navigation lights (green left, red right).
  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillRect(-5, 0, 1, 1);
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillRect(5, 0, 1, 1);
  // Munition pylons — amber ordnance slung under each wing (2 per side).
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillRect(-3, 1, 1, 2);
  ctx.fillRect(-2, 1, 1, 2);
  ctx.fillRect(2,  1, 1, 2);
  ctx.fillRect(3,  1, 1, 2);
  // V-tail fins at the rear — two angled pixels reading as stabilisers.
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillRect(-2, 4, 1, 1);
  ctx.fillRect( 1, 4, 1, 1);
  ctx.fillRect(-1, 5, 3, 1);
  ctx.restore();
}

// ISR = quadcopter: cyan central body + 4 rotor tips that flicker to animate.
function drawIsr(ctx, d, tMs) {
  const heading = Math.atan2(d.vy ?? 0, d.vx ?? 0);
  const flicker = (Math.floor(tMs / 60) & 1) === 0;
  ctx.save();
  ctx.translate(Math.floor(d.x), Math.floor(d.y));
  ctx.rotate(heading + Math.PI / 2);
  // Body + cross arms.
  ctx.fillStyle = CONFIG.colors.droneIsr;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.fillRect(-3, 0, 2, 1);
  ctx.fillRect(2, 0, 2, 1);
  ctx.fillRect(0, -3, 1, 2);
  ctx.fillRect(0, 2, 1, 2);
  // Rotor tips (white flicker shows spin).
  ctx.fillStyle = flicker ? CONFIG.colors.accentWhite : CONFIG.colors.friendlyCyan;
  ctx.fillRect(-4, -1, 1, 1);
  ctx.fillRect(3, 1, 1, 1);
  ctx.fillRect(1, -4, 1, 1);
  ctx.fillRect(-1, 3, 1, 1);
  ctx.restore();
}

// OWA = one-way attack chevron: triangular warhead pointing in flight dir.
function drawOwa(ctx, d) {
  const heading = Math.atan2(d.vy ?? 0, d.vx ?? 0);
  ctx.save();
  ctx.translate(Math.floor(d.x), Math.floor(d.y));
  ctx.rotate(heading + Math.PI / 2);
  ctx.fillStyle = CONFIG.colors.droneOwa;
  ctx.beginPath();
  ctx.moveTo(0, -4);     // nose (forward)
  ctx.lineTo(3, 3);      // rear right
  ctx.lineTo(0, 2);      // rear notch
  ctx.lineTo(-3, 3);     // rear left
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillRect(-1, -3, 2, 2);   // red tip
  ctx.restore();
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
    if (d.type === 'isr') { updateIsr(d, dt); accumulateIntel(d, dt, state); }
    else if (d.type === 'owa') updateOwa(d, dt, state);
    else if (d.type === 'payloadDelivery') updatePayload(d, dt, state);
  }

  for (const d of state.drones) {
    if (d.hp <= 0 && d.phase !== 'done') {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      playSfx('droneKill');
      state.stats.droneKills[d.type] = (state.stats.droneKills[d.type] ?? 0) + 1;
      // Payload drones ALWAYS drop — even when shot down before arrival.
      if (d.type === 'payloadDelivery' && !d.dropped) {
        executePayloadDrop(d, state, d.x, d.y);
      }
      d.phase = 'done';
    }
  }

  // Track ISR recon completions: if an ISR drone exits the map alive, it
  // successfully scanned the city and will boost next wave's force size.
  state.drones = state.drones.filter(d => {
    if (d.phase === 'done') return false;
    if (isOffGrid(d)) {
      if (d.type === 'isr' && d.hp > 0) {
        state.isrEscapedThisWave = (state.isrEscapedThisWave ?? 0) + 1;
        state.isrIntelThisWave = (state.isrIntelThisWave ?? 0) + (d.intel ?? 0);
        if (!state.observedStructuresThisWave) state.observedStructuresThisWave = new Set();
        for (const id of (d.observedStructures ?? [])) {
          state.observedStructuresThisWave.add(id);
        }
      }
      // Payload exiting without dropping → drop on the way out.
      if (d.type === 'payloadDelivery' && !d.dropped) {
        executePayloadDrop(d, state, d.x, d.y);
      }
      return false;
    }
    return true;
  });
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

// ISR drones earn intel points proportional to time alive — but only while
// OUTSIDE any active RF-jammer bubble. Inside an RF field, the drone flies
// home blind (no intel). Intel lands on escape (see filter below).
function accumulateIntel(d, dt, state) {
  if (!d.intel) d.intel = 0;
  if (!d.observedStructures) d.observedStructures = new Set();
  const rfCfg = CONFIG.defenses?.rfJammer;
  const rfRange = rfCfg?.range ?? 0;
  let jammed = false;
  if (rfRange > 0) {
    for (const def of state.defenses) {
      if (def.type !== 'rfJammer') continue;
      if (def.installMsRemaining > 0) continue;
      const dx = def.x - d.x, dy = def.y - d.y;
      if (dx * dx + dy * dy <= rfRange * rfRange) { jammed = true; break; }
    }
  }
  if (jammed) return;   // can't see through jamming — no intel banked
  d.intel += dt;        // 1 pt/sec scanning unobstructed
  // Accumulate intel by ISR lane so the next wave can pick the "safest" one.
  if (!state.laneIntelThisWave) state.laneIntelThisWave = {};
  const laneIdx = d.corridorIdx ?? 0;
  state.laneIntelThisWave[laneIdx] = (state.laneIntelThisWave[laneIdx] ?? 0) + dt;
  // Log any structure within ~60 px of this ISR — "photographed" for next wave.
  for (const s of MAP.structures) {
    const p = tileToPixel(s.tile);
    const dx = p.x - d.x, dy = p.y - d.y;
    if (dx * dx + dy * dy <= 60 * 60) d.observedStructures.add(s.id);
  }
  // Count defense types within ~60 px — fuels counter-meta for next wave.
  if (!state.observedDefenseTypesThisWave) {
    state.observedDefenseTypesThisWave = { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 };
  }
  for (const def of state.defenses) {
    const dxD = def.x - d.x, dyD = def.y - d.y;
    if (dxD * dxD + dyD * dyD <= 60 * 60) {
      state.observedDefenseTypesThisWave[def.type] =
        (state.observedDefenseTypesThisWave[def.type] ?? 0) + dt;
    }
  }
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
    // Don't waste a drone on rubble — if the assigned target is destroyed,
    // retarget to the nearest live critical (or exit if none remain).
    if ((state.structureHp[d.targetId] ?? 0) <= 0) {
      const newId = pickClosestLiveStructureId(d, state);
      if (!newId) { d.phase = 'exiting'; return; }
      d.targetId = newId;
    }

    const def = findClosestDefenseInRange(state, d, CONFIG.combat.owaEngageRange);
    if (def) {
      d.targetDefenseId = def.id;
      d.phase = 'terminalDefense';
      d.commitLineFrame = 1;
      return;
    }

    const corridor = MAP.corridors.owa[d.corridorIdx];
    if (d.wpIdx >= corridor.waypoints.length) {
      d.phase = 'terminal';
      d.commitLineFrame = 1;
      return;
    }
    advanceCruise(d, dt);
    return;
  }

  if (d.phase === 'terminalDefense') {
    const def = state.defenses.find(x => x.id === d.targetDefenseId);
    if (!def) {
      d.targetDefenseId = null;
      d.phase = 'terminal';
      return;
    }

    const dx = def.x - d.x;
    const dy = def.y - d.y;
    const dist = Math.hypot(dx, dy);
    const speed = CONFIG.drones.owa.speed * (d.speedMultiplier ?? 1);
    const step = speed * dt;

    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      def.hp -= CONFIG.combat.owaDefenseDamage;
      d.phase = 'done';
      return;
    }

    d.vx = (dx / dist) * speed;
    d.vy = (dy / dist) * speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return;
  }

  if (d.phase === 'terminal') {
    // If the authored target is already dead, retarget to the closest
    // live structure — otherwise the drone wastes itself on rubble.
    if ((state.structureHp[d.targetId] ?? 0) <= 0) {
      const newId = pickClosestLiveStructureId(d, state);
      if (!newId) { d.phase = 'exiting'; return; }
      d.targetId = newId;
    }

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

function pickClosestLiveStructureId(drone, state) {
  let bestId = null;
  let bestDist = Infinity;
  for (const s of MAP.structures) {
    if ((state.structureHp[s.id] ?? 0) <= 0) continue;
    const p = tileToPixel(s.tile);
    const dist = Math.hypot(p.x - drone.x, p.y - drone.y);
    if (dist < bestDist) {
      bestId = s.id;
      bestDist = dist;
    }
  }
  return bestId;
}

function findClosestDefenseInRange(state, drone, range) {
  let best = null;
  let bestDist = Infinity;
  const rSq = range * range;
  for (const def of state.defenses) {
    const dx = def.x - drone.x;
    const dy = def.y - drone.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > rSq) continue;
    if (dSq < bestDist) {
      best = def;
      bestDist = dSq;
    }
  }
  return best;
}

function structurePixelPos(id) {
  const s = MAP.structures.find(x => x.id === id);
  if (!s) return null;
  return tileToPixel(s.tile);
}

const PAYLOAD_DROP_PX = 8;

function updatePayload(d, dt, state) {
  // Direct-flight payloads (bridge-attack with per-spawn target OR carpet
  // bombs) fly straight to their dropPoint regardless of corridor waypoints.
  if (d.directFlight && d.dropPoint) {
    const drop = tileToPixel(d.dropPoint);
    const dxC = drop.x - d.x, dyC = drop.y - d.y;
    const distC = Math.hypot(dxC, dyC);
    const speed = CONFIG.drones.payloadDelivery.speed * (d.speedMultiplier ?? 1);
    const step = speed * dt;
    if (distC > PAYLOAD_DROP_PX && step < distC) {
      d.vx = (dxC / distC) * speed;
      d.vy = (dyC / distC) * speed;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      return;
    }
    // fall through to drop logic below
  } else {
    advanceCruise(d, dt);
    // Corridor payload reached the exit without a drop trigger — release now.
    if (d.phase === 'exiting' && !d.dropped && d.dropPoint) {
      executePayloadDrop(d, state, d.x, d.y);
      d.phase = 'done';
      return;
    }
  }

  if (!d.dropPoint || d.phase === 'done' || d.dropped) return;
  const drop = tileToPixel(d.dropPoint);
  const dx = drop.x - d.x;
  const dy = drop.y - d.y;
  if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
    executePayloadDrop(d, state, drop.x, drop.y);
    d.phase = 'done';
  }
}

// Shared payload-drop AoE — callable from normal arrival at dropPoint AND
// from the kill-in-flight path so a shot-down payload still rains ordnance.
function executePayloadDrop(d, state, cx, cy) {
  if (d.dropped) return;
  d.dropped = true;
  state.explosions.push({ x: cx, y: cy, frame: 0, frameTimer: 0 });
  for (const s of MAP.structures) {
    const sp = tileToPixel(s.tile);
    if (Math.hypot(sp.x - cx, sp.y - cy) <= PAYLOAD_AOE_RADIUS) {
      applyDamage(state, s.id, CONFIG.structures.damageFromPayloadDrop);
    }
  }
  for (const def of state.defenses) {
    if (Math.hypot(def.x - cx, def.y - cy) <= PAYLOAD_AOE_RADIUS) {
      def.hp -= CONFIG.combat.payloadDefenseDamage;
    }
  }
  const hospital = MAP.structures.find(s => s.type === 'hospital');
  const hospitalDown = hospital && (state.structureHp[hospital.id] ?? 0) <= 0;
  const casualtyMult = hospitalDown ? 1.5 : 1;
  for (const apt of MAP.apartments) {
    const p = tileToPixel(apt.tile);
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist > PAYLOAD_AOE_RADIUS) continue;
    const key = apt.tile.x + ',' + apt.tile.y;
    const cur = state.apartmentPop[key] ?? 0;
    if (cur <= 0) continue;
    const lethality = (1 - dist / PAYLOAD_AOE_RADIUS) * casualtyMult;
    const losses = Math.min(cur, Math.ceil(cur * lethality));
    state.apartmentPop[key] = cur - losses;
    state.apartmentFlash[key] = 2;
  }
  // Only the CLOSEST live bridge in AoE takes a hit — one drop = one bridge.
  let nearest = null, nearestDist = Infinity;
  for (const br of MAP.bridges) {
    if ((state.bridgeHp[br.id] ?? 0) <= 0) continue;
    const p = tileToPixel(br.tile);
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist > PAYLOAD_AOE_RADIUS) continue;
    if (dist < nearestDist) { nearest = br; nearestDist = dist; }
  }
  if (nearest) {
    state.bridgeHp[nearest.id] = Math.max(0, state.bridgeHp[nearest.id] - 1);
    state.bridgeFlash[nearest.id] = 2;
  }
  for (const sky of (MAP.skyscrapers ?? [])) {
    const p = tileToPixel(sky.tile);
    if (Math.hypot(p.x - cx, p.y - cy) > PAYLOAD_AOE_RADIUS) continue;
    const key = sky.tile.x + ',' + sky.tile.y;
    const cur = state.skyscraperHp?.[key] ?? 0;
    if (cur <= 0) continue;
    state.skyscraperHp[key] = Math.max(0, cur - 1);
    state.skyscraperFlash[key] = 2;
  }
}
