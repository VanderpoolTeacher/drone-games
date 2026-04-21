# Wave System + Win Condition Design — Drone Defense

**Date:** 2026-04-21
**Status:** Approved via brainstorm (sections 1 + 2 + 3 + 4)
**Scope:** Replace the dev-spawner with a 5-wave state machine driven by `CONFIG.waves`. Each wave: a 15 s prep phase with edge chevrons + drone-type icons, then an active phase with per-type spawn timers. Wave clears when all drones are out of play → $200 wave bonus → next prep. Clearing wave 5 fires a `CITY HELD` win overlay. Palette's WAVE/NEXT goes live. Click / Space / Enter restart works from either end-state.

Completes the core v1 game loop: win AND lose are reachable.

## Out of scope

- Last-2-seconds top-bar banner pulse (nice-to-have, deferred to polish)
- Difficulty scaling beyond `CONFIG.waves[N]` values (tuning pass territory)
- Replaying a specific wave — always restart from wave 1
- Real sprites, CRT post-effect, sounds (polish plan)
- Wave-completion score / stats screen (polish)

---

## Design thesis alignment

From DESIGN.md: 5 waves designed to teach the layered-defense thesis through escalation. Each wave introduces or scales a threat the previous defense set struggles with. The wave system is the engine that paces that teaching arc:

- Wave 1-2: ISR only. Player learns RF Jammer / soft-kill basics.
- Wave 3: +OWA. RF Jammer fails on preprogrammed drones; player must buy Interceptor.
- Wave 4: +Payload. Interceptor cost-inefficient vs armor; Laser / HPM pay off.
- Wave 5: saturation. HPM's one-to-many is the defender's answer.

Prep phase + chevrons telegraph the escalation so the player can respond with purpose.

---

## Architecture

- New `src/game/wave.js` owns the state machine — prep countdown + per-type spawn timers + clear detection.
- `gameState.wave` tracks number/phase/prepMs/spawnProgress.
- Dev spawner flipped off via `CONFIG.devSpawner.enabled = false`. Existing `runDevSpawner` early-returns; no code deletion.
- Palette's static WAVE/NEXT becomes live via a renamed `renderWaveHud(ctx, state)`.
- New `src/ui/waveTelegraph.js` renders amber chevrons + drone-type icons during prep.
- New `src/ui/winOverlay.js` mirrors `loseOverlay.js` — green `CITY HELD` scrim.
- `resetGameState` extended to reset wave + winFlag.
- Main frame guards updates behind `!loseFlag && !winFlag`.

### File layout (net changes)

```
src/
  main.js                MODIFIED — update block guarded by !loseFlag && !winFlag; wire updateWave + renderWaveTelegraph + renderWinOverlay; restart handlers include winFlag
  config.js              MODIFIED — devSpawner.enabled = false
  game/
    state.js             MODIFIED — wave state + winFlag; extend resetGameState
    wave.js              NEW — updateWave state machine
  ui/
    palette.js           MODIFIED — renderWavePlaceholder → renderWaveHud(state), live values
    waveTelegraph.js     NEW — prep-phase chevrons + drone-type icons
    winOverlay.js        NEW — CITY HELD overlay
DECISIONS.md              MODIFIED
TODO.md                   MODIFIED — check off Step 4 + close Step 6 win half
PLAYTESTS.md              MODIFIED
```

No existing files are deleted.

---

## Data model

### gameState additions

```js
wave: {
  number: 1,                                // 1..5
  phase: 'prep',                            // 'prep' | 'active' | 'won'
  prepMs: CONFIG.prepTimeBetweenWaves,      // 15000, counts down during prep
  spawnProgress: [],                        // populated on prep→active transition
},
winFlag: false,
```

`spawnProgress` mirrors `CONFIG.waves[number-1].drones` shape with runtime fields:

```js
[
  { type: 'isr', count: 5, spawnInterval: 1500, timerMs: 0, spawned: 0 },
  // more entries per drone type in the wave
]
```

### resetGameState additions

```js
gameState.wave.number = 1;
gameState.wave.phase = 'prep';
gameState.wave.prepMs = CONFIG.prepTimeBetweenWaves;
gameState.wave.spawnProgress.length = 0;
gameState.winFlag = false;
```

(Preserves `wave` object reference via in-place mutation; preserves `spawnProgress` array reference via `.length = 0`.)

---

