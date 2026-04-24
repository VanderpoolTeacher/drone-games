import { CONFIG, applyMode } from './config.js';
import { gameState, resetGameState, applyDelivery, updateTrucks, toggleBackdrop } from './game/state.js';
import { MAP } from './game/map.js';
import { renderMap, renderTrucks, renderStatsColumn } from './game/mapRenderer.js';
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
import { renderCasualtyHud } from './ui/casualtyHud.js';
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
  updateTrucks(gameState, dt);
  updateMusic(gameState);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs, gameState);
  renderTrucks(ctx, gameState);
  renderDefenses(ctx, gameState);
  renderDefenseDisablePulse(ctx, gameState, tMs);
  renderDrones(ctx, gameState);
  renderBeams(ctx, gameState);
  renderProjectiles(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderStatsColumn(ctx, gameState);
  renderChrome(ctx);
  renderMuteIcon(ctx);
  renderCasualtyHud(ctx, gameState);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderTooltip(ctx, gameState);
  renderBriefing(ctx, gameState, tMs);
  renderPlacement(ctx, gameState);
  renderWaveTelegraph(ctx, gameState, tMs);
  renderEndScreen(ctx, gameState, tMs);
  renderStartScreen(ctx, gameState, tMs);
  if (gameState.screenPhase === 'mapStatic') {
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillText('MAP PREVIEW  ·  B: BACKDROP  ·  ESC: BACK', 4, 4);
    const t = gameState.hoverTile;
    if (t && t.x >= 0 && t.x < MAP.gridW && t.y >= 0 && t.y < MAP.gridH) {
      const col = t.x < 26
        ? String.fromCharCode(65 + t.x)
        : 'A' + String.fromCharCode(65 + t.x - 26);
      ctx.fillStyle = CONFIG.colors.friendlyCyan;
      ctx.textAlign = 'right';
      ctx.fillText(col + (t.y + 1) + '  [' + t.x + ',' + t.y + ']',
        CONFIG.virtualWidth - 4, 4);
    }
    ctx.restore();
  }
  if (gameState.helpVisible) renderHelp(ctx);
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

  if (gameState.screenPhase === 'mapStatic') {
    return;  // clicks don't advance to gameplay in preview mode
  }
  if (gameState.screenPhase === 'idle') {
    gameState.screenPhase = 'start';
    return;
  }
  if (gameState.screenPhase === 'start') {
    gameState.mode = 'campaign';
    applyMode('campaign');
    applyDelivery(gameState, 0);
    gameState.stats.runStartMs = Date.now();
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

// Secret "MAP" code on the home screen — typing M-A-P (case-insensitive)
// within 2 s switches to a static map preview (no gameplay). Escape exits.
let mapCodeBuffer = '';
let mapCodeTimer = 0;
function pushMapCodeKey(k) {
  mapCodeBuffer = (mapCodeBuffer + k).slice(-3);
  clearTimeout(mapCodeTimer);
  mapCodeTimer = setTimeout(() => { mapCodeBuffer = ''; }, 2000);
}

window.addEventListener('keydown', e => {
  // H toggles the help overlay at any time.
  if (e.key === 'h' || e.key === 'H') {
    gameState.helpVisible = !gameState.helpVisible;
    return;
  }

  // Track letters toward the MAP code before the short-circuiting handlers
  // below consume the keystroke (m-for-mute would otherwise break it).
  if (gameState.screenPhase === 'idle' || gameState.screenPhase === 'start') {
    const single = e.key.length === 1 ? e.key.toUpperCase() : '';
    if (/^[A-Z]$/.test(single)) pushMapCodeKey(single);
    if (mapCodeBuffer === 'MAP') {
      mapCodeBuffer = '';
      gameState.screenPhase = 'mapStatic';
      return;
    }
  }

  if (gameState.screenPhase === 'mapStatic') {
    if (e.key === 'Escape') {
      gameState.screenPhase = 'start';
      return;
    }
    if (e.key === 'b' || e.key === 'B') {
      toggleBackdrop(gameState);
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      toggleMute();
      return;
    }
    return;  // swallow other keys — don't drop into gameplay
  }

  if (e.key === 'm' || e.key === 'M') {
    toggleMute();
    return;
  }
  if (e.key === 'b' || e.key === 'B') {
    toggleBackdrop(gameState);
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
    applyDelivery(gameState, 0);
    gameState.stats.runStartMs = Date.now();
    gameState.screenPhase = 'playing';
    return;
  }
  if (e.key === 'Escape') gameState.placementMode = null;
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    e.preventDefault();
  }
});

function renderHelp(ctx) {
  const W = 340, H = 200;
  const x = Math.round((CONFIG.virtualWidth - W) / 2);
  const y = Math.round((CONFIG.virtualHeight - H) / 2);
  ctx.save();
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.globalAlpha = 0.92;
  ctx.fillRect(x, y, W, H);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, W - 1, H - 1);

  ctx.font = '10px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('HELP · CONTROLS', x + W / 2, y + 8);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  const lines = [
    '',
    'MOUSE',
    '  Left-click palette icon  select defense',
    '  Left-click map tile      place selected defense',
    '  Right-click              cancel placement',
    '',
    'KEYBOARD',
    '  1 / 2                    start mode (Training / Campaign)',
    '  B                        cycle backdrop opacity',
    '  M                        toggle mute',
    '  H                        toggle this help',
    '  ESC                      cancel placement / exit preview',
    '  type M-A-P at title      open static map preview',
    '',
    'GOAL',
    '  Hold 6 critical sites through 5 waves.',
    '  Lose all 6 criticals = game over.',
  ];
  let ly = y + 24;
  for (const ln of lines) {
    ctx.fillStyle = ln.trim().match(/^[A-Z ]+$/) && ln.trim().length > 0 && !ln.startsWith(' ')
      ? CONFIG.colors.friendlyCyan
      : CONFIG.colors.accentWhite;
    ctx.fillText(ln, x + 12, ly);
    ly += 9;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('PRESS H TO CLOSE', x + W / 2, y + H - 12);
  ctx.restore();
}
