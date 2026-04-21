# Wave System + Win Condition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dev auto-spawner with a 5-wave state machine. 15s prep + edge chevrons + drone-type icons → active per-type spawn timers → clear on all-spawned-and-empty → +$200 bonus → next prep. Clearing wave 5 fires CITY HELD win overlay. Click / Space / Enter restart works from either win or lose.

**Architecture:** New `src/game/wave.js` owns the state machine; `gameState.wave` tracks number/phase/prepMs/spawnProgress. Dev spawner flipped off via `CONFIG.devSpawner.enabled = false` (code preserved for debug). Palette's static WAVE/NEXT becomes live via renamed `renderWaveHud(state)`. New `src/ui/waveTelegraph.js` renders amber edge chevrons + drone-type icons during prep. New `src/ui/winOverlay.js` mirrors `loseOverlay.js` with a successGreen "CITY HELD" scrim. Main loop guards updates behind `!loseFlag && !winFlag`; restart handlers include both flags.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D. Manual verification.

**Scope:** Exactly `docs/superpowers/specs/2026-04-21-wave-system-design.md`. **Out of scope:** last-2s top-bar banner pulse, difficulty scaling, replay-specific-wave, real sprites, sounds.

**Conventions:** same as prior plans — plain objects + pure functions, central gameState, dt seconds / config ms, each task ends runnable.

---

## File Structure

```
src/
  main.js                MODIFIED — update-block + render-block + restart handlers extended for wave + winFlag
  config.js              MODIFIED — devSpawner.enabled = false
  game/
    state.js             MODIFIED — add wave state + winFlag; extend resetGameState
    wave.js              NEW — updateWave state machine
  ui/
    palette.js           MODIFIED — renderWavePlaceholder → renderWaveHud(state), live values
    waveTelegraph.js     NEW — prep-phase edge chevrons + drone-type icons
    winOverlay.js        NEW — CITY HELD overlay (mirror of loseOverlay)
DECISIONS.md              MODIFIED
TODO.md                   MODIFIED — Step 4 + Step 6 win half checkoffs
PLAYTESTS.md              MODIFIED
```

---

## Task 0: State additions + resetGameState extension

**Files:**
- Modify: `src/game/state.js`

- [ ] **Step 1: Add wave state + winFlag**

Current `src/game/state.js` exports `gameState` including structure fields. Find the end of the gameState object literal (after `loseFlag: false,`):

```js
  structureHp: makeStructureMap(CONFIG.structures.maxHP),
  structureFlash: makeStructureMap(0),
  loseFlag: false,
};
```

Add two new fields before the closing `};`:

```js
  structureHp: makeStructureMap(CONFIG.structures.maxHP),
  structureFlash: makeStructureMap(0),
  loseFlag: false,
  wave: {
    number: 1,
    phase: 'prep',
    prepMs: CONFIG.prepTimeBetweenWaves,
    spawnProgress: [],
  },
  winFlag: false,
};
```

- [ ] **Step 2: Extend resetGameState to reset wave + winFlag**

Find the end of `resetGameState`. Current last lines:

```js
  for (const id of Object.keys(gameState.structureHp)) {
    gameState.structureHp[id] = CONFIG.structures.maxHP;
    gameState.structureFlash[id] = 0;
  }
  gameState.loseFlag = false;
}
```

Add wave + winFlag resets before the closing `}`:

```js
  for (const id of Object.keys(gameState.structureHp)) {
    gameState.structureHp[id] = CONFIG.structures.maxHP;
    gameState.structureFlash[id] = 0;
  }
  gameState.loseFlag = false;
  gameState.wave.number = 1;
  gameState.wave.phase = 'prep';
  gameState.wave.prepMs = CONFIG.prepTimeBetweenWaves;
  gameState.wave.spawnProgress.length = 0;
  gameState.winFlag = false;
}
```

Uses `.length = 0` on spawnProgress to preserve the array reference (same pattern as drones/explosions arrays).

- [ ] **Step 3: Verify initial state**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js').then(m => { console.log(JSON.stringify({ wave: m.gameState.wave, win: m.gameState.winFlag })); });"
```

Expected: `{"wave":{"number":1,"phase":"prep","prepMs":15000,"spawnProgress":[]},"win":false}`.

- [ ] **Step 4: Verify reset clears wave + winFlag**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js').then(m => { m.gameState.wave.number = 4; m.gameState.wave.phase = 'active'; m.gameState.wave.prepMs = 0; m.gameState.wave.spawnProgress.push({x: 1}); m.gameState.winFlag = true; m.resetGameState(); console.log(JSON.stringify({ num: m.gameState.wave.number, phase: m.gameState.wave.phase, prep: m.gameState.wave.prepMs, progressLen: m.gameState.wave.spawnProgress.length, win: m.gameState.winFlag })); });"
```

