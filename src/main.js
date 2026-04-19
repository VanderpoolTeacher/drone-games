import { CONFIG } from './config.js';
import { renderMap } from './game/mapRenderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

function frame() {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
