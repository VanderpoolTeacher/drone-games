import { CONFIG } from '../config.js';

export function renderLoseOverlay(ctx, state) {
  if (!state.loseFlag) return;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
  ctx.restore();

  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('DEFENSE FAILED', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 8);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CLICK TO RESTART', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 16);
}
