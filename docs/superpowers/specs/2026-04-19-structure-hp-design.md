# Structure HP + Lose Condition Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm
**Scope:** Structures gain HP. OWA strikes and Payload drops deplete it. Destroyed structures render as dead and can't be re-damaged. When all three structures are gone, the game enters a lose state with a "DEFENSE FAILED" overlay and a click/key restart. Win condition deferred to the wave-system plan.

Builds on all four defense branches. The core drone-death and defense-firing loops stay untouched; this plan makes the drone arrivals that were previously flavor-only actually *matter*.

## Out of scope

- Win condition — needs the wave system (survive all 5 waves with ≥1 structure intact). Next plan.
- Wave system (replaces dev-spawner).
- ISR "disable defense on contact" — still deferred; ISR does no structure damage in this plan.
- Audio FX (lose-state sting, structure-hit thud).
- Real destroyed-structure sprites (ruined-building art). Placeholder dim-gray block this plan.
- Per-structure HP number readout (HUD text) — visual color tiers only.

---

## Design thesis alignment

From DESIGN.md: win by surviving all 5 waves with ≥1 critical structure intact; lose when all critical structures destroyed. This plan implements the lose side. The player now has a *reason* to place defenses: inaction means drones chip through structure HP until the game ends.

Damage math at config values:

| Drone | Structure damage | Hits to kill one structure (100 HP) |
|---|---|---|
| OWA strike | 30 | 4 |
| Payload drop (per structure in AoE) | 60 | 2 |

Payload can threaten multiple structures in a single drop (the AoE overlaps) — more existential than OWA per-strike.

---

## Architecture

- `gameState` gains runtime per-structure HP and flash-timer maps, plus `loseFlag`.
- `src/game/structures.js` (NEW) — owns damage application + lose-check + flash timing.
- `src/game/drones.js` — OWA terminal arrival and Payload drop arrival each call `applyDamage` instead of (or in addition to) the existing explosion/splice.
- `src/game/mapRenderer.js` — structure render reads current HP and flash state; draws HP-tier color + destroyed state + flash overlay.
- `src/ui/loseOverlay.js` (NEW) — renders the "DEFENSE FAILED" overlay + input hint.
- `src/main.js` — short-circuits update calls when `loseFlag`; renders overlay last; adds restart input handlers.

### File layout (net changes)

```
src/
  main.js                 MODIFIED — pause updates on loseFlag; render overlay; restart handlers
  game/
    state.js              MODIFIED — add structureHp, structureFlash, loseFlag; export resetGameState
    structures.js         NEW      — applyDamage, updateStructures (flash-timer tick), isDestroyed, isAllDestroyed
    drones.js             MODIFIED — OWA terminal arrival + Payload drop arrival apply damage
    mapRenderer.js        MODIFIED — HP-aware structure render + flash overlay
  ui/
    loseOverlay.js        NEW      — DEFENSE FAILED screen
PLAYTESTS.md               MODIFIED — session entry
DECISIONS.md               MODIFIED — log decisions
TODO.md                    MODIFIED — check off Step 6
```

---

## Data model

### gameState additions

```js
structureHp: { power: 100, comms: 100, cityHall: 100 },   // from CONFIG.structures.maxHP
structureFlash: { power: 0, comms: 0, cityHall: 0 },       // frames of red-hit flash remaining
loseFlag: false,
```

Initialized at boot from `MAP.structures` ids + `CONFIG.structures.maxHP`.

**`resetGameState()`:** exported function that mutates `gameState` back to boot state. Clears drones/explosions/defenses/projectiles, resets counters, resources, placementMode/hoverTile, structureHp to maxHP, structureFlash to 0, loseFlag to false, devSpawnTimer to 0.

