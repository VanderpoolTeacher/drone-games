import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { tileToPixel } from './drones.js';

export function placeDefense(state, type, tile, facingRad = 0) {
  const cfg = CONFIG.defenses[type];
  if (!cfg) return null;
  const { x, y } = tileToPixel(tile);
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x,
    y,
    cooldownMs: 0,
    targetId: null,
    heatMs: 0,
    overheated: false,
    facingRad,
    pulseFlashFrame: 0,
  };
  state.defenses.push(defense);
  state.resources -= cfg.cost;
  return defense;
}

export function updateDefenses(state, dt) {
  for (const d of state.defenses) {
    d.cooldownMs = Math.max(0, d.cooldownMs - dt * 1000);

    if (d.type === 'interceptor') {
      if (d.cooldownMs > 0) continue;
      const target = pickClosestToStructureTarget(state, d, CONFIG.defenses.interceptor.range);
      if (!target) { d.targetId = null; continue; }
      fireInterceptor(state, d, target);
      d.cooldownMs = CONFIG.defenses.interceptor.cooldown;
      d.targetId = target.id;
    } else if (d.type === 'rfJammer') {
      // area effect handled by applyJamEffects; nothing per-defense
    } else if (d.type === 'laser') {
      if (d.overheated) {
        if (d.cooldownMs <= 0) {
          d.overheated = false;
          d.heatMs = 0;
        }
        d.targetId = null;
        continue;
      }
      const target = pickClosestToStructureTarget(state, d, CONFIG.defenses.laser.range);
      if (target) {
        const eff = CONFIG.defenses.laser.effectivenessVs[target.type] ?? 1;
        target.hp -= CONFIG.defenses.laser.dps * dt * eff;
        d.heatMs = Math.min(d.heatMs + dt * 1000, CONFIG.defenses.laser.overheatTime);
        if (d.heatMs >= CONFIG.defenses.laser.overheatTime) {
          d.overheated = true;
          d.cooldownMs = CONFIG.defenses.laser.cooldownTime;
        }
        d.targetId = target.id;
      } else {
        d.heatMs = Math.max(0, d.heatMs - dt * 1000);
        d.targetId = null;
      }
    } else if (d.type === 'hpm') {
      if (d.pulseFlashFrame > 0) d.pulseFlashFrame -= 1;
      if (d.cooldownMs > 0) continue;

      const cfg = CONFIG.defenses.hpm;
      const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
      const victims = findDronesInCone(state, d, cfg.coneRange, halfAngleRad);
      if (victims.length === 0) continue;

      for (const v of victims) {
        const eff = cfg.effectivenessVs[v.type] ?? 1;
        v.hp -= cfg.pulseDamage * eff;
      }
      d.cooldownMs = cfg.pulseCooldown;
      d.pulseFlashFrame = 3;
      d.targetId = victims[0].id;
    }
  }
}

function pickClosestToStructureTarget(state, d, range) {
  let best = null;
  let bestDist = Infinity;
  let bestId = Infinity;
  for (const dr of state.drones) {
    if (dr.hp <= 0 || dr.phase === 'done') continue;
    const dx = dr.x - d.x;
    const dy = dr.y - d.y;
    if (Math.hypot(dx, dy) > range) continue;
    const minStructDist = minDistanceToAnyStructure(dr);
    if (minStructDist < bestDist || (minStructDist === bestDist && dr.id < bestId)) {
      best = dr;
      bestDist = minStructDist;
      bestId = dr.id;
    }
  }
  return best;
}

function minDistanceToAnyStructure(drone) {
  let min = Infinity;
  for (const s of MAP.structures) {
    const p = tileToPixel(s.tile);
    const d = Math.hypot(drone.x - p.x, drone.y - p.y);
    if (d < min) min = d;
  }
  return min;
}

function fireInterceptor(state, defense, target) {
  const cfg = CONFIG.defenses.interceptor;
  const dx = target.x - defense.x;
  const dy = target.y - defense.y;
  const dist = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    id: ++state.projectileIdCounter,
    x: defense.x,
    y: defense.y,
    vx: (dx / dist) * cfg.projectileSpeed,
    vy: (dy / dist) * cfg.projectileSpeed,
    targetDroneId: target.id,
    damage: cfg.damage,
    effectivenessVs: cfg.effectivenessVs,
  });
}

