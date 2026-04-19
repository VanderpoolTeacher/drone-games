# Map Layout Design — Drone Defense: NYC

**Date:** 2026-04-18
**Status:** Approved via brainstorm (sections 1 + 2)
**Scope:** The v1 NYC map — shape, grid, structures, ingress corridors, placement zones, visual rendering, pre-wave telegraphs.

This spec covers **only** the map. Wave balancing, HUD details, entity code, and the build order live in their own docs (`DESIGN.md`, `CLAUDE.md`, `config.js`, `TODO.md`).

---

## Context

The design thesis in `DESIGN.md` is:

1. **Layered defense** — no single C-UAS system wins alone.
2. **Cost-exchange** — defender loses economically even when winning tactically.

The map must make both thesis points legible through *geometry*: ingress corridors that force the player to combine defenses, and structure placement that prevents single-point coverage.

---

## Shape and grid

- **Virtual resolution:** 480 × 270 pixels, pixel art.
- **Display scale:** 4× (fills 1920 × 1080). `config.js:scale` bumps from 3 to 4.
- **Tile size:** 24 px (unchanged).
- **Playable grid:** **20 × 8 tiles** (480 px wide × 192 px tall).
- **UI chrome:** 24 px top bar + 32 px bottom palette (solid, per `STYLE.md`).
- **Vertical layout:** 24 (top bar) + 192 (grid) + 32 (palette) = 248 px. The remaining 22 px is split as 11 px padding above the grid and 11 px below (both rendered as bg-dark, part of the map visual). Simple, symmetric, all grid rows align cleanly.
- **Map shape inside the grid:** Lower Manhattan close-up. Land on the majority of tiles; water along the W, E, and S edges (Hudson, East River, NY Harbor). N edge is land — "rest of Manhattan."

## Structure positions

Three critical structures, placed in a triangle formation grounded in real Lower Manhattan:

| Structure | Tile (col, row) | Real-world analog |
|---|---|---|
| ⚡ Power | (16, 2) | Con Ed 14th St substation (NE, East River side) |
| 📡 Comms | (9, 4) | AT&T 33 Thomas St "Long Lines" (center, TriBeCa) |
| 🏛 City Hall | (4, 6) | NYC City Hall (SW, Broadway/Park Row) |

Spacing rule: no single defense placement with any v1 range can cover two structures. Forces distributed spending.

## Spawn edges and progression

Four possible spawn edges. Each wave activates a subset matching the drone types introduced that wave.

| Edge | Drone type | Waves active | Ingress profile |
|---|---|---|---|
| N (overland, rest-of-Manhattan) | ISR | 1, 2, 3, 4, 5 | Urban weave — operator-flown feel |
| S (NY Harbor) | OWA | 3, 4, 5 | Long over-water run + terminal commit |
| W (Hudson River) | Payload | 4, 5 | Slow horizontal crossing, low altitude |
| E (East River) | Payload | 4, 5 | Slow horizontal crossing, low altitude |

The wave-by-wave edge progression ties DESIGN.md's wave escalation to physical geometry. Each new wave introduces both a new drone type *and* a new direction to watch.

## Ingress corridors (per drone type)

Corridors are authored waypoint lists; drones interpolate between waypoints with per-type behavior.

- **ISR** — 2–3 corridors from the N edge, each 6–8 waypoints, weaving southward toward any of the three structures. Small perpendicular jitter per waypoint (±1 tile) sells the operator-flown feel. No terminal commit — ISR drones orbit / scout until destroyed or until they disable a defense on contact.
- **OWA** — 2–3 corridors from the S edge, straight northbound waypoint line, final segment is *terminal commit* (straight line to its assigned structure). No jitter during terminal phase — reads as a deliberate strike run.
- **Payload-Delivery** — 2 corridors (W→E and E→W), low horizontal traversal. No weaving. Drops payload when within range of a target cluster.

Corridors are data; drones reference their corridor + type-specific behavior at runtime.

## Placement zones

**14 hand-picked cells** marked visually on the map. Rule: *placement is allowed only on zone tiles; all other land tiles are invalid.*

- Zones cluster near structures and along corridor chokepoints.
- Coverage goal (authored, verified in playtesting): zones are positioned so the cheapest-range defenses reach exactly one corridor. Longer-range defenses (Laser, HPM) may overlap corridors — that's acceptable, since those are expensive and the player still makes a meaningful economic tradeoff.
- Visual: 4×4 px cyan diamond (▲) centered in the tile. Subtle pulse (1-frame brightness step per second). Hidden when a defense is placed on that zone.

## Path visibility and telegraphs

Per the "realistic threat awareness" principle — player knows *vectors*, not *paths*.

### Pre-wave (15-second prep phase)

- **Active-edge chevrons** — amber chevrons pulse in the UI gutter at each edge active this wave.
- **Drone-type icons** — next to each chevron, an 8×8 silhouette identifies what's coming (ISR camera, OWA arrow, Payload box).
- **Wave-N banner** — top bar pulses amber for the last 2 s of prep (already in `STYLE.md`).
- **Flight paths are NOT drawn.** No ghost-drone preview. Player learns routes by observation.

