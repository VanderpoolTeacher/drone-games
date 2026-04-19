# Map Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the static city map from the approved spec (`docs/superpowers/specs/2026-04-18-map-layout-design.md`) in a browser — land, water, coastline, three critical structures, 14 placement zones, UI chrome — as the foundation every later subsystem (drones, placement, waves) builds on.

**Architecture:** Vanilla HTML5 Canvas + ES modules, no build step. Boot code creates a 480×270 virtual canvas scaled 4× to fill 1920×1080, then runs a requestAnimationFrame loop that delegates to a map renderer. Map data is a plain object in `src/game/map.js`; rendering is split across `src/game/mapRenderer.js` (map layers) and `src/ui/uiChrome.js` (chrome bars).

**Tech Stack:** Vanilla JS (ES modules), HTML5 Canvas 2D, `npx serve` as static host. No framework, no bundler, no linter, no automated tests — verification is manual (load page, inspect visual, compare to spec).

**Scope:** Static map render only. **Out of scope for this plan:** drones, placement interaction, range/cone indicators, wave system, pre-wave telegraphs, tooltips, CRT post-effect, audio. These get their own plans later.

**Conventions:**
- Plain objects and pure functions — no classes. Per `CLAUDE.md:56`.
- No comments unless the *why* is non-obvious. Per user preference (brief-explanation mode).
- All tunables live in `src/config.js`. No magic numbers in render code.
- One logical change per commit.
- Verification is always: `npx serve` → load `http://localhost:3000` (or whichever port it picks) → visually confirm.

---

## File Structure

```
index.html                 NEW — entry, canvas element, <script type="module" src="./src/main.js">
src/
  config.js               MOVED from root, scale bumped 3→4
  main.js                 NEW — boot, canvas setup, render loop
  game/
    map.js                NEW — static map data
    mapRenderer.js        NEW — draws layers 1–5 (water, land, coastline, zones, structures)
  ui/
    uiChrome.js           NEW — draws top bar (24px) + bottom palette (32px), empty content
STYLE.md                   MODIFIED — fix "~11 tall" → "8 playable"
DECISIONS.md               MODIFIED — append entries for brainstorm outcomes
CLAUDE.md                  MODIFIED — update config.js path reference to src/config.js
PLAYTESTS.md               MODIFIED — add first session entry after verification
```

---

## Task 0: Preflight — reconcile docs with the spec

**Files:**
- Modify: `config.js` (move to `src/config.js`, change scale: 3 → 4)
- Modify: `STYLE.md:21`
- Modify: `DECISIONS.md`
- Modify: `CLAUDE.md` (structure section references to config.js path)

