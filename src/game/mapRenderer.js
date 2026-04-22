import { CONFIG } from '../config.js';
import { MAP } from './map.js';

export function renderMap(ctx, tMs, state) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawZones(ctx, tMs);
  drawStructures(ctx, state);
}

export function renderTrucks(ctx, state) {
  if (!state.trucks || state.trucks.length === 0) return;
  for (const t of state.trucks) {
    if (t.phase === 'waiting') continue;
    // Truck body — 6×4 dark olive rectangle with an amber cab dot.
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(Math.floor(t.x - 3), Math.floor(t.y - 2), 6, 4);
    ctx.fillStyle = CONFIG.colors.bgDark;
    ctx.fillRect(Math.floor(t.x - 3), Math.floor(t.y - 2), 2, 4);   // cab shadow
    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillRect(Math.floor(t.x - 3), Math.floor(t.y - 2) + 1, 1, 2);  // headlight
  }
}

function drawTiles(ctx) {
  const { tileSize, gridW, gridH, tiles, padTop, padBottom } = MAP;

  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, CONFIG.topBarHeight, CONFIG.virtualWidth, gridH * tileSize + padTop + padBottom);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const t = tiles[y][x];
      if (t === 'land') {
        ctx.fillStyle = CONFIG.colors.bgDark;
        ctx.fillRect(
          x * tileSize,
          CONFIG.topBarHeight + padTop + y * tileSize,
          tileSize,
          tileSize
        );
      } else if (t === 'bridge') {
        // Bridge deck — slightly lighter than water, with rails.
        const py = CONFIG.topBarHeight + padTop + y * tileSize;
        ctx.fillStyle = CONFIG.colors.gridLine;
        ctx.fillRect(x * tileSize, py + 2, tileSize, tileSize - 4);
        ctx.fillStyle = CONFIG.colors.accentWhite;
        ctx.fillRect(x * tileSize, py + 1, tileSize, 1);
        ctx.fillRect(x * tileSize, py + tileSize - 2, tileSize, 1);
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

      // Coastline only renders where land meets water (not land meets bridge).
      const isWaterEdge = (x2, y2) =>
        x2 < 0 || x2 >= gridW || y2 < 0 || y2 >= gridH || tiles[y2][x2] === 'water';

      if (isWaterEdge(x - 1, y)) {
        ctx.beginPath(); ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + tileSize); ctx.stroke();
      }
      if (isWaterEdge(x + 1, y)) {
        ctx.beginPath(); ctx.moveTo(px + tileSize - 0.5, py); ctx.lineTo(px + tileSize - 0.5, py + tileSize); ctx.stroke();
      }
      if (isWaterEdge(x, y - 1)) {
        ctx.beginPath(); ctx.moveTo(px, py + 0.5); ctx.lineTo(px + tileSize, py + 0.5); ctx.stroke();
      }
      if (isWaterEdge(x, y + 1)) {
        ctx.beginPath(); ctx.moveTo(px, py + tileSize - 0.5); ctx.lineTo(px + tileSize, py + tileSize - 0.5); ctx.stroke();
      }
    }
  }
}

function drawStructures(ctx, state) {
  const { tileSize, structures, padTop } = MAP;
  const size = 32;

  for (const s of structures) {
    const cx = s.tile.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + s.tile.y * tileSize + tileSize / 2;
    const hp = state.structureHp[s.id];
    const maxHp = CONFIG.structures.maxHP;
    const flash = state.structureFlash[s.id] > 0;

    ctx.fillStyle = bodyColorForHp(hp, maxHp, flash);
    ctx.fillRect(Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);

    if (hp > 0) {
      ctx.fillStyle = CONFIG.colors.friendlyCyan;
      ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
    }
  }
}

function bodyColorForHp(hp, maxHp, flash) {
  if (flash) return CONFIG.colors.threatRed;
  if (hp <= 0) return CONFIG.colors.gridLine;
  const frac = hp / maxHp;
  if (frac <= 0.25) return CONFIG.colors.threatRed;
  if (frac <= 0.5) return CONFIG.colors.alertAmber;
  return CONFIG.colors.accentWhite;
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
