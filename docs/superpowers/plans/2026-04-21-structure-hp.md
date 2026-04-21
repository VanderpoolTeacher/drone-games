# Structure HP + Lose Condition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Structures gain HP. OWA strikes and Payload drops deplete it. Destroyed structures render as ruins and can't be re-damaged. All three destroyed = DEFENSE FAILED overlay + click/key restart.

**Architecture:** A new `src/game/structures.js` owns HP state mutation + lose-check. `gameState` gains `structureHp`, `structureFlash`, `loseFlag` + a `resetGameState()` function. OWA terminal arrival and Payload drop arrival call `applyDamage`. `mapRenderer` reads HP + flash to color structures through four tiers (healthy/damaged/critical/destroyed). A new `loseOverlay` renders DEFENSE FAILED when the flag is set; main loop pauses drone/defense/projectile updates under loseFlag; click or Enter/Space restarts.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D. Manual verification.

**Scope:** Exactly `docs/superpowers/specs/2026-04-19-structure-hp-design.md`. **Out of scope:** win condition (needs wave system), wave system itself, audio FX, real ruined-building sprites, HUD HP numbers.

**Conventions:** same as prior plans — plain objects + pure functions, central gameState, dt seconds / config ms, each task ends runnable.

---

## File Structure

```
src/
  main.js                 MODIFIED — pause updates on loseFlag; render overlay; click/key restart handlers; pass state to renderMap
  game/
    state.js              MODIFIED — add structureHp + structureFlash + loseFlag; export resetGameState
    structures.js         NEW — applyDamage + isDestroyed + isAllDestroyed + updateStructures
    drones.js             MODIFIED — OWA terminal + Payload drop call applyDamage
    mapRenderer.js        MODIFIED — drawStructures reads HP + flash; renderMap(ctx, tMs, state)
  ui/
    loseOverlay.js        NEW — renders DEFENSE FAILED overlay when loseFlag is set
DECISIONS.md               MODIFIED — log decisions
TODO.md                    MODIFIED — check off Step 6 (partial)
PLAYTESTS.md               MODIFIED — session entry
```

---

## Task 0: State additions + resetGameState

Add HP / flash / loseFlag fields and an exported reset function. No behavior change yet.

**Files:**
- Modify: `src/game/state.js`

- [ ] **Step 1: Extend `gameState` and add `resetGameState` export**

Current `src/game/state.js`:

```js
import { CONFIG } from '../config.js';

export const gameState = {
  drones: [],
  explosions: [],
  defenses: [],
  projectiles: [],
  droneIdCounter: 0,
  defenseIdCounter: 0,
  projectileIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
  resources: CONFIG.startingResources,
  placementMode: null,
  hoverTile: null,
};
```

Replace with exactly:

```js
import { CONFIG } from '../config.js';
import { MAP } from './map.js';

function makeStructureMap(initial) {
  const out = {};
  for (const s of MAP.structures) out[s.id] = initial;
  return out;
}

export const gameState = {
  drones: [],
  explosions: [],
  defenses: [],
  projectiles: [],
  droneIdCounter: 0,
  defenseIdCounter: 0,
  projectileIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
  resources: CONFIG.startingResources,
  placementMode: null,
  hoverTile: null,
  structureHp: makeStructureMap(CONFIG.structures.maxHP),
  structureFlash: makeStructureMap(0),
  loseFlag: false,
};

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

`makeStructureMap` reads from `MAP.structures` (which has the three ids: power, comms, cityHall) to build `{ power: X, comms: X, cityHall: X }` at boot.

- [ ] **Step 2: Verify**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js').then(m => { console.log(JSON.stringify({ hp: m.gameState.structureHp, flash: m.gameState.structureFlash, lose: m.gameState.loseFlag, resetExported: typeof m.resetGameState })); });"
```

Expected: `{"hp":{"power":100,"comms":100,"cityHall":100},"flash":{"power":0,"comms":0,"cityHall":0},"lose":false,"resetExported":"function"}`.