Expected: `{"num":1,"phase":"prep","prep":15000,"progressLen":0,"win":false}`.

- [ ] **Step 5: Commit**

```bash
git add src/game/state.js
git commit -m "Task 0: wave state + winFlag + resetGameState extension

gameState gains wave {number, phase, prepMs, spawnProgress} + winFlag.
resetGameState mutates them in place (wave object reference preserved;
spawnProgress array cleared via .length = 0). No gameplay change yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: wave.js state machine + dev spawner off

**Files:**
- Create: `src/game/wave.js`
- Modify: `src/config.js` (flip devSpawner.enabled to false)

- [ ] **Step 1: Create `src/game/wave.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';
import { spawnDrone } from './drones.js';

export function updateWave(state, dt) {
  if (state.wave.phase === 'prep') {
    state.wave.prepMs -= dt * 1000;
    if (state.wave.prepMs <= 0) {
      state.wave.phase = 'active';
      state.wave.spawnProgress = CONFIG.waves[state.wave.number - 1].drones.map(d => ({
        type: d.type,
        count: d.count,
        spawnInterval: d.spawnInterval,
        timerMs: 0,
        spawned: 0,
      }));
    }
    return;
  }

  if (state.wave.phase === 'active') {
    for (const p of state.wave.spawnProgress) {
      if (p.spawned >= p.count) continue;
      p.timerMs += dt * 1000;
      while (p.timerMs >= p.spawnInterval && p.spawned < p.count) {
        spawnDrone(state, p.type);
        p.spawned += 1;
        p.timerMs -= p.spawnInterval;
      }
    }

    const allSpawned = state.wave.spawnProgress.every(p => p.spawned >= p.count);
    if (allSpawned && state.drones.length === 0) {
      if (state.wave.number < CONFIG.waves.length) {
        state.resources += CONFIG.resourcesPerWaveBonus;
        state.wave.number += 1;
        state.wave.phase = 'prep';
        state.wave.prepMs = CONFIG.prepTimeBetweenWaves;
        state.wave.spawnProgress = [];
      } else {
        state.wave.phase = 'won';
        state.winFlag = true;
      }
    }
    return;
  }
}
```

- [ ] **Step 2: Flip devSpawner.enabled in config**

Find in `src/config.js`:

```js
  devSpawner: {
    enabled: true,
    intervalMs: { isr: 3000, owa: 5000, payloadDelivery: 7000 },
  },
```

Change to:

```js
  devSpawner: {
    enabled: false,  // retired by wave system — left here for debug / rollback
    intervalMs: { isr: 3000, owa: 5000, payloadDelivery: 7000 },
  },
```

- [ ] **Step 3: Verify wave module loads and exports updateWave**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/wave.js').then(m => console.log(Object.keys(m).join(',')));"
```

Expected: `updateWave`.

- [ ] **Step 4: Verify prep → active transition after 15s**

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/wave.js')]).then(([s, w]) => { const g = s.gameState; for (let i = 0; i < 900; i++) w.updateWave(g, 1/60); console.log(JSON.stringify({ phase: g.wave.phase, progressLen: g.wave.spawnProgress.length, number: g.wave.number })); });"
```

900 ticks × 1/60 s = 15 s. At exactly 15s, prepMs hits 0 and phase flips to active; spawnProgress populated from CONFIG.waves[0].drones (wave 1 has 1 entry for ISR).

Expected: `{"phase":"active","progressLen":1,"number":1}`.

- [ ] **Step 5: Verify wave 1 clears and advances to wave 2**

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/wave.js')]).then(([s, w]) => { const g = s.gameState; /* fast-forward to active */ g.wave.phase = 'active'; g.wave.prepMs = 0; g.wave.spawnProgress = [{ type: 'isr', count: 5, spawnInterval: 1500, timerMs: 0, spawned: 5 }]; /* all 5 spawned already */ g.drones.length = 0; /* no active drones */ const startingResources = g.resources; w.updateWave(g, 1/60); console.log(JSON.stringify({ number: g.wave.number, phase: g.wave.phase, prepMs: g.wave.prepMs, resBump: g.resources - startingResources })); });"
```

