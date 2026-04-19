import { CONFIG } from '../config.js';

const FRAME_MS = 80;
const SIZES = [8, 12, 6];

export function updateExplosions(state, dt) {
  for (const e of state.explosions) {
    e.frameTimer += dt * 1000;
    while (e.frameTimer >= FRAME_MS && e.frame < 3) {
      e.frameTimer -= FRAME_MS;
      e.frame += 1;
    }
  }
  state.explosions = state.explosions.filter(e => e.frame < 3);
}

export function renderExplosions(ctx, state) {
  for (const e of state.explosions) {
    const color = e.frame === 0 ? CONFIG.colors.alertAmber : CONFIG.colors.threatRed;
    const size = SIZES[e.frame] ?? 0;
    if (size <= 0) continue;
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(e.x - size / 2), Math.floor(e.y - size / 2), size, size);
  }
}