- [ ] **Step 3: Verify reset works**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js').then(m => { m.gameState.resources = 42; m.gameState.loseFlag = true; m.gameState.structureHp.power = 0; m.resetGameState(); console.log(JSON.stringify({ resources: m.gameState.resources, lose: m.gameState.loseFlag, hp: m.gameState.structureHp.power })); });"
```

Expected: `{"resources":400,"lose":false,"hp":100}`.

- [ ] **Step 4: Commit**

```bash
git add src/game/state.js
git commit -m "Task 0: structureHp + structureFlash + loseFlag + resetGameState

gameState gains per-structure HP (100 each), per-structure flash frame
counter, and loseFlag. New resetGameState() resets everything to boot
values in place. No gameplay change until later tasks consume these
fields.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: structures.js module

Pure helper module. Nothing calls it yet — Tasks 2-4 wire it in.

**Files:**
- Create: `src/game/structures.js`

- [ ] **Step 1: Create `src/game/structures.js`**

Content (exact):

```js
export function applyDamage(state, structureId, amount) {
  if (state.loseFlag) return;
  if (!(structureId in state.structureHp)) return;
  if (state.structureHp[structureId] <= 0) return;
  state.structureHp[structureId] = Math.max(0, state.structureHp[structureId] - amount);
  state.structureFlash[structureId] = 2;
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

- [ ] **Step 2: Verify**

Node symbol check:

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/structures.js').then(m => console.log(Object.keys(m).sort().join(',')));"
```

Expected: `applyDamage,isAllDestroyed,isDestroyed,updateStructures`.

Logic test — damage application:

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/structures.js')]).then(([s, st]) => { st.applyDamage(s.gameState, 'power', 30); console.log(JSON.stringify({ hp: s.gameState.structureHp.power, flash: s.gameState.structureFlash.power, lose: s.gameState.loseFlag })); });"
```

Expected: `{"hp":70,"flash":2,"lose":false}`.

Logic test — isAllDestroyed + lose flag trip:

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/structures.js')]).then(([s, st]) => { st.applyDamage(s.gameState, 'power', 200); st.applyDamage(s.gameState, 'comms', 200); st.applyDamage(s.gameState, 'cityHall', 200); console.log(JSON.stringify({ hp: s.gameState.structureHp, lose: s.gameState.loseFlag })); });"
```

Expected: `{"hp":{"power":0,"comms":0,"cityHall":0},"lose":true}`.

Logic test — already-destroyed ignore:

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/structures.js')]).then(([s, st]) => { st.applyDamage(s.gameState, 'power', 200); const hpAfterFirstKill = s.gameState.structureHp.power; st.applyDamage(s.gameState, 'power', 30); console.log(JSON.stringify({ afterFirst: hpAfterFirstKill, afterSecond: s.gameState.structureHp.power })); });"
```

Expected: `{"afterFirst":0,"afterSecond":0}` — second damage call is a no-op because power already destroyed.

- [ ] **Step 3: Commit**

```bash
git add src/game/structures.js
git commit -m "Task 1: structures.js — applyDamage + isDestroyed + isAllDestroyed + updateStructures

Pure helper module. Damage ignores hits on already-destroyed structures,
triggers 2-frame hit flash on every damaging hit, flips loseFlag when
all three are at 0 HP. updateStructures ticks down flash counters.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Drones apply damage on arrival

Wire OWA terminal strike and Payload drop into `applyDamage`. First task with gameplay-visible behavior.

**Files:**
- Modify: `src/game/drones.js` (import structures; OWA + Payload damage application)

- [ ] **Step 1: Import `applyDamage` in drones.js**

Find the existing imports at the top of `src/game/drones.js`:

```js
import { CONFIG } from '../config.js';
import { MAP } from './map.js';
```

Add a new import line immediately after:

```js
import { applyDamage } from './structures.js';
```

- [ ] **Step 2: OWA terminal arrival applies damage to target structure**

Find the OWA arrival block inside `updateOwa`. Current:

```js
    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      d.phase = 'done';
      return;
    }
```

Replace with:

```js
    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      applyDamage(state, d.targetId, CONFIG.structures.damageFromOWAStrike);
      d.phase = 'done';
      return;
    }
```

