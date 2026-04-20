# Laser Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm
**Scope:** Enable the third palette button (Laser). High-Energy Laser (HEL) — continuous-fire, high-damage hard-kill with an overheat/cooldown cycle. Highest single-target DPS at the cost of thermal management. Pairs with RF Jammer (slowed ISR are easy lens-on-target) and covers the Payload matchup that Interceptor chews through inefficiently.

Builds on defenses-placement-interceptor + rf-jammer branches. Re-uses placement UX, palette system, economy, and targeting helper (which gets extracted from Interceptor-only into a shared helper this branch).

## Out of scope

- HPM (separate plan, stretch).
- Real "tall narrow focusing lens" sprite (polish plan).
- Beam glow / bloom FX, pulsing-during-fire (polish plan).
- Manual lens rotation toward targets (not in design — lens is always "facing" wherever the beam points).
- Overheat warning sound, beam ignition sound (polish plan).
- Wave system, structure HP (their own plans).

---

## Design thesis alignment

Per DESIGN.md matchup table, Laser is **strong vs OWA/Payload**, **weak vs ISR**. This spec encodes that literally via `effectivenessVs`:

| Drone | HP | eff | Effective DPS | Time to kill |
|---|---|---|---|---|
| ISR | 20 | 0.3 | 12 | ~1.67s |
| OWA | 15 | 1.0 | 40 | ~0.38s |
| Payload | 120 | 1.2 | 48 | ~2.5s |

The 3-second overheat budget reads as "one Payload" or "~8 OWAs" or "1.8 ISRs" per cycle. Sustained Payload pressure forces Laser placements to the Payload corridors (W→E, E→W). ISR's inefficiency pushes the player toward RF Jammer for that class. The thesis lands.

---

## Architecture

- Central `gameState` unchanged.
- `updateDefenses` gains a `laser` dispatch branch alongside `interceptor` and the existing `rfJammer` no-op.
- **Refactor:** extract `pickInterceptorTarget` → generic `pickClosestToStructureTarget(state, d, range)`. Interceptor and Laser share it.
- New exported function `renderBeams(ctx, state)` renders continuous laser beams. Separate from `renderProjectiles` because beams and projectiles are different primitives with different render timing (beams recompute each frame from live target position; projectiles are fire-and-forget).
- Defense object gains `heatMs` and `overheated` fields. Harmless for non-laser defenses (unused).

### File layout (net changes)

```
src/
  main.js                 MODIFIED — import + call renderBeams after renderDrones
  game/
    defenses.js           MODIFIED — refactor pickInterceptorTarget → shared helper;
                                    add laser branch to updateDefenses;
                                    add heatMs/overheated to placeDefense init;
                                    add renderBeams export;
                                    extend renderDefenses with laser accent (state-sensitive)
  ui/
    palette.js            MODIFIED — laser.enabled → true
PLAYTESTS.md               MODIFIED — session entry
```

No new files. `placement.js` untouched — Laser uses the default solid range ring.

---

## Heat + overheat model

### Defense fields (additions to the defense object)

```js
{
  ...existing fields,
  heatMs: 0,          // 0 = cold, overheatTime = overheated (3000 ms for laser)
  overheated: false,  // while true, laser can't fire; cooldownMs ticks down toward 0
}
```

Both fields added in `placeDefense` unconditionally. Harmless for interceptor / rfJammer (never read).

### Update rules

Per-tick inside the `laser` branch (after the existing top-of-loop `cooldownMs -= dt*1000` decrement that runs for every defense):

```
if overheated:
  if cooldownMs <= 0:
    overheated = false
    heatMs = 0
  targetId = null
  (skip firing)
else:
  target = pickClosestToStructureTarget(state, d, CONFIG.defenses.laser.range)
  if target:
    eff = CONFIG.defenses.laser.effectivenessVs[target.type] ?? 1
    target.hp -= CONFIG.defenses.laser.dps * dt * eff
    heatMs += dt * 1000
    if heatMs >= CONFIG.defenses.laser.overheatTime:
      overheated = true
      cooldownMs = CONFIG.defenses.laser.cooldownTime
    targetId = target.id
  else:
    heatMs = max(0, heatMs - dt * 1000)   // passive cooling while idle
    targetId = null
```

### Timing consequences

- Fire 3s on ISR only: ISR dies at 1.67s, laser idles, heatMs drops by 1.33s worth → heatMs = 1670ms. Can fire another 1330ms = kill one more ISR without overheating. Total two ISRs per 3s→idle window.
- Fire continuously on Payload: 2.5s kill, heatMs = 2500ms, 500ms to overheat. Laser overheats 500ms after Payload dies if it can find another target immediately. Otherwise passive cool.
- OWA stream: each kill costs 380ms of heat, 380ms passive cool between kills → steady-state equilibrium, no overheat on sparse OWA streams. If OWAs arrive faster than 1-per-760ms: overheat triggers.

This teaches thermal management without needing to explain it — the player learns by watching the lens turn amber.

---

## pickClosestToStructureTarget (shared helper)

Extract the existing `pickInterceptorTarget` body into a generic helper. Current:

```js
function pickInterceptorTarget(state, d) {
  const R = CONFIG.defenses.interceptor.range;
  ...
}
```

Becomes:

```js
function pickClosestToStructureTarget(state, d, range) {
  const R = range;
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
```

Interceptor dispatch line changes from `pickInterceptorTarget(state, d)` to `pickClosestToStructureTarget(state, d, CONFIG.defenses.interceptor.range)`. Laser calls it with `CONFIG.defenses.laser.range`.

Remove the now-unused `pickInterceptorTarget` wrapper.

---

## renderBeams

New export. Drawn after `renderDrones` in the main frame (layer 9, between drone sprites and explosions).

```js
export function renderBeams(ctx, state) {
  ctx.strokeStyle = CONFIG.colors.accentWhite;
  ctx.lineWidth = 1;
  for (const d of state.defenses) {
    if (d.type !== 'laser') continue;
    if (d.overheated) continue;
    if (!d.targetId) continue;
    const target = state.drones.find(dr => dr.id === d.targetId);
    if (!target || target.hp <= 0 || target.phase === 'done') continue;

    ctx.beginPath();
    ctx.moveTo(d.x + 0.5, d.y + 0.5);
    ctx.lineTo(target.x + 0.5, target.y + 0.5);
    ctx.stroke();
  }
}
```

`state.drones.find` is O(drones). At v1 scale (max ~20 drones × max a few lasers) trivial.

Beam recomputes every frame from live target position. No beam state on the defense beyond `targetId`.

---

## Sprite accent (extend renderDefenses)

Current per-type branch:

```js
if (d.type === 'interceptor') {
  // amber 2x2 tip
} else if (d.type === 'rfJammer') {
  // white 4x2 dish
}
```

Add laser branch:

```js
} else if (d.type === 'laser') {
  const color = d.overheated ? CONFIG.colors.alertAmber : CONFIG.colors.accentWhite;
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
}
```

Normal state: 2×2 white lens at top-center (inside the cyan square). Overheated: same position, amber. The state flip is visible in real time during gameplay.

Note: Interceptor uses amber 2×2 at the same position. An overheated Laser visually matches an Interceptor. Acceptable because:
1. The player placed these defenses and knows which is which.
2. Overheat is a transient 2-second state.
3. Future polish plan will add real sprites (STYLE.md: "tall narrow with focusing lens") that differentiate silhouette, not just accent.

---

## Palette

In `src/ui/palette.js`:

```js
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: true  },
  { type: 'interceptor',     label: 'INTRCPT', enabled: true  },
  { type: 'laser',           label: 'LASER',   enabled: true  },   // was false
  { type: 'hpm',             label: 'HPM',     enabled: false },
];
```

Nothing else. Existing affordability / selection / cancel logic already handles the new enabled button.

---

## placeDefense

Add `heatMs: 0, overheated: false,` to the drone object literal in `placeDefense`. Fields are harmless on non-laser defenses.

```js
const defense = {
  id: ++state.defenseIdCounter,
  type,
  tile: { x: tile.x, y: tile.y },
  x,
  y,
  cooldownMs: 0,
  targetId: null,
  heatMs: 0,
  overheated: false,
};
```

---

## Main loop

Import `renderBeams` alongside existing defense exports:

```js
import { updateDefenses, renderDefenses, placeDefense, applyJamEffects, renderBeams } from './game/defenses.js';
```

Insert `renderBeams` between `renderDrones` and `renderProjectiles`:

```js
renderMap(ctx, tMs);
renderDefenses(ctx, gameState);
renderDrones(ctx, gameState);
renderBeams(ctx, gameState);         // NEW — layer 9 (beams)
renderProjectiles(ctx, gameState);   // layer 9 continued (projectiles)
renderExplosions(ctx, gameState);
renderChrome(ctx);
renderPalette(ctx, gameState);
renderLegend(ctx);
renderPlacement(ctx, gameState);
```

Beam draws BEFORE projectiles so a projectile (or explosion) during the same frame renders on top of the beam line. Minor visual priority; both are in the same "layer 9" per spec.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve` → load page. Palette: RF JAM / INTRCPT / LASER all cyan; HPM still dim.
2. Click LASER → solid range circle, radius 120 (visibly larger than Interceptor's 100).
3. Place a Laser at a zone covering the Payload corridor (e.g. (8, 5) or (12, 5)). Resources 400 → 200.
4. Wait for a Payload crossing → white beam flashes from the Laser to the Payload continuously for ~2.5s. Payload HP drops to 0, dies. If another drone is in range immediately: beam retargets, heat keeps climbing. If not: heat cools passively.
5. Hold continuous fire for the full 3s → **lens turns amber**. Beam cuts out. 2s later, lens returns to white; firing resumes.
6. Place a Laser covering the N corridor. Watch ISR drones take ~1.7s each to kill — notably slow. Compare to RF Jammer + Interceptor: clearly more efficient. Player learns the matchup.
7. No console errors. `gameState.defenses` stays bounded. Heat state observable by watching the lens color.

Add a `PLAYTESTS.md` entry with observations.

---

## Queued doc updates

- `DECISIONS.md` — log: Laser uses passive-cooling heat model; shares pickClosestToStructureTarget helper with Interceptor; beam rendered each frame from live target position (separate render function); overheated lens = amber color shift.
- `TODO.md` — check off Step 2c. Step 2d (HPM stretch) becomes next.
