# Defenses + Placement (Interceptor) Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm (sections 1 + 2 + 3)
**Scope:** Placement UX + defense palette + economy + one working defense (Interceptor). Kinetic hard-kill: click a zone, place an Interceptor, watch it fire on drones, earn kill bonuses, spend resources.

This spec builds on the map-foundation + drones-traversal specs. Map geometry, placement zones, drone behaviors, corridor data are all taken as given. Drone `hp` field (already in the drone object) becomes *meaningful* in this plan for the first time.

## Out of scope

Handled by later plans; do not build here:

- RF Jammer, Laser, HPM (they appear in the palette as **disabled placeholders** only).
- Wave system + pre-wave telegraphs (dev auto-spawner continues).
- Structure HP + win/lose.
- ISR "disable defense on contact" mechanic.
- Real sprites, cooldown fill animation, CRT, sounds.
- "Click placed defense to see its range" inspection UI.
- Sell / reposition defenses.

---

## Design thesis alignment

From `DESIGN.md`: layered defense + cost-exchange. This plan delivers the first *active defender choice*. A single defense (Interceptor) covers only one leg of the tri-drone matchup. That mismatch will be visible: Interceptor wrecks OWA and Payload but wastes cooldowns on fast ISR scouts. The incompleteness is the point — it motivates the follow-up plans that add the other defense classes.

---

## Architecture

- **Central mutable game state** continues in `src/game/state.js`. Additions documented below.
- **Per-concern modules** following the drones plan pattern:
  - `src/game/defenses.js` — data + update + render + targeting + firing
  - `src/game/projectiles.js` — physics + hit detection + render
  - `src/ui/palette.js` — palette rendering + button hit-testing
  - `src/ui/placement.js` — placement cursor + validity overlay + tile hit-testing
- **Input listeners** added in `src/main.js` (mouse move, click, right-click, Escape).

### File layout (net changes)

```
src/
  main.js                   MODIFIED — add input listeners + new render calls
  config.js                 unchanged (uses existing defenses/economy values)
  game/
    state.js                MODIFIED — adds defenses, projectiles, resources, placementMode, hoverTile, counters
    drones.js               MODIFIED — drone-death path (hp <= 0 → explosion + kill bonus + splice)
    defenses.js             NEW      — Defense entities, targeting, firing
    projectiles.js          NEW      — Projectile physics + hit detection
    map.js                  unchanged
    mapRenderer.js          unchanged
    explosions.js           unchanged
  ui/
    palette.js              NEW      — Palette rendering + hit test
    placement.js            NEW      — Ghost cursor + validity overlay + tile hit test
    uiChrome.js             unchanged
    legend.js               unchanged
```

---

## Data model additions

### `gameState` (appended — don't remove existing fields)

```js
export const gameState = {
  // ... existing drones, explosions, counters, devSpawnTimer ...
  defenses: [],
  projectiles: [],
  resources: CONFIG.startingResources,   // 400
  placementMode: null,                   // null or { type: 'interceptor' }
  hoverTile: null,                       // null or { x, y } in tile coords
  defenseIdCounter: 0,
  projectileIdCounter: 0,
};
```

### Defense object (plain)

```js
{
  id: <int>,
  type: 'interceptor',            // future: rfJammer / laser / hpm
  tile: { x, y },
  x: <pixel center>, y: <pixel center>,
  cooldownMs: 0,                  // 0 = ready
  targetId: null,                 // last drone id fired at (debug/UI hint)
}
```

### Projectile object (plain)

```js
{
  id: <int>,
  x, y,
  vx, vy,               // px/sec
  targetDroneId,
  damage,
}
```

Projectile flies in a **straight line** at 200 px/s (`CONFIG.defenses.interceptor.projectileSpeed`). No homing. If the target drone dodges or is killed by another interceptor mid-flight, the projectile continues on its original vector and may hit any drone it proximates within 8 px. That's intentional — it reads as a real kinetic shot, not a guided missile.

### Drone-death path (modification)

Currently drones despawn on `phase === 'done'` or off-grid. Add: when `d.hp <= 0`, push an explosion at the drone's position, credit `CONFIG.resourcesPerDroneKill[d.type]` to `state.resources`, set `d.phase = 'done'`. The existing filter then splices.

---

## Update flow

Per-frame order in `src/main.js`:

```js
updateDrones(gameState, dt);          // existing — positions, phases, trails
updateDefenses(gameState, dt);        // NEW — cooldowns, targeting, firing
updateProjectiles(gameState, dt);     // NEW — movement + hit detection
updateExplosions(gameState, dt);      // existing
```

### `updateDefenses`

```js
for each defense d:
  d.cooldownMs = max(0, d.cooldownMs - dt*1000)
  if d.cooldownMs > 0: continue
  if d.type != 'interceptor': continue    // future types handled by their own branch

  inRange = drones within CONFIG.defenses.interceptor.range px of (d.x, d.y)
  if empty:
    d.targetId = null
    continue

  target = drone in inRange minimizing (min distance to any structure pixel center)
  // ties broken by lower drone.id for determinism

  spawn projectile from (d.x, d.y) toward (target.x, target.y) at 200 px/s
  d.cooldownMs = CONFIG.defenses.interceptor.cooldown   // 1500 ms
  d.targetId = target.id
```

