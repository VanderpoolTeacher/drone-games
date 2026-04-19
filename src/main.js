import { CONFIG } from './config.js';
import { gameState } from './game/state.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

let prevMs = 0;

function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
