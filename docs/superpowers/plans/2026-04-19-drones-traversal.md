# Drones + Corridor Traversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement drone entities that spawn from map edges, traverse authored corridor waypoints per their type (ISR weaves, OWA terminal-commits, Payload crosses), render with placeholder sprites and per-type trails, and explode on arrival — all driven by a temporary dev auto-spawner so the result is visible in the browser.

**Architecture:** Central mutable `gameState` in `src/game/state.js`. Plain-object drone entities pushed into `state.drones`, updated each frame by per-type pure-ish helpers dispatched from `updateDrones(state, dt)`. Corridor waypoint data lives on `MAP.corridors` (filled into the empty slots from the map-foundation plan). Explosions get their own tiny module. No classes, no framework.

**Tech Stack:** Vanilla JS (ES modules), HTML5 Canvas 2D, `npx serve` as static host. No build step, no tests — verification is manual per `CLAUDE.md:61` (load page, watch for expected behavior).

**Scope:** Exactly what `docs/superpowers/specs/2026-04-19-drones-design.md` covers. **Out of scope:** wave system, defenses, placement, structure HP, win/lose, sounds, CRT. Those get their own plans.

**Conventions:**
- Plain objects + pure functions (per `CLAUDE.md:49`).
- One central game state object (per `CLAUDE.md:50`).
- `deltaTime` in seconds inside update functions; ms in config (per `CLAUDE.md:51`).
- No comments unless the WHY is non-obvious.
- All tunables in `src/config.js`.
- Each task ends runnable — open browser, see expected visual, commit.

---

## File Structure

```
src/
  config.js              MODIFIED — add devSpawner block
  main.js                MODIFIED — dt computation, wire update + render calls
  game/
    state.js             NEW — exports gameState object
    map.js               MODIFIED — fill corridor waypoint data (3 ISR, 3 OWA, 2 Payload)
    drones.js            NEW — updateDrones + renderDrones + per-type helpers + spawnDrone
    explosions.js        NEW — updateExplosions + renderExplosions (small, self-contained)
    mapRenderer.js       unchanged
  ui/
    uiChrome.js          unchanged
PLAYTESTS.md              MODIFIED — log verification session
```

---

## Task 0: Preflight — state.js, config, corridor data

**Files:**
- Create: `src/game/state.js`
- Modify: `src/config.js` (add `devSpawner` block)
- Modify: `src/game/map.js` (fill `corridors.isr`, `corridors.owa`, `corridors.payloadDelivery`)

- [ ] **Step 1: Create `src/game/state.js`**

Content (exact):

```js
export const gameState = {
  drones: [],
  explosions: [],
  droneIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
};
```

- [ ] **Step 2: Add `devSpawner` block to `src/config.js`**

Find the closing `};` of the `CONFIG` object in `src/config.js`. Directly above it, add:

```js
  devSpawner: {
    enabled: true,
    intervalMs: { isr: 3000, owa: 5000, payloadDelivery: 7000 },
  },
```

