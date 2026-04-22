# Logistics / Installation Economy — Design

**Date:** 2026-04-22
**Status:** Approved via brainstorm
**Issue:** [#2](https://github.com/VanderpoolTeacher/drone-games/issues/2)
**Scope:** Replace the $ economy with an authored per-wave inventory delivery + per-defense install time. No more dollars, no more cost UI, no more kill-reward cash flow.

---

## Model

- `gameState.inventory = { rfJammer, interceptor, laser, hpm }` — integer counts per defense type.
- At every `prep → active` transition's **entry** (i.e. when phase flips to prep), add that wave's delivery into inventory. Unused units roll over.
- Placing a defense **decrements** its inventory count. Icon with count 0 is disabled (no placement mode).
- No kill-reward income. No wave-bonus income. No `resources` state at all.
- **Install time** per defense type — after placement, the defense sits in a `'installing'` state for `cfg.installMs` and does NOT fire / jam / pulse. Damageable during install.

## Loadouts (per-mode `deliveries[i]`)

### Campaign (tight — forces layered play)

| Wave | RF | Int | Laser | HPM |
|---|---|---|---|---|
| 1 | +2 | +1 | 0 | 0 |
| 2 | +1 | +1 | 0 | 0 |
| 3 | 0 | +1 | +1 | 0 |
| 4 | 0 | +1 | +1 | 0 |
| 5 | 0 | +1 | 0 | +1 |

Total over full run: 3 RF, 5 Interceptor, 2 Laser, 1 HPM.

### Training (generous)

| Wave | RF | Int | Laser | HPM |
|---|---|---|---|---|
| 1 | +3 | +2 | 0 | 0 |
| 2 | +2 | +1 | 0 | 0 |
| 3 | 0 | +1 | +1 | 0 |
| 4 | 0 | +2 | +1 | 0 |
| 5 | 0 | +1 | 0 | +1 |

Total: 5 RF, 7 Interceptor, 2 Laser, 1 HPM.

## Install times

`CONFIG.defenses.<type>.installMs`:

| Defense | Install |
|---|---|
| rfJammer | 3 s |
| interceptor | 5 s |
| laser | 8 s |
| hpm | 12 s |

Expensive installations take longer to deploy. Can't plant an HPM mid-wave 5 and expect it to save you.

## Defense state machine

New `installMsRemaining` field, init'd to `cfg.installMs` in `placeDefense`. Each frame, subtract `dt * 1000`. Gate at top of `updateDefenses` branch: if `d.installMsRemaining > 0`, skip all shot / jam / pulse logic.

`renderDefenses` additions when installing:
- Tint the sprite with a 50%-alpha `threatViolet` overlay.
- Replace the HP segments (when full HP) with an install progress bar (single 2-px friendlyCyan fill growing left-to-right).

Damageable during install — OWA can kill a laser that's setting up. Intentional.

## UI changes

### Palette

- Four buttons, same layout. Cost line (`$NN`) replaced with count line (`×N`).
- Count-zero button renders in `gridLine` (greyed); click is a no-op.
- Active (count > 0) button renders in `friendlyCyan`.
- Selected button renders in `alertAmber` (unchanged).

### HUD

- Remove the resource counter (`renderResources` in `src/ui/palette.js`). The left side of the palette strip becomes blank space.

### Tooltip

- Palette tooltip: replace `COST: N res` line with `AVAILABLE: N`.
- On-map defense tooltip: unchanged. (Install state not surfaced via tooltip in v1 — v2 polish candidate.)

### Placement validation

`isValidZone` in `src/ui/placement.js`:
- Drop the `state.resources < cost` check.
- Add `state.inventory[type] <= 0` check — if empty, invalid.

## Config changes

- `CONFIG.defenses.<type>.cost` → deleted.
- `CONFIG.startingResources` / `resourcesPerWaveBonus` / `resourcesPerDroneKill` → deleted.
- `CONFIG.defenses.<type>.installMs` → added.
- `CONFIG.modes.<mode>.deliveries` → added (5-entry array per mode).
- `applyMode(name)` updates: copies `deliveries` onto `CONFIG.deliveries` (or reads live each wave — pick and stick).

## State changes

- `gameState.inventory = { rfJammer: 0, interceptor: 0, laser: 0, hpm: 0 }` — added.
- `gameState.resources` — deleted.
- `resetGameState` resets inventory to zeros (first wave's delivery will populate it).

## Hooks

- `src/game/wave.js` at the **start** of `updateWave` when `phase === 'prep'` AND `prepMs === prepTimeBetweenWaves` (freshly entered), apply delivery. Actually cleaner: wave transition from `active → prep` in the same function. At the initial wave-1 prep, it needs to apply too (state starts at wave=1, phase='prep', prepMs=full). Use a side-channel flag OR call `applyDelivery(state)` from both `resetGameState` (initial) and the wave-advance path.

Cleanest design: `applyDelivery(state, waveIdx)` helper; called:
- Once from `resetGameState` with `waveIdx = 0`
- Once from `wave.js` when advancing `wave.number += 1` (after wave cleared)

Helper:
```js
function applyDelivery(state, waveIdx) {
  const delivery = CONFIG.modes[state.mode].deliveries[waveIdx];
  if (!delivery) return;
  for (const type of Object.keys(delivery)) {
    state.inventory[type] = (state.inventory[type] ?? 0) + delivery[type];
  }
}
```

## File layout

| File | Action |
|---|---|
| `src/config.js` | Drop cost/economy fields; add `installMs` + `deliveries` under modes |
| `src/game/state.js` | Add `inventory`; drop `resources`; reset path |
| `src/game/wave.js` | Call `applyDelivery` on wave-advance |
| `src/game/defenses.js` | `placeDefense` checks + decrements inventory; `installMsRemaining` init; gate + render install |
| `src/ui/palette.js` | Drop `renderResources`; swap `$cost` → `×count` |
| `src/ui/placement.js` | `isValidZone` uses inventory |
| `src/ui/tooltip.js` | Palette tooltip uses `AVAILABLE: N` |
| `docs/superpowers/specs/...` | This file |

## Verification

1. Fresh load, click into Training → wave 1 prep starts with `3 RF, 2 Int, 0 L, 0 HPM` in palette counts.
2. Click RF icon → place on a zone. Defense appears with violet tint + short progress bar above. 3s later, tint clears and bar becomes the regular HP bar.
3. RF count on palette drops 3 → 2.
4. Click RF icon again, try to place at an occupied zone → no placement.
5. Keep placing until RF count = 0 → icon greys out; click does nothing.
6. Wait for wave 2 prep → palette refreshes with +2 RF, +1 Int.
7. Place a Laser on wave 3 → 8s install; an OWA that reaches the Laser during install destroys it.
8. Try Campaign mode for comparison — tighter deliveries, harder wave 5.
9. No console errors; no leftover references to `state.resources` or `cfg.cost`.

## Out of scope

- Resource refund on defense death.
- Queued production / mid-wave ordering.
- Delivery delay from structure damage (#10).
- "Crate landing" arrival animation / SFX.
- Install progress tooltip line.
- Install cancel / repay mechanic.

## Risks

- **Install vulnerability is punishing.** A Laser that dies mid-install is a hard loss. Tuning may need to soften OWA retarget range (#17's 60px) or add install-phase damage reduction. Flag for playtest.
- **Training loadout may be too generous.** 5 RF + 7 Int is a lot for a shortened campaign. Easy to dial back.
- **Campaign wave-5 inventory may be too tight** — HPM + 1 Int delivery for the saturation wave assumes carryover. Tune.
