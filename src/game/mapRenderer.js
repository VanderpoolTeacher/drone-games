import { CONFIG } from '../config.js';
import { MAP, isLand, STATS_COL_START } from './map.js';
import { totalCasualties } from '../ui/casualtyHud.js';
import { liveBridgeCount, totalBridgeCount } from './state.js';

const BACKDROP_IMG = new Image();
BACKDROP_IMG.src = './src/images/manhattan.png';

export function renderMap(ctx, tMs, state) {
  // Grid layer — plain fill, gridlines, then all asset icons. Backdrop image
  // overlays ON TOP at the current backdrop alpha; labels and live gameplay
  // overlays sit above the image.
  drawPlainMap(ctx);
  drawLand(ctx);
  drawPark(ctx);
  drawSkyscrapers(ctx, state);
  drawApartments(ctx, state);
  drawBridgeMarkers(ctx, state);
  drawStructures(ctx, state);

  const alpha = state.backdropAlpha ?? 1;
  if (alpha > 0) drawBackdrop(ctx, alpha);

  drawBridgeDamage(ctx, state);   // damage X always over the image
  drawDamagePhases(ctx, state, tMs);
}

// HP fraction → 'pristine' | 'cracked' | 'smoking' | 'fire' | 'destroyed'.
function damagePhase(frac) {
  if (frac >= 0.99) return 'pristine';
  if (frac >= 0.66) return 'cracked';
  if (frac >= 0.33) return 'smoking';
  if (frac > 0)     return 'fire';
  return 'destroyed';
}

function drawDamagePhases(ctx, state, tMs) {
  const { tileSize, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;

  function drawPhase(px, py, phase, tx, ty) {
    // Per-tile seed so each fire/smoke flickers on its own schedule —
    // stops the whole city from pulsing in lockstep.
    const seed = tx * 7919 + ty * 6151;
    const flickA = (Math.floor((tMs + seed) / 90)  & 1) === 0;
    const flickB = (Math.floor((tMs + seed * 3) / 130) & 1) === 0;
    const flickC = (Math.floor((tMs + seed * 5) / 170) & 1) === 0;
    const smokeOffset = (((tMs + seed) / 80) | 0) % 3;
    if (phase === 'pristine') return;
    if (phase === 'cracked') {
      // Two thin diagonal cracks across the tile face.
      ctx.strokeStyle = CONFIG.colors.gridLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 2, py + 3);
      ctx.lineTo(px + tileSize - 4, py + tileSize - 5);
      ctx.moveTo(px + tileSize - 3, py + 2);
      ctx.lineTo(px + 4, py + tileSize - 5);
      ctx.stroke();
      return;
    }
    if (phase === 'smoking') {
      // Grey smoke puffs rising from the roof.
      ctx.fillStyle = CONFIG.colors.gridLine;
      ctx.fillRect(px + 4, py + 1 - smokeOffset, 2, 2);
      if (flickA) ctx.fillRect(px + tileSize - 6, py + 2 - smokeOffset, 2, 2);
      return;
    }
    if (phase === 'fire') {
      // Amber + red flickering flames at base.
      ctx.fillStyle = CONFIG.colors.alertAmber;
      if (flickA) ctx.fillRect(px + 3, py + tileSize - 5, 2, 2);
      if (flickB) ctx.fillRect(px + tileSize - 5, py + tileSize - 4, 2, 2);
      ctx.fillStyle = CONFIG.colors.threatRed;
      if (flickC) ctx.fillRect(px + 5, py + tileSize - 6, 2, 2);
      return;
    }
    // 'destroyed' — rubble (dim fill with a red X) + faint embers.
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    ctx.strokeStyle = CONFIG.colors.threatRed;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 2);
    ctx.lineTo(px + tileSize - 2, py + tileSize - 2);
    ctx.moveTo(px + tileSize - 2, py + 2);
    ctx.lineTo(px + 2, py + tileSize - 2);
    ctx.stroke();
    if (flickA) {
      ctx.fillStyle = CONFIG.colors.alertAmber;
      ctx.fillRect(px + tileSize / 2 - 1, py + tileSize - 4, 2, 2);
    }
  }

  for (const apt of MAP.apartments) {
    const key = apt.tile.x + ',' + apt.tile.y;
    const cur = state.apartmentPop?.[key] ?? apt.maxPop;
    drawPhase(apt.tile.x * tileSize, mapTop + apt.tile.y * tileSize,
              damagePhase(cur / apt.maxPop), apt.tile.x, apt.tile.y);
  }
  const skyMax = 2;
  for (const s of (MAP.skyscrapers ?? [])) {
    const key = s.tile.x + ',' + s.tile.y;
    const cur = state.skyscraperHp?.[key] ?? skyMax;
    drawPhase(s.tile.x * tileSize, mapTop + s.tile.y * tileSize,
              damagePhase(cur / skyMax), s.tile.x, s.tile.y);
  }
  const strMax = CONFIG.structures.maxHP;
  for (const s of MAP.structures) {
    const cur = state.structureHp?.[s.id] ?? strMax;
    drawPhase(s.tile.x * tileSize, mapTop + s.tile.y * tileSize,
              damagePhase(cur / strMax), s.tile.x, s.tile.y);
  }
}

