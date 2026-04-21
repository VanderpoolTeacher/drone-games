import { CONFIG } from '../config.js';
import { isMuted } from '../audio/sfx.js';

const ICON_X = CONFIG.virtualWidth - 12;
const ICON_Y = 8;
const ICON_SIZE = 8;
const HIT_INSET = 2;

export function renderMuteIcon(ctx) {
  ctx.save();
  ctx.fillStyle = CONFIG.colors.accentWhite;

  // Speaker cone — 3×4 rectangle on the left side of the 8×8 box.
  ctx.fillRect(ICON_X, ICON_Y + 2, 3, 4);
  // Speaker horn — triangle widening to the right.
  ctx.fillRect(ICON_X + 3, ICON_Y + 1, 1, 6);
  ctx.fillRect(ICON_X + 4, ICON_Y, 1, 8);

  if (!isMuted()) {
    // Three sound-wave arcs (single-pixel dots stepping outward).
    ctx.fillRect(ICON_X + 6, ICON_Y + 3, 1, 2);
    ctx.fillRect(ICON_X + 7, ICON_Y + 2, 1, 4);
  } else {
    // Red diagonal strike-through.
    ctx.strokeStyle = CONFIG.colors.threatRed;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ICON_X + 0.5, ICON_Y + ICON_SIZE - 0.5);
    ctx.lineTo(ICON_X + ICON_SIZE - 0.5, ICON_Y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

export function muteIconClickHit(vx, vy) {
  return vx >= ICON_X - HIT_INSET && vx < ICON_X + ICON_SIZE + HIT_INSET
      && vy >= ICON_Y - HIT_INSET && vy < ICON_Y + ICON_SIZE + HIT_INSET;
}
