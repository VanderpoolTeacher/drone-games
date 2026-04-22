import { CONFIG } from '../config.js';
import { MAP } from './map.js';

export function renderMap(ctx, tMs, state) {
  drawTiles(ctx, state);
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

function drawTiles(ctx, state) {
  const { tileSize, gridW, gridH, tiles, padTop, padBottom } = MAP;

  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, CONFIG.topBarHeight, CONFIG.virtualWidth, gridH * tileSize + padTop + padBottom);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const t = tiles[y][x];
      const px = x * tileSize;
      const py = CONFIG.topBarHeight + padTop + y * tileSize;

      if (t === 'water') continue;

      // Everything land-ish gets a base dark fill.
      ctx.fillStyle = CONFIG.colors.bgDark;
      ctx.fillRect(px, py, tileSize, tileSize);

      if (t === 'bridge') {
        ctx.fillStyle = CONFIG.colors.gridLine;
        ctx.fillRect(px, py + 2, tileSize, tileSize - 4);
        ctx.fillStyle = CONFIG.colors.accentWhite;
        ctx.fillRect(px, py + 1, tileSize, 1);
        ctx.fillRect(px, py + tileSize - 2, tileSize, 1);
      } else if (t === 'building') {
        ctx.fillStyle = CONFIG.colors.bgMid;
        ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
        ctx.fillStyle = CONFIG.colors.alertAmber;
        ctx.fillRect(px + tileSize - 5, py + 4, 1, 1);
        ctx.fillRect(px + 4, py + tileSize - 6, 1, 1);
      } else if (t === 'road') {
        ctx.fillStyle = CONFIG.colors.gridLine;
        ctx.fillRect(px, py + Math.floor(tileSize / 2) - 1, tileSize, 3);
      } else if (t === 'park') {
        ctx.fillStyle = CONFIG.colors.successGreen;
        ctx.fillRect(px + Math.floor(tileSize / 2) - 1, py + Math.floor(tileSize / 2) - 1, 2, 2);
      } else if (t === 'apartment') {
        // Residential block — window grid. Redder when damaged.
        const key = x + ',' + y;
        const cur = state.apartmentPop?.[key];
        const max = MAP.apartments.find(a => a.tile.x === x && a.tile.y === y)?.maxPop ?? 1;
        const frac = cur == null ? 1 : Math.max(0, cur / max);
        const flash = state.apartmentFlash?.[key] > 0;
        ctx.fillStyle = flash ? CONFIG.colors.threatRed : (cur === 0 ? CONFIG.colors.gridLine : CONFIG.colors.bgMid);
        ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
        // 2×2 lit-window grid dimmed by population loss.
        const windowColor = frac > 0.33 ? CONFIG.colors.accentWhite : (frac > 0 ? CONFIG.colors.alertAmber : CONFIG.colors.gridLine);
        ctx.fillStyle = windowColor;
        ctx.fillRect(px + 4, py + 4, 2, 2);
        ctx.fillRect(px + tileSize - 6, py + 4, 2, 2);
        ctx.fillRect(px + 4, py + tileSize - 6, 2, 2);
        ctx.fillRect(px + tileSize - 6, py + tileSize - 6, 2, 2);
      }
    }
  }

  // Tile borders — only for generic land (keeps buildings/roads/parks clean).
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

  const landLike = t => t === 'land' || t === 'building' || t === 'road' || t === 'park' || t === 'apartment';

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (!landLike(tiles[y][x])) continue;
      const px = x * tileSize;
      const py = CONFIG.topBarHeight + padTop + y * tileSize;

      // Coastline only renders where land-like meets water (bridge + landLike = no line).
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