function drawPark(ctx) {
  const { tileSize, padTop, park } = MAP;
  if (!park) return;
  const mapTop = CONFIG.topBarHeight + padTop;
  const px = park.x0 * tileSize;
  const py = mapTop + park.y0 * tileSize;
  const w = (park.x1 - park.x0 + 1) * tileSize;
  const h = (park.y1 - park.y0 + 1) * tileSize;
  ctx.save();
  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(px, py, w, h);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = CONFIG.colors.successGreen;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawSkyscrapers(ctx, state) {
  const { tileSize, padTop, skyscrapers } = MAP;
  if (!skyscrapers) return;
  const mapTop = CONFIG.topBarHeight + padTop;
  for (const s of skyscrapers) {
    const px = s.tile.x * tileSize;
    const py = mapTop + s.tile.y * tileSize;
    const key = s.tile.x + ',' + s.tile.y;
    const hit = state.skyscraperHp?.[key] ?? 1;
    const flash = (state.skyscraperFlash?.[key] ?? 0) > 0;
    ctx.fillStyle = flash ? CONFIG.colors.threatRed
      : hit <= 0 ? CONFIG.colors.gridLine
      : CONFIG.colors.bgMid;
    ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
    // Single cyan window reading as "office tower at night" at 12 px tile.
    ctx.fillStyle = hit > 0 ? CONFIG.colors.friendlyCyan : CONFIG.colors.gridLine;
    ctx.fillRect(px + tileSize / 2 - 1, py + tileSize / 2 - 1, 2, 2);
  }
}

export function renderStatsColumn(ctx, state) {
  drawStatsColumn(ctx, state);
}

function drawStatsColumn(ctx, state) {
  const { tileSize, gridW, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  const x0 = STATS_COL_START * tileSize;
  const w = (gridW - STATS_COL_START) * tileSize;
  const h = gridH * tileSize;

  ctx.save();
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(x0, mapTop, w, h);
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, mapTop + 0.5, w - 1, h - 1);

  ctx.font = '6px "Press Start 2P", monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const lx = x0 + 4;
  let ly = mapTop + 4;
  const lineH = 9;

  const row = (label, value, color) => {
    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillText(label, lx, ly);
    ctx.fillStyle = color ?? CONFIG.colors.alertAmber;
    ctx.fillText(value, lx, ly + 7);
    ly += lineH * 2 + 2;
  };

  row('WAVE', String(state.wave?.number ?? 1) + '/5');

  const totalBr = totalBridgeCount();
  const liveBr = liveBridgeCount(state);
  row('BRIDGES', liveBr + '/' + totalBr,
    liveBr === totalBr ? CONFIG.colors.successGreen
    : liveBr >= Math.ceil(totalBr / 2) ? CONFIG.colors.alertAmber
    : CONFIG.colors.threatRed);

  // Critical assets — list each by icon + short name + live/down tag.
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CRITICALS', lx, ly); ly += 9;
  for (const s of MAP.structures.filter(ss => ss.critical)) {
    const hp = state.structureHp?.[s.id] ?? 0;
    const max = CONFIG.structures.maxHP;
    const frac = hp / max;
    const short = (s.displayName ?? s.id).toUpperCase().slice(0, 7);
    const tag = hp <= 0 ? 'DOWN'
      : frac <= 0.25 ? 'CRIT'
      : frac <= 0.5  ? 'LOW'
      : 'OK';
    ctx.fillStyle = hp <= 0 ? CONFIG.colors.threatRed
      : frac <= 0.5 ? CONFIG.colors.alertAmber
      : CONFIG.colors.successGreen;
    ctx.fillText(short.padEnd(7, ' ') + ' ' + tag, lx, ly);
    ly += 8;
  }
  ly += 3;

  const casualties = totalCasualties(state) + (state.financialPenalty ?? 0);
  row('CASUALTIES', String(casualties),
    casualties === 0 ? CONFIG.colors.successGreen : CONFIG.colors.threatRed);

  // Inventory readout — one-letter labels to fit the 4-column panel.
  const inv = state.inventory ?? {};
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('INVENTORY', lx, ly);
  ly += 9;
  ctx.fillStyle = CONFIG.colors.friendlyCyan;
  ctx.fillText('RF  ' + (inv.rfJammer ?? 0), lx, ly); ly += 8;
  ctx.fillText('INT ' + (inv.interceptor ?? 0), lx, ly); ly += 8;
  ctx.fillText('LAS ' + (inv.laser ?? 0), lx, ly); ly += 8;
  ctx.fillText('HPM ' + (inv.hpm ?? 0), lx, ly); ly += 8;

  ctx.restore();
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
    ctx.fillRect(px + 3, py + 1, tileSize - 6, tileSize - 2);
    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillRect(px + 2, py + 1, 1, tileSize - 2);
    ctx.fillRect(px + tileSize - 3, py + 1, 1, tileSize - 2);
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

function colLabel(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  return 'A' + String.fromCharCode(65 + i - 26);
}

function drawPlainMap(ctx) {
  const { tileSize, gridW, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  const mapH = gridH * tileSize;
  const playW = STATS_COL_START * tileSize;

  ctx.fillStyle = CONFIG.colors.bgDark;   // base = water; land painted by drawLand.
  ctx.fillRect(0, mapTop, CONFIG.virtualWidth, mapH);

  // Full grid — 1 px lines at every tile boundary, vertical + horizontal.
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= STATS_COL_START; x++) {
    const xb = x * tileSize + 0.5;
    ctx.moveTo(xb, mapTop);
    ctx.lineTo(xb, mapTop + mapH);
  }
  for (let y = 0; y <= gridH; y++) {
    const yb = mapTop + y * tileSize + 0.5;
    ctx.moveTo(0, yb);
    ctx.lineTo(STATS_COL_START * tileSize, yb);
  }
  ctx.stroke();

}

function drawLandBlocks(ctx) {
  // Fill every playable tile interior with a subtle "city block" gray so
  // every land cell reads as buildable, not empty water.
  const { tileSize, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  ctx.fillStyle = CONFIG.colors.bgDark;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < STATS_COL_START; x++) {
      ctx.fillRect(x * tileSize + 1, mapTop + y * tileSize + 1,
                   tileSize - 2, tileSize - 2);
    }
  }
}

function drawLand(ctx) {
  // Authoring marker: each land tile gets a centered "L" so we can verify
  // the land mask against the backdrop before placing real assets.
  const { tileSize, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  ctx.save();
  ctx.fillStyle = CONFIG.colors.bgMid;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < STATS_COL_START; x++) {
      if (!isLand(x, y)) continue;
      ctx.fillRect(x * tileSize + 1, mapTop + y * tileSize + 1,
                   tileSize - 2, tileSize - 2);
    }
  }
  // Per-cell building-block icon on every land tile — replaces the old 'L'.
  ctx.fillStyle = CONFIG.colors.gridLine;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < STATS_COL_START; x++) {
      if (!isLand(x, y)) continue;
      ctx.fillRect(x * tileSize + 3, mapTop + y * tileSize + 3,
                   tileSize - 6, tileSize - 6);
    }
  }
  ctx.restore();
}

