import { CONFIG } from '../config.js';
import { intelMultiplier, defenseMultiplier } from '../game/wave.js';

const PORTRAIT_SIZE = 64;

// Briefing bubble centred; generously sized to hold the full asset primer.
const BUBBLE_W = 440;
const BUBBLE_H = 230;
const BUBBLE_PAD_INNER = 18;   // breathing room around text content
const BUBBLE_X = Math.round((CONFIG.virtualWidth - BUBBLE_W) / 2);
const BUBBLE_Y = Math.round((CONFIG.virtualHeight - BUBBLE_H) / 2);
const BUBBLE_PAD = 6;

// Kept for the tab indicator below the bubble area.
const PORTRAIT_X = CONFIG.virtualWidth - 4 - PORTRAIT_SIZE;
const PORTRAIT_Y = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight - 4 - PORTRAIT_SIZE;

const TAB_SIZE = 16;
const TAB_X = CONFIG.virtualWidth - 4 - TAB_SIZE;                 // 460
const TAB_Y = CONFIG.virtualHeight - 20;                          // 250

const TEXT_SIZE = 8;
const TEXT_LINE_HEIGHT = 11;

const PATHS = {
  neutral: './src/images/commander-warden.png',
  stern:   './src/images/commander-warden-stern.png',
  angry:   './src/images/commander-warden-angry.png',
  bloody:  './src/images/commander-warden-bloody.png',
};

const PORTRAITS = {};
for (const key of Object.keys(PATHS)) {
  const img = new Image();
  img.src = PATHS[key];
  PORTRAITS[key] = img;
}

function currentPortraitKey(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return 'neutral';
  return CONFIG.waves[idx].portrait || 'neutral';
}

function briefingPages(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return [''];
  const raw = CONFIG.waves[idx].briefing;
  const pages = Array.isArray(raw) ? raw.slice() : [raw || ''];

  // Branch only applies to waves 2+ — prepend the dynamic prefix to page 0.
  if (idx > 0) {
    pages[0] = buildBriefingPrefix(state) + pages[0];
  }
  pages.push(intelForecastPage(state));
  return pages;
}

const TIER_TYPE_LABELS = {
  isr: 'ISR',
  owa: 'OWA',
  payloadDelivery: 'Payload',
};

// Intel forecast page (#11 + #36). Headers show the leaked-intel tier from
// the prior wave, the predicted enemy-response multiplier from current
// defense count, and a flavor line at high totals. Below: each upcoming
// drone group tagged HIGH / MED / LOW with counts (HIGH precise, MED ~, LOW
// "maybe ... (unconfirmed)"). Wave 1 has no prior recon → LOW + NONE.
function intelForecastPage(state) {
  const idx = state.briefing.activeBriefingIndex;
  if (idx < 0 || idx >= CONFIG.waves.length) return '';
  const wave = CONFIG.waves[idx];
  const intel = state.lastWaveIsrIntel ?? 0;
  const isWave1 = idx === 0;

  const tierLabel = isWave1 ? 'NONE' : intelTierLabel(intel);
  const intelMult = isWave1 ? 1 : intelMultiplier(intel);
  const defMult = defenseMultiplier(state.defenses?.length ?? 0);
  const totalMult = intelMult * defMult;
  const flavor = flavorLineFor(totalMult);

  const lines = ['WAVE ' + (idx + 1) + ' — ' + (wave.name ?? '?'), ''];
  if (wave.descriptor) lines.push(wave.descriptor, '');
  lines.push('INTEL FORECAST', '');
  lines.push('INTEL LEAKED LAST RUN: ' + tierLabel);
  lines.push('ENEMY RESPONSE: ×' + defMult.toFixed(1));
  if (flavor) lines.push(flavor);
  lines.push('');

  const baseTier = intel > 5 && intel <= 20 ? 'MED'
                 : intel > 20             ? 'HIGH'
                 : 'LOW';
  const stepDown = intel > 20 && intel <= 45;
  for (let i = 0; i < wave.drones.length; i++) {
    const d = wave.drones[i];
    const tier = (stepDown && i === wave.drones.length - 1) ? 'MED' : baseTier;
    const label = TIER_TYPE_LABELS[d.type] ?? d.type;
    let body;
    if (tier === 'HIGH')      body = String(d.count) + ' ' + label;
    else if (tier === 'MED')  body = '~' + d.count + ' ' + label;
    else                       body = 'maybe ' + label + ' (unconfirmed)';
    lines.push(tier.padEnd(5, ' ') + ' ' + body);
  }
  return lines.join('\n');
}

