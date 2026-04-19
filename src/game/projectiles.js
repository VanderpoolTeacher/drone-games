import { CONFIG } from '../config.js';

const HIT_RADIUS_PX = 8;
const OFF_GRID_MARGIN = 24;

export function updateProjectiles(state, dt) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  const survivors = [];
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let hit = null;
    for (const dr of state.drones) {
      if (dr.hp <= 0 || dr.phase === 'done') continue;
      if (Math.hypot(dr.x - p.x, dr.y - p.y) <= HIT_RADIUS_PX) { hit = dr; break; }
    }

    if (hit) {
      const eff = CONFIG.defenses.interceptor.effectivenessVs[hit.type] ?? 1;
      hit.hp -= p.damage * eff;
      continue;
    }

    if (p.x < -OFF_GRID_MARGIN || p.x > w + OFF_GRID_MARGIN || p.y < -OFF_GRID_MARGIN || p.y > h + OFF_GRID_MARGIN) continue;

    survivors.push(p);
  }
  state.projectiles = survivors;
}
