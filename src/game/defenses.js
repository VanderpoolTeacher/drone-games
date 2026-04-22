import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { tileToPixel } from './drones.js';
import { playSfx, startSfx, stopSfx } from '../audio/sfx.js';

function isDisabledByIsr(state, def) {
  const rSq = CONFIG.combat.isrDisableRange * CONFIG.combat.isrDisableRange;
  for (const d of state.drones) {
    if (d.type !== 'isr') continue;
    if (d.hp <= 0 || d.phase === 'done') continue;
    const dx = d.x - def.x;
    const dy = d.y - def.y;
    if (dx * dx + dy * dy <= rSq) return true;
  }
  return false;
}

export function placeDefense(state, type, tile, facingRad = 0) {
  const cfg = CONFIG.defenses[type];
  if (!cfg) return null;
  if ((state.inventory[type] ?? 0) <= 0) return null;
  const { x, y } = tileToPixel(tile);
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x,
    y,
    hp: cfg.hp,
    installMsRemaining: cfg.installMs ?? 0,
    cooldownMs: 0,
    targetId: null,
    heatMs: 0,
    overheated: false,
    facingRad,
    pulseFlashFrame: 0,
    laserFiring: false,
    rfJamming: false,
  };
  state.defenses.push(defense);
  state.inventory[type] -= 1;
  return defense;
}

export function updateDefenses(state, dt) {
  for (const d of state.defenses) {
    d.cooldownMs = Math.max(0, d.cooldownMs - dt * 1000);

    if (d.installMsRemaining > 0) {
      d.installMsRemaining = Math.max(0, d.installMsRemaining - dt * 1000);
      if (d.laserFiring) { stopSfx('laser-' + d.id); d.laserFiring = false; }
      if (d.rfJamming)   { stopSfx('rf-' + d.id);    d.rfJamming = false; }
      d.targetId = null;
      continue;
    }

    if (isDisabledByIsr(state, d)) {
      if (d.laserFiring) {
        stopSfx('laser-' + d.id);
        d.laserFiring = false;
      }
      if (d.rfJamming) {
        stopSfx('rf-' + d.id);
        d.rfJamming = false;
      }
      d.targetId = null;
      continue;
    }

    if (d.type === 'interceptor') {
      if (d.cooldownMs > 0) continue;
      const target = pickClosestToStructureTarget(state, d, CONFIG.defenses.interceptor.range);
      if (!target) { d.targetId = null; continue; }
      fireInterceptor(state, d, target);
      playSfx('interceptorLaunch');
      d.cooldownMs = CONFIG.defenses.interceptor.cooldown;
      d.targetId = target.id;
    } else if (d.type === 'rfJammer') {
      // area effect handled by applyJamEffects; jam-sfx transitions also handled there.
    } else if (d.type === 'laser') {
      if (d.overheated) {
        if (d.laserFiring) {
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
        }
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
        if (!d.laserFiring) {
          startSfx('laserFire', 'laser-' + d.id);
          d.laserFiring = true;
        }
        if (d.heatMs >= CONFIG.defenses.laser.overheatTime) {
          d.overheated = true;
          d.cooldownMs = CONFIG.defenses.laser.cooldownTime;
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
          playSfx('laserOverheat');
        }
        d.targetId = target.id;
      } else {
        d.heatMs = Math.max(0, d.heatMs - dt * 1000);
        if (d.laserFiring) {
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
        }
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
      playSfx('hpmPulse');
    }
  }

  // Sweep dead defenses: explosion + SFX cleanup + remove.
  for (const d of state.defenses) {
    if (d.hp <= 0) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      if (d.laserFiring) stopSfx('laser-' + d.id);
      if (d.rfJamming) stopSfx('rf-' + d.id);
      playSfx('structureDestroyed');
      state.stats.defensesLost += 1;
    }
  }
  state.defenses = state.defenses.filter(d => d.hp > 0);
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

    if (d.installMsRemaining > 0) {
      // Violet tint overlay + install progress bar
      const cfg = CONFIG.defenses[d.type];
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = CONFIG.colors.threatViolet;
      ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2), Math.floor(d.y - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);
      ctx.globalAlpha = 1.0;

      const installProgress = 1 - (d.installMsRemaining / cfg.installMs);
      const barW = Math.floor(installProgress * DEFENSE_SIZE);
      const barY = Math.floor(d.y - DEFENSE_SIZE / 2) - 4;
      const barX = Math.floor(d.x - DEFENSE_SIZE / 2);
      ctx.fillStyle = CONFIG.colors.gridLine;
      ctx.fillRect(barX, barY, DEFENSE_SIZE, 2);
      if (barW > 0) {
        ctx.fillStyle = CONFIG.colors.friendlyCyan;
        ctx.fillRect(barX, barY, barW, 2);
      }
    } else {
      // HP segments — only if damaged
      const maxHp = CONFIG.defenses[d.type].hp;
      if (d.hp < maxHp) {
        const segW = Math.max(1, Math.floor(DEFENSE_SIZE / maxHp) - 1);
        const barY = Math.floor(d.y - DEFENSE_SIZE / 2) - 4;
        let segX = Math.floor(d.x - DEFENSE_SIZE / 2);
        for (let i = 0; i < maxHp; i++) {
          ctx.fillStyle = i < d.hp ? CONFIG.colors.friendlyCyan : CONFIG.colors.gridLine;
          ctx.fillRect(segX, barY, segW, 2);
          segX += segW + 1;
        }
      }
    }
  }
}

export function renderDefenseDisablePulse(ctx, state, tMs) {
  if (Math.floor(tMs / 125) % 2 !== 0) return;
  for (const d of state.defenses) {
    if (!isDisabledByIsr(state, d)) continue;
    ctx.fillStyle = CONFIG.colors.threatViolet;
    ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y) - 1, 3, 3);
  }
}

export function applyJamEffects(state) {
  const cfg = CONFIG.defenses.rfJammer;

  // Reset per-defense jamming flag; we'll set true for any jammer with
  // at least one drone in range this frame.
  const jammersActiveThisFrame = new Set();

  for (const d of state.drones) {
    if (d.hp <= 0 || d.phase === 'done') { d.speedMultiplier = 1; continue; }

    let minMult = 1;
    for (const def of state.defenses) {
      if (def.type !== 'rfJammer') continue;
      if (def.installMsRemaining > 0) continue;
      if (isDisabledByIsr(state, def)) continue;
      const dx = d.x - def.x;
      const dy = d.y - def.y;
      if (Math.hypot(dx, dy) > cfg.range) continue;
      jammersActiveThisFrame.add(def.id);
      const eff = cfg.effectivenessVs[d.type] ?? 0;
      const mult = 1 - (1 - cfg.slowFactor) * eff;
      if (mult < minMult) minMult = mult;
    }
    d.speedMultiplier = minMult;
  }

  // Emit start/stop transitions for each jammer.
  for (const def of state.defenses) {
    if (def.type !== 'rfJammer') continue;
    const active = jammersActiveThisFrame.has(def.id);
    if (active && !def.rfJamming) {
      startSfx('rfJam', 'rf-' + def.id);
      def.rfJamming = true;
    } else if (!active && def.rfJamming) {
      stopSfx('rf-' + def.id);
      def.rfJamming = false;
    }
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
