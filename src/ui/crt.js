import { CONFIG } from '../config.js';

const SCANLINE_ALPHA = 0.15;
const SCANLINE_SPACING = 2;
const VIGNETTE_CORNER_ALPHA = 0.20;

export function renderCRT(ctx) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  ctx.save();

  // Scanlines: 1-px horizontal strips every SCANLINE_SPACING rows.
  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = CONFIG.colors.bgDark;
  for (let y = 0; y < h; y += SCANLINE_SPACING) {
    ctx.fillRect(0, y, w, 1);
  }

  // Vignette: radial gradient — transparent center → bgDark at corners.
  const centerX = w / 2;
  const centerY = h / 2;
  const innerRadius = Math.min(centerX, centerY) * 0.5;
  const outerRadius = Math.hypot(centerX, centerY);
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, 'rgba(13, 27, 42, 0)');
  gradient.addColorStop(1, `rgba(13, 27, 42, ${VIGNETTE_CORNER_ALPHA})`);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}