### During wave

- **ISR** leaves a faint 3-tile-fade red trail — sells the weave.
- **OWA** flashes a 1-frame amber terminal-commit line when it locks on a structure — high-urgency telegraph.
- **Payload** has no trail — slow/deliberate reads better uncluttered.

## Render layer order (back to front)

1. Water fill (bg-mid).
2. Land tiles (bg-dark + 1px grid-line overlay).
3. Coastline (1 px cyan where land meets water).
4. Placement zones (cyan diamonds, ignorable when no defense selected).
5. Critical structures (32 × 32 sprites).
6. Placed defenses (24 × 24 sprites).
7. Range/cone indicators (only for selected or being-placed defense).
8. Drones (16 × 16 sprites).
9. Projectiles / beams / pulses (1–2 px primitives, 1–3 frame lifetime).
10. Threat indicators (amber arrow on drones imminently hitting structures).
11. UI chrome (top bar, bottom palette).
12. Pre-wave telegraphs (chevrons, icons, banners — drawn on top during prep only).
13. CRT post-effect (scanlines, vignette) as the final pass.

## Placement interaction

- **No defense selected:** zones show as subtle cyan diamonds. Map reads clean.
- **Defense selected:** valid zones brighten; invalid tiles show a red pixel overlay. Cursor shows ghost sprite (50 % alpha) + range/cone preview.
- **Click valid zone:** defense instantiates at that tile. Budget deducts. Zone diamond hidden under sprite.
- **Hover empty zone while placing:** tooltip shows corridor coverage — e.g. "Covers: N corridor" — so the player knows what the zone is *for*, without needing to see the path.
- **Click placed defense:** reselects it; range/cone preview reappears. (No sell/reposition in v1.)

## Data model

Single static module `src/game/map.js`:

```js
export const MAP = {
  shape: 'lowerManhattan',
  gridW: 20,
  gridH: 8,
  tileSize: 24,
  tiles: [/* 20×8 array of 'land' | 'water' */],
  structures: [
    { id: 'power',    type: 'power',    tile: {x:16, y:2}, displayName: 'Con Ed Substation' },
    { id: 'comms',    type: 'comms',    tile: {x:9,  y:4}, displayName: '33 Thomas St' },
    { id: 'cityHall', type: 'cityHall', tile: {x:4,  y:6}, displayName: 'NYC City Hall' },
  ],
  placementZones: [ /* 14 {x,y} cells */ ],
  spawnEdges: {
    N: { active: true,  waves: [1,2,3,4,5], droneTypes: ['isr'] },
    S: { active: false, waves: [3,4,5],     droneTypes: ['owa'] },
    W: { active: false, waves: [4,5],       droneTypes: ['payloadDelivery'] },
    E: { active: false, waves: [4,5],       droneTypes: ['payloadDelivery'] },
  },
  corridors: {
    isr: [ /* 2–3 waypoint lists */ ],
    owa: [ /* 2–3 waypoint lists */ ],
    payloadDelivery: [ /* 2 waypoint lists (W→E, E→W) */ ],
  },
};
```

Plain object. No classes. Consumed read-only by the game/render systems.

## Verification

No automated tests (consistent with `CLAUDE.md` — no tooling by design). Manual verification:

1. `npx serve` and load `index.html`.
2. Wave 1 start: confirm ISR spawns from N edge, weaves, reaches/engages structures.
3. Inspect pre-wave telegraph: N chevron visible; S/W/E chevrons not visible on wave 1.
4. Wave 3: confirm S edge activates, OWA spawns from harbor.
5. Wave 4: confirm W + E activate, Payload crosses.
6. Wave 5: all four edges active simultaneously.
7. Placement: click any non-zone tile → invalid overlay. Click a zone → defense places.
8. Hover empty zone during placement: tooltip names the corridor it covers.

Add a session note to `PLAYTESTS.md` once the first corridor-driven wave is playable.

## Open technical items (not blocking this spec)

- **deltaTime unit** (`CLAUDE.md` vs `config.js`) — still unresolved. Doesn't affect map data; resolve when wiring the game loop.
- **Coastline authoring tool** — tiles array will need to be hand-authored. An ASCII-art string converted to the array at boot is probably cleanest. Implementation detail for the plan.
- **Corridor jitter** — exact jitter magnitude for ISR is a tuning value; starts at ±1 tile and gets adjusted in the tuning pass (`TODO.md` step 8).

## Queued doc reconciliations (not part of this spec)

When implementation begins:

- `config.js:12` — `scale: 3` → `scale: 4`.
- `STYLE.md:21` — fix "20 × ~11 tall" to "20 × 8 playable".
- `DECISIONS.md` — append entries for: grid dimensions, map shape, corridor model, spawn edges, placement zones, telegraph model.

These are consistency fixes that follow from this spec; they're not design decisions in themselves.