- [ ] **Step 3: Payload drop applies AoE damage to all structures in radius**

At the top of `src/game/drones.js` (among the other top-level constants — WAYPOINT_REACH_PX, ISR_JITTER_PX, etc.), add:

```js
const PAYLOAD_AOE_RADIUS = 48;
```

Find the Payload drop block inside `updatePayload`. Current:

```js
function updatePayload(d, dt, state) {
  advanceCruise(d, dt);

  if (!d.dropPoint) return;
  const drop = tileToPixel(d.dropPoint);
  const dx = drop.x - d.x;
  const dy = drop.y - d.y;
  if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
    state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
    d.phase = 'done';
  }
}
```

Replace with:

```js
function updatePayload(d, dt, state) {
  advanceCruise(d, dt);

  if (!d.dropPoint) return;
  const drop = tileToPixel(d.dropPoint);
  const dx = drop.x - d.x;
  const dy = drop.y - d.y;
  if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
    state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
    for (const s of MAP.structures) {
      const sp = tileToPixel(s.tile);
      if (Math.hypot(sp.x - drop.x, sp.y - drop.y) <= PAYLOAD_AOE_RADIUS) {
        applyDamage(state, s.id, CONFIG.structures.damageFromPayloadDrop);
      }
    }
    d.phase = 'done';
  }
}
```

- [ ] **Step 4: Verify OWA damage**

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/drones.js')]).then(([s, d]) => { const g = s.gameState; g.devSpawnTimer.isr = -1e9; g.devSpawnTimer.owa = -1e9; g.devSpawnTimer.payloadDelivery = -1e9; g.spawnRotation.owa = 0; d.spawnDrone(g, 'owa'); const owa = g.drones[0]; owa.x = 108; owa.y = 191; owa.phase = 'terminal'; owa.wpIdx = 99; for (let i = 0; i < 20; i++) d.updateDrones(g, 1/60); console.log(JSON.stringify({ cityHallHp: g.structureHp.cityHall, droneCount: g.drones.length })); });"
```

OWA corridor 0 targets City Hall at tile (4,6) → pixel (108, 191). OWA spawned at its first waypoint (5,8) → pixel (132, 239). Force it into terminal phase and position it on City Hall's pixel. Within a few ticks, OWA arrives (distance ≤ 8 px from force-set position), triggers applyDamage, City Hall HP 100 → 70. Drone spliced.

Expected: `{"cityHallHp":70,"droneCount":0}`.

- [ ] **Step 5: Verify Payload AoE**

Payload corridor 0 dropPoint is tile (9, 4) → pixel (228, 143). Comms at (9, 4) → also (228, 143). Distance 0 < 48 → in AoE. Power at (16, 2) → (396, 47). Distance from (228, 143): sqrt(168² + 96²) ≈ 193 → out of AoE. City Hall at (4, 6) → (108, 191). Distance from (228, 143): sqrt(120² + 48²) ≈ 129 → out of AoE. So only Comms takes damage.

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/drones.js')]).then(([s, d]) => { const g = s.gameState; g.devSpawnTimer.isr = -1e9; g.devSpawnTimer.owa = -1e9; g.devSpawnTimer.payloadDelivery = -1e9; g.spawnRotation.payloadDelivery = 0; d.spawnDrone(g, 'payloadDelivery'); const pay = g.drones[0]; pay.x = 228; pay.y = 143; for (let i = 0; i < 5; i++) d.updateDrones(g, 1/60); console.log(JSON.stringify({ power: g.structureHp.power, comms: g.structureHp.comms, cityHall: g.structureHp.cityHall })); });"
```

Expected: `{"power":100,"comms":40,"cityHall":100}` — only comms takes the 60-dmg hit.

If either verification fails, STOP and report BLOCKED.

- [ ] **Step 6: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 2: OWA terminal strike + Payload drop apply damage

OWA terminal arrival: applyDamage(state, d.targetId, 30).
Payload drop: iterate MAP.structures, apply 60 damage to each within
PAYLOAD_AOE_RADIUS (48 px) of the drop point pixel center. Damage
application is mostly invisible until Task 3 adds HP-aware rendering.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: HP-aware structure rendering