### `updateProjectiles`

```js
for each projectile p:
  p.x += p.vx * dt
  p.y += p.vy * dt

  hit = any drone within 8 px of (p.x, p.y)
  if hit:
    hit.hp -= p.damage                         // damage defined at projectile spawn
    mark projectile for removal
  else if offGrid(p, 24 margin):
    mark for removal

splice removed projectiles
```

Single-pass removal; no multi-target per projectile.

### Drone-death handling inside `updateDrones`

At the top of the existing drone-loop OR before the final filter, add:

```js
for each drone d in state.drones:
  if d.hp <= 0 && d.phase !== 'done':
    state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 })
    state.resources += CONFIG.resourcesPerDroneKill[d.type]
    d.phase = 'done'
```

The existing `filter(d => d.phase !== 'done' && !isOffGrid(d))` then splices.

---

## Targeting detail: "closest to any structure"

For each candidate drone in Interceptor range, compute:
```
minStructDist = min over MAP.structures of distance(drone.pos, structure.pixelCenter)
```
Pick the drone with the lowest `minStructDist`. This prioritizes the drone that's about to hit anything, not the drone closest to the Interceptor itself.

Consequence: an Interceptor will let a close ISR zip by if a more distant OWA is bearing down on a structure. Tactically "correct" (the OWA is the real threat) even if surprising. Player learns to place Interceptors where structures are, not where drones first appear.

---

## Placement UX

### Flow (locked)

1. Player clicks an **affordable + enabled** palette button → `placementMode = { type }`.
2. Cursor over the map shows a **ghost** of the defense sprite + **range circle** at the hovered tile's center.
3. Tiles NOT in `MAP.placementZones` (and occupied zones) show a **red pixel overlay** while armed.
4. Player clicks a valid zone → defense placed, `resources -= cost`, `placementMode = null`.
5. Cancels: **ESC**, **right-click**, or **click the same palette button again**.

### Valid-zone definition

```js
isValidZone(tile) = MAP.placementZones.some(z => z.x === tile.x && z.y === tile.y)
                 && !state.defenses.some(d => d.tile.x === tile.x && d.tile.y === tile.y)
                 && state.resources >= CONFIG.defenses[placementMode.type].cost
```

Resource check is part of validity so an unaffordable click at the last moment (cost dropped under budget between arm and click) rejects.

### Input translation

`toVirtual(clientEvent)` converts DOM `clientX/Y` to virtual coords via:
```js
const rect = canvas.getBoundingClientRect();
const vx = (clientX - rect.left) / CONFIG.scale;
const vy = (clientY - rect.top)  / CONFIG.scale;
```

`pixelToTile(vx, vy)` inverses the existing `tileToPixel` (subtract top-bar + padTop; divide by tileSize; floor).

---

## Palette UI (layout C)

Bottom bar (480×32 px) content:

```
$400                [RF JAM][INTRCPT][LASER][HPM]           WAVE 1/5
RES                                                         NEXT 0:12
```

- **Left (~80 px):** amber resources value (9 px font), white "RES" label under.
- **Center (~260 px):** 4 buttons, 60 px wide × 28 px tall, 4 px gap between, centered horizontally in the remaining band.
- **Right (~100 px):** green wave-indicator placeholder + amber countdown. Wave system isn't built; render `WAVE 1/5` and a static `NEXT 0:12` as placeholders. Real values come with the wave plan.

Button content:
```
RF JAM    INTRCPT   LASER     HPM
$50       $100      $200      $300
```

Button state mapping:
| Button state | Border | Text | Cost color | Hit-testable |
|---|---|---|---|---|
| Live + affordable | friendlyCyan | friendlyCyan | alertAmber | yes (Interceptor only this plan) |
| Live + unaffordable | gridLine | gridLine | gridLine | yes (resource check rejects placement) |
| Selected | alertAmber | alertAmber | alertAmber | yes (click-again cancels) |
| Disabled (RF/Laser/HPM this plan) | gridLine | gridLine | gridLine | no (click passes through) |

State transitions are single-frame. No tweening.

---

## Placement rendering

While `state.placementMode` is non-null:

1. **Valid-zone highlight:** for every zone in `MAP.placementZones` that's not occupied, draw a brighter-than-normal cyan diamond (step up the existing pulse; pulses still, but starts bright).
2. **Invalid overlay:** for every land tile that ISN'T a valid zone and is inside the map region, draw a 2×2 threat-red pixel at tile center.
3. **Ghost sprite at `hoverTile`:** 24×24 friendlyCyan square at 50 % alpha (use globalAlpha save/restore).
4. **Range circle at `hoverTile`:** 1 px cyan circle of radius `CONFIG.defenses.interceptor.range` (100 px) centered on the tile's pixel center. Drawn even if hoverTile is over an invalid cell — informs the player where *any* placement reaches.
5. **If hoverTile is itself an invalid target:** overlay a red X (2-line diagonal) over the ghost so the click-affordance reads "can't place here."

