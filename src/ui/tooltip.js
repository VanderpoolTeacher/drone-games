import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { tileToPixel } from '../game/drones.js';
import { paletteHitTest } from './palette.js';
import { legendHitTest } from './legend.js';

const PANEL_X = 100;
const PANEL_Y = 28;
const PANEL_W = 280;
const PANEL_H = 56;
const PAD = 4;
const LINE_HEIGHT = 11;
const TEXT_SIZE = 8;

const DRONE_HIT_R = 8;
const DEFENSE_HIT_R = 12;
const STRUCTURE_HIT_R = 16;

function inPlaying(state) {
  return state.screenPhase === 'playing' && !state.loseFlag && !state.winFlag;
}

function hitDefense(state, vx, vy) {
  for (const d of state.defenses) {
    const dx = vx - d.x;
    const dy = vy - d.y;
    if (dx * dx + dy * dy <= DEFENSE_HIT_R * DEFENSE_HIT_R) return 'defense-' + d.type;
  }
  return null;
}

function hitDrone(state, vx, vy) {
  for (const d of state.drones) {
    if (d.phase === 'done' || d.hp <= 0) continue;
    const dx = vx - d.x;
    const dy = vy - d.y;
    if (dx * dx + dy * dy <= DRONE_HIT_R * DRONE_HIT_R) return 'drone-' + d.type;
  }
  return null;
}

function hitStructure(vx, vy) {
  for (const s of MAP.structures) {
    const p = tileToPixel(s.tile);
    const dx = vx - p.x;
    const dy = vy - p.y;
    if (dx * dx + dy * dy <= STRUCTURE_HIT_R * STRUCTURE_HIT_R) return 'structure-' + s.id;
  }
  return null;
}

export function updateTooltip(state, vx, vy) {
  if (!inPlaying(state)) {
    state.tooltipKey = null;
    return;
  }

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    state.tooltipKey = 'palette-' + paletteHit.type;
    return;
  }

  const legendHit = legendHitTest(vx, vy);
  if (legendHit) {
    state.tooltipKey = 'drone-' + legendHit;
    return;
  }

  state.tooltipKey =
    hitDefense(state, vx, vy) ||
    hitDrone(state, vx, vy) ||
    hitStructure(vx, vy) ||
    null;
}

function structureHpTierColor(frac) {
  if (frac >= 0.66) return CONFIG.colors.successGreen;
  if (frac >= 0.33) return CONFIG.colors.alertAmber;
  return CONFIG.colors.threatRed;
}

function resolveTooltip(state) {
  const key = state.tooltipKey;
  if (!key) return null;

  if (key.startsWith('palette-')) {
    const type = key.slice('palette-'.length);
    const entry = CONFIG.tooltips['defense-' + type];
    if (!entry) return null;
    const count = state.inventory?.[type] ?? 0;
    const availableLine = 'AVAILABLE: x' + count;
    const body = [availableLine, ...entry.body].slice(0, 3);
    return { header: entry.header, headerColorKey: entry.headerColor, body };
  }

  if (key.startsWith('structure-')) {
    const id = key.slice('structure-'.length);
    const entry = CONFIG.tooltips[key];
    if (!entry) return null;
    const cur = state.structureHp[id] ?? 0;
    const max = CONFIG.structures.maxHP;
    const color = structureHpTierColor(cur / max);
    const body = [...entry.body, 'HP: ' + cur + ' / ' + max].slice(0, 3);
    return { header: entry.header, headerColor: color, body };
  }

  const entry = CONFIG.tooltips[key];
  if (!entry) return null;
  return { header: entry.header, headerColorKey: entry.headerColor, body: entry.body.slice(0, 3) };
}

export function renderTooltip(ctx, state) {
  if (!inPlaying(state)) return;
  const tt = resolveTooltip(state);
  if (!tt) return;

  ctx.save();

  ctx.globalAlpha = 0.85;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(PANEL_X + 0.5, PANEL_Y + 0.5, PANEL_W - 1, PANEL_H - 1);

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const headerColor = tt.headerColor ?? CONFIG.colors[tt.headerColorKey] ?? CONFIG.colors.accentWhite;
  ctx.fillStyle = headerColor;
  ctx.fillText(tt.header, PANEL_X + PAD, PANEL_Y + PAD);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  let y = PANEL_Y + PAD + LINE_HEIGHT;
  for (const line of tt.body) {
    if (line) ctx.fillText(line, PANEL_X + PAD, y);
    y += LINE_HEIGHT;
  }

  ctx.restore();
}