function drawMapLabels(ctx) {
  const { tileSize, gridH, padTop } = MAP;
  const mapTop = CONFIG.topBarHeight + padTop;
  // Column letters across the top margin (above row 1); row numbers at the
  // TOP of each labeled row. Drawn AFTER the backdrop so coords stay visible
  // even at backdrop alpha 1.
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  for (let x = 0; x < STATS_COL_START; x++) {
    ctx.fillText(colLabel(x), x * tileSize + 1, mapTop - 7);
  }
  for (let y = 0; y < gridH; y++) {
    ctx.fillText(String(y + 1), 1, mapTop + y * tileSize + 1);
  }
}

function drawBackdrop(ctx, alpha) {
  const mapTop = CONFIG.topBarHeight + MAP.padTop;
  const mapH = MAP.gridH * MAP.tileSize;
  const mapW = STATS_COL_START * MAP.tileSize;

  if (!BACKDROP_IMG.complete || BACKDROP_IMG.naturalWidth === 0) return;

  // Rotate portrait Manhattan image 90° CCW and cover-fit to the map area.
  const rotW = BACKDROP_IMG.naturalHeight;
  const rotH = BACKDROP_IMG.naturalWidth;
  const scale = Math.max(mapW / rotW, mapH / rotH) * 1.127;
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
      ctx.fillRect(px + 1, py + 1, tileSize - 2, tileSize - 2);
      const windowColor = frac > 0.33 ? CONFIG.colors.accentWhite : (frac > 0 ? CONFIG.colors.alertAmber : CONFIG.colors.gridLine);
      ctx.fillStyle = windowColor;
      // Single centered 2×2 window — 12 px tile is too small for a 4-window grid.
      ctx.fillRect(px + tileSize / 2 - 1, py + tileSize / 2 - 1, 2, 2);
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

// Single-letter glyphs sized to fit in a 12 px grid cell.
const STRUCTURE_GLYPHS = {
  power:       { size: 10, glyph: 'P', accent: 'alertAmber' },
  comms:       { size: 10, glyph: 'C', accent: 'friendlyCyan' },
  cityHall:    { size: 10, glyph: 'M', accent: 'accentWhite' },
  hospital:    { size: 10, glyph: 'H', accent: 'threatRed' },
  transit:     { size: 10, glyph: 'T', accent: 'alertAmber' },
  financial:   { size: 10, glyph: 'F', accent: 'successGreen' },
  un:          { size: 10, glyph: 'U', accent: 'friendlyCyan' },
  water:       { size: 10, glyph: 'W', accent: 'accentWhite' },
  fedReserve:  { size: 10, glyph: 'R', accent: 'successGreen' },
  exchange:    { size: 10, glyph: 'S', accent: 'successGreen' },  // Stock
  fireStation: { size: 10, glyph: 'E', accent: 'threatRed' },     // Emergency
  police:      { size: 10, glyph: 'N', accent: 'friendlyCyan' },  // NYPD
  portAuth:    { size: 10, glyph: 'A', accent: 'alertAmber' },    // Authority
  tvBroadcast: { size: 10, glyph: 'V', accent: 'accentWhite' },   // TV
};

function drawStructures(ctx, state) {
  const { tileSize, structures, padTop } = MAP;

  for (const s of structures) {
    const meta = STRUCTURE_GLYPHS[s.type] ?? STRUCTURE_GLYPHS.power;
    const cx = s.tile.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + s.tile.y * tileSize + tileSize / 2;
    const hp = state.structureHp[s.id];
    const maxHp = CONFIG.structures.maxHP;
    const flash = state.structureFlash[s.id] > 0;

    // Icon-only; color tracks HP tier + flash. Destroyed = gray out.
    const color = flash ? CONFIG.colors.threatRed
      : hp <= 0 ? CONFIG.colors.gridLine
      : (hp / maxHp <= 0.25) ? CONFIG.colors.threatRed
      : (hp / maxHp <= 0.5) ? CONFIG.colors.alertAmber
      : (CONFIG.colors[meta.accent] ?? CONFIG.colors.friendlyCyan);
    ctx.fillStyle = color;
    ctx.font = meta.size + 'px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta.glyph, Math.floor(cx), Math.floor(cy) + 1);
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
