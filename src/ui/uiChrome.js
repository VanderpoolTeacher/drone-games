import { CONFIG } from '../config.js';

export function renderChrome(ctx) {
  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.topBarHeight);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(0, CONFIG.topBarHeight - 1, CONFIG.virtualWidth, 1);

  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;
  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, paletteY, CONFIG.virtualWidth, CONFIG.bottomPaletteHeight);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(0, paletteY, CONFIG.virtualWidth, 1);
}