Make sure the preceding line (probably the `colors: { ... }` block's closing `},`) ends with a comma so the object literal stays valid. No other changes.

- [ ] **Step 3: Fill `MAP.corridors` in `src/game/map.js`**

Current `corridors` block:

```js
  corridors: {
    isr: [],
    owa: [],
    payloadDelivery: [],
  },
```

Replace with:

```js
  corridors: {
    isr: [
      { waypoints: [{ x: 2,  y: 0 }, { x: 3,  y: 2 }, { x: 5,  y: 4 }, { x: 4,  y: 6 }, { x: 5,  y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 10, y: 0 }, { x: 10, y: 2 }, { x: 9,  y: 4 }, { x: 10, y: 6 }, { x: 10, y: 8 }], exitEdge: 'S' },
      { waypoints: [{ x: 16, y: 0 }, { x: 15, y: 2 }, { x: 16, y: 4 }, { x: 15, y: 6 }, { x: 15, y: 8 }], exitEdge: 'S' },
    ],
    owa: [
      { waypoints: [{ x: 5,  y: 8 }, { x: 5,  y: 6 }], targetStructureId: 'cityHall' },
      { waypoints: [{ x: 9,  y: 8 }, { x: 9,  y: 5 }], targetStructureId: 'comms' },
      { waypoints: [{ x: 15, y: 8 }, { x: 15, y: 3 }], targetStructureId: 'power' },
    ],
    payloadDelivery: [
      { waypoints: [{ x: -1, y: 4 }, { x: 19, y: 4 }], dropPoint: { x: 9, y: 4 } },
      { waypoints: [{ x: 20, y: 5 }, { x: 0,  y: 5 }], dropPoint: { x: 4, y: 5 } },
    ],
  },
```

- [ ] **Step 4: Verify**

Run:
```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/map.js').then(m => { const c = m.MAP.corridors; console.log(JSON.stringify({ isr: c.isr.length, owa: c.owa.length, payload: c.payloadDelivery.length, owaTargets: c.owa.map(o => o.targetStructureId) })); });"
```

Expected: `{"isr":3,"owa":3,"payload":2,"owaTargets":["cityHall","comms","power"]}`

Also run:
```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/config.js').then(m => console.log(JSON.stringify(m.CONFIG.devSpawner)));"
```

Expected: `{"enabled":true,"intervalMs":{"isr":3000,"owa":5000,"payloadDelivery":7000}}`

- [ ] **Step 5: Commit**

```bash
git add src/game/state.js src/config.js src/game/map.js
git commit -m "Task 0: preflight — add gameState, devSpawner config, corridor waypoints

Creates src/game/state.js (single mutable state object), adds devSpawner
block to config (temporary, deleted when wave system lands), fills the
three corridor arrays on MAP.corridors with authored waypoints.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Explosions module (no drones yet, but wired in)

**Files:**
- Create: `src/game/explosions.js`
- Modify: `src/main.js` (import + call update + render)

- [ ] **Step 1: Create `src/game/explosions.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';

const FRAME_MS = 80;
const SIZES = [8, 12, 6];

export function updateExplosions(state, dt) {
  for (const e of state.explosions) {
    e.frameTimer += dt * 1000;
    while (e.frameTimer >= FRAME_MS && e.frame < 3) {
      e.frameTimer -= FRAME_MS;
      e.frame += 1;
    }
  }
  state.explosions = state.explosions.filter(e => e.frame < 3);
}

export function renderExplosions(ctx, state) {
  for (const e of state.explosions) {
    const color = e.frame === 0 ? CONFIG.colors.alertAmber : CONFIG.colors.threatRed;
    const size = SIZES[e.frame] ?? 0;
    if (size <= 0) continue;
    ctx.fillStyle = color;
    ctx.fillRect(Math.floor(e.x - size / 2), Math.floor(e.y - size / 2), size, size);
  }
}
```

- [ ] **Step 2: Wire into `src/main.js`**

Current `src/main.js`:

```js
import { CONFIG } from './config.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

function frame(tMs) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

Replace with:

```js
import { CONFIG } from './config.js';
import { gameState } from './game/state.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

let prevMs = 0;

function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 3: Verify in browser**

Start the server:
```bash
npx serve
```

Load the page. Expected: identical to the previous state (static map + chrome bars). `gameState.explosions` is empty so nothing new renders yet, but the render order now includes it.

Open the browser console and run:
```js
(await import('./src/game/state.js')).gameState.explosions.push({ x: 240, y: 135, frame: 0, frameTimer: 0 });
```

Expected: a 3-frame amber→red→gone flicker at the center of the map (~240 ms total), then nothing.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/game/explosions.js src/main.js
git commit -m "Task 1: add explosions module (3-frame amber→red→gone FX)

Wires updateExplosions/renderExplosions into the main loop. Adds dt
computation at the loop boundary (ms→seconds, clamped at 100 ms).
gameState.explosions is empty until drones start exploding in later
tasks; console-push works as a smoke test.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Drone render + spawnDrone (no motion yet)

**Files:**
- Create: `src/game/drones.js`
- Modify: `src/main.js` (import + call renderDrones)

- [ ] **Step 1: Create `src/game/drones.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';
import { MAP } from './map.js';

const DRONE_SIZE = 16;

export function spawnDrone(state, type) {
  const corridors = MAP.corridors[type];
  if (!corridors || corridors.length === 0) return null;

  const corridorIdx = state.spawnRotation[type] % corridors.length;
  state.spawnRotation[type] = (state.spawnRotation[type] + 1) % corridors.length;

  const corridor = corridors[corridorIdx];
  const first = corridor.waypoints[0];
  const { x, y } = tileToPixel(first);

  const cfg = CONFIG.drones[type];
  const drone = {
    id: ++state.droneIdCounter,
    type,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: cfg.hp,
    corridorIdx,
    wpIdx: 1,
    phase: 'cruise',
    targetId: type === 'owa' ? corridor.targetStructureId : null,
    dropPoint: type === 'payloadDelivery' ? corridor.dropPoint : null,
    jitterOffset: null,
    trail: type === 'isr' ? [] : null,
    trailSampleTimer: 0,
    commitLineFrame: 0,
  };
  state.drones.push(drone);
  return drone;
}

export function renderDrones(ctx, state) {
  for (const d of state.drones) {
    ctx.fillStyle = CONFIG.colors.threatRed;
    ctx.fillRect(Math.floor(d.x - DRONE_SIZE / 2), Math.floor(d.y - DRONE_SIZE / 2), DRONE_SIZE, DRONE_SIZE);

    const accent = accentFor(d.type);
    if (accent) {
      const { color, dx, dy } = accent;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(d.x) + dx, Math.floor(d.y) + dy, 2, 2);
    }
  }
}