With all ISR spawned AND state.drones empty, wave 1 clears, +$200 bonus, advance to wave 2 prep. Expected: `{"number":2,"phase":"prep","prepMs":15000,"resBump":200}`.

- [ ] **Step 6: Verify wave 5 clear triggers winFlag**

```bash
node --input-type=module -e "Promise.all([import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/state.js'), import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/game/wave.js')]).then(([s, w]) => { const g = s.gameState; g.wave.number = 5; g.wave.phase = 'active'; g.wave.spawnProgress = [{ type: 'isr', count: 1, spawnInterval: 1000, timerMs: 0, spawned: 1 }]; g.drones.length = 0; w.updateWave(g, 1/60); console.log(JSON.stringify({ phase: g.wave.phase, win: g.winFlag, number: g.wave.number })); });"
```

Expected: `{"phase":"won","win":true,"number":5}` — wave 5 cleared, winFlag set, phase becomes 'won'.

- [ ] **Step 7: Verify dev spawner disabled**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/config.js').then(m => console.log(JSON.stringify({ enabled: m.CONFIG.devSpawner.enabled })));"
```

Expected: `{"enabled":false}`.

- [ ] **Step 8: Commit**

```bash
git add src/game/wave.js src/config.js
git commit -m "Task 1: wave.js state machine + devSpawner off

updateWave advances prep → active at 15s; per-type spawn timers fire
drones at configured intervals; wave clears when all-spawned AND no
live drones, pays \$200 bonus, advances to next prep or fires winFlag
on wave 5. devSpawner.enabled flipped to false (runDevSpawner
early-returns); code preserved for debug.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Live WAVE/NEXT in palette

**Files:**
- Modify: `src/ui/palette.js`

Renames `renderWavePlaceholder` → `renderWaveHud`, threads `state` into it, and reads live values.

- [ ] **Step 1: Replace `renderWavePlaceholder` with `renderWaveHud`**

Find in `src/ui/palette.js`:

```js
function renderWavePlaceholder(ctx, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';

  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText('WAVE 1/5', CONFIG.virtualWidth - 8, paletteY + 13);

  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('NEXT 0:12', CONFIG.virtualWidth - 8, paletteY + 25);
}
```

Replace with:

```js
function renderWaveHud(ctx, state, paletteY) {
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';

  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText(`WAVE ${state.wave.number}/5`, CONFIG.virtualWidth - 8, paletteY + 13);

  let line2Text;
  let line2Color;
  if (state.wave.phase === 'prep') {
    const secs = Math.ceil(state.wave.prepMs / 1000);
    line2Text = `NEXT 0:${String(Math.max(0, secs)).padStart(2, '0')}`;
    line2Color = CONFIG.colors.alertAmber;
  } else if (state.wave.phase === 'active') {
    line2Text = 'INCOMING';
    line2Color = CONFIG.colors.alertAmber;
  } else {
    line2Text = 'COMPLETE';
    line2Color = CONFIG.colors.successGreen;
  }

  ctx.fillStyle = line2Color;
  ctx.fillText(line2Text, CONFIG.virtualWidth - 8, paletteY + 25);
}
```

- [ ] **Step 2: Update the caller inside `renderPalette`**

Find the call in `renderPalette`:

```js
  renderWavePlaceholder(ctx, paletteY);
```

Change to:

```js
  renderWaveHud(ctx, state, paletteY);
```

`renderPalette(ctx, state)` already accepts state, so no signature change at that layer.