## updateWave state machine

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

  // phase === 'won' — no-op; winFlag already set; frame-loop guard prevents re-entry
}
```

### Timing consequences

- First prep: 15 s of placement time before any drone spawns.
- Wave 1 ISR stream: 5 × 1.5s = 7.5 s to spawn all; last ISR exits south ~5s after spawn = ~12.5 s active; then prep for wave 2 starts.
- Wave 5 saturation: 8 ISR × 1s + 12 OWA × 0.8s + 4 Payload × 2.5s = longest spawn at 12 s, + ~10 s flight = ~22 s. Full session ≈ ~80 s of active + 4×15 s prep = ~140 s.

### Spawn timer pattern

- Each type has its own timer; types spawn concurrently (wave 5's ISR/OWA/Payload all flow at once).
- `spawnRotation` on `gameState` (round-robin per-type corridor selection, existing from drones plan) is inherited unchanged — wave spawns use the same corridor round-robin.

---

## UI

### Palette WAVE/NEXT (renderWaveHud)

Rename `renderWavePlaceholder` → `renderWaveHud`. Accepts `state`. Reads `state.wave.number`, `state.wave.phase`, `state.wave.prepMs`.

Top line: `WAVE ${number}/5` — always. Color: successGreen (won) or accentWhite (else... actually the palette spec already uses successGreen for WAVE text; keep).

Bottom line:
- `phase === 'prep'`: `NEXT 0:${String(Math.ceil(prepMs/1000)).padStart(2, '0')}` — amber → counts down 0:15 to 0:00.
- `phase === 'active'`: `INCOMING` — amber, static.
- `phase === 'won'`: `COMPLETE` — successGreen, static.

### Pre-wave chevrons (waveTelegraph.js)

Renders only when `state.wave.phase === 'prep'`.

For each drone type in `CONFIG.waves[state.wave.number - 1].drones`, find its spawn edge from `MAP.spawnEdges` (N/S/W/E). Render one chevron + icon per type-edge pair.

**Chevron positions** (virtual pixels):
- N edge: chevron at (edge-band midpoint, y=30), pointing DOWN (triangle base at top, apex at bottom)
- S edge: chevron at (midpoint, y=240), pointing UP
- W edge: chevron at (x=6, midpoint-of-map-region), pointing RIGHT
- E edge: chevron at (x=474, midpoint), pointing LEFT

Edge midpoint X for N/S = 240 (map horizontal center). Edge midpoint Y for W/E = 131 (top-bar-height 24 + padTop 11 + 8 tiles × 24 / 2 = 131).

**Drone-type icon** next to chevron (6 px offset toward the outside): 8×8 square using `bodyColorFor(type)` from drones.js. Position along the edge such that chevron is between icon and map interior.

**Pulse:** amber (alertAmber) chevron fill alternates bright/dim at 2 Hz: `Math.floor(tMs / 500) % 2 === 0 ? alertAmber : gridLine`. Ties to rAF's tMs — pass it through `renderWaveTelegraph(ctx, state, tMs)`.

Multiple types on the same edge (rare — only wave 5 at N) would overlap. Current waves: N=ISR only, S=OWA only, W=Payload, E=Payload. No collisions.

### Win overlay (winOverlay.js)

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

Mirrors loseOverlay — same scrim, same restart hint, green accent instead of red.

---

## main.js integration

### Imports

Add to existing game imports:
```js
import { updateWave } from './game/wave.js';
```

Add alongside ui imports:
```js
import { renderWaveTelegraph } from './ui/waveTelegraph.js';
import { renderWinOverlay } from './ui/winOverlay.js';
```

### Update block

Current:
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

New:
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

`updateWave` runs LAST in the gameplay block so any drones spawned this frame count toward `state.drones` before the clear-check fires on the same frame. (Edge case: spawning a drone and immediately detecting "all spawned + empty" would need the drone to survive at least one update tick; adding updateWave last means this frame's spawns are captured before next frame's clear-check runs. Safe.)

### Render block

Current end:
```js
renderPlacement(ctx, gameState);
renderLoseOverlay(ctx, gameState);
```

New:
```js
renderPlacement(ctx, gameState);
renderWaveTelegraph(ctx, gameState, tMs);
renderLoseOverlay(ctx, gameState);
renderWinOverlay(ctx, gameState);
```

Telegraph renders BEFORE the overlays so overlays cover it if both should show (edge case: won flag set but telegraph somehow active — won guard early-returns so this is fine).

### Restart handlers

Click listener (top of handler):
```js
if (gameState.loseFlag || gameState.winFlag) {
  resetGameState();
  return;
}
```

Keydown:
```js
if ((gameState.loseFlag || gameState.winFlag) && (e.key === ' ' || e.key === 'Enter')) {
  resetGameState();
  e.preventDefault();
}
```

### Palette call site

`renderPalette(ctx, gameState)` already takes state. The internal `renderWavePlaceholder(ctx, paletteY)` becomes `renderWaveHud(ctx, state, paletteY)` and is called from `renderPalette`. Signature stays the same at the module boundary.

---

## config.js change

Find:
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

Existing `runDevSpawner` in drones.js already checks `CONFIG.devSpawner.enabled` and early-returns when false. No drones.js change needed.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, load page. Palette shows `WAVE 1/5` + `NEXT 0:15`, counting down. Amber chevron pulsing at the top-center of the N edge with a red (ISR) 8×8 icon next to it. No drones spawning yet.
2. Wait 15 s. Palette flips to `INCOMING`. First ISR spawns at T+1.5s (first spawnInterval tick). 4 more follow at 1.5 s each.
3. Clear all 5 ISR → wave 1 ends → +$200 bonus → palette `WAVE 2/5` + `NEXT 0:15`. Same N-edge chevron (wave 2 is still ISR-only, 8 of them at 1.2s).
4. Wave 3 prep: chevrons at both N (ISR-red) and S (OWA-amber). Active: ISR and OWA spawn concurrently.
5. Wave 4 prep: S (OWA) + W and E (Payload — violet icons). Wave 5 prep: all four edges.
6. Survive all 5 → `CITY HELD` overlay in successGreen with `CLICK TO RESTART`. Click / Space / Enter restarts from wave 1.
7. Lose partway (let structures die) → DEFENSE FAILED still works. Restart resets wave to 1 prep too.
8. Console: no errors. `gameState.wave.phase` transitions `prep → active → prep → ... → won`. `gameState.resources` climbs with each wave clear (+$200).

Add a `PLAYTESTS.md` entry.

---

## Queued doc updates

- `DECISIONS.md` — wave state machine shape; prep/active/won phases; wave-clear condition (all spawned + drones empty); starts in prep for W1; $200 wave bonus paid on clear; chevrons only during prep; dev spawner disabled not deleted; win overlay mirrors lose.
- `TODO.md` — check off Step 4 (wave system) and close Step 6's win half.