Implementation is a direct write to each field (gameState is a named export, so Object.assign won't help — explicit property re-assignment is simplest and clearest).

### Dead structures

Decided by `isDestroyed(state, id)` → `state.structureHp[id] <= 0`. Read-only helper used by damage-application, render, and lose-check.

---

## Damage application

### `applyDamage(state, structureId, amount)` in `src/game/structures.js`

```js
export function applyDamage(state, structureId, amount) {
  if (state.loseFlag) return;
  if (!(structureId in state.structureHp)) return;
  if (state.structureHp[structureId] <= 0) return;  // already destroyed — ignore
  state.structureHp[structureId] = Math.max(0, state.structureHp[structureId] - amount);
  state.structureFlash[structureId] = 2;  // 2-frame red flash per STYLE.md
  if (isAllDestroyed(state)) state.loseFlag = true;
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
```

### OWA terminal arrival — `updateOwa` change

Current OWA arrival block in `src/game/drones.js`:

```js
if (dist <= OWA_ARRIVAL_PX || step >= dist) {
  state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
  d.phase = 'done';
  return;
}
```

Change to:

```js
if (dist <= OWA_ARRIVAL_PX || step >= dist) {
  state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
  applyDamage(state, d.targetId, CONFIG.structures.damageFromOWAStrike);
  d.phase = 'done';
  return;
}
```

(Requires `import { applyDamage } from './structures.js';` at the top of drones.js.)

### Payload drop — `updatePayload` change

Current Payload drop block:

```js
if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
  state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
  d.phase = 'done';
}
```

Change to:

```js
if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
  state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
  const dropX = drop.x;
  const dropY = drop.y;
  for (const s of MAP.structures) {
    const sp = tileToPixel(s.tile);
    if (Math.hypot(sp.x - dropX, sp.y - dropY) <= PAYLOAD_AOE_RADIUS) {
      applyDamage(state, s.id, CONFIG.structures.damageFromPayloadDrop);
    }
  }
  d.phase = 'done';
}
```

**`PAYLOAD_AOE_RADIUS = 48`** (2 tiles) — constant in `drones.js`. Comment inline that this should likely move to config during the tuning pass.

### Where arrivals hit destroyed structures

`applyDamage` early-returns when the target is already destroyed. OWA whose targetId is a destroyed structure still explodes (flavor, harmless) and then despawns. Payload whose AoE only overlaps destroyed structures also harmlessly despawns.

---

## Update flow

Frame order in `src/main.js`:

```js
if (!gameState.loseFlag) {
  applyJamEffects(gameState);
  updateDrones(gameState, dt);
  updateDefenses(gameState, dt);
  updateProjectiles(gameState, dt);
}
updateStructures(gameState);      // always — flash timers tick regardless (they'll be 0 most of the time)
updateExplosions(gameState, dt);  // always — lets in-flight explosions finish

// render unchanged order, plus:
renderLoseOverlay(ctx, gameState);  // added at the very end
```

Explosions still animate after loss. Drones freeze mid-corridor. Palette still renders (shows current resources, button states). Placement cursor still renders (but clicks to place are skipped because the click handler checks loseFlag — see below).

---

## Render: HP-tier structure color

Current structure render (in `mapRenderer.js` `drawStructures`):

```js
ctx.fillStyle = CONFIG.colors.accentWhite;
ctx.fillRect(Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);

ctx.fillStyle = CONFIG.colors.friendlyCyan;
ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
```

Change to (reads from gameState passed in):

```js
function drawStructures(ctx, state) {
  const { tileSize, structures, padTop } = MAP;
  const size = 32;

  for (const s of structures) {
    const cx = s.tile.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + s.tile.y * tileSize + tileSize / 2;
    const hp = state.structureHp[s.id];
    const maxHp = CONFIG.structures.maxHP;
    const flash = state.structureFlash[s.id] > 0;

    const bodyColor = bodyColorForHp(hp, maxHp, flash);
    ctx.fillStyle = bodyColor;
    ctx.fillRect(Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);

    if (hp > 0) {
      ctx.fillStyle = CONFIG.colors.friendlyCyan;
      ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
    }
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
```

**Destroyed state:** `CONFIG.colors.gridLine` (dim blue-gray) is the dead-structure color. No cyan icon pixel. Reads as "ruin."

**Flash precedence:** the 2-frame hit flash overrides all other colors (even if destroyed, the flash fires on the damaging hit — though on the killing blow the flash runs for 2 frames then transitions to the dim-gray ruined look).

`renderMap` signature change: `renderMap(ctx, tMs, state)` — the state argument now threads through to `drawStructures`. All existing callers update.

Alternative: leave `renderMap(ctx, tMs)` alone and import `gameState` from state.js directly into mapRenderer. Cleaner signature but introduces a state-module dependency in what used to be a pure-data renderer. Given the pattern elsewhere (drones.js accepts state param), thread it through.

---

## renderLoseOverlay

`src/ui/loseOverlay.js`:

```js
import { CONFIG } from '../config.js';

export function renderLoseOverlay(ctx, state) {
  if (!state.loseFlag) return;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
  ctx.restore();

  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.threatRed;
  ctx.fillText('DEFENSE FAILED', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 8);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CLICK TO RESTART', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 16);
}
```

---

## Restart input handling

`src/main.js` click listener gains a lose-flag short-circuit at the top:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag) {
    resetGameState();
    return;
  }
  // ... existing palette + placement logic ...
});
```

Window keydown listener already handles ESC for cancel. Add SPACE or ENTER as restart trigger (keyboard-friendly):

```js
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
  if (gameState.loseFlag && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
```

`resetGameState` is imported from `state.js`.

---

## resetGameState

```js
export function resetGameState() {
  gameState.drones.length = 0;
  gameState.explosions.length = 0;
  gameState.defenses.length = 0;
  gameState.projectiles.length = 0;
  gameState.droneIdCounter = 0;
  gameState.defenseIdCounter = 0;
  gameState.projectileIdCounter = 0;
  gameState.spawnRotation.isr = 0;
  gameState.spawnRotation.owa = 0;
  gameState.spawnRotation.payloadDelivery = 0;
  gameState.devSpawnTimer.isr = 0;
  gameState.devSpawnTimer.owa = 0;
  gameState.devSpawnTimer.payloadDelivery = 0;
  gameState.resources = CONFIG.startingResources;
  gameState.placementMode = null;
  gameState.hoverTile = null;
  for (const id of Object.keys(gameState.structureHp)) {
    gameState.structureHp[id] = CONFIG.structures.maxHP;
    gameState.structureFlash[id] = 0;
  }
  gameState.loseFlag = false;
}
```

Mutates in place (gameState is a live export referenced by other modules). Does not create a new object.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve` → load page. Structures render as current placeholder (white 32×32 + cyan center pixel).
2. **Damage:** don't place any defenses. Wait ~20s. OWA drones terminal-commit and strike structures. Watch HP indicators:
   - After 2 hits on one structure: body shifts to **alert amber** (HP 40).
   - After 3 hits: body shifts to **threat red** (HP 10).
   - After 4th hit: body turns **dim gray**, cyan center pixel disappears. Structure destroyed.
3. **Flash:** every damaging hit produces a 2-frame red flash overriding the body color — visible as a "pulse" the instant the OWA lands.
4. **Payload AoE:** Payload drops at (9, 4) → comms at (9, 4) definitely takes 60 dmg. Power at (16, 2) is ~174 px away (not in AoE). City Hall at (4, 6) is ~140 px away (not in AoE). Payload kills comms in 2 drops. Confirm via console `gameState.structureHp`.
5. **Lose:** let all three structures get destroyed (or lower HP via console to accelerate). The moment the third reaches 0:
   - `DEFENSE FAILED` overlay in threat-red
   - `CLICK TO RESTART` in accent-white below
   - Drones freeze mid-path
   - Explosions already in flight finish animating
6. **Restart:** click anywhere OR press Enter/Space. All state resets: $400 in resources, no defenses, no drones, all structures back to 100 HP, dev spawner resumes from zero.
7. **Don't die repeatedly:** after restart, place an HPM facing south at (8, 5) before OWAs arrive. Game should survive indefinitely (until wave system caps run length).

Add a `PLAYTESTS.md` entry.

---

## Edge cases handled

- **OWA targets a destroyed structure:** `applyDamage` early-returns; OWA explodes and despawns harmlessly.
- **Payload drops on a tile with ONLY destroyed structures in range:** all `applyDamage` calls early-return; no damage, but Payload still explodes + despawns.
- **Flash + destruction in same frame:** structure takes the killing hit → flash=2, hp=0 → renders threatRed this frame (flash takes precedence); 2 frames later flash ends, renders gridLine (destroyed).
- **Restart during mid-flight projectile:** resetGameState clears projectiles; no stale references.
- **Restart during mid-pulse HPM:** clearing defenses ends the pulse cleanly; flash state resets.
- **Multiple Payloads dropping on same structure within 1 frame:** each applies damage sequentially; the structure's HP goes down twice; flash stays at 2 (both overwrite, no buildup).

---

## Queued doc updates

- `DECISIONS.md` — structure HP + damage values from config; Payload AoE radius 48 px (2 tiles); lose = all three destroyed; restart via click or Space/Enter; destroyed structures stay on-map as dim-gray ruins.
- `TODO.md` — check off Step 6 (partial — "win/lose conditions" now has lose; win in wave plan).
