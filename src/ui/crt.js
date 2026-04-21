import { CONFIG } from '../config.js';

const SCANLINE_ALPHA = 0.15;
const SCANLINE_SPACING = 2;
const VIGNETTE_CORNER_ALPHA = 0.20;

const BG = hexToRgb(CONFIG.colors.bgDark);

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function renderCRT(ctx) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  ctx.save();

  ctx.globalAlpha = SCANLINE_ALPHA;
  ctx.fillStyle = CONFIG.colors.bgDark;
  for (let y = 0; y < h; y += SCANLINE_SPACING) {
    ctx.fillRect(0, y, w, 1);
  }

  const centerX = w / 2;
  const centerY = h / 2;
  const innerRadius = Math.min(centerX, centerY) * 0.5;
  const outerRadius = Math.hypot(centerX, centerY);
  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, `rgba(${BG.r}, ${BG.g}, ${BG.b}, 0)`);
  gradient.addColorStop(1, `rgba(${BG.r}, ${BG.g}, ${BG.b}, ${VIGNETTE_CORNER_ALPHA})`);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}
