import { CONFIG } from '../config.js';
import { getReleasedVersion } from './changelog.js';

const IMG_PATH = './src/images/commander-warden-podium.png';
const portrait = new Image();
portrait.src = IMG_PATH;

const LOGO_IMG_PATH = './src/images/drone-defense-x.png';
const logoImg = new Image();
logoImg.src = LOGO_IMG_PATH;

const MAP_IMG_PATH = './src/images/new-york.png';
const mapImg = new Image();
mapImg.src = MAP_IMG_PATH;

// Staged start transition: logo fades to black → hold → commander slides in
// from right + map fades up + music ramps (handled in audio/music.js) → brief
// scrolls once buildup completes.
const FADE_OUT_MS = 1200;
const HOLD_MS = 300;
const BUILDUP_MS = 1500;
const BUILDUP_START = FADE_OUT_MS + HOLD_MS;
const BUILDUP_END = BUILDUP_START + BUILDUP_MS;

const smoothstep = (t) => t * t * (3 - 2 * t);

const BRIEF_LINES = [
  '>> BRIEFING FOLLOWS <<',
  '',
  'Red Cell has activated coordinated drone',
  'operations against the city.',
  '',
  'Sensor returns indicate multi-class UAS —',
  'ISR surveillance, OWA one-way attack,',
  'armored Payload-Delivery.',
  '',
  'Your defenses are the only thing between',
  'the city and catastrophic loss.',
  '',
  'Hold the line, Watchfloor.',
  '',
  '>> GOOD LUCK <<',
];

const SCROLL_SPEED_PX_PER_S = 15;
const LINE_HEIGHT = 12;
const TEXT_BAND_TOP = 56;
const TEXT_BAND_BOTTOM = 214;
const TEXT_SIZE = 8;

let scrollStartMs = null;
let startPhaseEnterMs = null;
let lastPhase = null;

function drawBackdrop(ctx, state, tMs) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  if (state.screenPhase !== 'start') return;
  const elapsed = startPhaseEnterMs == null ? 0 : tMs - startPhaseEnterMs;
  if (elapsed < BUILDUP_START) return;

  // Commander first, map second — split the buildup window 0..0.55 = commander,
  // 0.45..1.0 = map (slight overlap for a smooth fade).
  const buildT = Math.min(1, (elapsed - BUILDUP_START) / BUILDUP_MS);
  const commanderT = smoothstep(Math.min(1, buildT / 0.55));
  const mapT = smoothstep(Math.max(0, (buildT - 0.45) / 0.55));

  // Warden portrait arrives FIRST — slides in from off-right.
  if (portrait.complete && portrait.naturalWidth > 0) {
    const srcW = portrait.naturalWidth;
    const srcH = portrait.naturalHeight;
    const destH = Math.round(CONFIG.virtualHeight * 0.5);
    const destW = Math.round(destH * srcW / srcH);
    const restX = CONFIG.virtualWidth - destW - 24;
    const restY = Math.round((CONFIG.virtualHeight - destH) / 2);
    const slideX = Math.round(restX + (1 - commanderT) * CONFIG.virtualWidth);
    ctx.save();
    ctx.globalAlpha = 0.95 * commanderT;
    ctx.drawImage(portrait, slideX, restY, destW, destH);
    ctx.restore();
  }

  // NY map fades in AFTER — half-width on the LEFT, low alpha, slight tilt.
  if (mapT > 0 && mapImg.complete && mapImg.naturalWidth > 0) {
    const srcW = mapImg.naturalWidth;
    const srcH = mapImg.naturalHeight;
    const destW = Math.round(CONFIG.virtualWidth * 0.5);
    const destH = Math.round(destW * srcH / srcW);
    const cx = destW / 2 + 24;
    const cy = CONFIG.virtualHeight / 2;
    ctx.save();
    ctx.globalAlpha = 0.5 * mapT;
    ctx.translate(cx, cy);
    ctx.rotate(-10 * Math.PI / 180);
    ctx.drawImage(mapImg, -destW / 2, -destH / 2, destW, destH);
    ctx.restore();
  }
}

function drawHeadline(ctx, tMs) {
  const blink = tMs % 1000 < 750;
  if (!blink) return;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('INCOMING DRONE ATTACK', CONFIG.virtualWidth / 2, 24);
}

function drawScrollingBrief(ctx, tMs, state) {
  if (state.screenPhase !== 'start') return;
  if (startPhaseEnterMs == null) return;
  const elapsed = tMs - startPhaseEnterMs;
  if (elapsed < BUILDUP_END) return;  // brief holds until buildup finishes
  if (scrollStartMs === null) scrollStartMs = tMs;

  const totalTextH = BRIEF_LINES.length * LINE_HEIGHT;
  const bandH = TEXT_BAND_BOTTOM - TEXT_BAND_TOP;
  const loopLen = totalTextH + bandH;

  const offset = ((tMs - scrollStartMs) * SCROLL_SPEED_PX_PER_S / 1000) % loopLen;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TEXT_BAND_TOP, CONFIG.virtualWidth, bandH);
  ctx.clip();

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  const startY = TEXT_BAND_BOTTOM - offset;
  for (let i = 0; i < BRIEF_LINES.length; i++) {
    const y = startY + i * LINE_HEIGHT;
    if (y + LINE_HEIGHT < TEXT_BAND_TOP) continue;
    if (y > TEXT_BAND_BOTTOM) continue;
    ctx.fillText(BRIEF_LINES[i], CONFIG.virtualWidth / 2, y);
  }

  ctx.restore();
}

function drawPrompt(ctx, state, tMs) {
  const blink = tMs % 1000 < 750;
  if (!blink) return;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  // Idle: press-any-key prompt. Start: mode-select prompt.
  const msg = state.screenPhase === 'idle'
    ? 'PRESS ANY BUTTON TO BEGIN'
    : 'PRESS 1 TRAINING  ·  2 EVENT  ·  ANY KEY EVENT';
  ctx.fillText(msg, CONFIG.virtualWidth / 2, 252);
}

function drawLogo(ctx, state, tMs) {
  if (!logoImg.complete || logoImg.naturalWidth === 0) return;
  let alpha = 1;
  if (state.screenPhase === 'start' && startPhaseEnterMs != null) {
    alpha = Math.max(0, 1 - (tMs - startPhaseEnterMs) / FADE_OUT_MS);
  }
  if (alpha <= 0) return;
  const size = 180;
  const x = Math.round((CONFIG.virtualWidth - size) / 2);
  const y = Math.round((CONFIG.virtualHeight - size) / 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logoImg, x, y, size, size);
  ctx.restore();
}

export function renderStartScreen(ctx, state, tMs) {
  if (state.screenPhase !== 'idle' && state.screenPhase !== 'start') return;

  // Detect idle → start transition and stamp the fade clock.
  if (state.screenPhase === 'start' && lastPhase !== 'start') {
    startPhaseEnterMs = tMs;
  }
  lastPhase = state.screenPhase;

  ctx.save();
  drawBackdrop(ctx, state, tMs);
  drawLogo(ctx, state, tMs);
  if (state.screenPhase === 'start' && startPhaseEnterMs != null
      && tMs - startPhaseEnterMs >= BUILDUP_END) {
    drawHeadline(ctx, tMs);
    drawScrollingBrief(ctx, tMs, state);
  }
  drawPrompt(ctx, state, tMs);
  drawVersion(ctx);
  ctx.restore();
}

function drawVersion(ctx) {
  ctx.save();
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillText(getReleasedVersion(), CONFIG.virtualWidth - 4, CONFIG.virtualHeight - 2);
  ctx.restore();
}
