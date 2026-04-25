import { CONFIG, applyMode } from './config.js';
import { gameState, resetGameState, applyDelivery, updateTrucks, toggleBackdrop, applyBackdropAutoForPhase } from './game/state.js';
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
import { playSfx, toggleMute, getAudioContext, startSfx, stopSfx } from './audio/sfx.js';
import { startSim, stopSim, tickSim, listStrategies, downloadSimData, clearSimData,
         startBatch, abortBatch, tickBatch } from './game/simHarness.js';
import { updateMusic } from './audio/music.js';
import { renderStartScreen } from './ui/startScreen.js';
import { updateTooltip, renderTooltip } from './ui/tooltip.js';
import { renderChangelog } from './ui/changelog.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth;
canvas.height = CONFIG.virtualHeight;

ctx.imageSmoothingEnabled = false;

let prevMs = 0;
let simStrategyIdx = 0;

function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  if (gameState.screenPhase === 'playing' && !gameState.loseFlag && !gameState.winFlag
      && !gameState.helpVisible && !gameState.changelogVisible) {
    if (gameState.simMode) {
      // Fixed-dt reps let the sim run much faster than real-time. Budget
      // ~8 ms of wall time per frame so the tab stays responsive.
      const reps = Math.max(1, gameState.simSpeed ?? 60);
      const fixedDt = 1 / 30;          // 33 ms simulated per rep
      const budgetMs = 8;
      const t0 = performance.now();
      for (let i = 0; i < reps; i++) {
        applyJamEffects(gameState);
        updateDrones(gameState, fixedDt);
        updateDefenses(gameState, fixedDt);
        updateProjectiles(gameState, fixedDt);
        updateWave(gameState, fixedDt);
        updateBriefing(gameState, fixedDt);
        tickSim(gameState);
        if (gameState.winFlag || gameState.loseFlag) break;
        if (performance.now() - t0 > budgetMs) break;
      }
    } else {
      applyJamEffects(gameState);
      updateDrones(gameState, dt);
      updateDefenses(gameState, dt);
      updateProjectiles(gameState, dt);
      updateWave(gameState, dt);
      updateBriefing(gameState, dt);
    }
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
  updateTrucks(gameState, dt);
  updateMusic(gameState);
  tickBatch(gameState);
  applyBackdropAutoForPhase(gameState);

  // Render skip for sim mode — draw only a minimal banner so the sim can
  // use the full frame budget on updates. Toggle with state.simSkipRender.
  if (gameState.simMode && gameState.simSkipRender) {
    ctx.fillStyle = CONFIG.colors.bgDark;
    ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
    ctx.save();
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = CONFIG.colors.alertAmber;
    const w = gameState.wave?.number ?? 1;
    const phase = gameState.wave?.phase ?? 'prep';
    const inBatch = gameState.batch?.active;
    const headline = inBatch
      ? 'BATCH ' + (gameState.batch.done + 1) + '/' + gameState.batch.total
      : 'SIM RUNNING';
    ctx.fillText(headline,
      CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 12);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillText((gameState.simStats?.strategy ?? '?') + '  ·  W' + w + ' ' + phase,
      CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 4);
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = CONFIG.colors.accentWhite;
    const steps = gameState.simStrategy ?? [];
    const placed = steps.filter(s => s.done).length;
    ctx.fillText('defenses placed ' + placed + ' / ' + steps.length +
      '  ·  on board ' + gameState.defenses.length,
      CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 20);
    ctx.fillText('inv: RF ' + (gameState.inventory.rfJammer ?? 0) +
      '  INT ' + (gameState.inventory.interceptor ?? 0) +
      '  LAS ' + (gameState.inventory.laser ?? 0) +
      '  HPM ' + (gameState.inventory.hpm ?? 0),
      CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 32);
    if (inBatch) {
      ctx.fillStyle = CONFIG.colors.successGreen;
      ctx.fillText('wins ' + gameState.batch.wins + ' / ' + gameState.batch.done +
        '   (run ' + (gameState.batch.done + 1) + ' of ' + gameState.batch.total + ')',
        CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 48);
      ctx.fillStyle = CONFIG.colors.accentWhite;
      ctx.fillText('Esc to abort  ·  Shift+T to export CSV',
        CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 60);
    } else {
      ctx.fillText('T to stop  ·  Shift+T to export CSV',
        CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 48);
    }
    ctx.restore();
    requestAnimationFrame(frame);
    return;
  }

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
  if (gameState.screenPhase === 'playing' && !gameState.loseFlag && !gameState.winFlag
      && !gameState.helpVisible && !gameState.changelogVisible) {
    ctx.save();
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillText('H = HELP', 4, CONFIG.virtualHeight - 2);
    ctx.restore();
  }
  if (gameState.helpVisible) renderHelp(ctx);
  if (gameState.changelogVisible) renderChangelog(ctx);
  if (gameState.simMode) {
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillText('SIM ' + gameState.simSpeed + 'x — ' +
      (gameState.simStats?.strategy ?? '?') + '  (T to stop)',
      CONFIG.virtualWidth / 2, 4);
    ctx.restore();
  }
  renderCRT(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function toVirtual(e) {
  // The canvas uses object-fit: contain, so when the window aspect doesn't
  // match the virtual aspect (480:270), the rendered image is letterboxed
  // inside the canvas element. We back out the letterbox offset before
  // scaling, otherwise clicks near the bottom of the visible image land
  // hundreds of virtual pixels above where the user aimed.
  const rect = canvas.getBoundingClientRect();
  const vAspect = CONFIG.virtualWidth / CONFIG.virtualHeight;
  const eAspect = rect.width / rect.height;
  let renderedW, renderedH, offsetX, offsetY;
  if (eAspect > vAspect) {
    renderedH = rect.height;
    renderedW = rect.height * vAspect;
    offsetX = (rect.width - renderedW) / 2;
    offsetY = 0;
  } else {
    renderedW = rect.width;
    renderedH = rect.width / vAspect;
    offsetX = 0;
    offsetY = (rect.height - renderedH) / 2;
  }
  return [
    (e.clientX - rect.left - offsetX) * (CONFIG.virtualWidth / renderedW),
    (e.clientY - rect.top  - offsetY) * (CONFIG.virtualHeight / renderedH),
  ];
}

canvas.addEventListener('mousemove', e => {
  const [vx, vy] = toVirtual(e);
  gameState.hoverTile = pixelToTile(vx, vy);
  // HPM aim preview: if we've pinned a tile (awaiting direction), draw aim
  // FROM the pinned tile toward the cursor. Otherwise preview from hover.
  if (gameState.placementMode?.type === 'hpm') {
    const pin = gameState.placementMode.pinTile ?? gameState.hoverTile;
    if (pin) {
      const cx = pin.x * MAP.tileSize + MAP.tileSize / 2;
      const cy = CONFIG.topBarHeight + MAP.padTop + pin.y * MAP.tileSize + MAP.tileSize / 2;
      gameState.placementMode.facingRad = Math.atan2(vy - cy, vx - cx);
    }
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

  // HPM is a two-click placement: first click pins the tile, second click
  // sets the cone direction (aim from pinned tile → click point).
  if (gameState.placementMode.type === 'hpm') {
    if (!gameState.placementMode.pinTile) {
      const tile = mapHitTest(vx, vy);
      if (!tile || !isValidZone(gameState, tile)) return;
      gameState.placementMode.pinTile = tile;
      playSfx('uiClick');
      return;
    }
    // Second click → compute facing from pin to click and commit.
    const pin = gameState.placementMode.pinTile;
    const cx = pin.x * MAP.tileSize + MAP.tileSize / 2;
    const cy = CONFIG.topBarHeight + MAP.padTop + pin.y * MAP.tileSize + MAP.tileSize / 2;
    const facing = Math.atan2(vy - cy, vx - cx);
    placeDefense(gameState, 'hpm', pin, facing);
    gameState.placementMode = null;
    playSfx('uiClick');
    return;
  }

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
  // Shift+C toggles the changelog overlay (issue #46).
  if ((e.key === 'c' || e.key === 'C') && e.shiftKey) {
    gameState.changelogVisible = !gameState.changelogVisible;
    return;
  }
  if (e.key === 'Escape' && gameState.changelogVisible) {
    gameState.changelogVisible = false;
    return;
  }
  // S — run the audio test suite (one-shot every 400 ms, continuous blocks
  // kicked off for 1 s each at the end).
  if (e.key === 's' || e.key === 'S') {
    runSoundTest();
    return;
  }
  // Shift+T — download accumulated sim runs as CSV.
  // Ctrl/Meta+Shift+T — clear sim log.
  if ((e.key === 'T' || e.key === 't') && e.shiftKey) {
    if (e.ctrlKey || e.metaKey) clearSimData();
    else downloadSimData();
    return;
  }
  // Shift+B — start a batch of 10 sim runs (current strategy index, no render).
  // Escape during batch = abort.
  if ((e.key === 'B' || e.key === 'b') && e.shiftKey) {
    if (gameState.batch?.active) { abortBatch(gameState); return; }
    if (gameState.screenPhase !== 'playing') {
      gameState.mode = 'campaign';
      applyMode('campaign');
      applyDelivery(gameState, 0);
      gameState.stats.runStartMs = Date.now();
      gameState.screenPhase = 'playing';
    }
    const strategies = listStrategies();
    const pick = strategies[(simStrategyIdx++) % strategies.length];
    startBatch(gameState, { strategy: pick, total: 10, speed: 60 });
    return;
  }
  if (e.key === 'Escape' && gameState.batch?.active) {
    abortBatch(gameState);
    return;
  }
  // T — toggle sim harness.
  if (e.key === 't' || e.key === 'T') {
    if (gameState.simMode) {
      stopSim(gameState, 'abort');
    } else {
      // Kick off a fresh run from scratch at the start of a campaign.
      if (gameState.screenPhase !== 'playing') {
        gameState.mode = 'campaign';
        applyMode('campaign');
        applyDelivery(gameState, 0);
        gameState.stats.runStartMs = Date.now();
        gameState.screenPhase = 'playing';
      }
      const strategies = listStrategies();
      const pick = strategies[(simStrategyIdx++) % strategies.length];
      startSim(gameState, { strategy: pick, speed: 10 });
    }
    return;
  }
  // Any key dismisses the commander briefing and releases the prep timer.
  if (gameState.briefing?.phase === 'visible' && gameState.screenPhase === 'playing') {
    collapseBriefing(gameState);
    return;
  }

  // QWER / 1-4 during play → select defense from palette without clicking.
  if (gameState.screenPhase === 'playing' && !gameState.loseFlag && !gameState.winFlag) {
    const key = e.key.toLowerCase();
    const map = { q: 'rfJammer', '1': 'rfJammer',
                  w: 'interceptor', '2': 'interceptor',
                  e: 'laser',       '3': 'laser',
                  r: 'hpm',         '4': 'hpm' };
    if (map[key]) {
      const type = map[key];
      const same = gameState.placementMode?.type === type;
      gameState.placementMode = same
        ? null
        : type === 'hpm'
          ? { type: 'hpm', facingRad: -Math.PI / 2 }
          : { type };
      return;
    }
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
  // Idle → any key starts the music + transitions to the mode-select title.
  if (gameState.screenPhase === 'idle') {
    gameState.screenPhase = 'start';
    return;
  }
  // Mode-select title → 1/2 picks training/campaign; any other key = campaign.
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
  const W = 440, H = 240;
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
    '  Q or 1 / W or 2 / E or 3 / R or 4   select defense',
    '     (RF Jammer / Interceptor / Laser / HPM)',
    '  B        cycle backdrop opacity',
    '  M        toggle mute',
    '  H        toggle this help',
    '  Shift+C  toggle changelog',
    '  ESC      cancel placement / exit preview',
    '  type M-A-P at title  open static map preview',
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

// Press S → cycle through every SFX so the player can audit them. Each
// one-shot fires 400 ms after the previous; continuous sounds run for 1 s.
function runSoundTest() {
  if (runSoundTest.running) return;
  runSoundTest.running = true;

  const oneShots = [
    'uiClick', 'interceptorLaunch', 'droneKill',
    'structureHit', 'structureHitHeavy', 'structureDestroyed',
    'owaCommit', 'payloadDrop', 'truckDelivery',
    'laserOverheat', 'hpmPulse',
    'waveStart', 'win', 'lose',
  ];
  const continuous = [
    { name: 'laserFire',       id: 'test-laser' },
    { name: 'rfJam',           id: 'test-rf' },
    { name: 'structuresAlarm', id: 'test-alarm' },
  ];

  console.log('[sfx-test] starting audio audit — watch the console for each cue');
  let delay = 0;
  for (const name of oneShots) {
    setTimeout(() => { console.log('[sfx-test] ' + name); playSfx(name); }, delay);
    delay += 400;
  }
  for (const c of continuous) {
    setTimeout(() => { console.log('[sfx-test] start ' + c.name); startSfx(c.name, c.id); }, delay);
    setTimeout(() => { stopSfx(c.id); }, delay + 1000);
    delay += 1200;
  }
  setTimeout(() => {
    runSoundTest.running = false;
    console.log('[sfx-test] done');
  }, delay);
}
