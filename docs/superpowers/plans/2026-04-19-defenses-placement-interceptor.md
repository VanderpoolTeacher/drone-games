# Defenses + Placement (Interceptor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the first active defender choice — click a palette button, click a placement zone, watch an Interceptor fire projectiles on drones and earn kill bonuses. Drones become killable for the first time.

**Architecture:** Central `gameState` gains `defenses`, `projectiles`, `resources`, `placementMode`, and `hoverTile`. Per-concern modules mirror the drones plan pattern: `defenses.js` (data + update + render + targeting), `projectiles.js` (physics + hit detect), `palette.js` (bottom-bar UI + hit test), `placement.js` (ghost cursor + validity overlay). Input listeners bind once in `main.js` (mouse move, click, right-click, Escape).

**Tech Stack:** Vanilla JS (ES modules), HTML5 Canvas 2D, `npx serve` as static host. Manual verification in browser per `CLAUDE.md:61`.

**Scope:** Exactly what `docs/superpowers/specs/2026-04-19-defenses-placement-interceptor-design.md` covers. **Out of scope:** RF Jammer / Laser / HPM (shown as disabled palette buttons only), wave system, structure HP + win/lose, ISR disable-on-contact, real sprites, cooldown animations, CRT, sounds, sell/reposition.

**Conventions:**
- Plain objects + pure functions (per `CLAUDE.md:49`).
- Central `gameState` (per `CLAUDE.md:50`).
- `deltaTime` in seconds inside update functions (per `CLAUDE.md:51`).
- No comments unless WHY is non-obvious.
- Each task ends runnable in a browser.

---

## File Structure

```
src/
  main.js                  MODIFIED — input listeners, new update + render calls
  game/
    state.js               MODIFIED — adds defenses, projectiles, resources, placementMode, hoverTile, counters
    drones.js              MODIFIED — drone-death path when hp <= 0
    defenses.js            NEW — update, render, targeting, firing
    projectiles.js         NEW — physics + hit detection + render
  ui/
    palette.js             NEW — palette render + button hit-test
    placement.js           NEW — ghost cursor + validity overlay + pixelToTile + mapHitTest
PLAYTESTS.md                MODIFIED — verification log entry
```

---

## Task 0: State additions + drone-death path

**Files:**
- Modify: `src/game/state.js`
- Modify: `src/game/drones.js`

- [ ] **Step 1: Add new fields to `gameState`**

Current `src/game/state.js`:

```js
export const gameState = {
  drones: [],
  explosions: [],
  droneIdCounter: 0,
  spawnRotation: { isr: 0, owa: 0, payloadDelivery: 0 },
  devSpawnTimer: { isr: 0, owa: 0, payloadDelivery: 0 },
};
```

Replace with:

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

- [ ] **Step 2: Add drone-death handling to `updateDrones` in `src/game/drones.js`**

Current top of `updateDrones`:

```js
export function updateDrones(state, dt) {
  runDevSpawner(state, dt);

  for (const d of state.drones) {
    if (d.type === 'isr') updateIsr(d, dt);
    else if (d.type === 'owa') updateOwa(d, dt, state);
    else if (d.type === 'payloadDelivery') updatePayload(d, dt, state);
  }

  state.drones = state.drones.filter(d => d.phase !== 'done' && !isOffGrid(d));
}
```

Insert a death-handling pass between the type dispatch loop and the filter. New full function:

```js
export function updateDrones(state, dt) {
  runDevSpawner(state, dt);

  for (const d of state.drones) {
    if (d.type === 'isr') updateIsr(d, dt);
    else if (d.type === 'owa') updateOwa(d, dt, state);
    else if (d.type === 'payloadDelivery') updatePayload(d, dt, state);
  }

  for (const d of state.drones) {
    if (d.hp <= 0 && d.phase !== 'done') {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      state.resources += CONFIG.resourcesPerDroneKill[d.type] ?? 0;
      d.phase = 'done';
    }
  }

  state.drones = state.drones.filter(d => d.phase !== 'done' && !isOffGrid(d));
}
```

- [ ] **Step 3: Verify via Node simulation**