function accentFor(type) {
  if (type === 'isr') return { color: CONFIG.colors.friendlyCyan, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
  if (type === 'owa') return { color: CONFIG.colors.alertAmber, dx: -1, dy: -DRONE_SIZE / 2 + 1 };
  if (type === 'payloadDelivery') return { color: CONFIG.colors.alertAmber, dx: -1, dy: -1 };
  return null;
}

export function tileToPixel(tile) {
  const { tileSize, padTop } = MAP;
  return {
    x: tile.x * tileSize + tileSize / 2,
    y: CONFIG.topBarHeight + padTop + tile.y * tileSize + tileSize / 2,
  };
}
```

- [ ] **Step 2: Wire `renderDrones` into `src/main.js`**

Add import (below existing explosions import):

```js
import { renderDrones } from './game/drones.js';
```

Update `frame(tMs)` to call `renderDrones` before `renderExplosions`:

```js
function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderDrones(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Verify**

Run `npx serve`, load the page. Expected: map unchanged (no drones yet).

Open console and run:
```js
const s = (await import('./src/game/state.js')).gameState;
const d = await import('./src/game/drones.js');
d.spawnDrone(s, 'isr');
d.spawnDrone(s, 'owa');
d.spawnDrone(s, 'payloadDelivery');
console.log(s.drones.map(x => ({id: x.id, type: x.type, x: x.x.toFixed(1), y: x.y.toFixed(1)})));
```

Expected console log:
```
[
  {id: 1, type: 'isr',              x: '60.0',   y: '47.0'},
  {id: 2, type: 'owa',              x: '132.0',  y: '239.0'},
  {id: 3, type: 'payloadDelivery',  x: '-12.0',  y: '143.0'}
]
```

Visually: one ISR drone (threat-red with cyan top pixel) at top of the map around col 2 row 0; one OWA drone (amber top pixel) at bottom around col 5 row 8; one Payload drone (amber center pixel) just off the left edge — the Payload is intentionally off-screen until motion lands. No motion.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/game/drones.js src/main.js
git commit -m "Task 2: add drones module — spawnDrone + renderDrones

Drones spawn at first corridor waypoint as plain objects on state.drones.
Round-robin corridor selection per type. Placeholder sprite: 16x16
threat-red square + single-pixel accent per type (ISR cyan top, OWA
amber top, Payload amber center). No motion yet; drones sit at their
spawn position.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Cruise motion — generic waypoint follower

**Files:**
- Modify: `src/game/drones.js` (add `updateDrones` + generic cruise motion)
- Modify: `src/main.js` (call `updateDrones`)

- [ ] **Step 1: Add `updateDrones` and motion helpers to `src/game/drones.js`**

At the top of `src/game/drones.js` (below the existing `import` lines), add a constant:

```js
const WAYPOINT_REACH_PX = 2;
```

At the bottom of the file, append:

```js
export function updateDrones(state, dt) {
  for (const d of state.drones) {
    advanceCruise(d, dt);
  }

  state.drones = state.drones.filter(d => !isOffGrid(d));
}

function advanceCruise(d, dt) {
  const corridor = MAP.corridors[d.type][d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  const target = tileToPixel(corridor.waypoints[d.wpIdx]);
  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= WAYPOINT_REACH_PX) {
    d.wpIdx += 1;
    return;
  }

  const speed = CONFIG.drones[d.type].speed;
  const step = speed * dt;
  if (step >= dist) {
    d.x = target.x;
    d.y = target.y;
    d.wpIdx += 1;
    return;
  }

  d.vx = (dx / dist) * speed;
  d.vy = (dy / dist) * speed;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}

function isOffGrid(d) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;
  return d.x < -24 || d.x > w + 24 || d.y < -24 || d.y > h + 24;
}
```

- [ ] **Step 2: Wire `updateDrones` into `src/main.js`**

Add import:

```js
import { renderDrones, updateDrones } from './game/drones.js';
```

(Adjust the existing `import { renderDrones } ...` line accordingly, so both symbols come from the same statement.)

In `frame(tMs)`, call `updateDrones` before `updateExplosions`:

```js
function frame(tMs) {
  const dtRaw = prevMs ? (tMs - prevMs) / 1000 : 0;
  const dt = Math.min(dtRaw, 0.1);
  prevMs = tMs;

  updateDrones(gameState, dt);
  updateExplosions(gameState, dt);

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderDrones(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Verify**

Run `npx serve`, load page.

Open console:
```js
const s = (await import('./src/game/state.js')).gameState;
const d = await import('./src/game/drones.js');
d.spawnDrone(s, 'isr');
d.spawnDrone(s, 'owa');
d.spawnDrone(s, 'payloadDelivery');
```

Watch for ~10 seconds.

Expected:
- ISR drone walks N→S following its corridor waypoints. Reaches last waypoint (around row 8 ≈ y=227), advances `wpIdx` past the array length, enters `'exiting'` phase — **but currently has no velocity,** so it stops at the last waypoint. (Cleaned up in Task 4.)
- OWA drone walks S→N along its corridor. Reaches last waypoint and stops there (terminal commit comes in Task 5).
- Payload drone moves W→E across the map, passes the last waypoint at `x=19 tiles`, continues off-grid east, despawns when `x > virtualWidth + 24`.

Console sanity:
```js
console.log(s.drones.map(x => ({type: x.type, x: x.x.toFixed(1), y: x.y.toFixed(1), wp: x.wpIdx, phase: x.phase})));
```
After 10 s, payload drone should no longer be in the list.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/game/drones.js src/main.js
git commit -m "Task 3: add generic cruise motion + waypoint follower

Drones now move at their configured speed toward their current waypoint,
advance wpIdx on arrival (within 2 px), and get spliced when fully off
grid. No per-type specialization yet — ISR doesn't weave, OWA doesn't
terminal-commit, Payload doesn't drop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Dev auto-spawner + ISR exit-south

**Files:**
- Modify: `src/game/drones.js` (add spawner logic to `updateDrones`, add `updateIsr` wrapper, handle exit-south)

- [ ] **Step 1: Replace `updateDrones` with a spawner-first dispatch version**

Find the existing `updateDrones` function in `src/game/drones.js`:

```js
export function updateDrones(state, dt) {
  for (const d of state.drones) {
    advanceCruise(d, dt);
  }

  state.drones = state.drones.filter(d => !isOffGrid(d));
}
```

Replace with:

```js
export function updateDrones(state, dt) {
  runDevSpawner(state, dt);

  for (const d of state.drones) {
    if (d.type === 'isr') updateIsr(d, dt);
    else if (d.type === 'owa') advanceCruise(d, dt);
    else if (d.type === 'payloadDelivery') advanceCruise(d, dt);
  }

  state.drones = state.drones.filter(d => !isOffGrid(d));
}

function runDevSpawner(state, dt) {
  if (!CONFIG.devSpawner || !CONFIG.devSpawner.enabled) return;
  const dtMs = dt * 1000;
  for (const type of ['isr', 'owa', 'payloadDelivery']) {
    state.devSpawnTimer[type] += dtMs;
    const interval = CONFIG.devSpawner.intervalMs[type];
    while (state.devSpawnTimer[type] >= interval) {
      state.devSpawnTimer[type] -= interval;
      spawnDrone(state, type);
    }
  }
}

function updateIsr(d, dt) {
  if (d.phase === 'exiting') {
    d.vx = 0;
    d.vy = CONFIG.drones.isr.speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return;
  }

  const corridor = MAP.corridors.isr[d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  advanceCruise(d, dt);
}
```

- [ ] **Step 2: Verify**

Run `npx serve`, load page. No console commands needed — the dev spawner runs on its own.

Expected over the first 30 seconds:
- At ~3 s: first ISR drone spawns at top, walks southward along corridor 0, reaches the last waypoint, enters exiting phase, continues south at ISR speed, exits the bottom edge.
- At ~5 s: first OWA drone spawns at bottom, walks northward. Stops at last waypoint (terminal commit comes in Task 5).
- At ~7 s: first Payload drone spawns off left edge, crosses the map, exits off right edge.
- At ~6 s: second ISR spawns (corridor 1), etc. Round-robin across 3 ISR corridors.
- OWA drones pile up at their last waypoints (expected — fixed in Task 5).
- Payload drones pass cleanly.

Open console:
```js
const s = (await import('./src/game/state.js')).gameState;
console.log({ drones: s.drones.length, byType: Object.fromEntries(['isr','owa','payloadDelivery'].map(t => [t, s.drones.filter(d => d.type === t).length])) });
```

After 30 s you should see:
- ISR: 0–2 (exit cleanly)
- OWA: 5–6 (piling up, expected)
- Payload: 0–1 (exit cleanly)

No console errors.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 4: dev auto-spawner + ISR exit-south

Spawner ticks via state.devSpawnTimer per type, uses CONFIG.devSpawner
intervals, spawns round-robin across each type's corridors. ISR now
has a dedicated updater that drops into 'exiting' phase past the last
waypoint and forces (0, +speed) until the drone clears the bottom
edge. OWA/Payload still use the generic cruise updater.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: ISR jitter + trails

**Files:**
- Modify: `src/game/drones.js` (ISR-specific jitter offset, trail sampling, trail rendering)

- [ ] **Step 1: Add jitter and trail state helpers**

In `src/game/drones.js`, add these constants at the top (below the existing `WAYPOINT_REACH_PX`):

```js
const ISR_JITTER_PX = 12;
const TRAIL_SAMPLE_MS = 50;
const TRAIL_MAX_SAMPLES = 8;
const TRAIL_MAX_AGE_S = 1.2;
```

At the bottom of the file, append:

```js
function rollIsrJitter() {
  return {
    dx: (Math.random() * 2 - 1) * ISR_JITTER_PX,
    dy: (Math.random() * 2 - 1) * ISR_JITTER_PX,
  };
}

function updateIsrTrail(d, dt) {
  d.trailSampleTimer += dt * 1000;
  while (d.trailSampleTimer >= TRAIL_SAMPLE_MS) {
    d.trailSampleTimer -= TRAIL_SAMPLE_MS;
    d.trail.push({ x: d.x, y: d.y, age: 0 });
    if (d.trail.length > TRAIL_MAX_SAMPLES) d.trail.shift();
  }
  for (const s of d.trail) s.age += dt;
  d.trail = d.trail.filter(s => s.age < TRAIL_MAX_AGE_S);
}
```

- [ ] **Step 2: Apply jitter in ISR motion; roll on spawn and per-waypoint**

In `spawnDrone`, find the drone object literal and change the `jitterOffset` assignment from:

```js
    jitterOffset: null,
```

to:

```js
    jitterOffset: type === 'isr' ? rollIsrJitter() : null,
```

(This requires `rollIsrJitter` to be defined. Since `spawnDrone` sits above the helper, move the helper — or more simply, keep `rollIsrJitter` as a regular `function` declaration so hoisting applies. It is, so the edit is safe.)

Now rewrite `updateIsr` to use the jittered target and re-roll on waypoint advance. Replace the existing `updateIsr`:

```js
function updateIsr(d, dt) {
  updateIsrTrail(d, dt);

  if (d.phase === 'exiting') {
    d.vx = 0;
    d.vy = CONFIG.drones.isr.speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return;
  }

  const corridor = MAP.corridors.isr[d.corridorIdx];
  if (d.wpIdx >= corridor.waypoints.length) {
    d.phase = 'exiting';
    return;
  }

  const waypointPx = tileToPixel(corridor.waypoints[d.wpIdx]);
  const target = {
    x: waypointPx.x + (d.jitterOffset?.dx ?? 0),
    y: waypointPx.y + (d.jitterOffset?.dy ?? 0),
  };

  const dx = target.x - d.x;
  const dy = target.y - d.y;
  const dist = Math.hypot(dx, dy);

  const speed = CONFIG.drones.isr.speed;

  if (dist <= WAYPOINT_REACH_PX) {
    d.wpIdx += 1;
    d.jitterOffset = rollIsrJitter();
    return;
  }

  const step = speed * dt;
  if (step >= dist) {
    d.x = target.x;
    d.y = target.y;
    d.wpIdx += 1;
    d.jitterOffset = rollIsrJitter();
    return;
  }

  d.vx = (dx / dist) * speed;
  d.vy = (dy / dist) * speed;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
}
```

- [ ] **Step 3: Render ISR trails**

Update the existing `renderDrones` to render trails first. Replace the entire function:

```js
export function renderDrones(ctx, state) {
  for (const d of state.drones) {
    if (d.type === 'isr' && d.trail?.length) {
      renderIsrTrail(ctx, d.trail);
    }
  }

  for (const d of state.drones) {
    ctx.fillStyle = CONFIG.colors.threatRed;
    ctx.fillRect(Math.floor(d.x - DRONE_SIZE / 2), Math.floor(d.y - DRONE_SIZE / 2), DRONE_SIZE, DRONE_SIZE);

    const accent = accentFor(d.type);
    if (accent) {
      const { color, dx, dy } = accent;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(d.x) + dx, Math.floor(d.y) + dy, 2, 2);
    }
  }
}

function renderIsrTrail(ctx, trail) {
  for (const s of trail) {
    const alphaStep = 1 - s.age / TRAIL_MAX_AGE_S;
    if (alphaStep <= 0) continue;
    ctx.fillStyle = quantizeTrailColor(alphaStep);
    ctx.fillRect(Math.floor(s.x - 1), Math.floor(s.y - 1), 2, 2);
  }
}

function quantizeTrailColor(alphaStep) {
  if (alphaStep > 0.66) return CONFIG.colors.threatRed;
  if (alphaStep > 0.33) return '#a0302c';
  return '#5a1b19';
}
```

- [ ] **Step 4: Verify**

Run `npx serve`, load page. Watch for ~30 s.

Expected:
- ISR drones visibly weave (not perfectly straight) as they walk south.
- Each ISR drone leaves a fading red trail of ~8 dots behind it; the trail fades in three discrete brightness steps (bright → mid → dim → gone). No smooth fade (pixel-art rule).
- Trail stays with the drone even during the `exiting` phase.
- OWA and Payload drones still behave as before (no trails, no jitter).

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 5: ISR jitter + 3-step fading trails

ISR drones now apply a ±12 px perpendicular jitter to each waypoint,
re-rolled on waypoint advance — sells the operator-flown weave.
Trails sample every 50 ms, cap at 8 samples, live 1.2 s; rendered as
a 3-level brightness step (bright → mid → dim → gone) in threat-red.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: OWA terminal commit + commit line + structure explosion

**Files:**
- Modify: `src/game/drones.js` (add `updateOwa`, commit-line rendering, structure collision)

- [ ] **Step 1: Add an OWA updater**

In `src/game/drones.js`, find the dispatch line inside `updateDrones`:

```js
    else if (d.type === 'owa') advanceCruise(d, dt);
```

Replace with:

```js
    else if (d.type === 'owa') updateOwa(d, dt, state);
```

At the bottom of the file, append:

```js
const OWA_ARRIVAL_PX = 8;

function updateOwa(d, dt, state) {
  if (d.commitLineFrame > 0) d.commitLineFrame -= 1;

  if (d.phase === 'cruise') {
    const corridor = MAP.corridors.owa[d.corridorIdx];
    if (d.wpIdx >= corridor.waypoints.length) {
      d.phase = 'terminal';
      d.commitLineFrame = 1;
      return;
    }
    advanceCruise(d, dt);
    return;
  }

  if (d.phase === 'terminal') {
    const target = structurePixelPos(d.targetId);
    if (!target) { d.phase = 'exiting'; return; }

    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= OWA_ARRIVAL_PX) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      d.phase = 'done';
      return;
    }

    const speed = CONFIG.drones.owa.speed;
    d.vx = (dx / dist) * speed;
    d.vy = (dy / dist) * speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
  }
}