- [ ] **Step 1: Move config.js into src/**

```bash
mkdir -p src
git mv config.js src/config.js
```

Verify with `ls src/` — expect `config.js` present.

- [ ] **Step 2: Change scale from 3 to 4 in src/config.js**

In `src/config.js`, locate the rendering block:

```js
  // Rendering
  virtualWidth: 480,
  virtualHeight: 270,
  scale: 3,
  tileSize: 24,
  targetFPS: 60,
```

Change `scale: 3,` to `scale: 4,` (trailing comma preserved). No other changes.

- [ ] **Step 3: Fix STYLE.md grid line**

In `STYLE.md` line 21, replace:

```
- **Grid:** map logic runs on a 24 × 24 px tile grid (20 tiles wide × ~11 tall)
```

with:

```
- **Grid:** map logic runs on a 24 × 24 px tile grid. Playable area is **20 × 8 tiles** (480 × 192 px) — plus 24 px top bar and 32 px bottom palette per the UI layout block. 22 px residual vertical space splits as 11 px padding above and below the grid.
```

- [ ] **Step 4: Update CLAUDE.md structure block**

In `CLAUDE.md`, find the "Project structure (target)" code block (around line 37). Replace the line:

```
├── config.js           # All tunable values (currently at root; moves to src/ when src/ appears)
```

with:

```
├── src/config.js       # All tunable values
```

Remove the now-incorrect explanatory paragraph above the code block:

```
Currently only `config.js` and docs exist at root. As code lands, organize it like this:
```

Replace it with:

```
Code layout:
```

- [ ] **Step 5: Append DECISIONS.md entries**

Append below the `<!-- Add new entries below this line. Most recent at the bottom. -->` marker in `DECISIONS.md`:

```
2026-04-19 — Virtual resolution scale bumped 3× → 4× so 480×270 fills a 1920×1080 display fullscreen.

2026-04-19 — Playable grid locked at 20×8 tiles (480×192 px), not the "~11 tall" STYLE.md previously suggested. UI chrome (24 top + 32 bottom) is solid, not overlay — clearer and preserves full pixel budget for gameplay.

2026-04-19 — Map shape: coastal peninsula (downtown). Water on W, S, E edges (West River, South Harbor, East River); land on N edge representing inland. Chosen over full-borough variants for tile-budget reasons on a 20×8 grid.

2026-04-19 — Navigation model: geography-driven ingress corridors with per-drone-type path behavior (ISR weaves from N, OWA straight-line from S with terminal commit, Payload horizontal from W/E). Authored waypoint lists in map data, not procedural. Matches real C-UAS ingress doctrine.

2026-04-19 — Path visibility: pre-wave chevrons telegraph active edges + drone types; actual flight paths not drawn. Player learns routes by observation of the first drone of each corridor.

2026-04-19 — Placement zones: 14 hand-picked cells marked visually, not free placement. Keeps balance tractable for v1 and preserves the "rooftop/plaza" city read.
```

- [ ] **Step 6: Verify no broken config.js references**

Search for imports or path references to `config.js` at the root:

Run:
```bash
grep -rn "from ['\"].*config\.js['\"]" --include='*.js' --include='*.html' --include='*.md' .
```

Expected: no matches pointing to root `config.js`. The only surviving reference should be the documentation in CLAUDE.md pointing to `src/config.js`.

- [ ] **Step 7: Commit**

```bash
git add src/config.js STYLE.md CLAUDE.md DECISIONS.md
git commit -m "Task 0: reconcile docs with approved map spec

Move config.js into src/, bump scale 3→4 for 1920x1080, fix STYLE.md
grid dimensions, update CLAUDE.md structure, log brainstorm decisions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Scaffold index.html + main.js + render loop

**Files:**
- Create: `index.html`
- Create: `src/main.js`

- [ ] **Step 1: Create index.html**

Content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drone Defense</title>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #000;
      height: 100%;
      overflow: hidden;
      font-family: 'Press Start 2P', monospace;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    canvas {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      display: block;
    }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/main.js with canvas boot**

Content:

```js
import { CONFIG } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

function frame() {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 3: Verify in browser**

Run:
```bash
npx serve
```

Open the served URL. Expected: a 1920×1080 canvas (or browser-window-limited) filled with deep navy (#0d1b2a). No errors in console.

Stop the server with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.js
git commit -m "Task 1: boot canvas at 480x270 virtual, 4x scale, bgDark fill

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Create src/game/map.js with full static map data

**Files:**
- Create: `src/game/map.js`

- [ ] **Step 1: Create src/game/map.js**

Content:

```js
const TILE_STRING = `
LLLLLLLLLLLLLLLLLLLL
LLLLLLLLLLLLLLLLLLLL
WLLLLLLLLLLLLLLLLLLW
WLLLLLLLLLLLLLLLLLLW
WWLLLLLLLLLLLLLLLLWW
WWLLLLLLLLLLLLLLLLWW
WWWLLLLLLLLLLLLLLWWW
WWWWLLLLLLLLLLLWWWWW
`.trim().split('\n').map(row => row.split('').map(ch => ch === 'L' ? 'land' : 'water'));

export const MAP = {
  shape: 'coastalPeninsula',
  gridW: 20,
  gridH: 8,
  tileSize: 24,
  padTop: 11,
  padBottom: 11,
  tiles: TILE_STRING,
  structures: [
    { id: 'power',    type: 'power',    tile: { x: 16, y: 2 }, displayName: 'Power Substation' },
    { id: 'comms',    type: 'comms',    tile: { x: 9,  y: 4 }, displayName: 'Comms Tower' },
    { id: 'cityHall', type: 'cityHall', tile: { x: 4,  y: 6 }, displayName: 'City Hall' },
  ],
  placementZones: [
    { x: 1,  y: 1 }, { x: 6,  y: 1 }, { x: 11, y: 1 }, { x: 16, y: 1 },
    { x: 10, y: 2 }, { x: 13, y: 3 },
    { x: 6,  y: 4 }, { x: 13, y: 4 },
    { x: 3,  y: 5 }, { x: 8,  y: 5 }, { x: 12, y: 5 },
    { x: 7,  y: 6 }, { x: 13, y: 6 },
    { x: 5,  y: 7 },
  ],
  spawnEdges: {
    N: { active: true,  waves: [1, 2, 3, 4, 5], droneTypes: ['isr'] },
    S: { active: false, waves: [3, 4, 5],        droneTypes: ['owa'] },
    W: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
    E: { active: false, waves: [4, 5],           droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    isr: [],
    owa: [],
    payloadDelivery: [],
  },
};
```

Corridor waypoint data is intentionally empty for this plan — corridors are authored when drones get implemented in a later plan. Structures and zones are fully populated so the render work in subsequent tasks has real data to draw.

- [ ] **Step 2: Verify data integrity**

Open a browser console at the served page (from Task 1). Run:

```js
import('./src/game/map.js').then(m => console.log(m.MAP));
```

Expected: the MAP object prints, `tiles` is an 8-element array, each 20 characters long (as 'land' or 'water' strings), three structures, fourteen placement zones. No errors.

Also verify each structure sits on a land tile. Run:

```js
import('./src/game/map.js').then(m => {
  const { tiles, structures, placementZones } = m.MAP;
  const bad = [...structures, ...placementZones].filter(p => tiles[p.tile?.y ?? p.y][p.tile?.x ?? p.x] !== 'land');
  console.log('invalid placements:', bad);
});
```

Expected: `invalid placements: []`.

- [ ] **Step 3: Commit**

```bash
git add src/game/map.js
git commit -m "Task 2: add static map data module

Peninsula silhouette tiles, 3 structures, 14 placement zones,
spawn edges with wave progression. Corridors stubbed for a later plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Render map layers 1–3 (water, land, coastline)

**Files:**
- Create: `src/game/mapRenderer.js`
- Modify: `src/main.js` (import + call map renderer)

- [ ] **Step 1: Add topBarHeight + bottomPaletteHeight to src/config.js**

The renderer created in Step 2 reads these — add them first so nothing breaks. In `src/config.js`, find the Rendering block:

```js
  // Rendering
  virtualWidth: 480,
  virtualHeight: 270,
  scale: 4,
  tileSize: 24,
  targetFPS: 60,
```

Add two lines directly below `targetFPS: 60,`:

```js
  topBarHeight: 24,
  bottomPaletteHeight: 32,
```

- [ ] **Step 2: Create src/game/mapRenderer.js with water + land fill**

Content:

```js
import { CONFIG } from '../config.js';
import { MAP } from './map.js';

export function renderMap(ctx) {
  drawTiles(ctx);
  drawCoastline(ctx);
}

function drawTiles(ctx) {
  const { tileSize, gridW, gridH, tiles, padTop } = MAP;

  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, CONFIG.topBarHeight, CONFIG.virtualWidth, gridH * tileSize + MAP.padTop + MAP.padBottom);

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] === 'land') {
        ctx.fillStyle = CONFIG.colors.bgDark;
        ctx.fillRect(
          x * tileSize,
          CONFIG.topBarHeight + padTop + y * tileSize,
          tileSize,
          tileSize
        );
      }
    }
  }

  ctx.strokeStyle = CONFIG.colors.gridLine;
  ctx.lineWidth = 1;
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] === 'land') {
        ctx.strokeRect(
          x * tileSize + 0.5,
          CONFIG.topBarHeight + padTop + y * tileSize + 0.5,
          tileSize - 1,
          tileSize - 1
        );
      }
    }
  }
}

function drawCoastline(ctx) {
  const { tileSize, gridW, gridH, tiles, padTop } = MAP;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (tiles[y][x] !== 'land') continue;
      const px = x * tileSize;
      const py = CONFIG.topBarHeight + padTop + y * tileSize;

      if (x === 0 || tiles[y][x - 1] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + tileSize); ctx.stroke();
      }
      if (x === gridW - 1 || tiles[y][x + 1] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px + tileSize - 0.5, py); ctx.lineTo(px + tileSize - 0.5, py + tileSize); ctx.stroke();
      }
      if (y === 0 || tiles[y - 1][x] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px, py + 0.5); ctx.lineTo(px + tileSize, py + 0.5); ctx.stroke();
      }
      if (y === gridH - 1 || tiles[y + 1][x] !== 'land') {
        ctx.beginPath(); ctx.moveTo(px, py + tileSize - 0.5); ctx.lineTo(px + tileSize, py + tileSize - 0.5); ctx.stroke();
      }
    }
  }
}
```

- [ ] **Step 3: Wire renderer into main.js**

In `src/main.js`, replace the existing file content with:

```js
import { CONFIG } from './config.js';
import { renderMap } from './game/mapRenderer.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

canvas.width = CONFIG.virtualWidth * CONFIG.scale;
canvas.height = CONFIG.virtualHeight * CONFIG.scale;

ctx.imageSmoothingEnabled = false;
ctx.scale(CONFIG.scale, CONFIG.scale);

function frame() {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 4: Verify in browser**

Run `npx serve` and load the page. Expected:
- A navy background (bg-dark).
- A lighter blue-grey (bg-mid) block covering the map region between y=24 and y=238.
- A peninsula-shaped land silhouette in dark navy with subtle grid lines inside it.
- A 1px cyan line tracing the coastline around the land silhouette.
- Land is wider at the top, narrower at the bottom (tapered shape).
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapRenderer.js src/main.js src/config.js
git commit -m "Task 3: render map tiles (water, land, coastline)

Adds topBarHeight and bottomPaletteHeight to config. Land silhouette
renders in bgDark with faint gridlines; coastline is a 1px cyan outline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Render critical structures (layer 5)

**Files:**
- Modify: `src/game/mapRenderer.js` (add structure rendering)

- [ ] **Step 1: Add structure rendering helper + export**

In `src/game/mapRenderer.js`, update the `renderMap` function and add a new helper. Replace:

```js
export function renderMap(ctx) {
  drawTiles(ctx);
  drawCoastline(ctx);
}
```

with:

```js
export function renderMap(ctx) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawStructures(ctx);
}
```

Add this function at the bottom of the file:

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

This draws the 32×32 placeholder per `STYLE.md:174` — white square with a cyan icon pixel. Real sprites per structure type land in a later plan.

- [ ] **Step 2: Verify in browser**

Run `npx serve` and reload. Expected:
- Previous map render intact (water, land, coastline).
- Three white squares with a single cyan pixel in the center, positioned at:
  - (16, 2) — NE quadrant, the power station
  - (9, 4) — center-left, the comms hub
  - (4, 6) — SW quadrant, City Hall
- Squares are 32×32 so they extend slightly outside their 24×24 tile — this is per-spec (structures are larger than tiles).
- No console errors.

- [ ] **Step 3: Commit**

```bash
git add src/game/mapRenderer.js
git commit -m "Task 4: render critical structure placeholders

32x32 accent-white squares with cyan icon pixel per STYLE.md placeholder
rules. Real type-specific sprites come in a later plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Render placement zones (layer 4)

**Files:**
- Modify: `src/game/mapRenderer.js` (add zone rendering + pulse timer)

- [ ] **Step 1: Add pulse-timer parameter to renderMap**

In `src/game/mapRenderer.js`, change:

```js
export function renderMap(ctx) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawStructures(ctx);
}
```

to:

```js
export function renderMap(ctx, tMs) {
  drawTiles(ctx);
  drawCoastline(ctx);
  drawZones(ctx, tMs);
  drawStructures(ctx);
}
```

Note: zones render *before* structures so structures occlude any zone that sits directly under one (there shouldn't be any — zones and structures don't share tiles in the spec — but the render order is per layer order).

Add `drawZones` at the bottom of the file:

```js
function drawZones(ctx, tMs) {
  const { tileSize, placementZones, padTop } = MAP;
  const brightPhase = Math.floor(tMs / 1000) % 2 === 0;
  const color = brightPhase ? CONFIG.colors.friendlyCyan : CONFIG.colors.gridLine;

  ctx.fillStyle = color;
  for (const z of placementZones) {
    const cx = z.x * tileSize + tileSize / 2;
    const cy = CONFIG.topBarHeight + padTop + z.y * tileSize + tileSize / 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy - 2);
    ctx.lineTo(cx + 2, cy);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 2, cy);
    ctx.closePath();
    ctx.fill();
  }
}
```

Single-frame brightness step per second is per spec — no tweening (`STYLE.md:157` forbids it).

- [ ] **Step 2: Pass timestamp from main.js**

In `src/main.js`, update the `frame` function. Replace:

```js
function frame() {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

with:

```js
function frame(tMs) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 3: Verify in browser**

Run `npx serve` and reload. Expected:
- 14 small cyan diamonds (4×4 px) scattered across the map at the zone positions from `map.js`.
- Diamonds alternate between bright cyan (friendlyCyan) and dim (gridLine color) once per second, with an instant state change — no smooth fade.
- Structures (white squares) still render on top.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/mapRenderer.js src/main.js
git commit -m "Task 5: render placement zones as pulsing cyan diamonds

14 zones render at their tile centers as 4x4 diamonds. Pulse is a
single-frame brightness step every 1s per STYLE.md — no tweening.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Render UI chrome (top bar + bottom palette)

**Files:**
- Create: `src/ui/uiChrome.js`
- Modify: `src/main.js` (import + call chrome renderer)

- [ ] **Step 1: Create src/ui/uiChrome.js**

Content:

```js
import { CONFIG } from '../config.js';

export function renderChrome(ctx) {
  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.topBarHeight);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(0, CONFIG.topBarHeight - 1, CONFIG.virtualWidth, 1);

  const paletteY = CONFIG.virtualHeight - CONFIG.bottomPaletteHeight;
  ctx.fillStyle = CONFIG.colors.bgMid;
  ctx.fillRect(0, paletteY, CONFIG.virtualWidth, CONFIG.bottomPaletteHeight);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(0, paletteY, CONFIG.virtualWidth, 1);
}
```

- [ ] **Step 2: Wire into main.js**

In `src/main.js`, add the import after the existing `renderMap` import:

```js
import { renderChrome } from './ui/uiChrome.js';
```

Update `frame` so the chrome draws last (layer 11 per spec):

```js
function frame(tMs) {
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);

  renderMap(ctx, tMs);
  renderChrome(ctx);

  requestAnimationFrame(frame);
}
```

- [ ] **Step 3: Verify in browser**

Run `npx serve` and reload. Expected:
- Top 24px band: solid bg-mid with a 1px accent-white line along its bottom.
- Bottom 32px band: solid bg-mid with a 1px accent-white line along its top.
- Map content (water, land, coastline, zones, structures) renders between these bars.
- No console errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/uiChrome.js src/main.js
git commit -m "Task 6: render empty UI chrome bars

Top 24px and bottom 32px bars in bgMid with 1px accent-white borders.
Content (wave info, palette buttons) comes in later plans.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Final verification + PLAYTESTS.md entry

**Files:**
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Run full verification checklist**

Run `npx serve` and load the page. Confirm each item:

- [ ] Canvas fills at 1920×1080 (or browser-window limit), crisp pixels (no blur).
- [ ] Top 24px bar in bg-mid, 1px white bottom border.
- [ ] 11px bg-dark padding below the top bar.
- [ ] Map water region in bg-mid; land silhouette in bg-dark with faint grid.
- [ ] Land shape: wider at top (rows 0–1 span full width), tapers to narrower at bottom (row 7 is 11 tiles wide).
- [ ] 1px cyan coastline outlines the land.
- [ ] 14 cyan diamonds pulse once per second at the placement-zone positions.
- [ ] 3 white 32×32 squares (with cyan center pixel) at (16,2), (9,4), (4,6) — Power Substation NE, Comms Tower center, City Hall SW.
- [ ] 11px bg-dark padding above the bottom bar.
- [ ] Bottom 32px bar in bg-mid, 1px white top border.
- [ ] Browser console shows zero errors.

If any item fails, fix before continuing.

- [ ] **Step 2: Add PLAYTESTS.md entry**

In `PLAYTESTS.md`, replace the `_No playtests yet._` placeholder with:

```
## 2026-04-19 — solo (map render only)

**Build:** map foundation plan complete (static render)
**Session length:** n/a — render check, not a play session
**Result:** N/A (no gameplay yet)

### What happened
- Loaded index.html via `npx serve`, map renders as spec'd

### What worked
- Peninsula silhouette reads clearly at 480x270 × 4x scale
- Structure placeholders, zones, coastline, chrome bars all render at the right positions
- Pulse timing on zones is crisp (1-frame state change, no tween)

### What felt off
- Placeholder structure sprites are identical — can't visually distinguish power / comms / city hall until real sprites land
- No drones, placement interaction, or waves yet — this is just the foundation

### Questions raised
- Will the 32×32 structures reading "too dominant" against 16×16 drones + 24×24 defenses become a problem during waves? Defer to first wave playtest.
```

- [ ] **Step 3: Commit**

```bash
git add PLAYTESTS.md
git commit -m "Task 7: log first playtest session (map render verification)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Push to remote**

```bash
git push
```

Expected: clean push to `origin/main`, all Task 0–7 commits visible in the GitHub repo.

---

## Out of scope — next-plan candidates

When planning subsequent work:

1. **Drone entities + corridor traversal** — implements the actual ingress behaviors (ISR weave, OWA commit, Payload crossing), including `corridors` waypoint data.
2. **Placement interaction** — defense palette click, ghost sprite, valid/invalid overlay, range/cone preview, click-to-place, tooltip showing corridor coverage.
3. **Wave system + pre-wave telegraphs** — wave runner, 15s prep phase with amber chevrons at active spawn edges, drone-type icons.
4. **Range / cone rendering** — draws only for selected defense (layer 7 per spec).
5. **CRT post-effect** — scanlines + vignette final pass (layer 13).

Each is its own brainstorm → spec → plan cycle unless the next-up spec explicitly covers it.
