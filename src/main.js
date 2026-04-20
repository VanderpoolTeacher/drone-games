import { CONFIG } from './config.js';
import { gameState } from './game/state.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { renderLegend } from './ui/legend.js';
import { renderPlacement, pixelToTile, mapHitTest, isValidZone } from './ui/placement.js';
import { renderPalette, paletteHitTest } from './ui/palette.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';
import { renderDrones, updateDrones } from './game/drones.js';
import { updateDefenses, renderDefenses, placeDefense, applyJamEffects } from './game/defenses.js';
import { updateProjectiles, renderProjectiles } from './game/projectiles.js';

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

  applyJamEffects(gameState);
  updateDrones(gameState, dt);
  updateDefenses(gameState, dt);
  updateProjectiles(gameState, dt);
  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderDefenses(ctx, gameState);
  renderDrones(ctx, gameState);
  renderProjectiles(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderPlacement(ctx, gameState);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function toVirtual(e) {
  const rect = canvas.getBoundingClientRect();
  return [(e.clientX - rect.left) / CONFIG.scale, (e.clientY - rect.top) / CONFIG.scale];
}

canvas.addEventListener('mousemove', e => {
  const [vx, vy] = toVirtual(e);
  gameState.hoverTile = pixelToTile(vx, vy);
});

canvas.addEventListener('click', e => {
  const [vx, vy] = toVirtual(e);

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type ? null : { type: paletteHit.type };
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile);
  gameState.placementMode = null;
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  gameState.placementMode = null;
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
});