function structurePixelPos(id) {
  const s = MAP.structures.find(x => x.id === id);
  if (!s) return null;
  return tileToPixel(s.tile);
}
```

- [ ] **Step 2: Splice drones whose phase is `'done'`**

In `updateDrones`, change the filter from:

```js
  state.drones = state.drones.filter(d => !isOffGrid(d));
```

to:

```js
  state.drones = state.drones.filter(d => d.phase !== 'done' && !isOffGrid(d));
```

- [ ] **Step 3: Render OWA commit lines**

Inside `renderDrones`, insert a second prelude loop (between the trail loop and the drone sprite loop):

```js
  for (const d of state.drones) {
    if (d.type === 'owa' && d.commitLineFrame > 0) {
      const target = structurePixelPos(d.targetId);
      if (target) {
        ctx.strokeStyle = CONFIG.colors.alertAmber;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(d.x + 0.5, d.y + 0.5);
        ctx.lineTo(target.x + 0.5, target.y + 0.5);
        ctx.stroke();
      }
    }
  }
```

Place this block right after the ISR-trail loop and before the drone sprite loop, so the line reads: trails → commit-lines → sprites.

- [ ] **Step 4: Verify**

Run `npx serve`, load page. Watch ~30 s.

Expected:
- OWA drones walk north along their corridor, reach last waypoint, and at that moment a 1-frame amber line flashes from the drone to the target structure.
- The drone then continues in a straight line toward the structure at OWA speed.
- When the drone reaches the structure (within 8 px), an explosion spawns and the drone disappears.
- OWA-0 → City Hall (SW), OWA-1 → Comms (center), OWA-2 → Power (NE). Confirms round-robin corridor selection.
- No piling up at last waypoints anymore.

Console sanity check:
```js
const s = (await import('./src/game/state.js')).gameState;
console.log({ total: s.drones.length, owa: s.drones.filter(d => d.type === 'owa').length });
```
After a minute, `owa` count should stay bounded (roughly 1–3), not climb.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 6: OWA terminal commit + explosion on structure

OWA drones transition cruise→terminal at the last waypoint, flash a
1-frame amber commit line toward their targeted structure, then fly
straight at it. On contact (8 px) they spawn an explosion and are
spliced from state.drones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Payload drop point → explosion

**Files:**
- Modify: `src/game/drones.js` (add `updatePayload`)

- [ ] **Step 1: Add a Payload updater**

In `src/game/drones.js`, find the dispatch line inside `updateDrones`:

```js
    else if (d.type === 'payloadDelivery') advanceCruise(d, dt);
