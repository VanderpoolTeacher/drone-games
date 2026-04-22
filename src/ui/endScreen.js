import { CONFIG } from '../config.js';

const TEXT_COL_X = 60;
const TEXT_COL_W = 360;
const HEADLINE_Y = 36;
const BODY_TOP_Y = 90;
const BODY_BOTTOM_Y = 230;
const LINE_HEIGHT = 11;
const PROMPT_Y = 252;

const images = {};
for (const key of ['win', 'lose']) {
  const entry = CONFIG.endScreens[key];
  if (!entry) continue;
  const img = new Image();
  img.src = entry.image;
  images[key] = img;
}

function wrapParagraph(ctx, text, maxWidth) {
  if (text === '') return [''];
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

function drawBackdrop(ctx, key) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  const img = images[key];
  if (img && img.complete && img.naturalWidth > 0) {
    const destH = CONFIG.virtualHeight;
    const destW = Math.round(destH * img.naturalWidth / img.naturalHeight);
    const destX = Math.round((CONFIG.virtualWidth - destW) / 2);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, destX, 0, destW, destH);
    ctx.globalAlpha = 1.0;
  }
}

function drawHeadline(ctx, entry, tMs) {
  const blink = Math.floor(tMs / 250) % 2 === 0;
  if (!blink) return;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors[entry.headlineColor] ?? CONFIG.colors.accentWhite;
  ctx.fillText(entry.headline, CONFIG.virtualWidth / 2, HEADLINE_Y);
}

function drawBody(ctx, entry) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  const allLines = [];
  for (const para of entry.body) {
    for (const line of wrapParagraph(ctx, para, TEXT_COL_W)) allLines.push(line);
  }

  const totalH = allLines.length * LINE_HEIGHT;
  const bandH = BODY_BOTTOM_Y - BODY_TOP_Y;
  let y = BODY_TOP_Y + Math.max(0, Math.floor((bandH - totalH) / 2));

  for (const line of allLines) {
    if (line) ctx.fillText(line, CONFIG.virtualWidth / 2, y);
    y += LINE_HEIGHT;
  }
}

function drawPrompt(ctx, tMs) {
  const blink = Math.floor(tMs / 250) % 2 === 0;
  if (!blink) return;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('PRESS ANY KEY TO RESTART', CONFIG.virtualWidth / 2, PROMPT_Y);
}

export function renderEndScreen(ctx, state, tMs) {
  const key = state.winFlag ? 'win' : state.loseFlag ? 'lose' : null;
  if (!key) return;
  const entry = CONFIG.endScreens[key];
  if (!entry) return;

  ctx.save();
  drawBackdrop(ctx, key);
  drawHeadline(ctx, entry, tMs);
  drawBody(ctx, entry);
  drawPrompt(ctx, tMs);
  ctx.restore();
}