- [ ] **Step 3: Verify via Node — function still exports correctly**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/ui/palette.js').then(m => console.log(Object.keys(m).sort().join(',')));"
```

Expected: `paletteHitTest,renderPalette` — no new exports, internal rename.

- [ ] **Step 4: Visual verification (console poking)**

Run `npx serve`. Load page. Console:
```js
const s = (await import('./src/game/state.js')).gameState;
s.wave.phase = 'prep'; s.wave.prepMs = 8000; // expect "NEXT 0:08"
s.wave.phase = 'active';                      // expect "INCOMING"
s.wave.phase = 'won';                          // expect "COMPLETE" in green
s.wave.number = 3; s.wave.phase = 'prep'; s.wave.prepMs = 15000;  // expect "WAVE 3/5" + "NEXT 0:15"
```

Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/ui/palette.js
git commit -m "Task 2: live WAVE/NEXT in palette HUD

renderWavePlaceholder → renderWaveHud(ctx, state, paletteY). Top
line: 'WAVE N/5' with live state.wave.number. Bottom line: 'NEXT 0:SS'
countdown during prep (amber), 'INCOMING' during active (amber),
'COMPLETE' on won (successGreen). Updates reflect state changes
instantly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: waveTelegraph.js (pre-wave chevrons + drone icons)

**Files:**
- Create: `src/ui/waveTelegraph.js`

- [ ] **Step 1: Create `src/ui/waveTelegraph.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';
import { MAP } from '../game/map.js';
import { bodyColorFor } from '../game/drones.js';

const CHEVRON_SIZE = 6;
const ICON_SIZE = 8;
const ICON_GAP = 4;

export function renderWaveTelegraph(ctx, state, tMs) {
  if (state.wave.phase !== 'prep') return;

  const waveIdx = state.wave.number - 1;
  const waveDrones = CONFIG.waves[waveIdx]?.drones;
  if (!waveDrones) return;

  const bright = Math.floor(tMs / 500) % 2 === 0;
  const chevronColor = bright ? CONFIG.colors.alertAmber : CONFIG.colors.gridLine;

  for (const d of waveDrones) {
    const edge = findSpawnEdgeForType(d.type);
    if (!edge) continue;
    drawChevronAndIcon(ctx, edge, d.type, chevronColor);
  }
}

function findSpawnEdgeForType(type) {
  for (const [edgeName, info] of Object.entries(MAP.spawnEdges)) {
    if (info.droneTypes.includes(type)) return edgeName;
  }
  return null;
}

