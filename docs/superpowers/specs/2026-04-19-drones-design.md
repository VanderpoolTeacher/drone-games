# Drones + Corridor Traversal Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm (sections 1 + 2 + 3)
**Scope:** Drone entities for the three v1 types (ISR, OWA, Payload-Delivery), their corridor-based traversal, per-type motion and trail behavior, arrival logic, and a temporary dev auto-spawner so the result is visible without a wave system.

This spec builds directly on `2026-04-18-map-layout-design.md`. Map shape, structure positions, spawn edges, and the empty `corridors` slots on `MAP` are taken as given.

## Out of scope

Handled by later plans; do not build here:

- Wave system + 15 s prep phase + pre-wave chevrons
- Defenses, placement interaction, range/cone indicators
- Structure HP, damage, win/lose
- ISR's "disable a defense on contact" mechanic (needs defenses to exist)
- Sounds, CRT post-effect, real (non-placeholder) sprites

---

## Design thesis alignment

From `DESIGN.md`: layered defense + cost-exchange. This plan establishes the *threat vectors* both thesis points rely on:

- Three mission profiles (ISR/OWA/Payload) traversing distinct corridors make "no single defense covers all three" visible in motion.
- Per-type speed and HP values in `config.js` already encode the cost-exchange asymmetry; this plan makes it legible.

Nothing in this plan is gameplay-complete on its own. Its job is to make the next plan (defenses + placement) have something to shoot at.

---

## Architecture

- **Central game state** in `src/game/state.js`. One exported object, mutated in-place. Per `CLAUDE.md:50`.
- **Per-type update helpers** (`updateIsr`, `updateOwa`, `updatePayload`) dispatched by `drone.type` inside `updateDrones(state, dt)`. Plain functions over plain objects. Per `CLAUDE.md:49`.
- **Rendering** lives in `src/game/drones.js` (drones + trails + commit lines) and `src/game/explosions.js` (3-frame FX). Both are pure functions taking `(ctx, state)`.
- **Loop integration** in `src/main.js`: compute `dt` in seconds at the loop boundary (per `CLAUDE.md:51`), call update functions, then render in spec layer order.

### File layout (net changes)

```
src/
  config.js                 MODIFIED — add devSpawner block
  main.js                   MODIFIED — compute dt, call updateDrones / renderDrones / renderExplosions
  game/
    state.js                NEW      — exports gameState (single mutable object)
    map.js                  MODIFIED — fill corridor waypoints + targetStructureId + dropPoint
    drones.js               NEW      — updateDrones + renderDrones + per-type helpers
    explosions.js           NEW      — updateExplosions + renderExplosions
    mapRenderer.js          unchanged
  ui/
    uiChrome.js             unchanged
```

---

## Data model

### `gameState` (in `src/game/state.js`)

```js
export const gameState = {
  drones: [],                                             // active drones
  explosions: [],                                         // active FX
  droneIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },  // round-robin corridor index per type
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },  // ms accumulator per type
};
```

One mutable object consumed read-only by renderers, mutated by updaters. No classes, no getters/setters.

### Drone object (plain object pushed onto `gameState.drones`)

```js
{
  id: <int>,                    // from droneIdCounter
  type: 'isr' | 'owa' | 'payloadDelivery',
  x: <px>, y: <px>,             // virtual pixels (float OK during interp)
  vx: <px/sec>, vy: <px/sec>,   // current velocity
  hp: <int>,                    // from CONFIG.drones[type].hp
  corridorIdx: <int>,           // which corridor of its type this drone uses
  wpIdx: <int>,                 // next waypoint to reach (0 == first)
  phase: 'cruise' | 'terminal' | 'exiting',
  targetId: <string|null>,      // structure id (OWA only; null otherwise)
  dropPoint: {x,y}|null,        // tile coords (Payload only; null otherwise)
  jitterOffset: {dx,dy}|null,   // ISR only; re-rolled per waypoint; in px
  trail: [],                    // ISR only; capped at 8 {x,y,age} samples
  trailSampleTimer: 0,          // ISR only; ms accumulator for 3-frame sampling
}
```

### Explosion object

```js
{ x: <px>, y: <px>, frame: 0, frameTimer: 0 }
```

`frameTimer` accumulates dt-ms; each ~80 ms step advances `frame`. Removed when `frame >= 3`.

### Corridor data (filled into `MAP.corridors`)

Waypoints in **tile coordinates** (not pixels — converted during update). Out-of-bounds tiles (e.g. `x: -1` or `y: 8`) represent off-grid spawn/exit points.