### Defense rendering (post-placement)

For each placed defense (layer 6, before drones):
- 24×24 friendlyCyan square at its pixel center.
- Single amber accent pixel at (cx, cy-DRONE_SIZE/2+1) for "launcher barrel tip" placeholder cue.
- No cooldown indicator (polish plan).

### Projectile rendering (layer 9)

For each projectile: 2×2 friendlyCyan square at `(floor(x-1), floor(y-1))`.

---

## Input wiring

Listeners bind once at boot in `src/main.js`. Single canvas element, all events scoped there.

```js
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('click', onClick);
canvas.addEventListener('contextmenu', onRightClick);  // e.preventDefault()
window.addEventListener('keydown', onKeyDown);         // ESC
```

- `onMove`: compute virtual coords, set `gameState.hoverTile = pixelToTile(vx, vy)` (or null if outside map region).
- `onClick`: (a) palette hit → toggle placementMode; (b) map hit + placementMode → validate + place or reject silently.
- `onRightClick`: `gameState.placementMode = null;` and `e.preventDefault()`.
- `onKeyDown`: if `e.key === 'Escape'` → `gameState.placementMode = null`.

---

## Render order (layer 1–13 extension)

```
renderMap              layers 1–5 (water, land, coast, zones, structures)
renderDefenses         layer 6                  NEW
renderDrones           layer 8 (trails + sprites, existing)
renderProjectiles      layer 9                  NEW
renderExplosions       layer 9 continued
renderChrome           layer 11
renderPalette          layer 11b — palette content on the chrome NEW
renderLegend           layer 11c
renderPlacement        layer 12 — ghost + range + red overlays NEW
```

Range preview during placement renders on layer 12 (last before CRT) so it's always on top.

---

## Economy

From `CONFIG`:
- `startingResources: 400` → 4 Interceptors affordable at start.
- `resourcesPerDroneKill: { isr: 10, owa: 15, payloadDelivery: 35 }`.
- Interceptor cost: `100`.
- Per-wave bonus (200) is unused in this plan — wave system doesn't exist yet.

Bankruptcy is implicit: if `resources < cost`, the button dims. No game-over.

Kill credit is paid the moment `hp <= 0`, not when explosion completes.

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve` → load page.
2. **Within 5 s:** palette visible in bottom bar, 4 buttons, only Interceptor has cyan border; resources shows `$400`.
3. **Click Interceptor button:** its border turns amber (selected). Cursor shows ghost sprite + range circle following the mouse over the map. Invalid tiles show red dots.
4. **Click a valid zone:** defense appears, `$400` → `$300`, palette de-selects.
5. **Wait for a drone to enter range:** projectile (cyan 2×2) shoots from defense toward drone, damage lands, drone either shrugs it off or explodes (depending on HP and hits needed).
6. **Watch resources:** each drone kill credits (ISR +$10 / OWA +$15 / Payload +$35). Confirm by placing 4 Interceptors and watching resources climb as drones die.
7. **ESC / right-click / click palette again** all cancel an armed placement.
8. **Affordability:** spend down to `$50`, palette Interceptor button dims. Earn $50 from a kill — button re-lights.
9. **Coverage sanity:** Interceptor range (100 px) should reach OWAs/Payloads from a nearby placement zone. If it doesn't reach corridors from ANY zone, the corridor/zone data needs tuning (not this plan's job; log in PLAYTESTS).

Log a `PLAYTESTS.md` entry with observed behavior.

---

## Open technical items (not blocking)

- **Projectile lifetime cap:** if a projectile misses everything and drifts across the map, it's removed by the 24 px off-grid margin. Edge case: extremely long flights near the bottom of the screen during tab-restore with dt=0.1 — projectile could overshoot off-grid check in one tick. Low concern; 200 px/s × 0.1 s = 20 px max per tick, well inside the margin.
- **Tile coord conversion:** `pixelToTile` will land in `src/ui/placement.js` since it's purely a placement concern. If a later plan needs it from another module, promote to a shared helper (e.g. `src/game/coords.js`).
- **Determinism of targeting:** tie-break by `drone.id` (lower first) — may want to flip to "newer first" after playtesting. Tunable.

---

## Queued doc updates

When implementation lands:

- `DECISIONS.md` — log: Interceptor-only first defense plan; targeting = closest-to-any-structure; placement two-click + ESC/RMB/rebid cancel; disabled palette slots for not-yet-built defenses; palette layout C.
- `TODO.md` — clear Step 2 ("RF Jammer placed manually…") and replace with "Step 2a: Interceptor placed, firing; 2b: RF Jammer; 2c: Laser; 2d: HPM (stretch)."
