import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { playSfx, startSfx, stopAllContinuous } from '../audio/sfx.js';
import { isStructureTypeDown } from './state.js';

const FINANCIAL_PENALTY_PER_TILE = 500;

const HIT_HEAVY_FRAC = 0.25;   // hit ≥25% of maxHP → structureHitHeavy
const ALARM_HP_FRAC = 0.5;     // any structure below 50% HP → alarm on
const ALARM_ID = 'structures-alarm';

export function applyDamage(state, structureId, amount) {
  if (state.loseFlag) return;
  if (!(structureId in state.structureHp)) return;
  if (state.structureHp[structureId] <= 0) return;

  const before = state.structureHp[structureId];
  state.structureHp[structureId] = Math.max(0, state.structureHp[structureId] - amount);
  state.structureFlash[structureId] = 2;

  if (before > 0 && state.structureHp[structureId] <= 0) {
    playSfx('structureDestroyed');
    state.stats.structuresLost += 1;
    const meta = MAP.structures.find(s => s.id === structureId);
    if (meta?.type === 'financial') {
      // Federal Reserve down → financial damage doubles (#10).
      const fedMult = isStructureTypeDown(state, 'fedReserve') ? 2 : 1;
      state.financialPenalty = (state.financialPenalty ?? 0)
        + FINANCIAL_PENALTY_PER_TILE * fedMult;
    }
  } else {
    playSfx('structureHit');
    if (amount >= CONFIG.structures.maxHP * HIT_HEAVY_FRAC) {
      playSfx('structureHitHeavy');
    }
  }

  const anySubCritical = Object.values(state.structureHp).some(
    hp => hp > 0 && hp < CONFIG.structures.maxHP * ALARM_HP_FRAC
  );
  if (anySubCritical) startSfx('structuresAlarm', ALARM_ID);

  if (isAllDestroyed(state)) {
    state.loseFlag = true;
    state.stats.runEndMs = Date.now();
    stopAllContinuous();
    playSfx('lose');
  }
}

export function isDestroyed(state, id) {
  return state.structureHp[id] <= 0;
}

export function isAllDestroyed(state) {
  // Game-over only triggers when all CRITICAL structures are destroyed;
  // hospital / transit / financial are gameplay modifiers, not lose conditions.
  const criticals = MAP.structures.filter(s => s.critical);
  if (criticals.length === 0) return false;   // no criticals → game can't end this way
  return criticals.every(s => (state.structureHp[s.id] ?? 0) <= 0);
}

export function updateStructures(state) {
  for (const id of Object.keys(state.structureFlash)) {
    if (state.structureFlash[id] > 0) state.structureFlash[id] -= 1;
  }
  for (const k of Object.keys(state.apartmentFlash)) {
    if (state.apartmentFlash[k] > 0) state.apartmentFlash[k] -= 1;
  }
  for (const k of Object.keys(state.bridgeFlash)) {
    if (state.bridgeFlash[k] > 0) state.bridgeFlash[k] -= 1;
  }
  for (const k of Object.keys(state.skyscraperFlash ?? {})) {
    if (state.skyscraperFlash[k] > 0) state.skyscraperFlash[k] -= 1;
  }
}
