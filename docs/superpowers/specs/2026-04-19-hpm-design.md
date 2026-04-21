# HPM Design — Drone Defense

**Date:** 2026-04-19
**Status:** Approved via brainstorm
**Scope:** Enable the fourth palette button (HPM — High-Power Microwave). Cone-shaped directed-energy AoE. Discrete pulse every 4s that damages every drone in the cone simultaneously. Unique placement UX: the player aims the cone with the mouse before locking facing. This is the stretch defense per `CLAUDE.md`.

Builds on defenses-placement-interceptor + rf-jammer + laser branches. All placement UX, palette, economy, shared targeting helper already exist. This plan adds: cone geometry math, per-HPM facing state, aim-toward-mouse ghost, pulse-damage broadcast, pulse-sweep render effect.

## Out of scope

- Post-placement rotation adjustment (you place, you're locked).
- Real phased-array sprite (polish plan).
- Pulse sound / FX audio (polish plan).
- "Click placed HPM to inspect cone" UI.
- Wave system / structure HP / win-lose (separate plans).

---

## Design thesis alignment

Per DESIGN.md and CONCEPTS.md, HPM is the **swarm answer**. Its $300 cost and 4s cooldown are balanced against the fact that ONE pulse kills every low-HP drone in a 70° cone up to 110 px away. Effectiveness table:

| Drone | HP | eff | Pulse damage | Pulses to kill |
|---|---|---|---|---|
| ISR | 20 | 1.0 | 40 | 1 (one-shot) |
| OWA | 15 | 1.0 | 40 | 1 (one-shot) |
| Payload | 120 | 0.8 | 32 | 4 (16 s of pulses) |

One HPM pulse wipes an ISR scout cluster. Four pulses drag a lone Payload down. In saturation (wave 5-ish), an HPM on the S corridor facing north nukes OWA drones the moment they cluster, in ways Interceptor's single-shot cooldown can't match. That's the "HPM shines against swarms" gameplay pillar.

---

## Architecture

- `updateDefenses` gains an `else if (d.type === 'hpm')` branch.
- New private helper `findDronesInCone(state, defense, range, halfAngleRad)` returns the drones intersecting the cone this frame.
- Defense object gains `facingRad` (from placement) and `pulseFlashFrame` (render counter).
- Placement UX extended: when `placementMode.type === 'hpm'`, the placement mode stores a live `facingRad` computed from mouse vs hover-tile. Placement ghost draws an arc sector instead of a circle.
- `placeDefense` accepts an optional `facingRad` parameter, defaults to 0, applied to the defense object.
- `renderDefenses` extended with an HPM branch that draws a facing wedge + amber charge bar.
- Pulse flash (2–3 frame expanding cone sweep) drawn inside `renderDefenses` reading `pulseFlashFrame`.

### File layout (net changes)

```
src/
  main.js                  MODIFIED — mousemove updates facingRad on placementMode; click passes facingRad to placeDefense
  game/
    defenses.js            MODIFIED — hpm branch in updateDefenses; findDronesInCone helper; placeDefense accepts facingRad; placeDefense inits facingRad + pulseFlashFrame on all defenses; renderDefenses hpm branch (wedge + charge bar + pulse flash)
  ui/
    palette.js             MODIFIED — hpm.enabled → true
    placement.js           MODIFIED — draw arc-sector ghost for hpm instead of circle; no state mutation (facingRad lives on placementMode, mutated from main.js)
DECISIONS.md                MODIFIED — log hpm decisions
TODO.md                     MODIFIED — check off step 2d
PLAYTESTS.md                MODIFIED — session entry
```

No new files.

---

## Cone math

A drone at position `P` is inside a cone centered at `C` with facing `f` (radians), range `R`, half-angle `h` (radians) when:

```
dx = P.x - C.x
dy = P.y - C.y
dist = hypot(dx, dy)
if dist > R: NOT in cone
if dist < ε (drone on apex): in cone (by fiat — avoid div-by-0)
bearing = atan2(dy, dx)
diff = normalizeAngle(bearing - f)  // result in [-π, π]
return abs(diff) <= h
```

Where `normalizeAngle(θ)` maps any real to `(-π, π]`:

```js
function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
```

At v1 scale (max ~20 drones × ~4 HPMs × 60 fps = 4800 cone tests/s) this is negligible.

---

## updateDefenses hpm branch

```js
} else if (d.type === 'hpm') {
  if (d.pulseFlashFrame > 0) d.pulseFlashFrame -= 1;
  if (d.cooldownMs > 0) continue;

  const cfg = CONFIG.defenses.hpm;
  const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
  const victims = findDronesInCone(state, d, cfg.coneRange, halfAngleRad);
  if (victims.length === 0) continue;

  for (const v of victims) {
    const eff = cfg.effectivenessVs[v.type] ?? 1;
    v.hp -= cfg.pulseDamage * eff;
  }
  d.cooldownMs = cfg.pulseCooldown;
  d.pulseFlashFrame = 3;
  d.targetId = victims[0].id;   // first victim, informational only
}
```

`findDronesInCone` implementation:

```js
function findDronesInCone(state, defense, range, halfAngleRad) {
  const victims = [];
  for (const dr of state.drones) {
    if (dr.hp <= 0 || dr.phase === 'done') continue;
    const dx = dr.x - defense.x;
    const dy = dr.y - defense.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;
    if (dist < 0.0001) { victims.push(dr); continue; }
    const bearing = Math.atan2(dy, dx);
    const diff = normalizeAngle(bearing - defense.facingRad);
    if (Math.abs(diff) <= halfAngleRad) victims.push(dr);
  }
  return victims;
}
```

Auto-fire rule: the moment cooldown is 0 AND ≥ 1 drone is in cone. No "wait for more drones" heuristic — cheap to add later if playtesting shows single-drone pulses feel wasteful.

---

## placeDefense signature change

Current:

```js
export function placeDefense(state, type, tile) {
  ...
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x, y,
    cooldownMs: 0,
    targetId: null,
    heatMs: 0,
    overheated: false,
  };
  ...
}
```

New:

```js
export function placeDefense(state, type, tile, facingRad = 0) {
  ...
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x, y,
    cooldownMs: 0,
    targetId: null,
    heatMs: 0,
    overheated: false,
    facingRad,
    pulseFlashFrame: 0,
  };
  ...
}
```

All existing call sites (Interceptor / RF Jammer / Laser placement) don't pass the fourth arg; it defaults to 0. Only HPM uses it.

---

## Placement UX — aim toward mouse

### State: `placementMode.facingRad`

When the player clicks the HPM palette button, `placementMode = { type: 'hpm', facingRad: -Math.PI / 2 }` (initial north-facing; overridden by first mousemove).

`mousemove` handler in `main.js` computes facingRad from the hover tile's pixel center toward the mouse virtual coord:

```js
canvas.addEventListener('mousemove', e => {
  const [vx, vy] = toVirtual(e);
  gameState.hoverTile = pixelToTile(vx, vy);
  if (gameState.placementMode?.type === 'hpm' && gameState.hoverTile) {
    const cx = gameState.hoverTile.x * MAP.tileSize + MAP.tileSize / 2;
    const cy = CONFIG.topBarHeight + MAP.padTop + gameState.hoverTile.y * MAP.tileSize + MAP.tileSize / 2;
    gameState.placementMode.facingRad = Math.atan2(vy - cy, vx - cx);
  }
});
```

On click (`canvas.click`) when placing HPM: pass `placementMode.facingRad` to `placeDefense`:

```js
placeDefense(gameState, gameState.placementMode.type, tile, gameState.placementMode.facingRad ?? 0);
```

For non-HPM defenses, `facingRad` is irrelevant and defaults to 0.

### Ghost render: arc-sector outline

`drawGhostAndRange` in `placement.js` currently draws a circle for range. Add a branch for HPM:

```js
const type = state.placementMode.type;

if (type === 'hpm') {
  const cfg = CONFIG.defenses.hpm;
  const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
  const f = state.placementMode.facingRad ?? -Math.PI / 2;
  ctx.strokeStyle = CONFIG.colors.friendlyCyan;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, cfg.coneRange, f - halfAngleRad, f + halfAngleRad);
  ctx.closePath();
  ctx.stroke();
} else if (range > 0) {
  // existing circle / dashed-for-rfJammer logic
  ...
}
```

Existing RF Jammer dashed + Interceptor / Laser solid circle logic stays in the `else` branch.

Import `MAP` into `placement.js` for tile-size computation in the mousemove handler? It's already imported. `CONFIG.defenses.hpm` already accessible via `CONFIG`.

---

## renderDefenses hpm branch

Adds a facing wedge + charge bar + pulse flash.

```js
} else if (d.type === 'hpm') {
  const cfg = CONFIG.defenses.hpm;

  // Facing wedge: 2x2 cyan pixel on the sprite edge in the facingRad direction
  const wedgeX = Math.floor(d.x + Math.cos(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
  const wedgeY = Math.floor(d.y + Math.sin(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
  ctx.fillStyle = CONFIG.colors.accentWhite;
  ctx.fillRect(wedgeX, wedgeY, 2, 2);

  // Charge bar: 1px amber line along the top of the sprite, length = (1 - cooldownMs/pulseCooldown) * (DEFENSE_SIZE - 2)
  const chargeFrac = 1 - Math.min(1, d.cooldownMs / cfg.pulseCooldown);
  const barLen = Math.floor(chargeFrac * (DEFENSE_SIZE - 2));
  if (barLen > 0) {
    ctx.fillStyle = CONFIG.colors.alertAmber;
    ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2) + 1, Math.floor(d.y - DEFENSE_SIZE / 2) - 1, barLen, 1);
  }

  // Pulse flash: expanding cone sweep for 3 frames
  if (d.pulseFlashFrame > 0) {
    const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
    const flashFrac = (4 - d.pulseFlashFrame) / 3;  // 0.33, 0.66, 1.0 as frames tick down
    const flashR = cfg.coneRange * flashFrac;
    ctx.strokeStyle = CONFIG.colors.friendlyCyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.arc(d.x, d.y, flashR, d.facingRad - halfAngleRad, d.facingRad + halfAngleRad);
    ctx.closePath();
    ctx.stroke();
  }
}
```

At rest (no pulse), the player sees: cyan square + white wedge indicating direction + amber charge bar on the top edge that fills left-to-right over 4 seconds.

On pulse: the cone outline sweeps outward for 3 frames (tiny → medium → full), then disappears until next pulse.

---

## Render order (unchanged)

```
renderMap → renderDefenses → renderDrones → renderBeams → renderProjectiles → renderExplosions → renderChrome → renderPalette → renderLegend → renderPlacement
```

HPM pulse flash renders inside `renderDefenses` (layer 6). It precedes drone / beam / projectile rendering so pulses appear UNDER drones visually. That matches the spec's "drones flicker amber then explode" — drones stay visible during the pulse moment.

Explosions for 1-shot kills (ISR/OWA) will fire on the NEXT frame (after `updateDrones` catches hp<=0) — same one-frame-lag behavior as Laser. No change.

---

## Palette

```js
const BUTTONS = [
  { type: 'rfJammer',        label: 'RF JAM',  enabled: true },
  { type: 'interceptor',     label: 'INTRCPT', enabled: true },
  { type: 'laser',           label: 'LASER',   enabled: true },
  { type: 'hpm',             label: 'HPM',     enabled: true },   // was false
];
```

---

## Verification

Manual per `CLAUDE.md:61`.

1. `npx serve`, load page. All four palette buttons cyan (all affordable at $400 start).
2. Click **HPM** → armed. Move mouse over the map — ghost shows a **cyan arc sector** radiating from the hover tile toward the mouse. Moving the mouse around changes the cone's facing in real time.
3. Click a valid zone with the cone pointing at, say, the S corridor: HPM places, resources 400 → 100. Defense sprite: cyan square + white wedge on the south edge + amber charge bar filling on the top edge.
4. Wait for an OWA to spawn on the S corridor and reach the cone. The moment one OWA enters AND `cooldownMs` is 0: pulse fires. 3-frame cyan cone sweep expands outward; OWA drops to 0 hp, explodes next frame. Resources +$15.
5. If multiple drones are in cone at pulse time: all damaged simultaneously. Watch for clustered OWA / ISR getting wiped by a single pulse.
6. Between pulses: amber charge bar visibly fills over 4 seconds.
7. Payload in cone: takes 32 dmg per pulse → 4 pulses to kill (16 s of continuous presence).
8. All 11 palette buttons work correctly (RF Jam / Interceptor / Laser / HPM).
9. No console errors.

Add `PLAYTESTS.md` entry.

---

## Queued doc updates

- `DECISIONS.md` — log: HPM placement uses aim-toward-mouse with facing locked at click; cone uses 70° full / 35° half-angle with 110 px radial depth; pulse auto-fires on cooldown=0 + ≥1 drone in cone; one-shot ISR/OWA, 4 pulses to kill Payload; pulse flash is 3-frame expanding-cone sweep.
- `TODO.md` — check off Step 2d. v1 defense roster now complete.
