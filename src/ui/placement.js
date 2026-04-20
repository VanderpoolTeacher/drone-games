import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { tileToPixel } from '../game/drones.js';

const DEFENSE_SIZE = 24;

export function pixelToTile(vx, vy) {
  const top = CONFIG.topBarHeight + MAP.padTop;
  const bottom = top + MAP.gridH * MAP.tileSize;
  if (vx < 0 || vx >= MAP.gridW * MAP.tileSize) return null;
  if (vy < top || vy >= bottom) return null;
  return { x: Math.floor(vx / MAP.tileSize), y: Math.floor((vy - top) / MAP.tileSize) };
}

export function mapHitTest(vx, vy) {
  return pixelToTile(vx, vy);
}

export function isValidZone(state, tile) {
  if (!tile) return false;
  if (!state.placementMode) return false;
  const type = state.placementMode.type;
  const cost = CONFIG.defenses[type]?.cost ?? Infinity;
  if (state.resources < cost) return false;
  const onZone = MAP.placementZones.some(z => z.x === tile.x && z.y === tile.y);
  if (!onZone) return false;
  const occupied = state.defenses.some(d => d.tile.x === tile.x && d.tile.y === tile.y);
  return !occupied;
}

export function renderPlacement(ctx, state) {
  if (!state.placementMode) return;

  drawInvalidOverlays(ctx, state);
  drawGhostAndRange(ctx, state);
}

function drawInvalidOverlays(ctx, state) {
  const { gridW, gridH, tiles } = MAP;
  ctx.fillStyle = CONFIG.colors.threatRed;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] !== 'land') continue;
      if (MAP.placementZones.some(z => z.x === x && z.y === y)) continue;
      const { x: cx, y: cy } = tileToPixel({ x, y });
      ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
    }
  }
}

function drawGhostAndRange(ctx, state) {
  const tile = state.hoverTile;
  if (!tile) return;
  const { x: cx, y: cy } = tileToPixel(tile);
  const type = state.placementMode.type;
  const range = CONFIG.defenses[type]?.range ?? 0;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = CONFIG.colors.friendlyCyan;
  ctx.fillRect(Math.floor(cx - DEFENSE_SIZE / 2), Math.floor(cy - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);
  ctx.restore();

  if (range > 0) {
    ctx.strokeStyle = CONFIG.colors.friendlyCyan;
    ctx.lineWidth = 1;
    if (type === 'rfJammer') {
      ctx.setLineDash([3, 3]);
    }
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (!isValidZone(state, tile)) {
    ctx.strokeStyle = CONFIG.colors.threatRed;
    ctx.lineWidth = 1;
    const half = DEFENSE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - half);
    ctx.lineTo(cx + half, cy + half);
    ctx.moveTo(cx + half, cy - half);
    ctx.lineTo(cx - half, cy + half);
    ctx.stroke();
  }
}
