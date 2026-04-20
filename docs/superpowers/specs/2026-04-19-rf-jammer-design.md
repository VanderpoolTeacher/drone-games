# RF Jammer Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm
**Scope:** Enable the second palette button (RF Jammer). Add area-slow mechanic: drones in any RF Jammer's range move slower, scaled by per-drone-type effectivenessVs. No damage, no kills — pair with Interceptor or Laser for hard-kill. Unlocks "layered defense" playable.

Builds on the defenses-placement-interceptor branch. Re-uses placement UX, palette system, economy, and defense render pipeline.

## Out of scope

- Laser, HPM (separate plans).
- RF Jammer's 2-frame pulsing ring animation (polish plan).
- Jammed-drone visual tint (polish plan).
- Real "squat tower with dish" sprite (polish plan).
- Soft-kill effects beyond slow (jamming could realistically also disable ISR "defense contact" behaviors, but that mechanic isn't built yet).
- Sounds.

---

## Design thesis alignment

From `DESIGN.md`: layered defense + cost-exchange. RF Jammer is the cheapest defense ($50) and it covers the cheapest drones (ISR). It proves a specific DESIGN.md table: **"RF Jammer is strong vs ISR, weak vs OWA, weak vs Payload."** The scaled slow formula encodes that table directly — ISR fully slowed, OWA barely slowed, Payload barely slowed.

The player will discover that placing RF Jammers at N-corridor chokepoints handles ISR cheaply while leaving Interceptors free to engage OWA / Payload. This is the first visible "layered" moment in the game.

---

## Slow mechanic

### Formula

```
const eff = CONFIG.defenses.rfJammer.effectivenessVs[drone.type] ?? 0;
const perJammerMultiplier = 1 - (1 - CONFIG.defenses.rfJammer.slowFactor) * eff;
```

With `slowFactor = 0.5` and the config's `effectivenessVs`:

| Drone | eff | perJammerMultiplier | Effective speed |
|---|---|---|---|
| ISR | 1.0 | 0.5 | 60 → 30 px/s |
| OWA | 0.3 | 0.85 | 140 → 119 px/s |
| Payload | 0.2 | 0.9 | 30 → 27 px/s |

### Stacking

When multiple RF Jammers cover one drone, take the **minimum** multiplier (strongest slow wins; no stacking exploit):

```
drone.speedMultiplier = min(1, ...allInRangeJammers.map(perJammerMultiplier))
```

Drones outside any jammer range: `speedMultiplier = 1` (no slow).

### Lifecycle

- `drone.speedMultiplier` is recomputed every frame from scratch. No accumulation, no decay.
- When a drone leaves all jammer ranges, its multiplier returns to 1 on the next frame.
- When a jammer is placed, affected drones feel the slow immediately.

---

## Frame order change

Current:
```
updateDrones / updateDefenses / updateProjectiles / updateExplosions
```

New:
```
applyJamEffects(state)        // NEW — sets drone.speedMultiplier based on current jammer positions
updateDrones(state, dt)       // motion uses drone.speedMultiplier
updateDefenses(state, dt)     // dispatches: interceptor fires; rfJammer no-op
updateProjectiles(state, dt)
updateExplosions(state, dt)
```

`applyJamEffects` runs FIRST so the current frame's motion reflects current jammer coverage.

---

## Data model

### Drone (addition)

```js
{
  ...existing fields,
  speedMultiplier: 1,    // 0 < n ≤ 1; 1 = full speed, lower = slowed
}
```

Initialized to 1 on spawn. Mutated each frame by `applyJamEffects`.

### Defense (no change)

RF Jammer uses the same defense shape as Interceptor. No per-jammer state: no cooldown, no target, no pulsing-ring-frame counter (deferred to polish plan).

---

## applyJamEffects

New function in `src/game/defenses.js`:

```js
export function applyJamEffects(state) {
  const cfg = CONFIG.defenses.rfJammer;
  for (const d of state.drones) {
    if (d.hp <= 0 || d.phase === 'done') { d.speedMultiplier = 1; continue; }

    let minMult = 1;
    for (const def of state.defenses) {
      if (def.type !== 'rfJammer') continue;
      const dx = d.x - def.x, dy = d.y - def.y;
      if (Math.hypot(dx, dy) > cfg.range) continue;
      const eff = cfg.effectivenessVs[d.type] ?? 0;
      const mult = 1 - (1 - cfg.slowFactor) * eff;
      if (mult < minMult) minMult = mult;
    }
    d.speedMultiplier = minMult;
  }
}
```

O(defenses × drones) per frame. At v1 scale (max ~10 defenses × ~20 drones = 200 pairs), trivial.

---

## updateDefenses dispatch

Current `updateDefenses` guards on `d.type !== 'interceptor'` early-continue. Keep that structure. Add an explicit `rfJammer` branch that's a no-op (so the intent is clear):

```js
for (const d of state.defenses) {
  d.cooldownMs = Math.max(0, d.cooldownMs - dt * 1000);
  if (d.type === 'interceptor') {
    if (d.cooldownMs > 0) continue;
    const target = pickInterceptorTarget(state, d);
    if (!target) { d.targetId = null; continue; }
    fireInterceptor(state, d, target);
    d.cooldownMs = CONFIG.defenses.interceptor.cooldown;
    d.targetId = target.id;
  } else if (d.type === 'rfJammer') {
    // area effect handled by applyJamEffects; nothing per-defense
  }
}
```

---

## Motion integration

Every site in `src/game/drones.js` that reads `CONFIG.drones[d.type].speed` (or equivalent) multiplies by `d.speedMultiplier ?? 1`.

Sites to update (concrete — lines will shift as code evolves):

1. `advanceCruise` — `const speed = CONFIG.drones[d.type].speed` → `const speed = CONFIG.drones[d.type].speed * (d.speedMultiplier ?? 1);`
2. `updateIsr` exit phase — `d.vy = CONFIG.drones.isr.speed * (d.speedMultiplier ?? 1);`
3. `updateIsr` cruise phase — `const speed = CONFIG.drones.isr.speed * (d.speedMultiplier ?? 1);`
4. `updateOwa` terminal phase — `const speed = CONFIG.drones.owa.speed * (d.speedMultiplier ?? 1);`

Payload uses `advanceCruise` — covered by site 1.

spawnDrone initializes `speedMultiplier: 1` in the drone object literal.

---

## Render

### Defense placeholder accent (differentiate types)

Current `renderDefenses` draws: 24×24 cyan square + amber 2×2 tip pixel. That's identical for both types. Add a per-type accent:

- **Interceptor**: amber 2×2 tip pixel at top-center (existing — unchanged).
- **RF Jammer**: cyan 4×2 "dish" pixel at top-center (wider, brighter); placed 1 px above the top edge of the defense square to suggest a dish protruding. Color `CONFIG.colors.accentWhite` for contrast against the cyan body.

Implementation:

```js
export function renderDefenses(ctx, state) {
  for (const d of state.defenses) {
    ctx.fillStyle = CONFIG.colors.friendlyCyan;
    ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2), Math.floor(d.y - DEFENSE_SIZE / 2), DEFENSE_SIZE, DEFENSE_SIZE);

    if (d.type === 'interceptor') {
      ctx.fillStyle = CONFIG.colors.alertAmber;
      ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
    } else if (d.type === 'rfJammer') {
      ctx.fillStyle = CONFIG.colors.accentWhite;
      ctx.fillRect(Math.floor(d.x) - 2, Math.floor(d.y - DEFENSE_SIZE / 2) - 1, 4, 2);
    }
  }
}
```

### Placement range preview (dashed for jammer)

`drawGhostAndRange` in `src/ui/placement.js` currently draws a solid circle. For RF Jammer, draw a **dashed** circle using `ctx.setLineDash([3, 3])`:

```js
if (range > 0) {
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;
  if (type === 'rfJammer') {
    ctx.setLineDash([3, 3]);
  }
  ctx.beginPath();
  ctx.arc(cx + 0.5, cy + 0.5, range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);   // reset so other strokes aren't affected
}
```

This matches `STYLE.md:77` ("dashed cyan circle, faint" for RF Jammer) vs `STYLE.md:82` (solid for Interceptor).

---

## Palette

In `src/ui/palette.js`:

```js
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: true  },   // was false
  { type: 'interceptor',     label: 'INTRCPT', enabled: true  },
  { type: 'laser',           label: 'LASER',   enabled: false },
  { type: 'hpm',             label: 'HPM',     enabled: false },
];
```

Everything else in the palette pipeline — affordability check, selection highlight, click-to-arm — already works for any `enabled: true` button. No changes.

---

## Files touched

```
src/game/drones.js       MODIFIED — speedMultiplier spawn init + motion math × 4 sites
src/game/defenses.js     MODIFIED — add applyJamEffects + rfJammer branch in updateDefenses + per-type accent in renderDefenses
src/main.js              MODIFIED — import and call applyJamEffects at top of update block
src/ui/placement.js      MODIFIED — dashed range ring for rfJammer
src/ui/palette.js        MODIFIED — enable rfJammer button
PLAYTESTS.md             MODIFIED — log session
```

No new files. Just expands existing modules.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve` → load page. Observe: palette shows INTRCPT + RF JAM both cyan (both affordable at $400 start). LASER / HPM still dim.
2. Click RF JAM → armed. Placement cursor shows ghost with **dashed** range circle (radius 80 — smaller than Interceptor's 100).
3. Click a valid zone in the N corridor — e.g. (1,1) or (6,1) — RF Jammer places for $50. Resources 400 → 350. Defense sprite: cyan square with white 4×2 dish on top (not amber tip — that's Interceptor).
4. Watch ISR drones pass through the jammer range: visibly slow to roughly half speed.
5. Watch OWA drones if they enter range: barely slow (15% reduction — visible but subtle).
6. Place a second RF Jammer overlapping the first: drones in overlap don't double-slow (min rule).
7. Place an Interceptor nearby. ISR that's slowed spends longer in the Interceptor's range → easier to kill. The "layered" moment lands.
8. No console errors, no projectiles from RF Jammer (it's soft-kill only), no kill bonuses (must pair with hard-kill).

Add a `PLAYTESTS.md` entry with observations.

---

## Queued doc updates

- `DECISIONS.md` — log: RF Jammer slow formula is `1 - (1 - slowFactor) × effectivenessVs`; stacking = min (strongest wins); RF Jammer always-on passive (no cooldown); placeholder accent = white 4×2 dish to distinguish from Interceptor amber tip.
- `TODO.md` — check off Step 2b; Step 2c (Laser) now next.