function intelTierLabel(intelPoints) {
  if (intelPoints > 45) return 'HIGH';
  if (intelPoints > 20) return 'MED';
  if (intelPoints > 5)  return 'LOW';
  return 'NONE';
}

function flavorLineFor(totalMult) {
  if (totalMult >= 3.0) return 'RED CELL COMMITTING EVERYTHING';
  if (totalMult >= 2.0) return 'HEAVY ORDNANCE INBOUND';
  if (totalMult >= 1.5) return 'ENEMY ESCALATING';
  return null;
}

function tierColorFor(line) {
  if (line.startsWith('HIGH ')) return CONFIG.colors.successGreen;
  if (line.startsWith('MED  ')) return CONFIG.colors.alertAmber;
  if (line.startsWith('LOW  ')) return CONFIG.colors.gridLine;
  if (line.startsWith('WAVE ') && line.includes(' — ')) return CONFIG.colors.alertAmber;
  if (line === 'INTEL FORECAST') return CONFIG.colors.friendlyCyan;
  if (line.startsWith('INTEL LEAKED')) return CONFIG.colors.alertAmber;
  if (line.startsWith('ENEMY RESPONSE')) return CONFIG.colors.threatRed;
  if (line === 'RED CELL COMMITTING EVERYTHING'
      || line === 'HEAVY ORDNANCE INBOUND'
      || line === 'ENEMY ESCALATING') return CONFIG.colors.threatRed;
  return null;
}

function buildBriefingPrefix(state) {
  const intel = state.lastWaveIsrIntel ?? 0;
  const defenseCount = state.defenses?.length ?? 0;
  const criticalsDown = state.stats?.structuresLost ?? 0;
  let prefix = '';
  if (intel > 45) {
    prefix = 'They got a clean read on us. Expect EVERYTHING at once. ';
  } else if (intel > 20) {
    prefix = 'Enough slipped through recon to paint our gaps. Heavier push. ';
  } else if (intel > 5) {
    prefix = 'Recon mostly jammed — Red Cell is guessing. Standard pressure. ';
  } else {
    prefix = 'Zero intel got home. They are flying blind. ';
  }
  if (defenseCount === 0) {
    prefix += 'AND you have NO defenses up. Drop something, anything, NOW. ';
  } else if (defenseCount < 3) {
    prefix += 'Coverage is thin — get more assets on the board. ';
  }
  if (criticalsDown > 0) {
    prefix += 'We already lost ' + criticalsDown + ' critical site(s). ';
  }
  return prefix + '\n\n';
}

function currentBriefingText(state) {
  const pages = briefingPages(state);
  const pageIdx = Math.min(state.briefing.pageIdx ?? 0, pages.length - 1);
  return pages[pageIdx];
}

function currentBriefingMeta(state) {
  const pages = briefingPages(state);
  const pageIdx = Math.min(state.briefing.pageIdx ?? 0, pages.length - 1);
  return { pageIdx, pageCount: pages.length };
}