```js
corridors: {
  isr: [
    { waypoints: [{x:2, y:0}, {x:3, y:2}, {x:5, y:4}, {x:4, y:6}, {x:5, y:8}],  exitEdge: 'S' },
    { waypoints: [{x:10,y:0}, {x:10,y:2}, {x:9, y:4}, {x:10,y:6}, {x:10,y:8}], exitEdge: 'S' },
    { waypoints: [{x:16,y:0}, {x:15,y:2}, {x:16,y:4}, {x:15,y:6}, {x:15,y:8}], exitEdge: 'S' },
  ],
  owa: [
    { waypoints: [{x:5,  y:8}, {x:5,  y:6}], targetStructureId: 'cityHall' },
    { waypoints: [{x:9,  y:8}, {x:9,  y:5}], targetStructureId: 'comms' },
    { waypoints: [{x:15, y:8}, {x:15, y:3}], targetStructureId: 'power' },
  ],
  payloadDelivery: [
    { waypoints: [{x:-1, y:4}, {x:19, y:4}], dropPoint: {x:9, y:4} },
    { waypoints: [{x:20, y:5}, {x:0,  y:5}], dropPoint: {x:4, y:5} },
  ],
}
```

Exact waypoint lists are tuning territory; these are the starting authored paths. Adjust in playtesting.

---

## Loop integration

`src/main.js` updates to pass `dt` in seconds and drive update + render:

```js
import { CONFIG } from './config.js';
import { gameState } from './game/state.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { updateDrones, renderDrones } from './game/drones.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';

let prevMs = 0;

function frame(tMs) {
  const dt = prevMs ? (tMs - prevMs) / 1000 : 0;
  prevMs = tMs;

  updateDrones(gameState, dt);
  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderDrones(ctx, gameState);       // layers 8 + 9
  renderExplosions(ctx, gameState);   // layer 9
  renderChrome(ctx);                  // layer 11

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

`dt` may be large on the first frame or after tab-backgrounding — clamp to `Math.min(dt, 0.1)` inside update functions to prevent tunneling through waypoints.

---

## Update behavior per type

All three types share a common motion model: move toward `corridor.waypoints[wpIdx]` at the type's configured speed; when within ~2 px, advance `wpIdx`. Type-specific logic applies at spawn, on waypoint advance, and at end of corridor.

### ISR

- **Spawn:** set `x/y` to first waypoint's pixel position. `phase = 'cruise'`. Roll initial `jitterOffset`.
- **Per-waypoint arrival:** advance `wpIdx`. Re-roll `jitterOffset` within `±tileSize` perpendicular to heading.
- **Movement target:** `waypoint + jitterOffset` (offset applied only in virtual-pixel space).
- **End of corridor:** `phase = 'exiting'`. Velocity becomes `(0, +speed)`.
- **Despawn:** when `y > virtualHeight + 16` (clear the bottom edge).
- **Trail:** every ~3 frames of elapsed time (tracked via `trailSampleTimer` crossing 50 ms), push `{x, y, age: 0}`. Age each sample by `dt`. Drop samples when `age > 1.2 s` (≈ 72 px at 60 px/s). Cap length at 8.

### OWA

- **Spawn:** first waypoint. `phase = 'cruise'`. `targetId = corridor.targetStructureId`. No trail state.
- **Waypoint advance:** follow like ISR, no jitter.
- **Last waypoint reached:** `phase = 'terminal'`. Compute vector from current position to target structure's pixel center; set velocity to `normalize(v) * speed`.
- **Commit line (render-only side effect):** when entering `'terminal'`, set `commitLineFrame = 1` so render emits a one-frame amber line.
- **Arrival condition:** distance to target structure center `< 8 px`. Push `{x: droneX, y: droneY, frame: 0}` into `gameState.explosions`. Splice drone out.

### Payload-Delivery

- **Spawn:** first waypoint (off-grid W or E). `phase = 'cruise'`. No trail, no terminal commit.
- **Waypoint advance:** standard. No jitter.
- **Drop-point arrival:** when distance to `dropPoint` (pixel center) `< 8 px`, push explosion and splice.

### Safety clamp

Any drone that somehow escapes the grid without hitting an arrival condition (e.g. bad corridor authoring) despawns when `x < -24 || x > virtualWidth + 24 || y > virtualHeight + 24`. Off-grid northward (`y < -24`) is acceptable because ISR corridors start above the grid.

---

## Trails + commit line rendering

- **ISR trail:** for each sample, fill a 2×2 px rectangle at `(sample.x, sample.y)` in threat-red, alpha ≈ `1 - age/1.2` (quantized to 3 levels to stay pixel-art). Oldest first, so newer samples overdraw.
- **OWA commit line:** when `drone.phase === 'terminal'` and `commitLineFrame > 0`, stroke a 1-px amber line from drone position to target structure center. Decrement; line stops rendering after 1 frame.
- **Drones:** placeholder sprites per `STYLE.md:173`:
  - ISR: 16×16 threat-red square with cyan pixel at top-center (eye).
  - OWA: 16×16 threat-red square with amber pixel at the "front" (direction of travel).
  - Payload: 16×16 threat-red square with amber pixel at center.

No animation frames in this plan (`STYLE.md` spec has 2-frame animations — defer to polish plan).

---

## Explosions (`src/game/explosions.js`)

```js
export function updateExplosions(state, dt) {
  for (const e of state.explosions) {
    e.frameTimer += dt * 1000;
    while (e.frameTimer >= 80 && e.frame < 3) {
      e.frameTimer -= 80;
      e.frame += 1;
    }
  }
  state.explosions = state.explosions.filter(e => e.frame < 3);
}

