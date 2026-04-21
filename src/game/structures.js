import { playSfx } from '../audio/sfx.js';

export function applyDamage(state, structureId, amount) {
  if (state.loseFlag) return;
  if (!(structureId in state.structureHp)) return;
  if (state.structureHp[structureId] <= 0) return;

  const before = state.structureHp[structureId];
  state.structureHp[structureId] = Math.max(0, state.structureHp[structureId] - amount);
  state.structureFlash[structureId] = 2;

  if (before > 0 && state.structureHp[structureId] <= 0) {
    playSfx('structureDestroyed');
  }

  if (isAllDestroyed(state)) {
    state.loseFlag = true;
    playSfx('lose');
  }
}

export function isDestroyed(state, id) {
  return state.structureHp[id] <= 0;
}

export function isAllDestroyed(state) {
  return Object.values(state.structureHp).every(hp => hp <= 0);
}

export function updateStructures(state) {
  for (const id of Object.keys(state.structureFlash)) {
    if (state.structureFlash[id] > 0) state.structureFlash[id] -= 1;
  }
}
