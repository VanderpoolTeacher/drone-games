# Hover Tooltips — Design

**Date:** 2026-04-21
**Status:** Approved via brainstorm
**Issue:** [#3](https://github.com/VanderpoolTeacher/drone-games/issues/3)
**Scope:** Top-center information panel that surfaces name + role + matchup info when the player hovers a drone, defense, structure, or palette button during gameplay.

---

## Design thesis alignment

From `DESIGN.md`: no single defense wins alone; the player must combine rows of the matchup table. Tooltips make that table queryable on-demand — every hover is a teaching moment without Warden having to deliver the whole matchup catalog in briefings.

From `STYLE.md`: minimal UI chrome, retro arcade. A single fixed-position panel reads as a command-center information readout, not a floating cursor popup.

---

## Panel layout

- **Position:** centered horizontally, anchored to the top of the map area. Virtual coords: `x = 100`, `y = 28`, `w = 280`, `h = 56`.
- **Fill:** `CONFIG.colors.bgDark` at 85% alpha.
- **Border:** 1-px `CONFIG.colors.gridLine` stroke.
- **Padding:** 4-px inner margin on all sides.
- **Text:** `Press Start 2P` 8px, left-aligned, 11px line height.
- **Header:** first line, color per-entry (color-coded by entity class). Bold is implicit in the pixel font weight.
- **Body lines:** rows 2-4, `accentWhite`.
- **Renders only when `state.tooltipKey !== null`** — panel is completely hidden otherwise, no empty scaffolding.
- **Renders only during `screenPhase === 'playing'`** — no tooltips on the start screen, win/lose overlays, or idle state.

---

## Hoverable targets

Precedence (topmost wins, check in order):

1. **Palette button** — uses existing `paletteHitTest(vx, vy)` from `src/ui/palette.js`. Match returns `{ type: '<defenseType>' }`. Tooltip key: `'palette-rfJammer'` etc.
2. **Defense on map** — iterate `state.defenses`. A cursor within 12 px (half of `DEFENSE_SIZE = 24`) of `d.x, d.y` is a hit. Tooltip key: `'defense-' + d.type`.
3. **Drone on map** — iterate `state.drones`. A cursor within 8 px of `d.x, d.y` is a hit. Tooltip key: `'drone-' + d.type`.
4. **Structure** — iterate `MAP.structures`, convert `s.tile` to pixel center via `tileToPixel`. A cursor within 16 px is a hit. Tooltip key: `'structure-' + s.id` (verified ids in `src/game/map.js`: `'power'`, `'comms'`, `'cityHall'`).
5. **None of the above** → `state.tooltipKey = null`.

Ghost (placement) cursor hovering the map does NOT trigger tooltips — placement UX takes precedence.

---

## State

New field: `gameState.tooltipKey` (string or null). Reset to null in `resetGameState()`. Updated every `mousemove` event via `updateTooltip(state, vx, vy)`.

No state on tooltip timing / delay — tooltips show instantly since the panel doesn't follow the cursor (no flicker risk from micro-movements).

---

## Content

Authored in `CONFIG.tooltips` (new block). Each entry:

```js
{ header: 'NAME',  headerColor: 'paletteColorKey',  body: ['line2', 'line3', 'line4'] }
```

Values:

### Drones (header color: `threatRed` — threat class)

```js
'drone-isr': {
  header: 'ISR DRONE',
  headerColor: 'threatRed',
  body: [
    'Surveillance scout (Group 1 sUAS)',
    'STRONG: RF Jammer',
    'WEAK: Interceptor, Laser',
  ],
},
'drone-owa': {
  header: 'OWA DRONE',
  headerColor: 'threatRed',
  body: [
    'One-way attack / loitering munition',
    'STRONG: Interceptor, Laser',
    'WEAK: RF Jammer (preprogrammed)',
  ],
},
'drone-payloadDelivery': {
  header: 'PAYLOAD-DELIVERY DRONE',
  headerColor: 'threatRed',
  body: [
    'Armored Group 2 payload carrier',
    'STRONG: Laser, HPM',
    'WEAK: RF Jammer',
  ],
},
```

### Defenses on map (header color: `friendlyCyan` — friendly asset)

```js
'defense-rfJammer': {
  header: 'RF JAMMER',
  headerColor: 'friendlyCyan',
  body: [
    'Soft-kill electronic warfare',
    'STRONG: ISR',
    'WEAK: OWA, Payload',
  ],
},
'defense-interceptor': {
  header: 'INTERCEPTOR',
  headerColor: 'friendlyCyan',
  body: [
    'Hard-kill kinetic (single target)',
    'STRONG: OWA, Payload',
    'WEAK: ISR (cooldown waste)',
  ],
},
'defense-laser': {
  header: 'LASER (HEL)',
  headerColor: 'friendlyCyan',
  body: [
    'Directed energy — continuous beam',
    'STRONG: Payload, OWA',
    'WEAK: ISR; overheats after sustained fire',
  ],
},
'defense-hpm': {
  header: 'HPM',
  headerColor: 'friendlyCyan',
  body: [
    'Directed energy — area pulse',
    'STRONG: Swarms (all types in cone)',
    'WEAK: Single high-HP targets',
  ],
},
```

### Structures (dynamic header color by HP tier)

```js
'structure-power': {
  header: 'POWER SUBSTATION',
  body: ['Critical infrastructure'],
  // header color computed live: >=66%=successGreen, >=33%=alertAmber, else threatRed
  // last body line appended live: 'HP: 120 / 120'
},
'structure-comms':    { header: 'COMMS TOWER', body: ['Critical infrastructure'] },
'structure-cityHall': { header: 'CITY HALL',   body: ['Critical infrastructure'] },
```

Renderer appends `HP: <current> / <max>` as the last body line at draw time; reads `state.structureHp[id]` and `CONFIG.structures.maxHP`. Header color computed from the HP fraction.

### Palette buttons (reuse defense content + cost line)

Renderer prepends a cost line to `defense-<type>` body when the tooltip key starts with `'palette-'`. No separate `'palette-*'` config entries.

Example render for `'palette-interceptor'`:
```
INTERCEPTOR             (friendlyCyan)
COST: 100 res           (alertAmber)
Hard-kill kinetic (single target)
STRONG: OWA, Payload
```

Body gets truncated to 3 lines so the total stays at 4 lines inside the panel.

---

## Module API (`src/ui/tooltip.js`)

```js
export function updateTooltip(state, vx, vy)  // called from mousemove
export function renderTooltip(ctx, state)     // called from render loop
```

Both no-op when `state.screenPhase !== 'playing'` or state is in loseFlag/winFlag.

---

## File layout

| File | Action |
|---|---|
| `src/ui/tooltip.js` | Create — hit-test + render |
| `src/config.js` | Modify — `tooltips` block |
| `src/game/state.js` | Modify — add `tooltipKey: null`; reset in resetGameState |
| `src/main.js` | Modify — call `updateTooltip` in `mousemove`; `renderTooltip` between `renderLegend` and `renderBriefing` |

---

## Verification

Manual per `CLAUDE.md:61`.

1. Start a run. Hover the palette buttons one at a time → panel shows each defense's info with cost line.
2. Hover each of the three drone types as they spawn → tooltip updates to ISR / OWA / Payload info.
3. Hover each defense on the map → tooltip matches palette content (without cost line).
4. Hover each structure → HP readout shows current/max; header color changes as damage accumulates.
5. Move cursor off all entities → panel disappears (no empty box).
6. Start screen + win/lose overlays → no tooltip panel visible.
7. No console errors. No visual jank when moving cursor between entities.

---

## Out of scope

- Tooltip delay (instant show is fine since panel is fixed-position).
- Tooltip on state-specific info (drone currently jammed, defense overheated, projectile mid-flight).
- Tooltip on HUD chrome (mute icon, legend) — they're self-labeling.
- Mobile / touch devices (no hover; defer to click-based tooltip in a follow-up if needed).
- Animated reveal.
- Keyboard-navigable tooltip (e.g., arrow keys to cycle through entities).

---

## Risks / open items

- **Structure tile IDs confirmed** — `'power'`, `'comms'`, `'cityHall'` from `src/game/map.js`. Display names `'POWER SUBSTATION'`, `'COMMS TOWER'`, `'CITY HALL'`.
- **Palette tooltip body truncation.** Some defense tooltips have 4 body lines; prepending cost line + truncating to 3 drops the weakness line. If the weakness is the teaching point, re-consider truncation strategy.
- **OWA / Payload are "STRONG: Interceptor, Laser" for OWA, but Laser `effectivenessVs.owa = 1.0`, Interceptor `effectivenessVs.owa = 1.0`.** Text matches config. If tuning changes effectiveness numbers later, the tooltip text won't auto-update — remember to re-author.
