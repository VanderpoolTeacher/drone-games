import { CONFIG } from '../config.js';
import { MAP } from './map.js';

const BACKDROP_IMG = new Image();
BACKDROP_IMG.src = './src/images/manhattan.png';

export function renderMap(ctx, tMs, state) {
  // Always draw the plain map (water + grid + coord labels) as a base; then
  // overlay the image at state.backdropAlpha (1 = image hides grid fully).
  drawPlainMap(ctx);
  drawBridgeMarkers(ctx, state);
  const alpha = state.backdropAlpha ?? 1;
  if (alpha > 0) drawBackdrop(ctx, alpha);
  drawApartments(ctx, state);
  drawBridgeDamage(ctx, state);
  drawZones(ctx, tMs);
  drawStructures(ctx, state);
}

// Small deck-and-rail glyph per bridge, drawn on the plain-map layer.
// The image covers this when backdrop alpha = 1; it bleeds through when
// the player lowers the alpha to inspect the grid.
function drawBridgeMarkers(ctx, state) {
  const { tileSize, padTop } = MAP;
  for (const br of MAP.bridges) {
    const hp = state.bridgeHp?.[br.id] ?? br.maxHp;
    if (hp <= 0) continue;
    const px = br.tile.x * tileSize;
    const py = CONFIG.topBarHeight + padTop + br.tile.y * tileSize;
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(px + 2, py + 4, tileSize - 4, tileSize - 8);
    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillRect(px + 2, py + 3, tileSize - 4, 1);
    ctx.fillRect(px + 2, py + tileSize - 4, tileSize - 4, 1);
  }
}

// Bridges are invisible on the map (the image shows them). We flash when
// they're hit, and render a red X over destroyed ones so the player can
// tell which supply lines are down.
function drawBridgeDamage(ctx, state) {
  const { tileSize, padTop } = MAP;
  for (const br of MAP.bridges) {
    const hp = state.bridgeHp?.[br.id] ?? br.maxHp;
    const flash = (state.bridgeFlash?.[br.id] ?? 0) > 0;
    if (hp > 0 && !flash) continue;
    const px = br.tile.x * tileSize;
    const py = CONFIG.topBarHeight + padTop + br.tile.y * tileSize;
    ctx.strokeStyle = CONFIG.colors.threatRed;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 3, py + 3);
    ctx.lineTo(px + tileSize - 3, py + tileSize - 3);
    ctx.moveTo(px + tileSize - 3, py + 3);
    ctx.lineTo(px + 3, py + tileSize - 3);
    ctx.stroke();
  }
}

function drawPlainMap(ctx) {
  const { tileSize, gridW, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  const mapH = gridH * tileSize;
  const mapW = gridW * tileSize;

  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, mapTop, CONFIG.virtualWidth, mapH);

  // Tile grid for positional reference — subtle lines at every tile boundary.
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= gridW; x++) {
    ctx.moveTo(x * tileSize + 0.5, mapTop);
    ctx.lineTo(x * tileSize + 0.5, mapTop + mapH);
  }
  for (let y = 0; y <= gridH; y++) {
    ctx.moveTo(0, mapTop + y * tileSize + 0.5);
    ctx.lineTo(mapW, mapTop + y * tileSize + 0.5);
  }
  ctx.stroke();

  // Column letters (A, B, C…) in the TOP-LEFT of each row-0 cell,
  // row numbers (1, 2, 3…) in the TOP-LEFT of each col-0 cell.
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let x = 0; x < gridW; x++) {
    const letter = String.fromCharCode(65 + x);
    ctx.fillText(letter, x * tileSize + 2, mapTop + 2);
  }
  for (let y = 0; y < gridH; y++) {
    // Bottom-left corner so row 1 doesn't overlap the column letter in (0,0).
    ctx.fillText(String(y + 1), 2, mapTop + y * tileSize + tileSize - 9);
  }
}

function drawBackdrop(ctx, alpha) {
  const mapTop = CONFIG.topBarHeight + MAP.padTop;
  const mapH = MAP.gridH * MAP.tileSize;
  const mapW = CONFIG.virtualWidth;

  if (!BACKDROP_IMG.complete || BACKDROP_IMG.naturalWidth === 0) return;

  // Rotate portrait Manhattan image 90° CCW and cover-fit to the map area.
  const rotW = BACKDROP_IMG.naturalHeight;
  const rotH = BACKDROP_IMG.naturalWidth;
  const scale = Math.max(mapW / rotW, mapH / rotH) * 0.85;
  const drawW = rotW * scale;
  const drawH = rotH * scale;
  const dx = (mapW - drawW) / 2;
  const dy = mapTop + (mapH - drawH) / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.rect(0, mapTop, mapW, mapH);
  ctx.clip();
  ctx.translate(dx + drawW / 2, dy + drawH / 2);
  ctx.rotate(-Math.PI / 2 - 15 * Math.PI / 180);
  ctx.drawImage(BACKDROP_IMG, -drawH / 2, -drawW / 2, drawH, drawW);
  ctx.restore();
}

function drawApartments(ctx, state) {
  const { tileSize, padTop, tiles } = MAP;
  for (let y = 0; y < MAP.gridH; y++) {
    for (let x = 0; x < MAP.gridW; x++) {
      const t = tiles[y][x];
      if (t !== 'apartment') continue;
      const px = x * tileSize;
      const py = CONFIG.topBarHeight + padTop + y * tileSize;
      const key = x + ',' + y;
      const cur = state.apartmentPop?.[key];
      const max = MAP.apartments.find(a => a.tile.x === x && a.tile.y === y)?.maxPop ?? 1;
      const frac = cur == null ? 1 : Math.max(0, cur / max);
      const flash = state.apartmentFlash?.[key] > 0;
      ctx.fillStyle = flash ? CONFIG.colors.threatRed : (cur === 0 ? CONFIG.colors.gridLine : CONFIG.colors.bgMid);
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);
      const windowColor = frac > 0.33 ? CONFIG.colors.accentWhite : (frac > 0 ? CONFIG.colors.alertAmber : CONFIG.colors.gridLine);
      ctx.fillStyle = windowColor;
      ctx.fillRect(px + 4, py + 4, 2, 2);
      ctx.fillRect(px + tileSize - 6, py + 4, 2, 2);
      ctx.fillRect(px + 4, py + tileSize - 6, 2, 2);
      ctx.fillRect(px + tileSize - 6, py + tileSize - 6, 2, 2);
    }
  }
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
