import { CONFIG } from './config.js';
import { gameState, resetGameState } from './game/state.js';
import { MAP } from './game/map.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { renderLegend } from './ui/legend.js';
import { renderPlacement, pixelToTile, mapHitTest, isValidZone } from './ui/placement.js';
import { renderPalette, paletteHitTest } from './ui/palette.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';
import { renderDrones, updateDrones } from './game/drones.js';
import { updateDefenses, renderDefenses, placeDefense, applyJamEffects, renderBeams } from './game/defenses.js';
import { updateProjectiles, renderProjectiles } from './game/projectiles.js';
import { updateStructures } from './game/structures.js';
import { updateWave } from './game/wave.js';
import { renderLoseOverlay } from './ui/loseOverlay.js';
import { renderWaveTelegraph } from './ui/waveTelegraph.js';
import { renderWinOverlay } from './ui/winOverlay.js';
import { renderCRT } from './ui/crt.js';
import { updateBriefing, renderBriefing, briefingClickHit } from './ui/briefing.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth;
canvas.height = CONFIG.virtualHeight;

ctx.imageSmoothingEnabled = false;

let prevMs = 0;

function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  if (!gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
    updateBriefing(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs, gameState);
  renderDefenses(ctx, gameState);
  renderDrones(ctx, gameState);
  renderBeams(ctx, gameState);
  renderProjectiles(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderBriefing(ctx, gameState, tMs);
  renderPlacement(ctx, gameState);
  renderWaveTelegraph(ctx, gameState, tMs);
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
  renderCRT(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function toVirtual(e) {
  const rect = canvas.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (CONFIG.virtualWidth / rect.width),
    (e.clientY - rect.top) * (CONFIG.virtualHeight / rect.height),
  ];
}

canvas.addEventListener('mousemove', e => {
  const [vx, vy] = toVirtual(e);
  gameState.hoverTile = pixelToTile(vx, vy);
  if (gameState.placementMode?.type === 'hpm' && gameState.hoverTile) {
    const cx = gameState.hoverTile.x * MAP.tileSize + MAP.tileSize / 2;
    const cy = CONFIG.topBarHeight + MAP.padTop + gameState.hoverTile.y * MAP.tileSize + MAP.tileSize / 2;
    gameState.placementMode.facingRad = Math.atan2(vy - cy, vx - cx);
  }
});

canvas.addEventListener('click', e => {
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    return;
  }
  const [vx, vy] = toVirtual(e);

  if (briefingClickHit(gameState, vx, vy)) return;

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type
        ? null
        : paletteHit.type === 'hpm'
          ? { type: 'hpm', facingRad: -Math.PI / 2 }
          : { type: paletteHit.type };
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile, gameState.placementMode.facingRad ?? 0);
  gameState.placementMode = null;
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  gameState.placementMode = null;
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
  if ((gameState.loseFlag || gameState.winFlag) && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