export function renderExplosions(ctx, state) {
  for (const e of state.explosions) {
    const color = e.frame === 0 ? CONFIG.colors.alertAmber : CONFIG.colors.threatRed;
    const size = e.frame === 0 ? 8 : (e.frame === 1 ? 12 : 6);
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(e.x - size/2), Math.floor(e.y - size/2), size, size);
  }
}
```

80 ms per frame × 3 frames ≈ 240 ms total — reads as a sharp snap, not a fade.

---

## Dev auto-spawner

Temporary. Lives inside `updateDrones` as the first step. Config:

```js
// src/config.js (append)
devSpawner: {
  enabled: true,                                           // set false when wave system lands
  intervalMs: { isr: 3000, owa: 5000, payloadDelivery: 7000 },
},
```

Logic (pseudocode):

```js
if (!CONFIG.devSpawner.enabled) return;
for (const type of ['isr', 'owa', 'payloadDelivery']) {
  state.devSpawnTimer[type] += dt * 1000;
  if (state.devSpawnTimer[type] >= CONFIG.devSpawner.intervalMs[type]) {
    state.devSpawnTimer[type] -= CONFIG.devSpawner.intervalMs[type];
    spawnDrone(state, type);
  }
}
```

`spawnDrone(state, type)` picks `corridorIdx = spawnRotation[type] % MAP.corridors[type].length`, increments the rotation counter, instantiates the drone object, pushes to `state.drones`.

When the wave system arrives, delete the `devSpawner` block from config (or flip `enabled: false`) and the auto-spawner no-ops.

**Important:** the dev spawner ignores `MAP.spawnEdges.*.active` so we can see all three types during dev. The wave system will use those flags correctly.

---

## Interface boundaries

- `state.js` exposes the data. No logic.
- `drones.js` exposes `updateDrones(state, dt)` and `renderDrones(ctx, state)`. Reads from `MAP`, `CONFIG`, `state`. Mutates `state`. Nothing else.
- `explosions.js` exposes `updateExplosions(state, dt)` and `renderExplosions(ctx, state)`. Same rules.
- `main.js` orchestrates — no business logic.

A future plan (defenses) can read `state.drones` to find targets without touching the internals of drone update.

---

## Verification

Per `CLAUDE.md:61`, manual.

1. `npx serve` → load page.
2. **Within 3–7 s:** one ISR drone visible walking southward from the N edge, weaving side-to-side. Its trail fades behind it in dim red.
3. **Within 8–12 s:** second and third ISR drones have spawned from different N corridors; all three walking distinct paths. First ISR exits south and despawns (doesn't pile up at the bottom).
4. **Within 5–10 s:** first OWA drone spawns at S edge, moves straight north, reaches a waypoint, and visibly locks onto a structure (1-frame amber line). Reaches structure → 3-frame explosion → gone.
5. **Within 7–15 s:** first Payload drone enters from W or E, crosses horizontally, explodes at its drop point.
6. **60-second soak test:** no drones pile up, no console errors, frame rate stable (the exploded drones should be spliced out cleanly — check `state.drones.length` in the console stays bounded).
7. **Add a `PLAYTESTS.md` entry** after verification with observed behavior.

## Open technical items (flagged for implementation plan — not blocking this spec)

- Exact jitter magnitude for ISR is tuning territory. Starts at ±12 px (half a tile); adjust in the tuning pass (`TODO.md` step 8).
- Trail sample rate (50 ms / 3-frame-ish) and length (8 samples) are starting points. May need tuning for visual weight.
- `dt` clamp value (100 ms) is defensive; revisit if drones visibly lag after tab-backgrounding.
