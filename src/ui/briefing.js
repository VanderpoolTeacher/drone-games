import { CONFIG } from '../config.js';

const PORTRAIT_SIZE = 64;
const PORTRAIT_X = 4;
const PORTRAIT_Y = CONFIG.virtualHeight - 68;   // 202

const BUBBLE_X = 72;
const BUBBLE_Y = CONFIG.virtualHeight - 84;     // 186
const BUBBLE_W = 320;
const BUBBLE_H = 80;
const BUBBLE_PAD = 4;

const TAB_X = 4;
const TAB_Y = CONFIG.virtualHeight - 20;        // 250
const TAB_SIZE = 16;

const TEXT_SIZE = 8;
const TEXT_LINE_HEIGHT = 11;

const PATHS = {
  neutral: './src/images/commander-warden.png',
  stern:   './src/images/commander-warden-stern.png',
  angry:   './src/images/commander-warden-angry.png',
  bloody:  './src/images/commander-warden-bloody.png',
};

const PORTRAITS = {};
for (const key of Object.keys(PATHS)) {
  const img = new Image();
  img.src = PATHS[key];
  PORTRAITS[key] = img;
}

function currentPortraitKey(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return 'neutral';
  return CONFIG.waves[idx].portrait || 'neutral';
}

function currentBriefingText(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return '';
  return CONFIG.waves[idx].briefing || '';
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const candidate = current ? current + ' ' + w : w;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawPortrait(ctx, key, x, y, size) {
  const img = PORTRAITS[key];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = CONFIG.colors.accentWhite;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
}

function drawBubble(ctx, state) {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(BUBBLE_X + 0.5, BUBBLE_Y + 0.5, BUBBLE_W - 1, BUBBLE_H - 1);

  const tailY = 210;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.beginPath();
  ctx.moveTo(BUBBLE_X, tailY - 3);
  ctx.lineTo(BUBBLE_X - 3, tailY);
  ctx.lineTo(BUBBLE_X, tailY + 3);
  ctx.closePath();
  ctx.fill();

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  const innerW = BUBBLE_W - BUBBLE_PAD * 2;
  const lines = wrapLines(ctx, currentBriefingText(state), innerW);
  let ty = BUBBLE_Y + BUBBLE_PAD;
  for (const line of lines) {
    ctx.fillText(line, BUBBLE_X + BUBBLE_PAD, ty);
    ty += TEXT_LINE_HEIGHT;
    if (ty > BUBBLE_Y + BUBBLE_H - TEXT_SIZE) break;
  }
}

function drawTab(ctx, state, tMs) {
  const key = currentPortraitKey(state);
  const img = PORTRAITS[key];

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE);

  if (img && img.complete && img.naturalWidth > 0) {
    const srcSize = Math.min(img.naturalWidth, img.naturalHeight) * 0.45;
    const srcX = (img.naturalWidth - srcSize) / 2;
    const srcY = img.naturalHeight * 0.1;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, TAB_X + 1, TAB_Y + 1, 14, 14);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(TAB_X + 1, TAB_Y + 1, 14, 14);
  }

  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(TAB_X + 0.5, TAB_Y + 0.5, TAB_SIZE - 1, TAB_SIZE - 1);

  const blink = !state.briefing.expandedOnce && Math.floor(tMs / 250) % 2 === 0;
  if (state.briefing.expandedOnce || blink) {
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(TAB_X + TAB_SIZE - 3, TAB_Y + 1, 2, 2);
  }
}

function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
}

export function updateBriefing(state, dt) {
  const waveIdx = state.wave.number - 1;
  if (state.wave.phase === 'prep' && state.briefing.activeBriefingIndex !== waveIdx) {
    state.briefing.phase = 'visible';
    state.briefing.visibleMs = 0;
    state.briefing.expandedOnce = false;
    state.briefing.activeBriefingIndex = waveIdx;
    return;
  }
  if (state.briefing.phase === 'visible') {
    state.briefing.visibleMs += dt * 1000;
    if (state.briefing.visibleMs >= CONFIG.warden.autoCollapseMs) {
      state.briefing.phase = 'tab';
    }
  }
}

export function renderBriefing(ctx, state, tMs) {
  if (state.loseFlag || state.winFlag) return;
  if (state.briefing.phase === 'idle') return;

  ctx.save();
  if (state.briefing.phase === 'visible') {
    drawPortrait(ctx, currentPortraitKey(state), PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE);
    drawBubble(ctx, state);
  } else if (state.briefing.phase === 'tab') {
    drawTab(ctx, state, tMs);
  }
  ctx.restore();
}

export function briefingClickHit(state, vx, vy) {
  if (state.loseFlag || state.winFlag) return false;
  if (state.briefing.phase === 'visible') {
    const inBubble = pointInRect(vx, vy, BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
    const inPortrait = pointInRect(vx, vy, PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE);
    if (inBubble || inPortrait) {
      state.briefing.phase = 'tab';
      state.briefing.expandedOnce = true;
      return true;
    }
    return false;
  }
  if (state.briefing.phase === 'tab') {
    if (pointInRect(vx, vy, TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE)) {
      state.briefing.phase = 'visible';
      state.briefing.visibleMs = 0;
      state.briefing.expandedOnce = true;
      return true;
    }
    return false;
  }
  return false;
}