function wrapLines(ctx, text, maxWidth) {
  // Preserve explicit \n as hard breaks; wrap each paragraph independently.
  const lines = [];
  for (const para of text.split('\n')) {
    if (para === '') { lines.push(''); continue; }
    const words = para.split(/\s+/);
    let current = '';
    for (const w of words) {
      const candidate = current ? current + ' ' + w : w;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawPortrait(ctx, key, x, y, size) {
  const img = PORTRAITS[key];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = CONFIG.colors.accentWhite;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }
}

function drawBubble(ctx, state) {
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;
  ctx.strokeRect(BUBBLE_X + 0.5, BUBBLE_Y + 0.5, BUBBLE_W - 1, BUBBLE_H - 1);

  // Commander title bar (padded)
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('COMMANDER WARDEN', BUBBLE_X + BUBBLE_PAD_INNER, BUBBLE_Y + BUBBLE_PAD_INNER);

  ctx.font = TEXT_SIZE + 'px "Press Start 2P", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = CONFIG.colors.accentWhite;

  const innerW = BUBBLE_W - BUBBLE_PAD_INNER * 2;
  const lines = wrapLines(ctx, currentBriefingText(state), innerW);
  let ty = BUBBLE_Y + BUBBLE_PAD + 22;   // extra padding below title
  for (const line of lines) {
    ctx.fillStyle = tierColorFor(line) ?? CONFIG.colors.accentWhite;
    ctx.fillText(line, BUBBLE_X + BUBBLE_PAD_INNER, ty);
    ty += TEXT_LINE_HEIGHT;
    if (ty > BUBBLE_Y + BUBBLE_H - TEXT_SIZE - 18) break;
  }

  // Dismiss / next-page hint footer
  const meta = currentBriefingMeta(state);
  const more = meta.pageIdx < meta.pageCount - 1;
  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.textAlign = 'center';
  ctx.fillText(more ? 'PRESS ANY KEY — NEXT' : 'PRESS ANY KEY TO CONTINUE',
    BUBBLE_X + BUBBLE_W / 2, BUBBLE_Y + BUBBLE_H - TEXT_SIZE - 4);
  if (meta.pageCount > 1) {
    ctx.textAlign = 'right';
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillText((meta.pageIdx + 1) + '/' + meta.pageCount,
      BUBBLE_X + BUBBLE_W - BUBBLE_PAD, BUBBLE_Y + BUBBLE_PAD);
  }
}

function drawTab(ctx, state, tMs) {
  const key = currentPortraitKey(state);
  const img = PORTRAITS[key];

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE);

  if (img && img.complete && img.naturalWidth > 0) {
    const srcSize = Math.min(img.naturalWidth, img.naturalHeight) * 0.45;
    const srcX = (img.naturalWidth - srcSize) / 2;
    const srcY = img.naturalHeight * 0.1;
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, TAB_X + 1, TAB_Y + 1, 14, 14);
  } else {
    ctx.fillStyle = CONFIG.colors.gridLine;
    ctx.fillRect(TAB_X + 1, TAB_Y + 1, 14, 14);
  }

  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(TAB_X + 0.5, TAB_Y + 0.5, TAB_SIZE - 1, TAB_SIZE - 1);

  const blink = !state.briefing.expandedOnce && Math.floor(tMs / 250) % 2 === 0;
  if (state.briefing.expandedOnce || blink) {
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(TAB_X + TAB_SIZE - 3, TAB_Y + 1, 2, 2);
  }
}

function pointInRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
}

export function updateBriefing(state, dt) {
  const waveIdx = state.wave.number - 1;
  if (state.wave.phase === 'prep' && state.briefing.activeBriefingIndex !== waveIdx) {
    state.briefing.phase = 'visible';
    state.briefing.visibleMs = 0;
    state.briefing.expandedOnce = false;
    state.briefing.activeBriefingIndex = waveIdx;
    state.briefing.pageIdx = 0;
    return;
  }
  if (state.briefing.phase === 'visible') {
    state.briefing.visibleMs += dt * 1000;
    // No auto-collapse — commander text stays until the player dismisses it.
  }
}

export function renderBriefing(ctx, state, tMs) {
  if (state.loseFlag || state.winFlag) return;
  if (state.briefing.phase === 'idle') return;

  ctx.save();
  if (state.briefing.phase === 'visible') {
    // Portrait removed during gameplay — text bubble carries the briefing.
    drawBubble(ctx, state);
  }
  // Tab suppressed entirely — commander head no longer hovers on the map.
  ctx.restore();
}

export function briefingClickHit(state, vx, vy) {
  if (state.loseFlag || state.winFlag) return false;
  if (state.briefing.phase === 'visible') {
    const inBubble = pointInRect(vx, vy, BUBBLE_X, BUBBLE_Y, BUBBLE_W, BUBBLE_H);
    const inPortrait = pointInRect(vx, vy, PORTRAIT_X, PORTRAIT_Y, PORTRAIT_SIZE, PORTRAIT_SIZE);
    if (inBubble || inPortrait) {
      // Collapse the bubble but let the click flow through to palette/map so
      // the player doesn't lose an intended action just to dismiss the briefing.
      state.briefing.phase = 'tab';
      state.briefing.expandedOnce = true;
    }
    return false;
  }
  if (state.briefing.phase === 'tab') {
    if (pointInRect(vx, vy, TAB_X, TAB_Y, TAB_SIZE, TAB_SIZE)) {
      state.briefing.phase = 'visible';
      state.briefing.visibleMs = 0;
      state.briefing.expandedOnce = true;
      return true;
    }
    return false;
  }
  return false;
}

// Dismiss the open bubble (if any) without consuming the click. Called from
// the palette click path so picking a defense type gets the briefing out of
// the way immediately.
export function collapseBriefing(state) {
  if (state.briefing.phase !== 'visible') return;
  const meta = currentBriefingMeta(state);
  if ((state.briefing.pageIdx ?? 0) < meta.pageCount - 1) {
    // Advance to the next page rather than dismissing.
    state.briefing.pageIdx = (state.briefing.pageIdx ?? 0) + 1;
    return;
  }
  state.briefing.phase = 'idle';   // last page reached → dismiss
  state.briefing.expandedOnce = true;
}
