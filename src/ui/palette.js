import { CONFIG } from '../config.js';

const BUTTON_W = 50;
const BUTTON_H = 28;
const BUTTON_GAP = 4;
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: true },
  { type: 'interceptor',     label: 'INTRCPT', enabled: true },
  { type: 'laser',           label: 'LASER',   enabled: true },
  { type: 'hpm',             label: 'HPM',     enabled: true },
  { type: 'radar',           label: 'RADAR',   enabled: true },
];

export function renderPalette(ctx, state) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;

  renderButtons(ctx, state, paletteY);
  renderWaveHud(ctx, state, paletteY);
}

function renderButtons(ctx, state, paletteY) {
  const totalWidth = BUTTONS.length * BUTTON_W + (BUTTONS.length - 1) * BUTTON_GAP;
  let x = Math.floor((CONFIG.virtualWidth - totalWidth) / 2);
  const y = paletteY + Math.floor((CONFIG.bottomPaletteHeight - BUTTON_H) / 2);

  for (const btn of BUTTONS) {
    drawButton(ctx, state, btn, x, y);
    x += BUTTON_W + BUTTON_GAP;
  }
}

function drawButton(ctx, state, btn, x, y) {
  const count = state.inventory?.[btn.type] ?? 0;
  const isSelected = state.placementMode?.type === btn.type;
  const hasStock = count > 0;
  const isActive = btn.enabled && hasStock && !isSelected;

  let borderColor;
  let labelColor;
  let countColor;
  if (isSelected) {
    borderColor = labelColor = countColor = CONFIG.colors.alertAmber;
  } else if (isActive) {
    borderColor = CONFIG.colors.friendlyCyan;
    labelColor = CONFIG.colors.friendlyCyan;
    countColor = CONFIG.colors.accentWhite;
  } else {
    borderColor = labelColor = countColor = CONFIG.colors.gridLine;
  }

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(x, y, BUTTON_W, BUTTON_H);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, BUTTON_W - 1, BUTTON_H - 1);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  ctx.fillStyle = labelColor;
  ctx.fillText(btn.label, x + BUTTON_W / 2, y + 12);

  ctx.fillStyle = countColor;
  ctx.fillText(`x${count}`, x + BUTTON_W / 2, y + 24);
}

function renderWaveHud(ctx, state, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';

  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText(`WAVE ${state.wave.number}/5`, CONFIG.virtualWidth - 8, paletteY + 13);

  let line2Text;
  let line2Color;
  if (state.wave.phase === 'prep') {
    const secs = Math.ceil(state.wave.prepMs / 1000);
    line2Text = `NEXT 0:${String(Math.max(0, secs)).padStart(2, '0')}`;
    line2Color = CONFIG.colors.alertAmber;
  } else if (state.wave.phase === 'active') {
    const name = CONFIG.waves[state.wave.number - 1]?.name;
    line2Text = name ?? 'INCOMING';
    line2Color = CONFIG.colors.alertAmber;
  } else {
    line2Text = 'COMPLETE';
    line2Color = CONFIG.colors.successGreen;
  }

  ctx.fillStyle = line2Color;
  ctx.fillText(line2Text, CONFIG.virtualWidth - 8, paletteY + 25);
}

export function paletteHitTest(vx, vy) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;
  if (vy < paletteY || vy >= paletteY + CONFIG.bottomPaletteHeight) return null;

  const totalWidth = BUTTONS.length * BUTTON_W + (BUTTONS.length - 1) * BUTTON_GAP;
  let x = Math.floor((CONFIG.virtualWidth - totalWidth) / 2);

  // Full palette-row column is clickable — label + initials + button body.
  for (const btn of BUTTONS) {
    if (!btn.enabled) { x += BUTTON_W + BUTTON_GAP; continue; }
    if (vx >= x && vx < x + BUTTON_W) return { type: btn.type };
    x += BUTTON_W + BUTTON_GAP;
  }
  return null;
}
