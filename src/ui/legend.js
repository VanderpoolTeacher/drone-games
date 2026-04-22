import { CONFIG } from '../config.js';
import { bodyColorFor } from '../game/drones.js';

const ITEMS = [
  { type: 'isr',             label: 'ISR' },
  { type: 'owa',             label: 'OWA' },
  { type: 'payloadDelivery', label: 'PAY' },
];

const SQUARE = 6;
const GAP_ICON_LABEL = 3;
const LABEL_CHAR_W = 6;
const GAP_ITEM = 8;
const LEFT_PAD = 6;

export function renderLegend(ctx) {
  const barMidY = Math.floor(CONFIG.topBarHeight / 2);
  const iconY = barMidY - Math.floor(SQUARE / 2);
  const textY = barMidY + 4;

  const itemWidths = ITEMS.map(it => SQUARE + GAP_ICON_LABEL + it.label.length * LABEL_CHAR_W);
  let x = LEFT_PAD;

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  for (let i = 0; i < ITEMS.length; i++) {
    const it = ITEMS[i];
    ctx.fillStyle = bodyColorFor(it.type);
    ctx.fillRect(x, iconY, SQUARE, SQUARE);

    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillText(it.label, x + SQUARE + GAP_ICON_LABEL, textY);

    x += itemWidths[i] + GAP_ITEM;
  }
}