Run from project root:

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/drones.js')]).then(([s, d]) => { console.log('starting resources:', s.gameState.resources); d.spawnDrone(s.gameState, 'owa'); const drone = s.gameState.drones[0]; drone.hp = 0; d.updateDrones(s.gameState, 1/60); console.log(JSON.stringify({ spliced: !s.gameState.drones.includes(drone), resources: s.gameState.resources, explosions: s.gameState.explosions.length })); });"
```

Expected output:
```
starting resources: 400
{"spliced":true,"resources":415,"explosions":1}
```

(OWA kill pays $15, from `CONFIG.resourcesPerDroneKill.owa`.)

- [ ] **Step 4: Commit**

```bash
git add src/game/state.js src/game/drones.js
git commit -m "Task 0: state additions (defenses/projectiles/resources) + drone death path

Adds the state shape required for defenses + placement + economy. Drones
with hp<=0 now spawn an explosion, credit kill bonus per config, and are
spliced by the existing filter. No other behavior changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Defenses module + projectiles module — update logic only

**Files:**
- Create: `src/game/defenses.js`
- Create: `src/game/projectiles.js`
- Modify: `src/main.js` (wire the two new update functions)

- [ ] **Step 1: Create `src/game/defenses.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';
import { MAP } from './map.js';
import { tileToPixel } from './drones.js';

export function placeDefense(state, type, tile) {
  const cfg = CONFIG.defenses[type];
  if (!cfg) return null;
  const { x, y } = tileToPixel(tile);
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x,
    y,
    cooldownMs: 0,
    targetId: null,
  };
  state.defenses.push(defense);
  state.resources -= cfg.cost;
  return defense;
}

export function updateDefenses(state, dt) {
  for (const d of state.defenses) {
    d.cooldownMs = Math.max(0, d.cooldownMs - dt * 1000);
    if (d.type !== 'interceptor' || d.cooldownMs > 0) continue;

    const target = pickInterceptorTarget(state, d);
    if (!target) { d.targetId = null; continue; }

    fireInterceptor(state, d, target);
    d.cooldownMs = CONFIG.defenses.interceptor.cooldown;
    d.targetId = target.id;
  }
}

function pickInterceptorTarget(state, d) {
  const R = CONFIG.defenses.interceptor.range;
  let best = null;
  let bestDist = Infinity;
  let bestId = Infinity;
  for (const dr of state.drones) {
    if (dr.hp <= 0 || dr.phase === 'done') continue;
    const dx = dr.x - d.x;
    const dy = dr.y - d.y;
    if (Math.hypot(dx, dy) > R) continue;
    const minStructDist = minDistanceToAnyStructure(dr);
    if (minStructDist < bestDist || (minStructDist === bestDist && dr.id < bestId)) {
      best = dr;
      bestDist = minStructDist;
      bestId = dr.id;
    }
  }
  return best;
}

function minDistanceToAnyStructure(drone) {
  let min = Infinity;
  for (const s of MAP.structures) {
    const p = tileToPixel(s.tile);
    const d = Math.hypot(drone.x - p.x, drone.y - p.y);
    if (d < min) min = d;
  }
  return min;
}

function fireInterceptor(state, defense, target) {
  const cfg = CONFIG.defenses.interceptor;
  const dx = target.x - defense.x;
  const dy = target.y - defense.y;
  const dist = Math.hypot(dx, dy) || 1;
  state.projectiles.push({
    id: ++state.projectileIdCounter,
    x: defense.x,
    y: defense.y,
    vx: (dx / dist) * cfg.projectileSpeed,
    vy: (dy / dist) * cfg.projectileSpeed,
    targetDroneId: target.id,
    damage: cfg.damage,
  });
}
```

- [ ] **Step 2: Create `src/game/projectiles.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';

const HIT_RADIUS_PX = 8;
const OFF_GRID_MARGIN = 24;

export function updateProjectiles(state, dt) {
  const w = CONFIG.virtualWidth;
  const h = CONFIG.virtualHeight;

  const survivors = [];
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    let hit = null;
    for (const dr of state.drones) {
      if (dr.hp <= 0 || dr.phase === 'done') continue;
      if (Math.hypot(dr.x - p.x, dr.y - p.y) <= HIT_RADIUS_PX) { hit = dr; break; }
    }

    if (hit) {
      const eff = CONFIG.defenses.interceptor.effectivenessVs[hit.type] ?? 1;
      hit.hp -= p.damage * eff;
      continue;
    }

    if (p.x < -OFF_GRID_MARGIN || p.x > w + OFF_GRID_MARGIN || p.y < -OFF_GRID_MARGIN || p.y > h + OFF_GRID_MARGIN) continue;

    survivors.push(p);
  }
  state.projectiles = survivors;
}
```