```

Replace with:

```js
    else if (d.type === 'payloadDelivery') updatePayload(d, dt, state);
```

At the bottom of the file, append:

```js
const PAYLOAD_DROP_PX = 8;

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

- [ ] **Step 2: Verify**

Run `npx serve`, load page. Watch ~30 s.

Expected:
- Payload drones spawn off the W edge (corridor 0) or E edge (corridor 1), round-robin.
- They cross horizontally toward their drop point (W→E payload drops on comms at col 9 row 4; E→W drops near City Hall at col 4 row 5).
- When they reach within 8 px of the drop point, an explosion spawns and the drone disappears.
- No payload drone ever exits off-grid anymore (drop condition triggers inside the map region).

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 7: Payload drop point triggers explosion

Payload-Delivery drones keep the generic cruise motion but now also
check distance to their authored dropPoint each tick. On arrival
(8 px) they spawn an explosion and are spliced from state.drones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Final verification + PLAYTESTS.md entry + push

**Files:**
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Run the full manual verification checklist**

Run `npx serve` and load the page. Let it run for a full 60 seconds. Confirm each:

- [ ] No console errors at any point.
- [ ] First ISR spawns around 3 s from N edge; weaves visibly; leaves a fading red trail; exits bottom.
- [ ] ISR round-robin across 3 corridors (N-left, N-center, N-right).
- [ ] First OWA spawns around 5 s from S edge; travels straight N along corridor; flashes a 1-frame amber line at last waypoint; continues toward structure; explodes on contact.
- [ ] OWA round-robin targets City Hall (SW), Comms (center), Power (NE) in that order.
- [ ] First Payload spawns around 7 s from W or E edge; crosses horizontally; explodes at drop point (mid-map).
- [ ] Payload round-robin alternates W→E and E→W.
- [ ] Explosions render as 3-frame amber→red→gone (no tween).
- [ ] Drones don't pile up anywhere — running `gameState.drones.length` in console stays bounded (< 15 at any moment under default intervals).
- [ ] Map, structures, zones, chrome bars still render correctly (Task 0–7 map-foundation output intact).

