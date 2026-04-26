import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { bodyColorFor } from '../game/drones.js';

const CHEVRON_SIZE = 6;
const ICON_SIZE = 8;
const ICON_GAP = 4;

export function renderWaveTelegraph(ctx, state, tMs) {
  if (state.wave.phase === 'prep') {
    drawPrepChevrons(ctx, state, tMs);
    return;
  }
  // Wave-start announcement (#36): for the first 2.5 s of active phase show
  // a banner with the leaked-intel tier and the resulting defense multiplier
  // so the player can feel WHY the wave got heavier.
  if (state.wave.phase === 'active' && (state.wave.activeElapsedMs ?? 0) < 2500) {
    drawWaveStartBanner(ctx, state);
  }
}

function drawPrepChevrons(ctx, state, tMs) {
  const waveIdx = state.wave.number - 1;
  const waveDrones = CONFIG.waves[waveIdx]?.drones;
  if (!waveDrones) return;
  const bright = Math.floor(tMs / 500) % 2 === 0;
  const chevronColor = bright ? CONFIG.colors.alertAmber : CONFIG.colors.gridLine;
  for (const d of waveDrones) {
    const edge = findSpawnEdgeForType(d.type);
    if (!edge) continue;
    drawChevronAndIcon(ctx, edge, d.type, chevronColor);
  }
}

function intelTierLabel(intelPoints) {
  if (intelPoints > 45) return 'HIGH';
  if (intelPoints > 20) return 'MED';
  if (intelPoints > 5)  return 'LOW';
  return 'NONE';
}

function flavorLineFor(totalMult) {
  if (totalMult >= 3.0) return 'RED CELL COMMITTING EVERYTHING';
  if (totalMult >= 2.0) return 'HEAVY ORDNANCE INBOUND';
  if (totalMult >= 1.5) return 'ENEMY ESCALATING';
  return null;
}

function drawWaveStartBanner(ctx, state) {
  const intelMult = state.wave.intelMult ?? 1;
  const defMult = state.wave.defenseMult ?? 1;
  const intel = state.lastWaveIsrIntel ?? 0;
  const tier = state.wave.number === 1 ? 'NONE' : intelTierLabel(intel);
  const total = intelMult * defMult;
  const flavor = flavorLineFor(total);

  const cx = CONFIG.virtualWidth / 2;
  const top = CONFIG.topBarHeight + 8;
  const lineH = 11;

  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Subtle bg panel so text is legible over the map.
  const panelW = 280;
  const panelH = (flavor ? 3 : 2) * lineH + 12;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.globalAlpha = 0.85;
  ctx.fillRect(cx - panelW / 2, top - 4, panelW, panelH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = CONFIG.colors.alertAmber;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - panelW / 2 + 0.5, top - 4 + 0.5, panelW - 1, panelH - 1);

  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText('INTEL LEAKED LAST RUN: ' + tier, cx, top);
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('ENEMY RESPONSE: ×' + defMult.toFixed(1), cx, top + lineH);
  if (flavor) {
    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillText(flavor, cx, top + lineH * 2);
  }
  ctx.restore();
}

function findSpawnEdgeForType(type) {
  for (const [edgeName, info] of Object.entries(MAP.spawnEdges)) {
    if (info.droneTypes.includes(type)) return edgeName;
  }
  return null;
}

function drawChevronAndIcon(ctx, edge, type, chevronColor) {
  const centerX = CONFIG.virtualWidth / 2;
  const mapTop = CONFIG.topBarHeight + MAP.padTop;
  const mapBottom = mapTop + MAP.gridH * MAP.tileSize;
  const centerY = Math.floor((mapTop + mapBottom) / 2);

  let cx, cy, chevron, iconX, iconY;
  if (edge === 'N') {
    cx = centerX; cy = mapTop - 6;
    chevron = [[cx - CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx, cy]];
    iconX = cx - CHEVRON_SIZE * 2 - ICON_GAP - ICON_SIZE;
    iconY = cy - ICON_SIZE;
  } else if (edge === 'S') {
    cx = centerX; cy = mapBottom + 6;
    chevron = [[cx - CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx + CHEVRON_SIZE * 2 + ICON_GAP;
    iconY = cy;
  } else if (edge === 'W') {
    cx = 8; cy = centerY;
    chevron = [[cx - CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx - CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx + CHEVRON_SIZE + ICON_GAP;
    iconY = cy - ICON_SIZE / 2;
  } else if (edge === 'E') {
    cx = CONFIG.virtualWidth - 8; cy = centerY;
    chevron = [[cx + CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx - CHEVRON_SIZE - ICON_GAP - ICON_SIZE;
    iconY = cy - ICON_SIZE / 2;
  } else {
    return;
  }

  ctx.fillStyle = chevronColor;
  ctx.beginPath();
  ctx.moveTo(chevron[0][0], chevron[0][1]);
  ctx.lineTo(chevron[1][0], chevron[1][1]);
  ctx.lineTo(chevron[2][0], chevron[2][1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColorFor(type);
  ctx.fillRect(Math.floor(iconX), Math.floor(iconY), ICON_SIZE, ICON_SIZE);
}
