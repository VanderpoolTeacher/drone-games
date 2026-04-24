import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { liveBridgeCount, totalBridgeCount } from '../game/state.js';

export function totalCasualties(state) {
  let lost = 0;
  for (const apt of MAP.apartments) {
    const key = apt.tile.x + ',' + apt.tile.y;
    const cur = state.apartmentPop?.[key] ?? apt.maxPop;
    lost += apt.maxPop - cur;
  }
  return lost;
}

function liveBridges(state) {
  return liveBridgeCount(state);
}

export function renderCasualtyHud(ctx, state) {
  const midY = Math.floor(CONFIG.topBarHeight / 2);

  ctx.save();
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'middle';

  // Wave clock upper-right, just left of the speaker icon (ICON_X = vw-12).
  if (state.wave?.phase === 'active') {
    const s = Math.floor((state.wave.activeElapsedMs ?? 0) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    ctx.textAlign = 'right';
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillText('W' + (state.wave.number ?? 1) + ' ' + mm + ':' + ss,
      CONFIG.virtualWidth - 16, midY);
  }

  ctx.textAlign = 'center';
  const msg = currentCommanderMessage(state);
  if (msg) {
    ctx.fillStyle = msg.color || CONFIG.colors.accentWhite;
    ctx.fillText(msg.text, CONFIG.virtualWidth / 2, midY);
  }
  ctx.restore();
}

// Contextual in-header messages. Priority order: structure alerts > incoming
// drone threats > casualty milestone > intel warning > idle.
function currentCommanderMessage(state) {
  const casualties = totalCasualties(state) + (state.financialPenalty ?? 0);

  // Critical under attack — any critical currently flashing from a hit.
  for (const s of MAP.structures) {
    if (!s.critical) continue;
    if ((state.structureFlash?.[s.id] ?? 0) > 0) {
      return { text: (s.displayName || s.id).toUpperCase() + ' UNDER ATTACK',
               color: CONFIG.colors.threatRed };
    }
  }
  // Any critical destroyed.
  const downCrit = MAP.structures.find(s => s.critical && (state.structureHp?.[s.id] ?? 1) <= 0);
  if (downCrit) {
    return { text: (downCrit.displayName || downCrit.id).toUpperCase() + ' DESTROYED',
             color: CONFIG.colors.threatRed };
  }
  // Bridge fraction tipping point.
  const live = liveBridges(state);
  const total = totalBridgeCount();
  if (live === 0 && total > 0) {
    return { text: 'ALL BRIDGES DOWN — NO SUPPLY',
             color: CONFIG.colors.threatRed };
  }
  if (live < Math.ceil(total / 2)) {
    return { text: 'BRIDGES CRITICAL — HOLD THEM',
             color: CONFIG.colors.alertAmber };
  }
  // Drone threat call-out during active combat.
  if (state.wave?.phase === 'active') {
    const owa = state.drones?.some(d => d.type === 'owa' && d.hp > 0);
    const pay = state.drones?.some(d => d.type === 'payloadDelivery' && d.hp > 0);
    if (pay) return { text: 'PAYLOAD INBOUND', color: CONFIG.colors.threatRed };
    if (owa) return { text: 'OWA COMMITTED', color: CONFIG.colors.alertAmber };
    return { text: 'WAVE ' + state.wave.number + ' ACTIVE', color: CONFIG.colors.accentWhite };
  }
  // Casualty milestone.
  if (casualties > 0) {
    return { text: 'CASUALTIES ' + casualties, color: CONFIG.colors.threatRed };
  }
  // Prep-phase intel hint.
  if (state.wave?.phase === 'prep') {
    const intel = state.lastWaveIsrIntel ?? 0;
    if (intel > 45) return { text: 'ENEMY HAS FULL PICTURE — BRACE',
                             color: CONFIG.colors.threatRed };
    if (intel > 20) return { text: 'INTEL LEAKED — STIFFEN LINES',
                             color: CONFIG.colors.alertAmber };
    if (intel > 0)  return { text: 'MINOR LEAK — GOOD COVERAGE',
                             color: CONFIG.colors.successGreen };
    return { text: 'READY — PLACE YOUR DEFENSES',
             color: CONFIG.colors.friendlyCyan };
  }
  return null;
}
