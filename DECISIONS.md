# Decisions Log

One-line entries. Date + decision + why. Keep it short — this is a trail, not documentation.

Format:
```
YYYY-MM-DD — Decision. Reason.
```

---

## Setup phase

2026-04-18 — Stack: vanilla HTML5 Canvas + JS, no framework. Fastest path to playable, zero setup friction.

2026-04-18 — Defenses auto-fire once placed (no manual activation). Cleaner prototype; avoids muddling the "strategic vs. reactive" feel in playtesting.

2026-04-18 — Critical structures have HP, lose when all destroyed. Replaces vague "destroyed beyond recovery"; makes it implementable.

2026-04-18 — Visual direction: retro arcade / pixel art / CRT. Hides placeholder-art sins and communicates genre instantly.

2026-04-18 — Virtual resolution 480×270, scaled 3×. Classic pixel-art ratio; enough room for a grid-based map.

2026-04-18 — Palette locked at 8 colors. All enemies red, all defenses cyan — type communicated by silhouette, not color.

2026-04-18 — Military/DoD framing over civilian/homeland security. Better documented public vocabulary; defensible for class writeup.

2026-04-18 — Use real DoD doctrinal names for drones in v1: ISR Drone, OWA Drone, Payload-Delivery Drone. Accuracy over casual readability. Tooltips explain each term on first encounter.

2026-04-18 — Add HPM as a 4th defense in v1 (not v2). Completes the real-world layered C-UAS set — soft-kill + kinetic + HEL + HPM. Reflects the current frontier (Epirus Leonidas, Sept 2025 49-drone swarm demo). Risk: scope creep. Mitigation: HPM is the first thing to cut if the build runs long.

2026-04-18 — Elevate "layered defense + cost-exchange" to explicit design thesis at top of DESIGN.md. Gives the project a real intellectual center and a defensible argument for the class writeup.

2026-04-18 — Dropped stealth drones, fiber-optic drones, autonomous drones, GPS Spoofer, sensor towers, and drone netting from v1. All parked in HORIZON.md Part 4 with research context for later.

---

<!-- Add new entries below this line. Most recent at the bottom. -->

2026-04-19 — Virtual resolution scale bumped 3× → 4× so 480×270 fills a 1920×1080 display fullscreen.

2026-04-19 — Playable grid locked at 20×8 tiles (480×192 px), not the "~11 tall" STYLE.md previously suggested. UI chrome (24 top + 32 bottom) is solid, not overlay — clearer and preserves full pixel budget for gameplay.

2026-04-19 — Map shape: coastal peninsula (downtown). Water on W, S, E edges (West River, South Harbor, East River); land on N edge representing inland. Chosen over full-borough variants for tile-budget reasons on a 20×8 grid.

2026-04-19 — Navigation model: geography-driven ingress corridors with per-drone-type path behavior (ISR weaves from N, OWA straight-line from S with terminal commit, Payload horizontal from W/E). Authored waypoint lists in map data, not procedural. Matches real C-UAS ingress doctrine.

2026-04-19 — Path visibility: pre-wave chevrons telegraph active edges + drone types; actual flight paths not drawn. Player learns routes by observation of the first drone of each corridor.

2026-04-19 — Placement zones: 14 hand-picked cells marked visually, not free placement. Keeps balance tractable for v1 and preserves the "rooftop/plaza" city read.

2026-04-19 — Removed all references to Manhattan / New York / NYC from documentation, spec, plan, and code. Map shape, structure positions, and ingress corridors unchanged — only labels and flavor text generalized. Rationale: keep the game setting a generic coastal city rather than a specific real-world target.

2026-04-19 — First defense plan ships Interceptor only; RF Jammer / Laser / HPM shown as disabled palette buttons. Validates the full click→place→fire→kill→bonus loop with the simplest defense before scaling.

2026-04-19 — Interceptor targeting: picks the drone in range whose minimum distance to any structure is smallest (ties broken by lower drone.id). Prioritizes threat-to-structure over proximity-to-defense; feels strategic and teaches coverage-adjacent-to-structures placement.

2026-04-19 — Placement UX: two-click (click palette → click zone). Cancel via any of ESC, right-click, or click the same palette button again. Redundant cancels prevent "stuck in placement mode" feel.

2026-04-19 — Palette shows all four defenses always; RF Jammer / Laser / HPM render as dim (disabled) placeholders even in the Interceptor-only branch. Telegraphs "more defenses coming" without needing copy.

2026-04-19 — Palette layout C: resources left, 4 centered buttons, wave/next placeholder right. Consolidates the HUD in the 32px bottom bar. Top bar keeps the drone-type legend.

2026-04-19 — RF Jammer slow formula: `effectiveSlow = 1 - (1 - slowFactor) × effectivenessVs[droneType]`. Produces ISR→0.5×, OWA→0.85×, Payload→0.9×. Continuous multiplier (not gated), so the matchup table reads as real in motion.

2026-04-19 — Multi-jammer stacking: take the minimum multiplier across all in-range jammers (strongest slow wins; no multiplicative stacking). Prevents jammer-spam exploits and keeps "two jammers for coverage, not cumulative slow" intuition.

2026-04-19 — Defense placeholder accents: Interceptor = 2×2 amber tip at top; RF Jammer = 4×2 accent-white "dish" protruding above the cyan square. Keeps the two types instantly distinguishable pre-real-sprites.