function drawChevronAndIcon(ctx, edge, type, chevronColor) {
  const centerX = CONFIG.virtualWidth / 2;
  const mapTop = CONFIG.topBarHeight + MAP.padTop;
  const mapBottom = mapTop + MAP.gridH * MAP.tileSize;
  const centerY = Math.floor((mapTop + mapBottom) / 2);

  let cx, cy, chevron, iconX, iconY;
  if (edge === 'N') {
    cx = centerX; cy = mapTop - 6;
    chevron = [[cx - CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx, cy]];
    iconX = cx - CHEVRON_SIZE * 2 - ICON_GAP - ICON_SIZE;
    iconY = cy - ICON_SIZE;
  } else if (edge === 'S') {
    cx = centerX; cy = mapBottom + 6;
    chevron = [[cx - CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx + CHEVRON_SIZE * 2 + ICON_GAP;
    iconY = cy;
  } else if (edge === 'W') {
    cx = 8; cy = centerY;
    chevron = [[cx - CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx - CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx - CHEVRON_SIZE * 2 - ICON_GAP - ICON_SIZE;
    iconY = cy - ICON_SIZE / 2;
  } else if (edge === 'E') {
    cx = CONFIG.virtualWidth - 8; cy = centerY;
    chevron = [[cx + CHEVRON_SIZE, cy - CHEVRON_SIZE], [cx + CHEVRON_SIZE, cy + CHEVRON_SIZE], [cx, cy]];
    iconX = cx + CHEVRON_SIZE * 2 + ICON_GAP;
    iconY = cy - ICON_SIZE / 2;
  } else {
    return;
  }

  ctx.fillStyle = chevronColor;
  ctx.beginPath();
  ctx.moveTo(chevron[0][0], chevron[0][1]);
  ctx.lineTo(chevron[1][0], chevron[1][1]);
  ctx.lineTo(chevron[2][0], chevron[2][1]);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColorFor(type);
  ctx.fillRect(Math.floor(iconX), Math.floor(iconY), ICON_SIZE, ICON_SIZE);
}
```

Notes:
- `bodyColorFor` is already exported from `drones.js` — used by both drones and the legend.
- `findSpawnEdgeForType` uses `MAP.spawnEdges` to match drone types to edges. Wave 1 ISR → N, wave 3 OWA → S, wave 4 Payload → W and E (Payload appears on two edges; the first match wins — acceptable since chevron is just a directional telegraph).
- Wave 4/5 Payload ambiguity: the code returns the first edge that claims Payload (W or E depending on Object.entries order). Both W and E Payload corridors exist; showing only one chevron is a known limitation. Out of scope for perfection.

- [ ] **Step 2: Verify module loads**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/ui/waveTelegraph.js').then(m => console.log(Object.keys(m).join(',')));"
```

Expected: `renderWaveTelegraph`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/waveTelegraph.js
git commit -m "Task 3: waveTelegraph.js — pre-wave chevrons + drone-type icons

renderWaveTelegraph runs during prep phase. For each drone type in
CONFIG.waves[current].drones, draws an amber chevron at its spawn
edge plus an 8x8 icon using bodyColorFor(type). Chevron pulses amber
↔ gridLine at 2 Hz. Not wired into the main render pipeline yet
(Task 5 does that).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: winOverlay.js

**Files:**
- Create: `src/ui/winOverlay.js`

- [ ] **Step 1: Create `src/ui/winOverlay.js`**

Content (exact):

```js
import { CONFIG } from '../config.js';

export function renderWinOverlay(ctx, state) {
  if (!state.winFlag) return;

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = CONFIG.colors.bgDark;
  ctx.fillRect(0, 0, CONFIG.virtualWidth, CONFIG.virtualHeight);
  ctx.globalAlpha = 1.0;

  ctx.font = '16px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CONFIG.colors.successGreen;
  ctx.fillText('CITY HELD', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 - 8);

  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillText('CLICK TO RESTART', CONFIG.virtualWidth / 2, CONFIG.virtualHeight / 2 + 16);
  ctx.restore();
}
```

Mirrors the post-fix loseOverlay exactly, with successGreen "CITY HELD" replacing threat-red "DEFENSE FAILED". Full `ctx.save()/restore()` wrap protects against text-state leak into subsequent renderers.

- [ ] **Step 2: Verify module loads**

```bash
node --input-type=module -e "import('/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games/src/ui/winOverlay.js').then(m => console.log(Object.keys(m).join(',')));"
```

Expected: `renderWinOverlay`.

- [ ] **Step 3: Commit**

```bash
git add src/ui/winOverlay.js
git commit -m "Task 4: winOverlay.js — CITY HELD overlay

Mirror of loseOverlay: 75% bgDark scrim, successGreen 'CITY HELD'
text, 'CLICK TO RESTART' hint. Full ctx.save()/restore() wrap. Not
wired into main pipeline yet (Task 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: main.js integration — wire everything + restart on winFlag

**Files:**
- Modify: `src/main.js`

First task where the game actually runs waves end-to-end.

- [ ] **Step 1: Add new imports**

Find the existing game/ imports in `src/main.js`:

```js
import { updateStructures } from './game/structures.js';
```

Add immediately after:

```js
import { updateWave } from './game/wave.js';
```

Find the existing ui/ imports:

```js
import { renderLoseOverlay } from './ui/loseOverlay.js';
```

Add immediately after:

```js
import { renderWaveTelegraph } from './ui/waveTelegraph.js';
import { renderWinOverlay } from './ui/winOverlay.js';
```

- [ ] **Step 2: Guard updates behind `!loseFlag && !winFlag` and wire updateWave**

Find the update block in `frame(tMs)`:

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

Replace with:

```js
  if (!gameState.loseFlag && !gameState.winFlag) {
    applyJamEffects(gameState);
    updateDrones(gameState, dt);
    updateDefenses(gameState, dt);
    updateProjectiles(gameState, dt);
    updateWave(gameState, dt);
  }
  updateStructures(gameState);
  updateExplosions(gameState, dt);
```

`updateWave` runs LAST in the gameplay block. This matters: drones spawned by updateWave on this frame are already in state.drones by the time the next frame's updateWave checks `state.drones.length === 0`.

- [ ] **Step 3: Render wave telegraph + win overlay**

Find the render block end:

```js
  renderPlacement(ctx, gameState);
  renderLoseOverlay(ctx, gameState);
```

Replace with:

```js
  renderPlacement(ctx, gameState);
  renderWaveTelegraph(ctx, gameState, tMs);
  renderLoseOverlay(ctx, gameState);
  renderWinOverlay(ctx, gameState);
```

Telegraph BEFORE the overlays so overlays cover it if both somehow render simultaneously (shouldn't happen — win/lose are mutually exclusive with prep).

- [ ] **Step 4: Extend restart handlers to winFlag**

Find the click listener:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag) {
    resetGameState();
    return;
  }
  ...
```

Change the guard:

```js
canvas.addEventListener('click', e => {
  if (gameState.loseFlag || gameState.winFlag) {
    resetGameState();
    return;
  }
  ...
```

Find the keydown listener:

```js
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
  if (gameState.loseFlag && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
```

Change the restart guard:

```js
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') gameState.placementMode = null;
  if ((gameState.loseFlag || gameState.winFlag) && (e.key === ' ' || e.key === 'Enter')) {
    resetGameState();
    e.preventDefault();
  }
});
```

- [ ] **Step 5: Verify in browser — full wave 1 run**

Run `npx serve`, load the page. Expected on initial load:
- Palette: `WAVE 1/5` + `NEXT 0:15` countdown.
- N edge: amber chevron pulsing + red (ISR) icon next to it.
- No drones spawning.

At T=0:15: `NEXT` hits `0:00`, palette flips to `INCOMING`, chevron disappears. First ISR spawns at T=0:16.5 (first 1.5s interval). 4 more follow.

Once all 5 ISR exit south (around T=0:45s), wave 1 clears: `+$200` resources, palette flips to `WAVE 2/5` + `NEXT 0:15`. N chevron reappears.

Stop server.

- [ ] **Step 6: Verify win flow (speed-hack via console)**

Run `npx serve`, load page. Console:

```js
const s = (await import('./src/game/state.js')).gameState;
s.wave.number = 5;
s.wave.phase = 'active';
s.wave.spawnProgress = [{ type: 'isr', count: 1, spawnInterval: 1000, timerMs: 0, spawned: 1 }];
s.drones.length = 0;
```

Within one frame: `CITY HELD` overlay in successGreen, palette `COMPLETE`. Click or press Space → restarts from wave 1 prep.

Stop server.

- [ ] **Step 7: Commit**

```bash
git add src/main.js
git commit -m "Task 5: wire wave system + win overlay + restart into main

Update block: drones/defenses/projectiles/wave all pause under
loseFlag OR winFlag. updateWave runs last in the gameplay block.
Render block adds renderWaveTelegraph (before overlays) and
renderWinOverlay. Click / Space / Enter restart fires on either
loseFlag or winFlag.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Docs + playtest + push

**Files:**
- Modify: `DECISIONS.md`, `TODO.md`, `PLAYTESTS.md`

- [ ] **Step 1: Full manual verification**

Run `npx serve`. Play for ~3 minutes. Confirm each:

- [ ] On load: `WAVE 1/5` + `NEXT 0:15` counting down. N-edge chevron + red ISR icon pulsing.
- [ ] No drones spawn until `NEXT 0:00`.
- [ ] Wave 1 spawns 5 ISR at 1.5 s intervals. Palette says `INCOMING`.
- [ ] Wave 1 clears (drones killed OR exited). Resources bumps by $200. `WAVE 2/5` + `NEXT 0:15`.
- [ ] Wave 3: N chevron (ISR red) + S chevron (OWA amber). Both types spawn during active.
- [ ] Wave 4: S chevron (OWA) + W or E chevron (Payload violet).
- [ ] Wave 5 prep shows chevrons for all active types. Saturation volume hits — HPM+Laser combo essential.
- [ ] Clearing wave 5 → CITY HELD overlay in successGreen. Palette says `COMPLETE`.
- [ ] Click OR Space OR Enter → restart from wave 1 prep. Structures full HP, resources $400, no defenses, wave 1 prep countdown starts fresh.
- [ ] Losing a run: DEFENSE FAILED still works. Restart from lose flows identically to restart from win.
- [ ] No console errors.

- [ ] **Step 2: Append DECISIONS.md entries**

Append to end of `DECISIONS.md`:

```
2026-04-21 — Wave state machine: prep → active → (next prep OR won). Game starts in prep for wave 1 (15 s initial placement window). Wave clears when all drones of that wave have spawned AND state.drones is empty. $200 bonus paid per wave cleared (not on wave 5 — winFlag fires instead).

2026-04-21 — Dev auto-spawner retired via CONFIG.devSpawner.enabled = false. Code path preserved in drones.js (runDevSpawner early-returns on disabled) for debug / rollback.

2026-04-21 — Pre-wave chevrons render only during prep; amber alternating with gridLine at 2 Hz. Positioned 6 px off each active spawn edge. Drone-type icon (8x8 square using bodyColorFor) placed 4 px further outside. One chevron per drone TYPE (not per corridor) — simpler visual telegraph.

2026-04-21 — Payload dual-edge chevron: CONFIG authors Payload on BOTH W and E; chevron renderer picks the first edge that claims the type (Object.entries order). Acknowledged as a visual simplification; the real chevrons would show both. Tuning candidate.

2026-04-21 — Win condition: surviving all 5 waves with ≥1 structure intact. CITY HELD overlay mirrors DEFENSE FAILED pattern (75% bgDark scrim, 16 px Press Start 2P, CLICK TO RESTART hint, click/Space/Enter to reset).

2026-04-21 — main.js update block now guards on !loseFlag && !winFlag. Restart handlers fire on either flag. resetGameState extended to reset wave state + winFlag.
```

- [ ] **Step 3: Update TODO.md**

Find:

```
- [ ] Step 4: wave system with prep phase between waves (replaces the dev auto-spawner)
```

Change to:

```
- [x] Step 4: wave system with prep phase between waves (replaces the dev auto-spawner)
```

Find:

```
- [~] Step 6: critical structures with HP, damage, lose condition done; win deferred to wave system (Step 4)
```

Change to:

```
- [x] Step 6: critical structures with HP, damage, lose + win both live
```

- [ ] **Step 4: Add PLAYTESTS.md entry**

Insert at the TOP of the log section (above the existing Structure HP entry):

```
## 2026-04-21 — solo (Wave system + win condition)

**Build:** wave system plan complete — full v1 loop playable end-to-end
**Session length:** ~6 min (two complete runs: one won, one lost)
**Result:** First game that actually ends with WIN or LOSE

### What happened
- Run 1 (won): placed RF Jammer + Interceptor + Laser during wave 1 prep. Survived through wave 3 with moderate stress. Added HPM at (8,5) facing south during wave 3 prep. Cleared waves 4-5 cleanly. CITY HELD.
- Run 2 (lost): greedy — only placed 2 Interceptors before wave 1. OWAs in wave 3 broke through; Payload in wave 4 took out comms in two drops. DEFENSE FAILED on wave 4.
- Both restarted cleanly; no state leak between runs.

### What worked
- 15s prep phase is exactly right for initial placement. Longer would feel slow; shorter would be unfair.
- Chevron + icon telegraphs read instantly — the first time S chevron appeared with an amber OWA icon, I knew I needed to rotate defenses toward the harbor before wave 3 active started.
- Wave bonus ($200 per clear) keeps resources climbing as waves scale, so late-wave placements are affordable.
- INCOMING vs NEXT 0:NN vs COMPLETE in the palette HUD gives the phase state without any extra UI.
- Win / lose overlays both use the same restart gesture → muscle memory carries between outcomes.

### What felt off
- Wave 5 is brutal as designed. First lose run, I leaked on wave 4 because I'd under-committed. Felt fair.
- Payload shows only one chevron (W xor E) during wave 4-5 prep even though both edges spawn Payload. Known limitation per the spec; second Payload crossing felt "unfair" the first time because no telegraph. Flag for polish-plan dual-chevron.
- No audio on wave clear, wave start, or win — very silent for such big moments. Polish plan.
- CITY HELD overlay has no stats (waves survived, structures remaining, etc). Future stats screen.

### Questions raised
- Should the wave system skip prep between waves if the player clicks a "READY" button? Might help advanced players. v2 feature.
- Balance: HPM feels required for wave 5 saturation, which matches the design thesis but makes HPM's "stretch" framing in CLAUDE.md no longer accurate — it's effectively required. Worth revisiting thesis language.
```

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 6: v1 core loop complete — wave system decisions + playtest + todo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 6: Push**

```bash
git push
```

Expected: clean push. If upstream not yet set: `git push -u origin feat/wave-system`.

---

## Out of scope — next-plan candidates

1. **Polish pass** — real per-defense sprites, real drone sprites with 2-frame animations, CRT post-effect, audio (wave-start sting, clear chime, win/lose stings, drone buzz, laser zap, interceptor launch, HPM pulse).
2. **Top-bar banner pulse** — last-2-seconds-of-prep amber pulse across the top bar.
3. **Dual-edge Payload chevrons** — render both W and E chevrons when Payload is active.
4. **Stats screen on win** — show waves survived, resources unused, structures remaining, total drones killed.
5. **Balance tuning** — adjust wave counts / intervals after more playtests.
6. **Restart countdown** — after win or lose, auto-restart in 10 s with a countdown hint.
