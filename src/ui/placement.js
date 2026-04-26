import { CONFIG } from '../config.js';
import { MAP, getTileType, isBuildableType } from '../game/map.js';
import { tileToPixel } from '../game/drones.js';

const DEFENSE_SIZE = 12;   // one grid cell

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
  if ((state.inventory?.[type] ?? 0) <= 0) return false;
  // Only healthy or lightly-cracked (>= 66% HP) apartments/skyscrapers can
  // mount a defense. Smoking / burning / destroyed cells block placement.
  const tileType = getTileType(tile.x, tile.y);
  if (!isBuildableType(tileType)) return false;
  const key = tile.x + ',' + tile.y;
  if (tileType === 'apartment') {
    const apt = MAP.apartments.find(a => a.tile.x === tile.x && a.tile.y === tile.y);
    if (apt) {
      const frac = (state.apartmentPop?.[key] ?? apt.maxPop) / apt.maxPop;
      if (frac < 0.66) return false;
    }
  }
  if (tileType === 'skyscraper') {
    const frac = (state.skyscraperHp?.[key] ?? 2) / 2;
    if (frac < 0.66) return false;
  }
  const occupied = state.defenses.some(d => d.tile.x === tile.x && d.tile.y === tile.y);
  return !occupied;
}

export function renderPlacement(ctx, state) {
  if (!state.placementMode) return;
  drawGhostAndRange(ctx, state);
}

function drawGhostAndRange(ctx, state) {
  // HPM after first click: ghost locks to the pinned tile while the cursor
  // picks direction. Everything else follows the hover tile.
  const tile = state.placementMode.pinTile ?? state.hoverTile;
  if (!tile) return;
  const { x: cx, y: cy } = tileToPixel(tile);
  const type = state.placementMode.type;
  const range = CONFIG.defenses[type]?.range
    ?? CONFIG.defenses[type]?.detectRange   // radar — sensing-only (#6)
    ?? 0;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = CONFIG.colors.friendlyCyan;
  ctx.fillRect(Math.floor(cx - DEFENSE_SIZE / 2), Math.floor(cy - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);
  ctx.restore();

  if (type === 'hpm') {
    const cfg = CONFIG.defenses.hpm;
    const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
    const f = state.placementMode.facingRad ?? -Math.PI / 2;
    ctx.strokeStyle = CONFIG.colors.friendlyCyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, cfg.coneRange, f - halfAngleRad, f + halfAngleRad);
    ctx.closePath();
    ctx.stroke();
  } else if (range > 0) {
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