const DEFENSE_SIZE = 24;

export function renderDefenses(ctx, state) {
  for (const d of state.defenses) {
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2), Math.floor(d.y - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);

    if (d.type === 'interceptor') {
      ctx.fillStyle = CONFIG.colors.alertAmber;
      ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
    } else if (d.type === 'rfJammer') {
      ctx.fillStyle = CONFIG.colors.accentWhite;
      ctx.fillRect(Math.floor(d.x) - 2, Math.floor(d.y - DEFENSE_SIZE / 2) - 1, 4, 2);
    } else if (d.type === 'laser') {
      ctx.fillStyle = d.overheated ? CONFIG.colors.alertAmber : CONFIG.colors.accentWhite;
      ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
    } else if (d.type === 'hpm') {
      const cfg = CONFIG.defenses.hpm;

      const wedgeX = Math.floor(d.x + Math.cos(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
      const wedgeY = Math.floor(d.y + Math.sin(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
      ctx.fillStyle = CONFIG.colors.accentWhite;
      ctx.fillRect(wedgeX, wedgeY, 2, 2);

      const chargeFrac = 1 - Math.min(1, d.cooldownMs / cfg.pulseCooldown);
      const barLen = Math.floor(chargeFrac * (DEFENSE_SIZE - 2));
      if (barLen > 0) {
        ctx.fillStyle = CONFIG.colors.alertAmber;
        ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2) + 1, Math.floor(d.y - DEFENSE_SIZE / 2) - 1, barLen, 1);
      }

      if (d.pulseFlashFrame > 0) {
        const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
        const flashFrac = (4 - d.pulseFlashFrame) / 3;
        const flashR = cfg.coneRange * flashFrac;
        ctx.strokeStyle = CONFIG.colors.friendlyCyan;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.arc(d.x, d.y, flashR, d.facingRad - halfAngleRad, d.facingRad + halfAngleRad);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}

export function applyJamEffects(state) {
  const cfg = CONFIG.defenses.rfJammer;
  for (const d of state.drones) {
    if (d.hp <= 0 || d.phase === 'done') { d.speedMultiplier = 1; continue; }

    let minMult = 1;
    for (const def of state.defenses) {
      if (def.type !== 'rfJammer') continue;
      const dx = d.x - def.x;
      const dy = d.y - def.y;
      if (Math.hypot(dx, dy) > cfg.range) continue;
      const eff = cfg.effectivenessVs[d.type] ?? 0;
      const mult = 1 - (1 - cfg.slowFactor) * eff;
      if (mult < minMult) minMult = mult;
    }
    d.speedMultiplier = minMult;
  }
}

export function renderBeams(ctx, state) {
  ctx.strokeStyle = CONFIG.colors.accentWhite;
  ctx.lineWidth = 1;
  for (const d of state.defenses) {
    if (d.type !== 'laser') continue;
    if (d.overheated) continue;
    if (!d.targetId) continue;
    const target = state.drones.find(dr => dr.id === d.targetId);
    if (!target || target.hp <= 0 || target.phase === 'done') continue;

    ctx.beginPath();
    ctx.moveTo(d.x + 0.5, d.y + 0.5);
    ctx.lineTo(target.x + 0.5, target.y + 0.5);
    ctx.stroke();
  }
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function findDronesInCone(state, defense, range, halfAngleRad) {
  const victims = [];
  for (const dr of state.drones) {
    if (dr.hp <= 0 || dr.phase === 'done') continue;
    const dx = dr.x - defense.x;
    const dy = dr.y - defense.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;
    if (dist < 0.0001) { victims.push(dr); continue; }
    const bearing = Math.atan2(dy, dx);
    const diff = normalizeAngle(bearing - defense.facingRad);
    if (Math.abs(diff) <= halfAngleRad) victims.push(dr);
  }
  return victims;
}
