import { CONFIG } from '../config.js';

const IMG_PATH = './src/images/commander-warden-podium.png';
const portrait = new Image();
portrait.src = IMG_PATH;

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

function drawBackdrop(ctx) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  if (portrait.complete && portrait.naturalWidth > 0) {
    const srcW = portrait.naturalWidth;
    const srcH = portrait.naturalHeight;
    const destH = CONFIG.virtualHeight;
    const destW = Math.round(destH * srcW / srcH);
    const destX = Math.round((CONFIG.virtualWidth - destW) / 2);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(portrait, destX, 0, destW, destH);
    ctx.globalAlpha = 1.0;
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

function drawPrompt(ctx, tMs) {
  const blink = tMs % 1000 < 750;
  if (!blink) return;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('PRESS 1 TRAINING  ·  2 CAMPAIGN  ·  ANY KEY CAMPAIGN', CONFIG.virtualWidth / 2, 252);
}

export function renderStartScreen(ctx, state, tMs) {
  if (state.screenPhase !== 'idle' && state.screenPhase !== 'start') return;
  ctx.save();
  drawBackdrop(ctx);
  drawHeadline(ctx, tMs);
  drawScrollingBrief(ctx, tMs, state);
  drawPrompt(ctx, tMs);
  ctx.restore();
}