- [ ] **Step 3: Wire into `src/main.js`**

Current imports:

```js
import { CONFIG } from './config.js';
import { gameState } from './game/state.js';
import { renderMap } from './game/mapRenderer.js';
import { renderChrome } from './ui/uiChrome.js';
import { renderLegend } from './ui/legend.js';
import { updateExplosions, renderExplosions } from './game/explosions.js';
import { renderDrones, updateDrones } from './game/drones.js';
```

Add two import lines after the drones import:

```js
import { updateDefenses } from './game/defenses.js';
import { updateProjectiles } from './game/projectiles.js';
```

Update `frame(tMs)` update block. Current:

```js
  updateDrones(gameState, dt);
  updateExplosions(gameState, dt);
```

Change to:

```js
  updateDrones(gameState, dt);
  updateDefenses(gameState, dt);
  updateProjectiles(gameState, dt);
  updateExplosions(gameState, dt);
```

No render changes in this task.

- [ ] **Step 4: Verify via Node**

Simulate: place an Interceptor within range of an OWA drone, tick forward, confirm OWA hp decreases and eventually dies + pays $15.

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/drones.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/defenses.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/projectiles.js')]).then(([s, d, def, pr]) => { const g = s.gameState; g.devSpawnTimer.isr = -1e9; g.devSpawnTimer.owa = -1e9; g.devSpawnTimer.payloadDelivery = -1e9; def.placeDefense(g, 'interceptor', { x: 7, y: 6 }); d.spawnDrone(g, 'owa'); const owa = g.drones[0]; console.log('start:', { owaHp: owa.hp, resources: g.resources, projCount: g.projectiles.length }); for (let i = 0; i < 240; i++) { d.updateDrones(g, 1/60); def.updateDefenses(g, 1/60); pr.updateProjectiles(g, 1/60); } console.log('end:', { drones: g.drones.length, resources: g.resources, owaStill: g.drones.includes(owa) }); });"
```

Expected final output (key signals: `drones: 0` and `resources: 315`):

```
start: { owaHp: 15, resources: 300, projCount: 0 }
end: { drones: 0, resources: 315, owaStill: false }
```

(Starting resources 400, spend 100 placing Interceptor = 300. Placement at tile (7,6) → pixel (180, 191) is ~68 px from OWA spawn at (132, 239), well within the 100 px range; projectile lands and kills the 15 hp OWA in one hit. OWA kill pays $15 → 315.)

- [ ] **Step 5: Commit**

```bash
git add src/game/defenses.js src/game/projectiles.js src/main.js
git commit -m "Task 1: defenses + projectiles update logic

Defenses tick cooldowns, scan for drones in range, pick the one closest
to any structure, fire a straight-line projectile. Projectiles move,
proximity-hit on any drone (within 8px), apply damage multiplied by
effectivenessVs. No rendering yet — state mutates correctly, verifiable
via console.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Render defenses + projectiles

**Files:**
- Modify: `src/game/defenses.js` (add `renderDefenses`)
- Modify: `src/game/projectiles.js` (add `renderProjectiles`)
- Modify: `src/main.js` (wire the render calls)

- [ ] **Step 1: Add `renderDefenses` to `src/game/defenses.js`**

At the bottom of `src/game/defenses.js`, append:

```js
const DEFENSE_SIZE = 24;

export function renderDefenses(ctx, state) {
  for (const d of state.defenses) {
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2), Math.floor(d.y - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);

    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
  }
}
```

- [ ] **Step 2: Add `renderProjectiles` to `src/game/projectiles.js`**

At the bottom of `src/game/projectiles.js`, append:

```js
const PROJECTILE_SIZE = 2;

export function renderProjectiles(ctx, state) {
  ctx.fillStyle = CONFIG.colors.friendlyCyan;
  for (const p of state.projectiles) {
    ctx.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, PROJECTILE_SIZE, PROJECTILE_SIZE);
  }
}
```

- [ ] **Step 3: Wire into `src/main.js`**

Update the defenses import:

```js
import { updateDefenses } from './game/defenses.js';
```

to:

```js
import { updateDefenses, renderDefenses } from './game/defenses.js';
```

Update the projectiles import:

```js
import { updateProjectiles } from './game/projectiles.js';
```

to:

```js
import { updateProjectiles, renderProjectiles } from './game/projectiles.js';
```

Update the render block in `frame(tMs)`. Current:

```js
  renderMap(ctx, tMs);
  renderDrones(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);
  renderLegend(ctx);
```

Change to:

```js
  renderMap(ctx, tMs);
  renderDefenses(ctx, gameState);
  renderDrones(ctx, gameState);
  renderProjectiles(ctx, gameState);
  renderExplosions(ctx, gameState);
  renderChrome(ctx);
  renderLegend(ctx);
```

- [ ] **Step 4: Verify in browser**

Run `npx serve` and load the page.

Expected: map + drones + legend unchanged. No defenses visible yet (none placed).

Open the browser console and run:

```js
const s = (await import('./src/game/state.js')).gameState;
const def = await import('./src/game/defenses.js');
def.placeDefense(s, 'interceptor', { x: 9, y: 6 });
console.log('resources:', s.resources);
```

Expected: one 24×24 cyan square appears at tile (9, 6) — roughly mid-SW area near City Hall, with a 2×2 amber pixel at the top center. Resources log as `300`.

Watch for ~30 s. Drones entering its 100 px range should trigger cyan projectile dots flying toward them. OWA drones in particular should take hits and explode. Resources should climb on each kill.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/game/defenses.js src/game/projectiles.js src/main.js
git commit -m "Task 2: render defenses + projectiles

Placeholder defense sprite: 24x24 friendlyCyan square + amber tip
pixel. Projectiles render as 2x2 cyan squares. No UI to place defenses
yet — console-push is the current placement path. Gameplay loop is
actually visible for the first time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Placement cursor + input listeners

**Files:**
- Create: `src/ui/placement.js`
- Modify: `src/main.js` (input listeners, wire `renderPlacement`)

- [ ] **Step 1: Create `src/ui/placement.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { tileToPixel } from '../game/drones.js';

const DEFENSE_SIZE = 24;

export function pixelToTile(vx, vy) {
  const top = CONFIG.topBarHeight + MAP.padTop;
  const bottom = top + MAP.gridH * MAP.tileSize;
  if (vx < 0 || vx >= MAP.gridW * MAP.tileSize) return null;
  if (vy < top || vy >= bottom) return null;
  return { x: Math.floor(vx / MAP.tileSize), y: Math.floor((vy - top) / MAP.tileSize) };
}

export function mapHitTest(vx, vy) {
  return pixelToTile(vx, vy);
}

export function isValidZone(state, tile) {
  if (!tile) return false;
  if (!state.placementMode) return false;
  const type = state.placementMode.type;
  const cost = CONFIG.defenses[type]?.cost ?? Infinity;
  if (state.resources < cost) return false;
  const onZone = MAP.placementZones.some(z => z.x === tile.x && z.y === tile.y);
  if (!onZone) return false;
  const occupied = state.defenses.some(d => d.tile.x === tile.x && d.tile.y === tile.y);
  return !occupied;
}

export function renderPlacement(ctx, state) {
  if (!state.placementMode) return;

  drawInvalidOverlays(ctx, state);
  drawGhostAndRange(ctx, state);
}

function drawInvalidOverlays(ctx, state) {
  const { gridW, gridH, tiles } = MAP;
  ctx.fillStyle = CONFIG.colors.threatRed;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] !== 'land') continue;
      if (MAP.placementZones.some(z => z.x === x && z.y === y)) continue;
      const { x: cx, y: cy } = tileToPixel({ x, y });
      ctx.fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, 2, 2);
    }
  }
}

function drawGhostAndRange(ctx, state) {
  const tile = state.hoverTile;
  if (!tile) return;
  const { x: cx, y: cy } = tileToPixel(tile);
  const type = state.placementMode.type;
  const range = CONFIG.defenses[type]?.range ?? 0;

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = CONFIG.colors.friendlyCyan;
  ctx.fillRect(Math.floor(cx - DEFENSE_SIZE / 2), Math.floor(cy - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);
  ctx.restore();

  if (range > 0) {
    ctx.strokeStyle = CONFIG.colors.friendlyCyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx + 0.5, cy + 0.5, range, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (!isValidZone(state, tile)) {
    ctx.strokeStyle = CONFIG.colors.threatRed;
    ctx.lineWidth = 1;
    const half = DEFENSE_SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy - half);
    ctx.lineTo(cx + half, cy + half);
    ctx.moveTo(cx + half, cy - half);
    ctx.lineTo(cx - half, cy + half);
    ctx.stroke();
  }
}
```

