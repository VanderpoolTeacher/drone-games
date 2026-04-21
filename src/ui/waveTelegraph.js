import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { bodyColorFor } from '../game/drones.js';

const CHEVRON_SIZE = 6;
const ICON_SIZE = 8;
const ICON_GAP = 4;

export function renderWaveTelegraph(ctx, state, tMs) {
  if (state.wave.phase !== 'prep') return;

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
    iconX = cx - CHEVRON_SIZE * 2 - ICON_GAP - ICON_SIZE;
    iconY = cy - ICON_SIZE / 2;
  } else if (edge === 'E') {
    cx = CONFIG.virtualWidth - 8; cy = centerY;
    chevron = [[cx + CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx + CHEVRON_SIZE * 2 + ICON_GAP;
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