If anything fails, fix it before continuing. Note any issues in the PLAYTESTS entry.

- [ ] **Step 2: Add PLAYTESTS.md entry**

In `PLAYTESTS.md`, add a new entry at the top of the log section (above the 2026-04-19 map-render entry) — newest at top per the file's convention:

```
## 2026-04-19 — solo (drones + corridor traversal)

**Build:** drones-traversal plan complete (no wave system / defenses yet)
**Session length:** ~2 min soak
**Result:** N/A (no gameplay loop yet; this tests threat-vector rendering)

### What happened
- Dev auto-spawner produces drones at 3s/5s/7s intervals for ISR/OWA/Payload
- All three drone types behaved per spec: ISR weaves N→S and exits, OWA terminal-commits to authored structure and explodes, Payload crosses W↔E and explodes on drop
- Trails, commit lines, explosions all render correctly

### What worked
- Round-robin corridor selection made coverage of all authored paths visible in the first ~15s
- ISR jitter reads as "operator-flown" without looking random
- 3-frame explosions feel snappy, not sluggish
- No drones piled up after 60s

### What felt off
- Payload dropPoint landing on top of a structure tile makes the explosion visually merge with the structure sprite — may need a drop offset or structure damage animation when that plan lands
- ISR trail at maximum length sometimes reads busier than expected when multiple ISR drones overlap — tuning candidate

### Questions raised
- Dev spawn intervals (3/5/7 s) feel paced for development, not gameplay. Will need re-tuning once wave system replaces the stub.
- Should Payload drones survive their drop and continue off-grid, or despawn at drop? Currently despawn; matches spec.
```

Keep the existing 2026-04-19 map-render entry below this new one.

- [ ] **Step 3: Commit**

```bash
git add PLAYTESTS.md
git commit -m "Task 8: log drones-traversal playtest session

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push branch to remote**

```bash
git push
```

Expected: clean push, all Task 0–8 commits visible in the GitHub repo.

---

## Out of scope — next-plan candidates

1. **Defenses + placement interaction** — unlocks ISR's "disable on contact" mechanic, adds palette/range/cone, makes drones killable.
2. **Wave system + pre-wave telegraphs** — replaces the dev spawner, runs waves 1–5, respects `MAP.spawnEdges.*.active`.
3. **Structure HP + win/lose** — makes OWA/Payload explosions actually matter.
4. **Animation polish** — 2-frame rotor/propulsion animations per `STYLE.md:56–66`, real structure sprites, CRT post-effect.
5. **Sound design** — drone buzz, explosions, commit-line alert (listed in `TODO.md`).