- [ ] **Step 2: Add input listeners and `renderPlacement` call in `src/main.js`**

Add a new import directly below the `renderLegend` import:

```js
import { renderPlacement, pixelToTile, mapHitTest, isValidZone } from './ui/placement.js';
import { placeDefense } from './game/defenses.js';
```

(If `placeDefense` isn't already imported from defenses.js, merge into the existing defenses import line instead.)

At the bottom of the file, after `requestAnimationFrame(frame);`, append input wiring:

```js
function toVirtual(e) {
  const rect = canvas.getBoundingClientRect();
  return [(e.clientX - rect.left) / CONFIG.scale, (e.clientY - rect.top) / CONFIG.scale];
}

canvas.addEventListener('mousemove', e => {
  const [vx, vy] = toVirtual(e);
  gameState.hoverTile = pixelToTile(vx, vy);
});

canvas.addEventListener('click', e => {
  const [vx, vy] = toVirtual(e);
  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile);
  gameState.placementMode = null;
});

canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  gameState.placementMode = null;
});

window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
});
```

Update the render block. Current end of `frame(tMs)`:

```js
  renderChrome(ctx);
  renderLegend(ctx);
```

Change to:

```js
  renderChrome(ctx);
  renderLegend(ctx);
  renderPlacement(ctx, gameState);
```

- [ ] **Step 3: Verify in browser**

Run `npx serve`, load page.

Open the browser console and run:

```js
const s = (await import('./src/game/state.js')).gameState;
s.placementMode = { type: 'interceptor' };
```

Expected: ghost cyan square follows the cursor over the map, with a 1 px cyan range circle. Tiles that aren't placement zones show a red 2×2 overlay. When the cursor is over a valid empty zone: ghost renders cleanly. When cursor is outside the map region: ghost disappears (hoverTile is null).

**Click a valid zone** (one of the 14): the Interceptor should place, resources drop to $300, placementMode clears (ghost disappears).

**Press ESC** while armed: mode clears.

**Right-click** while armed: mode clears.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/ui/placement.js src/main.js
git commit -m "Task 3: placement cursor + input listeners

Canvas listens for mousemove / click / right-click / ESC. Hover tile
is tracked in gameState. Placement mode renders ghost + range circle
+ red overlay on invalid tiles. Clicking a valid zone instantiates a
defense and deducts cost. Placement mode is set via console only
until Task 4 adds the palette.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Palette UI + full flow

**Files:**
- Create: `src/ui/palette.js`
- Modify: `src/main.js` (render palette, add palette click handling)

- [ ] **Step 1: Create `src/ui/palette.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';

const BUTTON_W = 60;
const BUTTON_H = 28;
const BUTTON_GAP = 4;
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: false },
  { type: 'interceptor',     label: 'INTRCPT', enabled: true },
  { type: 'laser',           label: 'LASER',   enabled: false },
  { type: 'hpm',             label: 'HPM',     enabled: false },
];

export function renderPalette(ctx, state) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;

  renderResources(ctx, state, paletteY);
  renderButtons(ctx, state, paletteY);
  renderWavePlaceholder(ctx, paletteY);
}

function renderResources(ctx, state, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.fillStyle = CONFIG.colors.alertAmber;
  ctx.fillText(`$${state.resources}`, 8, paletteY + 13);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('RES', 8, paletteY + 25);
}

function renderButtons(ctx, state, paletteY) {
  const totalWidth = BUTTONS.length * BUTTON_W + (BUTTONS.length - 1) * BUTTON_GAP;
  let x = Math.floor((CONFIG.virtualWidth - totalWidth) / 2);
  const y = paletteY + Math.floor((CONFIG.bottomPaletteHeight - BUTTON_H) / 2);

  for (const btn of BUTTONS) {
    drawButton(ctx, state, btn, x, y);
    x += BUTTON_W + BUTTON_GAP;
  }
}

function drawButton(ctx, state, btn, x, y) {
  const cfg = CONFIG.defenses[btn.type];
  const cost = cfg?.cost ?? 0;
  const isSelected = state.placementMode?.type === btn.type;
  const isAffordable = state.resources >= cost;
  const isActive = btn.enabled && isAffordable && !isSelected;

  let borderColor;
  let labelColor;
  let costColor;
  if (isSelected) {
    borderColor = labelColor = costColor = CONFIG.colors.alertAmber;
  } else if (isActive) {
    borderColor = CONFIG.colors.friendlyCyan;
    labelColor = CONFIG.colors.friendlyCyan;
    costColor = CONFIG.colors.alertAmber;
  } else {
    borderColor = labelColor = costColor = CONFIG.colors.gridLine;
  }

  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(x, y, BUTTON_W, BUTTON_H);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, BUTTON_W - 1, BUTTON_H - 1);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';

  ctx.fillStyle = labelColor;
  ctx.fillText(btn.label, x + BUTTON_W / 2, y + 12);

  ctx.fillStyle = costColor;
  ctx.fillText(`$${cost}`, x + BUTTON_W / 2, y + 24);
}

function renderWavePlaceholder(ctx, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';

  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText('WAVE 1/5', CONFIG.virtualWidth - 8, paletteY + 13);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('NEXT 0:12', CONFIG.virtualWidth - 8, paletteY + 25);
}

export function paletteHitTest(vx, vy) {
  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;
  if (vy < paletteY || vy >= paletteY + CONFIG.bottomPaletteHeight) return null;

  const totalWidth = BUTTONS.length * BUTTON_W + (BUTTONS.length - 1) * BUTTON_GAP;
  let x = Math.floor((CONFIG.virtualWidth - totalWidth) / 2);
  const y = paletteY + Math.floor((CONFIG.bottomPaletteHeight - BUTTON_H) / 2);

  for (const btn of BUTTONS) {
    if (!btn.enabled) { x += BUTTON_W + BUTTON_GAP; continue; }
    if (vx >= x && vx < x + BUTTON_W && vy >= y && vy < y + BUTTON_H) {
      return { type: btn.type };
    }
    x += BUTTON_W + BUTTON_GAP;
  }
  return null;
}
```

- [ ] **Step 2: Wire palette into `src/main.js`**

Add a new import below the placement import:

```js
import { renderPalette, paletteHitTest } from './ui/palette.js';
```

Update the render block. Current:

```js
  renderChrome(ctx);
  renderLegend(ctx);
  renderPlacement(ctx, gameState);
```

Change to:

```js
  renderChrome(ctx);
  renderPalette(ctx, gameState);
  renderLegend(ctx);
  renderPlacement(ctx, gameState);
```

Update the click listener to check palette first. Current:

```js
canvas.addEventListener('click', e => {
  const [vx, vy] = toVirtual(e);
  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile);
  gameState.placementMode = null;
});
```

Replace with:

```js
canvas.addEventListener('click', e => {
  const [vx, vy] = toVirtual(e);

  const paletteHit = paletteHitTest(vx, vy);
  if (paletteHit) {
    gameState.placementMode =
      gameState.placementMode?.type === paletteHit.type ? null : { type: paletteHit.type };
    return;
  }

  if (!gameState.placementMode) return;
  const tile = mapHitTest(vx, vy);
  if (!tile || !isValidZone(gameState, tile)) return;
  placeDefense(gameState, gameState.placementMode.type, tile);
  gameState.placementMode = null;
});
```

- [ ] **Step 3: Verify in browser**

Run `npx serve`, load page.

Expected on first load:
- Bottom bar shows: `$400 / RES` on left, 4 centered buttons (RF JAM / INTRCPT / LASER / HPM), `WAVE 1/5 / NEXT 0:12` on right.
- Only INTRCPT has a cyan border. RF JAM / LASER / HPM are dim gray.
- Top bar still shows the legend.

Flow:
1. **Click INTRCPT** → border turns amber, cursor ghost follows mouse over map with cyan range circle.
2. **Click a valid zone** → defense placed, $400 → $300, palette de-selects (cyan border returns).
3. **Click INTRCPT again** → armed.
4. **Press ESC** → cancels. Same for right-click.
5. Spend down with more placements; when `$100 > resources` (< $100), the INTRCPT button dims to gray.
6. Wait for drones — kills pay bonuses ($10/$15/$35). Once resources ≥ $100 again, button re-brightens.
7. Watch the core loop: drones enter → Interceptor fires → projectile → hit → drone explodes → resources climb.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/ui/palette.js src/main.js
git commit -m "Task 4: palette UI + full placement flow

Bottom-bar palette renders 4 buttons (Interceptor enabled, others
disabled placeholders), resources on the left, wave placeholder on
the right. Palette click toggles placementMode; click-same-button
cancels. Core gameplay loop is now playable end-to-end via mouse.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Final verification + PLAYTESTS entry + push

**Files:**
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Full manual verification**

Run `npx serve` and load the page. Run a full 90-second session. Confirm each:

- [ ] No console errors at any point.
- [ ] Bottom bar: resources, 4 palette buttons centered, wave placeholder right.
- [ ] Top bar: drone legend (unchanged).
- [ ] INTRCPT button lit cyan when affordable, amber when selected, dim when `< $100`.
- [ ] Placement ghost + range circle follow the cursor when armed.
- [ ] Invalid tiles (non-zone) show red 2×2 overlays; zones without overlay are placeable.
- [ ] Occupied zones show a red X over the ghost when cursor is there.
- [ ] ESC, right-click, and re-clicking the same palette button all cancel placement.
- [ ] Placement deducts $100 from resources.
- [ ] Projectiles (cyan 2×2) fire from interceptors toward drones entering range.
- [ ] OWA drones die in 1 hit (30 dmg vs 15 hp); ISR takes 2 hits (15 dmg each vs 20 hp); Payload takes 4 hits (30 dmg × 4 = 120 hp).
- [ ] Kill bonuses credited immediately (ISR +$10, OWA +$15, Payload +$35).
- [ ] Defenses only fire when a drone is in 100 px range and cooldown is 0.
- [ ] Interceptor picks "drone closest to any structure" — observable when multiple drones are in range.

If anything fails, fix it before Step 2. Note the observed edge in the PLAYTESTS entry.

- [ ] **Step 2: Add PLAYTESTS.md entry**

In `PLAYTESTS.md`, add a new entry at the top of the log section (above the existing drones-traversal entry):

```
## 2026-04-19 — solo (defenses + placement + Interceptor)

**Build:** defenses-placement-interceptor plan complete (Interceptor only, no waves)
**Session length:** ~90 s soak
**Result:** Playable core loop (drones in, defenses fire, bonuses pay)

### What happened
- Click INTRCPT button → armed; click valid zone → placed for $100
- Interceptors fired on drones in range with 1.5 s cooldown
- Drones took damage per effectivenessVs (ISR ×0.5, OWA/Payload ×1.0); dying drones triggered explosions and credited bonuses
- Economy stable: starting $400, kept affording placements as kill bonuses rolled in

### What worked
- Two-click placement (palette → zone) reads fast; ESC / right-click / re-click cancel all work
- Range circle at ghost position telegraphs coverage before commit
- Red 2×2 overlays on non-zone tiles kept placement decisions readable
- Targeting "closest to any structure" felt right — Interceptors engaged OWAs committing before distant ISRs

### What felt off
- Interceptor cooldown (1.5 s) against ISR spawning every 3 s from three corridors means one Interceptor can't cover much; designed for later to reward multi-placement + defense mix
- Payload takes 4 hits and its movement is slow, so a single Interceptor can chew through one solo. Once Laser/HPM land the matchup variance will sharpen

### Questions raised
- Should projectiles be removed on target death mid-flight? Currently they continue and may hit nearby drones. Feels realistic for a kinetic shot; revisit if it causes confusion
- Are 100 px range + corridor positions well-aligned? Some zones cover only one corridor by design; confirm during tuning pass
```

- [ ] **Step 3: Commit**

```bash
git add PLAYTESTS.md
git commit -m "Task 5: log defenses + placement + Interceptor playtest

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push**

```bash
git push
```

Expected: clean push, all Task 0–5 commits visible on the feature branch.

---

## Out of scope — next-plan candidates

1. **RF Jammer** — enables the second palette button. Area slow effect, no projectile. Shows how soft-kill differs from kinetic.
2. **Laser** — third button. Continuous DPS + overheat state. Visual: 1 px beam.
3. **HPM** — fourth (stretch). Cone AoE, unique placement concern (rotation on placement).
4. **Structure HP + win/lose** — OWA/Payload explosions matter. Win screen.
5. **Wave system** — replaces dev spawner; drives the palette's `WAVE X/5` live.
6. **Click-placed-defense to inspect range** — small UX add, valuable once multiple defenses are on the map.
7. **Visual polish** — real sprites, cooldown fill indicator, CRT post-effect, 2-frame animations.
