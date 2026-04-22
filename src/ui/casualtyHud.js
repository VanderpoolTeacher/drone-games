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

function liveBridges(state) {
  let live = 0;
  for (const b of MAP.bridges) {
    if ((state.bridgeHp?.[b.id] ?? 0) > 0) live += 1;
  }
  return live;
}

export function renderCasualtyHud(ctx, state) {
  const lost = totalCasualties(state);
  const live = liveBridges(state);
  const total = MAP.bridges.length;
  const midY = Math.floor(CONFIG.topBarHeight / 2);

  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle';

  // Bridge readout — always visible, left of center; goes amber/red as lost.
  ctx.textAlign = 'right';
  ctx.fillStyle = live === total
    ? CONFIG.colors.successGreen
    : live >= Math.ceil(total / 2)
      ? CONFIG.colors.alertAmber
      : CONFIG.colors.threatRed;
  ctx.fillText('BRIDGES ' + live + '/' + total, CONFIG.virtualWidth / 2 - 10, midY);

  // Casualty readout — only when non-zero, right of center.
  if (lost > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = CONFIG.colors.threatRed;
    ctx.fillText('CASUALTIES ' + lost, CONFIG.virtualWidth / 2 + 10, midY);
  }
  ctx.restore();
}
