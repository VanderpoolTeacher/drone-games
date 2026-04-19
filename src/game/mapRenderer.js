import { CONFIG } from '../config.js';
import { MAP } from './map.js';

export function renderMap(ctx, tMs) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawZones(ctx, tMs);
  drawStructures(ctx);
}

function drawTiles(ctx) {
  const { tileSize, gridW, gridH, tiles, padTop } = MAP;

  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, CONFIG.topBarHeight, CONFIG.virtualWidth, gridH * tileSize + MAP.padTop + MAP.padBottom);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] === 'land') {
        ctx.fillStyle = CONFIG.colors.bgDark;
        ctx.fillRect(
          x * tileSize,
          CONFIG.topBarHeight + padTop + y * tileSize,
          tileSize,
          tileSize
        );
      }
    }
  }

  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] === 'land') {
        ctx.strokeRect(
          x * tileSize + 0.5,
          CONFIG.topBarHeight + padTop + y * tileSize + 0.5,
          tileSize - 1,
          tileSize - 1
        );
      }
    }
  }
}

function drawCoastline(ctx) {
  const { tileSize, gridW, gridH, tiles, padTop } = MAP;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] !== 'land') continue;
      const px = x * tileSize;
      const py = CONFIG.topBarHeight + padTop + y * tileSize;

      if (x === 0 || tiles[y][x - 1] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + tileSize); ctx.stroke();
      }
      if (x === gridW - 1 || tiles[y][x + 1] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px + tileSize - 0.5, py); ctx.lineTo(px + tileSize - 0.5, py + tileSize); ctx.stroke();
      }
      if (y === 0 || tiles[y - 1][x] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px, py + 0.5); ctx.lineTo(px + tileSize, py + 0.5); ctx.stroke();
      }
      if (y === gridH - 1 || tiles[y + 1][x] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px, py + tileSize - 0.5); ctx.lineTo(px + tileSize, py + tileSize - 0.5); ctx.stroke();
      }
    }
  }
}

function drawStructures(ctx) {
  const { tileSize, structures, padTop } = MAP;
  const size = 32;

  for (const s of structures) {
    const cx = s.tile.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + s.tile.y * tileSize + tileSize / 2;

    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillRect(Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);

    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
  }
}

function drawZones(ctx, tMs) {
  const { tileSize, placementZones, padTop } = MAP;
  const brightPhase = Math.floor(tMs / 1000) % 2 === 0;
  const color = brightPhase ? CONFIG.colors.friendlyCyan : CONFIG.colors.gridLine;

  ctx.fillStyle = color;
  for (const z of placementZones) {
    const cx = z.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + z.y * tileSize + tileSize / 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.lineTo(cx + 2, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 2, cy);
    ctx.closePath();
    ctx.fill();
  }
}
