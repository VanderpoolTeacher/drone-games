import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { totalCasualties } from './casualtyHud.js';
import { liveBridgeCount, totalBridgeCount } from '../game/state.js';

const TEXT_COL_X = 60;
const TEXT_COL_W = 360;
const HEADLINE_Y = 36;
const BODY_TOP_Y = 70;
const BODY_BOTTOM_Y = 158;
const LINE_HEIGHT = 11;
const SCORE_GRADE_Y = 165;       // top of big grade letter / score number
const SCORE_LABEL_Y = 192;       // small "GRADE" / "SCORE" labels under each
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

  // Map any win/lose tier to the shared win/lose backdrop image.
  const imgKey = key.startsWith('win') ? 'win' : 'lose';
  const img = images[imgKey];
  if (img && img.complete && img.naturalWidth > 0) {
    const destH = CONFIG.virtualHeight;
    const destW = Math.round(destH * img.naturalWidth / img.naturalHeight);
    const destX = Math.round((CONFIG.virtualWidth - destW) / 2);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(img, destX, 0, destW, destH);
    ctx.globalAlpha = 1.0;
  }
}

function drawHeadline(ctx, entry, tMs, modeTag) {
  const blink = tMs % 1000 < 750;
  if (!blink) return;
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors[entry.headlineColor] ?? CONFIG.colors.accentWhite;
  ctx.fillText(entry.headline + (modeTag ? ' · ' + modeTag : ''), CONFIG.virtualWidth / 2, HEADLINE_Y);
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
  const blink = tMs % 1000 < 750;
  if (!blink) return;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('PRESS ANY KEY TO RESTART', CONFIG.virtualWidth / 2, PROMPT_Y);
}

function pickEndingKey(state) {
  if (state.winFlag) {
    const casualties = totalCasualties(state) + (state.financialPenalty ?? 0);
    const structsLost = state.stats?.structuresLost ?? 0;
    const allBridges = liveBridgeCount(state) === totalBridgeCount();
    if (casualties === 0 && structsLost === 0 && allBridges) return 'winPerfect';
    if (casualties < 250 && structsLost <= 1) return 'winDecisive';
    return 'winPyrrhic';
  }
  if (state.loseFlag) {
    if ((state.wave?.number ?? 1) >= 4) return 'loseNarrow';
    return 'loseTotal';
  }
  return null;
}

export function renderEndScreen(ctx, state, tMs) {
  const key = pickEndingKey(state);
  if (!key) return;
  const entry = CONFIG.endScreens[key] ?? CONFIG.endScreens[state.winFlag ? 'win' : 'lose'];
  if (!entry) return;

  const modeTag = state.mode ? state.mode.toUpperCase() : '';

  ctx.save();
  drawBackdrop(ctx, key);
  drawHeadline(ctx, entry, tMs, modeTag);
  drawBody(ctx, entry);
  drawScoreGrade(ctx, state);
  drawCasualties(ctx, state);
  drawPrompt(ctx, tMs);
  ctx.restore();
}

export function computeScore(state) {
  const w = CONFIG.scoring.weights;
  const wavesCleared = state.winFlag ? 5 : Math.max(0, (state.wave?.number ?? 1) - 1);
  let structuresAlive = 0;
  for (const id of Object.keys(state.structureHp ?? {})) {
    if ((state.structureHp[id] ?? 0) > 0) structuresAlive += 1;
  }
  const bridgesAlive = liveBridgeCount(state);
  const casualties = totalCasualties(state);
  const structuresLost = state.stats?.structuresLost ?? 0;
  const financialPenalty = state.financialPenalty ?? 0;

  let score =
      wavesCleared    * w.wavesCleared
    + structuresAlive * w.structuresAlive
    + bridgesAlive    * w.bridgesAlive
    + casualties      * w.casualties
    + structuresLost  * w.structuresLost
    + financialPenalty* w.financialPenalty;

  if (casualties === 0 && structuresLost === 0 && bridgesAlive === totalBridgeCount()) {
    score += CONFIG.scoring.perfectRunBonus;
  }

  let grade = 'F';
  for (const [min, letter] of CONFIG.scoring.gradeThresholds) {
    if (score >= min) { grade = letter; break; }
  }
  const color = CONFIG.colors[CONFIG.scoring.gradeColors[grade]] ?? CONFIG.colors.accentWhite;
  return { score, grade, color };
}

function drawScoreGrade(ctx, state) {
  const { score, grade, color } = computeScore(state);
  const cx = CONFIG.virtualWidth / 2;

  ctx.textBaseline = 'top';

  // Big GRADE letter, left of center, color-coded.
  ctx.font = '24px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = color;
  ctx.fillText(grade, cx - 24, SCORE_GRADE_Y);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillText('GRADE', cx - 24, SCORE_LABEL_Y);

  // SCORE number, right of center.
  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText(String(score), cx + 24, SCORE_GRADE_Y + 4);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.gridLine;
  ctx.fillText('SCORE', cx + 24, SCORE_LABEL_Y);
}

function formatRunTime(ms) {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function drawCasualties(ctx, state) {
  const lost = totalCasualties(state);
  const waveTotal = 5;
  const wavesSurvived = state.winFlag ? waveTotal : Math.max(0, state.wave.number - 1);
  const runMs = (state.stats.runEndMs || Date.now()) - (state.stats.runStartMs || Date.now());
  const kills = state.stats.droneKills;
  const droneTotal = (kills.isr ?? 0) + (kills.owa ?? 0) + (kills.payloadDelivery ?? 0);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';

  const leftX = 80;
  const rightX = 400;
  const topY = 200;
  const lineH = 11;

  ctx.textAlign = 'left';
  ctx.fillStyle = lost > 0 ? CONFIG.colors.threatRed : CONFIG.colors.successGreen;
  ctx.fillText('CASUALTIES ' + lost, leftX, topY);
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('DRONES DOWN ' + droneTotal, leftX, topY + lineH);
  ctx.fillText('DEFENSES LOST ' + state.stats.defensesLost, leftX, topY + lineH * 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('WAVES ' + wavesSurvived + '/' + waveTotal, rightX, topY);
  ctx.fillText('TIME ' + formatRunTime(runMs), rightX, topY + lineH);
  ctx.fillText('STRUCTURES LOST ' + state.stats.structuresLost, rightX, topY + lineH * 2);
}