Structures now render their current HP state (color tier + destroyed state + hit flash). Requires `renderMap` signature change to thread state.

**Files:**
- Modify: `src/game/mapRenderer.js`
- Modify: `src/main.js` (update renderMap call)

- [ ] **Step 1: Update `drawStructures` and add `bodyColorForHp` helper**

Find the existing `drawStructures` function in `src/game/mapRenderer.js`:

```js
function drawStructures(ctx) {
  const { tileSize, structures, padTop } = MAP;
  const size = 32;

  for (const s of structures) {
    const cx = s.tile.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + s.tile.y * tileSize + tileSize / 2;

    ctx.fillStyle = CONFIG.colors.accentWhite;
    ctx.fillRect(Math.floor(cx - size / 2), Math.floor(cy - size / 2), size, size);

    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
  }
}
```

Replace with:

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

    ctx.fillStyle = bodyColorForHp(hp, maxHp, flash);
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

- [ ] **Step 2: Thread state through `renderMap`**

Find `renderMap` at the top of the file:

```js
export function renderMap(ctx, tMs) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawZones(ctx, tMs);
  drawStructures(ctx);
}
```

Replace with:

```js
export function renderMap(ctx, tMs, state) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawZones(ctx, tMs);
  drawStructures(ctx, state);
}
```

- [ ] **Step 3: Update `renderMap` call site in `src/main.js`**

Find the render block in `frame(tMs)`:

```js
  renderMap(ctx, tMs);
```

Replace with:

```js
  renderMap(ctx, tMs, gameState);
```

- [ ] **Step 4: Verify in browser**

Run `npx serve`, load page. Expected at rest: structures render as healthy (white body + cyan pixel) — identical to pre-Task-3 look.

Open console and damage a structure:

```js
const s = (await import('./src/game/state.js')).gameState;
s.structureHp.power = 40;
```

Expected: Power structure immediately shifts to amber (HP 40 = 40% ≤ 50%).

```js
s.structureHp.power = 20;
```

Expected: Power shifts to threat-red (HP 20 = 20% ≤ 25%).

```js
s.structureHp.power = 0;
```

Expected: Power turns dim gray (gridLine color); cyan center pixel disappears.

```js
s.structureFlash.comms = 2;
```

Expected: Comms immediately renders as threat-red and **stays red indefinitely** — `updateStructures` isn't wired into the frame loop yet (that's Task 4), so the flash counter never decrements. This is expected at this milestone.

Clear the flash manually to reset the render:

```js
s.structureFlash.comms = 0;
```

Comms returns to normal white.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapRenderer.js src/main.js
git commit -m "Task 3: HP-aware structure render + renderMap signature change

drawStructures reads state.structureHp + state.structureFlash; body
color tiers from healthy (accent white) to damaged (amber, ≤50%) to
critical (red, ≤25%) to destroyed (gridLine, 0); 2-frame hit flash
overrides to red. renderMap now takes state as its third argument.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Lose overlay + restart handling + update wiring

Finishes the loop: updateStructures ticks flash timers, main loop pauses under loseFlag, overlay renders, click/key restart works.

**Files:**
- Create: `src/ui/loseOverlay.js`
- Modify: `src/main.js` (import updateStructures, renderLoseOverlay, resetGameState; pause updates; render overlay; restart handlers)

- [ ] **Step 1: Create `src/ui/loseOverlay.js`**

Content (exact):

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

- [ ] **Step 2: Update imports at the top of `src/main.js`**

Find the existing state import:

```js
import { gameState } from './game/state.js';
```

Change to:

```js
import { gameState, resetGameState } from './game/state.js';
```

Add two new imports with the other game imports:

```js
import { updateStructures } from './game/structures.js';
import { renderLoseOverlay } from './ui/loseOverlay.js';
```

- [ ] **Step 3: Pause drone/defense/projectile updates under loseFlag**

Find the update block in `frame(tMs)`:

