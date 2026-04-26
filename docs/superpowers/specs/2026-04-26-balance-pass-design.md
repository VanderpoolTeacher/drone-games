# Balance Pass — Design

**Date:** 2026-04-26
**Tracking issue:** #50
**Version target:** unreleased work merges under `v0.1.2 (in progress)`; cut `v0.1.2` once acceptance hit.

## Context

`v0.1.1` shipped a stack of mechanics that significantly shift difficulty without
re-tuning the original numbers:

- Radar / detection layer (#6) — drones invisible until sensed.
- Finite interceptor magazines (#7) — 6 missiles per launcher, reload between waves.
- Cascading critical-structure consequences (#10) — losing one critical degrades a specific subsystem.
- Hard wave timer (#49) — 60 s waves 1-2, 90 s waves 3-5.
- Fragile bridges — any tile destroyed = whole named bridge offline.
- ISR-driven OWA pathing (#48) — Red Cell routes around RF coverage; jammed lanes get bonus OWA next wave.
- Intel forecast + visible ENEMY RESPONSE multiplier (#11, #36).
- Click-to-repair (#40).

The existing tunables (drone counts, HP, spawn intervals, install times, magazine
size, detect ranges, prep / wave timers, delivery quantities) were set under the
v0.1.0 model. Most are now wrong direction-ally even if play "feels okay" at the
keyboard.

## Goal

Use the existing browser sim harness (#43) — single-run mode (T) and 10-run
batch mode (Shift+B at 60×) — to drive a methodical rebalance until the
strategy win-rate distribution matches the layered-defense thesis.

## Acceptance criteria

100 sims per strategy per measurement. (The current `Shift+B` batch defaults
to 10 runs; the implementation plan must either invoke it ten times per
strategy or raise the batch default — that's an implementation choice, not
a design decision.) The run is "done" only when **all five** bands hold:

- `early-rf` (baseline competent) — **40-60 %** win rate
- `balanced-stack` (one of every defense, layered) — **60-80 %** win rate
- Each specialist (`kinetic-only`, `dew-only`, `radar-first`) — **20-35 %** win rate
- `no-defenses` (negative control) — **0-2 %** win rate
- Wave-cleared distribution shows escalation: most runs reach wave 3, fewer
  reach wave 5. (Operationalise: median run reaches wave 3; wave-5 reach rate
  is no more than 60 % of wave-3 reach rate on `early-rf`.)

The thesis is enforced through outcomes: specialists are viable enough to
teach the lesson, not viable enough to undermine it.

## Strategies (6)

Existing in `src/game/simHarness.js#STRATEGIES`:

| Key | Status | Intent |
|---|---|---|
| `no-defenses` | exists | Empty placement. Confirms the wave threat alone can defeat a passive player. |
| `early-rf` | exists | Mixed stack — RF wave 1, laser 2, RF + interceptor 3, laser + interceptor 4, HPM 5. The "average competent" archetype. |

To add (4):

| Key | Intent |
|---|---|
| `radar-first` | Wave 1 drops a radar at city center before any effector. Subsequent waves layer effectors as they arrive. Tests whether sensor-first play meaningfully changes outcomes vs. effectors-first. |
| `kinetic-only` | Interceptors only. Tests whether finite magazines + kinetic alone holds at the saturation wave. |
| `dew-only` | Laser + HPM only. Tests whether the DEW economy (overheat / cooldown / pulse cooldown) sustains under saturation. |
| `balanced-stack` | One of every defense type as it becomes available — RF + laser + interceptor + radar by wave 3, HPM at 5. The "optimal layered" archetype; should be the high-water mark. |

Exact tile placements are not part of this design — the implementation plan
will pick them. Constraints: placements must (a) cover the central structure
cluster, (b) be reachable given the per-wave delivery schedule (you can't
place RF on wave 2 if RF is delivered wave 1), (c) be deterministic (no
randomised tile picks in strategy entries).

## Tuning Loop

Each iteration:

1. **Baseline pass** — user runs the configured batch size for each of the 6 strategies (whatever the implementation set; target 100 sims per strategy total). After all six, exports CSV via Shift+T. Pastes / shares data with the assistant.
2. **Aggregate** — assistant computes per-strategy win rate, wave-cleared distribution, mean casualties, mean structures lost.
3. **Rank outliers** — strategies outside their acceptance band, sorted by deviation magnitude.
4. **Root-cause hypothesis** — for the worst outlier, identify the *single* tunable most likely responsible. Frame as a falsifiable claim: "if interceptor magazine ↓ from 6 to 4, kinetic-only win-rate drops by ~10 pp, balanced-stack drops by ~3 pp."
5. **One change per iteration** — propose the number change. User accepts / counters / declines. Apply.
6. **Re-run affected strategies only** — re-run only those whose outcome the changed knob plausibly affects. Saves compute.
7. **Loop** — repeat 3-6 until acceptance bands all hold.

Each tuning decision is logged in `DECISIONS.md` with: date, knob changed, before/after value, hypothesis, observed result. Number changes that ship roll under `v0.1.2 (in progress)` in `CHANGELOG.md`.

## Tunable Scope

**In scope** (any may change between iterations):

- Per-wave drone counts, HP, speed, spawn intervals, spawn delays
- Defense damage / DPS / pulse damage
- Defense engagement range, cooldown, overheat / cooldownTime
- Detect ranges (RF detectRange = 110, radar detectRange = 180)
- Magazine size (interceptor)
- Wave hard timer (`activeMaxMs`: 60 000 / 90 000)
- Prep timer (`prepTimeBetweenWaves`)
- Delivery counts per wave; auto-trickle weights
- Structure max HP; per-strike damage values
- `intelMultiplier()` and `defenseMultiplier()` curves

**Out of scope** (not touched in this work):

- Map layout, structure placement, bridge cluster topology
- Wave drone *type* composition (no adding/removing drone types per wave)
- New defense types; removal of existing types
- Mechanics themselves (no removing magazines, no removing radar gating)
- Briefing text / narrative
- Visual / audio
- Defense HP cap of 3 (intentional uniform fragility)

## Metrics

Start with the existing CSV columns from `simHarness.js#downloadSimData`:

- `recordedAt`, `strategy`, `outcome` (win / lose / abort), `wavesSurvived`, `runMs`
- `casualties`, `structuresLost`, `defensesLost`
- `lastIntel`, `payloadPoolRemaining`, `bridgesLive`
- `isrKills`, `owaKills`, `payloadKills`

If a tuning iteration cannot identify a root cause from these aggregates,
extend the stats block on demand (e.g., per-wave casualty breakdown,
interceptor empty-magazine count, wave-end mode timer-vs-natural). YAGNI:
do not pre-instrument.

## Tools

- Sim harness: `src/game/simHarness.js`
- Trigger: T (single run), Shift+B (10-run batch at 60×), Shift+T (CSV export), Ctrl+Shift+T (clear log)
- All sims run in-browser; no Node dependency.

## Risks

- **Compute time** — at 100 sims per strategy × 6 strategies = 600 sims per cycle. Wave 5 is ~3 minutes of game time → ~3 s of wall time per run at 60×. Worst case ~30 min per cycle; most runs end at waves 1-3 so realistic cycle ≈ 5-10 min.
- **Strategy drift** — strategies are scripted; a tuning change might make one strategy's placements no longer make sense (e.g., placement on a tile that becomes unreachable). Implementation plan needs to verify each strategy is still well-formed after changes.
- **Local minimum** — single-knob iteration could converge to a local minimum where two correlated knobs need to move together (e.g., magazine size + interceptor damage). If this happens, the spec allows escalating to a coupled-pair change with explicit justification in `DECISIONS.md`.

## Acceptance gate at end

Before declaring the rebalance complete:

1. All five acceptance bands hold across two consecutive 100-run batches per strategy (so we know it isn't variance).
2. `DECISIONS.md` has a chronological tuning log.
3. `CHANGELOG.md` `v0.1.2 (in progress)` lists the player-facing number changes.
4. A short post-mortem note in `PLAYTESTS.md` summarising what the sim found vs. what the keyboard playtest had felt.
