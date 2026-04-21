import { CONFIG } from '../config.js';

const BUTTON_W = 60;
const BUTTON_H = 28;
const BUTTON_GAP = 4;
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: true  },
  { type: 'interceptor',     label: 'INTRCPT', enabled: true },
  { type: 'laser',           label: 'LASER',   enabled: true  },
  { type: 'hpm',             label: 'HPM',     enabled: false },
];

export function renderPalette(ctx, state) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;

  renderResources(ctx, state, paletteY);
  renderButtons(ctx, state, paletteY);
  renderWavePlaceholder(ctx, paletteY);
}

function renderResources(ctx, state, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText(`$${state.resources}`, 8, paletteY + 13);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('RES', 8, paletteY + 25);
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
  const cfg = CONFIG.defenses[btn.type];
  const cost = cfg?.cost ?? 0;
  const isSelected = state.placementMode?.type === btn.type;
  const isAffordable = state.resources >= cost;
  const isActive = btn.enabled && isAffordable && !isSelected;

  let borderColor;
  let labelColor;
  let costColor;
  if (isSelected) {
    borderColor = labelColor = costColor = CONFIG.colors.alertAmber;
  } else if (isActive) {
    borderColor = CONFIG.colors.friendlyCyan;
    labelColor = CONFIG.colors.friendlyCyan;
    costColor = CONFIG.colors.alertAmber;
  } else {
    borderColor = labelColor = costColor = CONFIG.colors.gridLine;
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

  ctx.fillStyle = costColor;
  ctx.fillText(`$${cost}`, x + BUTTON_W / 2, y + 24);
}

function renderWavePlaceholder(ctx, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';

  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText('WAVE 1/5', CONFIG.virtualWidth - 8, paletteY + 13);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('NEXT 0:12', CONFIG.virtualWidth - 8, paletteY + 25);
}

export function paletteHitTest(vx, vy) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;
  if (vy < paletteY || vy >= paletteY + CONFIG.bottomPaletteHeight) return null;

  const totalWidth = BUTTONS.length * BUTTON_W + (BUTTONS.length - 1) * BUTTON_GAP;
  let x = Math.floor((CONFIG.virtualWidth - totalWidth) / 2);
  const y = paletteY + Math.floor((CONFIG.bottomPaletteHeight - BUTTON_H) / 2);

  for (const btn of BUTTONS) {
    if (!btn.enabled) { x += BUTTON_W + BUTTON_GAP; continue; }
    if (vx >= x && vx < x + BUTTON_W && vy >= y && vy < y + BUTTON_H) {
      return { type: btn.type };
    }
    x += BUTTON_W + BUTTON_GAP;
  }
  return null;
}