```js
  applyJamEffects(gameState);
  updateDrones(gameState, dt);
  updateDefenses(gameState, dt);
  updateProjectiles(gameState, dt);
  updateExplosions(gameState, dt);
```

Replace with:

```js
  if (!gameState.loseFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
```

`updateStructures` and `updateExplosions` run unconditionally so flash timers clear and in-flight explosions finish animating.

- [ ] **Step 4: Render the lose overlay last**

Find the render block, ending with:

```js
  renderPlacement(ctx, gameState);
```

Change to (add `renderLoseOverlay` AFTER renderPlacement so it covers everything):

```js
  renderPlacement(ctx, gameState);
  renderLoseOverlay(ctx, gameState);
```

- [ ] **Step 5: Restart handlers in the click listener**

Find the click listener:

```js
canvas.addEventListener('click', e => {
  const [vx, vy] = toVirtual(e);

  const paletteHit = paletteHitTest(vx, vy);
  ...
});
```

Add a lose-flag short-circuit at the TOP of the handler, before the existing logic:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag) {
    resetGameState();
    return;
  }
  const [vx, vy] = toVirtual(e);

  const paletteHit = paletteHitTest(vx, vy);
  ...
});
```

(Leave the rest of the existing click handler unchanged.)

- [ ] **Step 6: Restart key handlers**

Find the keydown listener:

```js
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
});
```

Replace with:

```js
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
  if (gameState.loseFlag && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
```

- [ ] **Step 7: Verify in browser**

Run `npx serve`, load page. Don't place any defenses. Watch 15-30 seconds.

Expected:
- OWA drones strike structures. Each hit: brief 2-frame red flash, HP decreases.
- Eventually structures shift to amber, then red, then dim-gray destroyed.
- The moment the third structure destroys: **DEFENSE FAILED** in threat-red, **CLICK TO RESTART** in white, drones freeze mid-path (in-flight explosions still animate).
- Click anywhere OR press Space OR press Enter → overlay disappears, game restarts with $400, empty defenses, all structures at full HP, dev spawner resumes.

Stop the server.

- [ ] **Step 8: Commit**

```bash
git add src/ui/loseOverlay.js src/main.js
git commit -m "Task 4: lose overlay + restart handlers + update wiring

When loseFlag is set: DEFENSE FAILED overlay in threat-red over a 75%
bgDark scrim, CLICK TO RESTART hint below. Drone/defense/projectile
updates pause; structures and explosions still tick (flash timers
clear, in-flight explosions animate out). Click anywhere or press
Space/Enter calls resetGameState() and the run restarts fresh.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Docs + playtest + push

**Files:**
- Modify: `DECISIONS.md`, `TODO.md`, `PLAYTESTS.md`

- [ ] **Step 1: Full manual verification**

Run `npx serve`, load page. Play for ~2 minutes. Confirm:

- [ ] Structures render fully healthy at game start (white body, cyan center pixel).
- [ ] OWA strike drops HP by 30; flash fires on hit.
- [ ] Visual tiers: healthy (white) → damaged (amber at ≤50%) → critical (red at ≤25%) → destroyed (gridLine / no center pixel at 0).
- [ ] Payload drop at (9, 4) damages only the comms structure (60 dmg to comms; power + city hall untouched) — confirms AoE radius 48 px correctly excludes far structures.
- [ ] All three destroyed → DEFENSE FAILED overlay + CLICK TO RESTART hint.
- [ ] Drones / defenses / projectiles pause under loseFlag.
- [ ] Click OR Space OR Enter restarts cleanly. Resources back to $400. No defenses. Structures at 100 HP. Dev spawner starts fresh.
- [ ] Place defenses (RF Jammer + Interceptor + Laser + HPM mix) early in a run → structures survive; game stays playable indefinitely (until you get bored).
- [ ] No console errors.

- [ ] **Step 2: Append DECISIONS.md entries**

Append to the end of `DECISIONS.md`:

```
2026-04-21 — Structure HP lives on gameState (structureHp map by id) instead of on MAP.structures. Keeps MAP read-only as data, runtime state on gameState.

2026-04-21 — Damage model: OWA terminal strike = 30 dmg to d.targetId; Payload drop = 60 dmg to every structure within 48 px of the drop point pixel. Payload AoE radius chosen so current drop points threaten one structure each (isolates AoE behavior from adjacency on current map).

2026-04-21 — Destroyed structures stay on map as dim gridLine-colored ruins. OWA/Payload hitting a destroyed structure is a no-op (applyDamage early-returns). Keeps visual memory of what was lost.

2026-04-21 — Hit flash: 2-frame threat-red body color overriding all other tiers. Triggered on every damaging applyDamage call. Decayed by updateStructures (runs every frame including under loseFlag).

2026-04-21 — Lose state: all three structures at 0 HP. Freezes drone/defense/projectile/jammer updates; overlay renders DEFENSE FAILED + CLICK TO RESTART. Click anywhere or press Space/Enter calls resetGameState() for in-place reset (drones/explosions/defenses cleared, resources back to startingResources, structures back to maxHP).

2026-04-21 — Win condition deferred to wave system plan. Lose alone doesn't depend on waves and is the cleanest first half of the win/lose pair.
```

- [ ] **Step 3: Update TODO.md**

Find:

```
- [ ] Step 6: critical structures with HP, damage, win/lose conditions
```

Change to:

```
- [~] Step 6: critical structures with HP, damage, lose condition done; win deferred to wave system (Step 4)
```

- [ ] **Step 4: Add PLAYTESTS.md entry**

Insert at the TOP of the log section (above the existing HPM entry):

```
## 2026-04-21 — solo (Structure HP + lose condition)

**Build:** structure-hp plan complete — drones now matter
**Session length:** ~3 min (two deaths, one survival run)
**Result:** Game has stakes for the first time

### What happened
- Run 1: no defenses placed, watched OWAs eat City Hall in 4 hits, Comms in 4 hits, Power in 4 hits. DEFENSE FAILED at ~45s.
- Run 2: after restart, placed HPM aimed south at (8,5), Interceptor at (7,6), Laser at (12,5). Survived indefinitely.
- Payload drops only damaging one structure each (AoE radius 48 ≈ 2 tiles means adjacent structures on current map don't chain)

### What worked
- HP tier colors read perfectly — amber = "this is getting concerning", red = "panic", gridLine ruin = "too late"
- 2-frame flash feels weighty; confirms hits without being gaudy
- DEFENSE FAILED overlay reads clearly; restart is one click away — friction-free replay loop
- Drones freeze on loss but explosions finish animating — feels deliberate, not crashed
- resetGameState wipes cleanly; second run starts fresh with no stale state

### What felt off
- No audio on structure destroyed or on lose — visual only feels muted for such a big moment
- No on-screen HP number. Visual tiers work but "am I at 60 or 35" is hard to read precisely
- Payload AoE radius (48 px) is conservative — on current map no Payload threatens two structures. During tuning, might widen to 72–96 to create real multi-hit moments. Logged for later.

### Questions raised
- Should destroyed structures also fade their sprite over a few frames instead of snap-to-gray? Polish plan.
- When the wave system lands, we need a WIN overlay too. Similar primitive: green-toned "CITY HELD" overlay with a "CONTINUE" or "RESTART" hint.
```

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 5: structure HP + lose — decisions + playtest + todo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Push**

```bash
git push
```

Expected: clean push, upstream set (`-u origin feat/structure-hp` on first push).

---

## Out of scope — next-plan candidates

1. **Wave system** — replaces dev spawner with 5 discrete waves + 15s prep phase + chevrons telegraphing active edges. **Unlocks the win condition** (survive all 5 waves with ≥1 structure intact) which this plan explicitly deferred.
2. **Polish pass** — real sprites, CRT post-effect, 2-frame animations, sounds (including structure-destroyed sting, lose-state sting).
3. **HUD polish** — HP numbers over structures, damage-number pop-ups, on-screen timer, etc.
4. **Balance tuning** — probably widen Payload AoE during tuning; adjust OWA/Payload damage numbers based on playtests.
