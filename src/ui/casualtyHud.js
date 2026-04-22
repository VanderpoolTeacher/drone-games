import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';

export function totalCasualties(state) {
  let lost = 0;
  for (const apt of MAP.apartments) {
    const key = apt.tile.x + ',' + apt.tile.y;
    const cur = state.apartmentPop?.[key] ?? apt.maxPop;
    lost += apt.maxPop - cur;
  }
  return lost;
}

export function renderCasualtyHud(ctx, state) {
  const lost = totalCasualties(state);
  if (lost <= 0) return;
  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('CASUALTIES ' + lost, CONFIG.virtualWidth / 2, Math.floor(CONFIG.topBarHeight / 2));
  ctx.restore();
}
