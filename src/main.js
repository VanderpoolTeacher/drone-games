import { CONFIG, applyMode } from './config.js';
import { gameState, resetGameState } from './game/state.js';
import { MAP } from './game/map.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { renderLegend } from './ui/legend.js';
import { renderPlacement, pixelToTile, mapHitTest, isValidZone } from './ui/placement.js';
import { renderPalette, paletteHitTest } from './ui/palette.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';
import { renderDrones, updateDrones } from './game/drones.js';
import { updateDefenses, renderDefenses, placeDefense, applyJamEffects, renderBeams, renderDefenseDisablePulse } from './game/defenses.js';
import { updateProjectiles, renderProjectiles } from './game/projectiles.js';
import { updateStructures } from './game/structures.js';
import { updateWave } from './game/wave.js';
import { renderWaveTelegraph } from './ui/waveTelegraph.js';
import { renderEndScreen } from './ui/endScreen.js';
import { renderCRT } from './ui/crt.js';
import { updateBriefing, renderBriefing, briefingClickHit, collapseBriefing } from './ui/briefing.js';
import { renderMuteIcon, muteIconClickHit } from './ui/muteIcon.js';
import { playSfx, toggleMute, getAudioContext } from './audio/sfx.js';
import { updateMusic } from './audio/music.js';
import { renderStartScreen } from './ui/startScreen.js';
import { updateTooltip, renderTooltip } from './ui/tooltip.js';

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

  if (gameState.screenPhase === 'playing' && !gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
    updateBriefing(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
  updateMusic(gameState);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs, gameState);
  renderDefenses(ctx, gameState);
  renderDefenseDisablePulse(ctx, gameState, tMs);
  renderDrones(ctx, gameState);
  renderBeams(ctx, gameState);
  renderProjectiles(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);
  renderMuteIcon(ctx);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderTooltip(ctx, gameState);
  renderBriefing(ctx, gameState, tMs);
  renderPlacement(ctx, gameState);
  renderWaveTelegraph(ctx, gameState, tMs);
  renderEndScreen(ctx, gameState, tMs);
  renderStartScreen(ctx, gameState, tMs);
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
  updateTooltip(gameState, vx, vy);
});

canvas.addEventListener('click', e => {
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    playSfx('uiClick');
    return;
  }
  const [vx, vy] = toVirtual(e);

  if (muteIconClickHit(vx, vy)) {
    toggleMute();
    return;
  }

  if (gameState.screenPhase === 'idle') {
    gameState.screenPhase = 'start';
    return;
  }
  if (gameState.screenPhase === 'start') {
    gameState.mode = 'campaign';
    applyMode('campaign');
    gameState.screenPhase = 'playing';
    return;
  }

  if (briefingClickHit(gameState, vx, vy)) return;

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type
        ? null
        : paletteHit.type === 'hpm'
          ? { type: 'hpm', facingRad: -Math.PI / 2 }
          : { type: paletteHit.type };
    collapseBriefing(gameState);
    playSfx('uiClick');
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile, gameState.placementMode.facingRad ?? 0);
  gameState.placementMode = null;
  playSfx('uiClick');
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  gameState.placementMode = null;
});

// Wake the AudioContext on the first user interaction anywhere on the page,
// so music starts without needing to hit a palette/placement target.
function wakeAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  window.removeEventListener('click', wakeAudio);
  window.removeEventListener('keydown', wakeAudio);
  window.removeEventListener('touchstart', wakeAudio);
}
window.addEventListener('click', wakeAudio);
window.addEventListener('keydown', wakeAudio);
window.addEventListener('touchstart', wakeAudio);

window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') {
    toggleMute();
    return;
  }
  if (gameState.screenPhase === 'idle') {
    gameState.screenPhase = 'start';
    return;
  }
  if (gameState.screenPhase === 'start') {
    const mode = (e.key === '1') ? 'training' : 'campaign';
    gameState.mode = mode;
    applyMode(mode);
    gameState.screenPhase = 'playing';
    return;
  }
  if (e.key === 'Escape') gameState.placementMode = null;
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    e.preventDefault();
  }
});
