# Balance Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the sim-driven rebalance loop. Add the four new sim
strategies, raise the batch size from 10 → 100 runs, run the baseline
measurement, and produce the first tuning hypothesis.

**Architecture:** Append four entries to `STRATEGIES` in
`src/game/simHarness.js`. Change the `Shift+B` handler in `src/main.js` so
it kicks off 100-run batches instead of 10-run. Each new strategy is a
declarative array of `{ waveNumber, type, tile }` placements timed to the
campaign delivery schedule. Verification is manual browser observation —
this codebase has no automated test framework. After the baseline batch,
analysis is judgment-driven (no analysis code), comparing CSV exports to
the acceptance bands in the design doc.

**Tech Stack:** Vanilla JS, ES modules, no build step, no test framework.
Existing sim harness (`src/game/simHarness.js`), existing keybinds in
`src/main.js`.

**Spec:** `docs/superpowers/specs/2026-04-26-balance-pass-design.md`

---

## File Structure

| File | Purpose | Change |
|---|---|---|
| `src/game/simHarness.js` | `STRATEGIES` dict + sim runner | Append 4 entries |
| `src/main.js` | `Shift+B` keybind | Bump `total: 10` → `total: 100` |
| `DECISIONS.md` | Tuning decision log | Add baseline measurement entry |
| `PLAYTESTS.md` | Playtest history | Append the first iteration's hypothesis |

No new files. No deletions.

---

## Map / Placement Reference

Critical structures (from `src/game/map.js`):

| Structure | Tile | Notes |
|---|---|---|
| Power Substation | (26, 8) | east-center |
| Comms Tower | (18, 8) | center |
| City Hall | (28, 10) | east-south |
| UN HQ | (26, 7) | east-north |
| Water Plant | (14, 8) | west-center |
| Federal Reserve | (22, 11) | south-center |
| Hospital | (18, 5) | north-center (non-critical) |
| Transit-G / Penn | (15, 7) / (12, 7) | west (non-critical) |

Defenses cannot share a tile with a structure or with another defense (the
existing `isValidZone` check rejects the placement; the sim retries the step
on later frames). Strategy placements must therefore be on land tiles
adjacent to but not on the structures above.

Map column range is 0-29 for the playable area (col 30+ is the stats
sidebar). Land y-range is roughly 4-13 in the central island band.

---

## Tasks

### Task 1: Add `radar-first` strategy

**Files:**
- Modify: `src/game/simHarness.js` — `STRATEGIES` dict (currently has `early-rf` and `no-defenses` only)

**Intent:** Wave-1 radar at the central island before any effector. Effectors
layer in as deliveries arrive. Tests whether sensor-first play meaningfully
changes outcomes.

- [ ] **Step 1: Open the file and locate the STRATEGIES dict**

`src/game/simHarness.js`, around line 23. The dict ends with the
`'no-defenses': []` line.

- [ ] **Step 2: Append the strategy entry**

Replace:

```js
const STRATEGIES = {
  // ... existing early-rf entries ...
  'no-defenses': [],
};
```

with:

```js
const STRATEGIES = {
  // ... existing early-rf entries unchanged ...
  'no-defenses': [],
  'radar-first': [
    { waveNumber: 1, type: 'radar',       tile: { x: 18, y: 9 } },   // central radar
    { waveNumber: 2, type: 'laser',       tile: { x: 22, y: 9 } },
    { waveNumber: 3, type: 'rfJammer',    tile: { x: 16, y: 9 } },
    { waveNumber: 3, type: 'interceptor', tile: { x: 24, y: 8 } },
    { waveNumber: 3, type: 'radar',       tile: { x: 12, y: 8 } },   // 2nd radar (delivered W3)
    { waveNumber: 4, type: 'interceptor', tile: { x: 14, y: 10 } },
    { waveNumber: 4, type: 'laser',       tile: { x: 20, y: 10 } },
    { waveNumber: 5, type: 'hpm',         tile: { x: 18, y: 6 }, facingRad: Math.PI / 2 },
  ],
};
```

(Leave `early-rf` and `no-defenses` exactly as they are.)

- [ ] **Step 3: Syntax check**

Run: `node --check src/game/simHarness.js`
Expected: no output (clean parse).

- [ ] **Step 4: Browser verify**

Refresh `http://localhost:5050/`. Press `T` to start a single sim. The
strategy rotation order is alphabetical-ish based on `listStrategies()`'s
insertion order; press `T` until the SIM banner shows
`strategy: radar-first`. Watch the sidebar event log:

- W1 prep should log `+rad 18,9`
- W2 prep should log `+las 22,9`
- W3 prep should log `+rfJ 16,9`, `+int 24,8`, `+rad 12,8`
- W4: `+int 14,10`, `+las 20,10`
- W5: `+hpm 18,6`

If any placement fails (no `+` log line for that tile), check `isLand` /
existing structure overlap on that tile. Adjust to a neighbour tile if so
and rerun.

- [ ] **Step 5: Commit**

```
git add src/game/simHarness.js
git commit -m "feat(#50): add radar-first sim strategy"
```

---

### Task 2: Add `kinetic-only` strategy

**Files:**
- Modify: `src/game/simHarness.js` — `STRATEGIES` dict (append after `radar-first`)

**Intent:** Interceptors only. Tests finite magazine + no DEW + no RF. Should
struggle at saturation. Plans more placements than the per-wave delivery
provides — relies on the auto-trickle (`updateTrucks` in `state.js`) to fill
inventory between scripted attempts.

- [ ] **Step 1: Append the entry**

After the `radar-first` array, before the closing `}`:

```js
  'kinetic-only': [
    { waveNumber: 3, type: 'interceptor', tile: { x: 22, y: 9 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 14, y: 10 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 25, y: 9 } },   // bet on trickle
    { waveNumber: 5, type: 'interceptor', tile: { x: 16, y: 9 } },
    { waveNumber: 5, type: 'interceptor', tile: { x: 20, y: 9 } },
  ],
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/game/simHarness.js`
Expected: clean.

- [ ] **Step 3: Browser verify**

Refresh + cycle `T` until the banner shows `strategy: kinetic-only`. Confirm
no RF / laser / HPM / radar placements log; only `+int` lines on waves 3-5.
Some `+int` attempts may not fire on the first frame they're scheduled —
the script retries each frame until inventory permits or the prep phase
ends. Acceptable.

- [ ] **Step 4: Commit**

```
git add src/game/simHarness.js
git commit -m "feat(#50): add kinetic-only sim strategy"
```

---

### Task 3: Add `dew-only` strategy

**Files:**
- Modify: `src/game/simHarness.js` — `STRATEGIES` dict (append after `kinetic-only`)

**Intent:** Laser + HPM only. Tests DEW economy under saturation; no kinetic,
no RF, no sensors.

- [ ] **Step 1: Append the entry**

```js
  'dew-only': [
    { waveNumber: 2, type: 'laser', tile: { x: 18, y: 9 } },
    { waveNumber: 4, type: 'laser', tile: { x: 22, y: 9 } },
    { waveNumber: 4, type: 'laser', tile: { x: 14, y: 10 } },        // bet on trickle
    { waveNumber: 5, type: 'hpm',   tile: { x: 18, y: 6 }, facingRad: Math.PI / 2 },
  ],
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/game/simHarness.js`
Expected: clean.

- [ ] **Step 3: Browser verify**

Refresh + cycle `T` until banner shows `strategy: dew-only`. Confirm only
`+las` and `+hpm` placements log.

- [ ] **Step 4: Commit**

```
git add src/game/simHarness.js
git commit -m "feat(#50): add dew-only sim strategy"
```

---

### Task 4: Add `balanced-stack` strategy

**Files:**
- Modify: `src/game/simHarness.js` — `STRATEGIES` dict (append after `dew-only`)

**Intent:** One of every defense as it becomes available. The "optimal
layered" reference. High-water mark for win rate.

- [ ] **Step 1: Append the entry**

```js
  'balanced-stack': [
    { waveNumber: 1, type: 'rfJammer',    tile: { x: 16, y: 9 } },
    { waveNumber: 1, type: 'radar',       tile: { x: 22, y: 9 } },
    { waveNumber: 2, type: 'laser',       tile: { x: 14, y: 10 } },
    { waveNumber: 3, type: 'rfJammer',    tile: { x: 25, y: 9 } },
    { waveNumber: 3, type: 'interceptor', tile: { x: 18, y: 6 } },
    { waveNumber: 3, type: 'radar',       tile: { x: 12, y: 8 } },
    { waveNumber: 4, type: 'interceptor', tile: { x: 20, y: 10 } },
    { waveNumber: 4, type: 'laser',       tile: { x: 27, y: 9 } },
    { waveNumber: 5, type: 'hpm',         tile: { x: 18, y: 7 }, facingRad: Math.PI / 2 },
  ],
```

- [ ] **Step 2: Syntax check**

Run: `node --check src/game/simHarness.js`
Expected: clean.

- [ ] **Step 3: Browser verify**

Refresh + cycle `T` until banner shows `strategy: balanced-stack`. Confirm
all 9 placement attempts log over W1-W5. If the 4-defense cap (5 of each
type via the trickle CAP) interferes with W3+W4 placements, accept the
gap — the trickle delivers everything eventually.

- [ ] **Step 4: Commit**

```
git add src/game/simHarness.js
git commit -m "feat(#50): add balanced-stack sim strategy"
```

---

### Task 5: Raise batch size from 10 to 100 runs

**Files:**
- Modify: `src/main.js` — the `Shift+B` keydown handler

**Intent:** Per the spec, acceptance is judged on 100-run batches per
strategy. The current handler hard-codes `total: 10`. Bump to 100. Each
batch will take ~5-8 minutes of compute at 60×.

- [ ] **Step 1: Locate the Shift+B block**

In `src/main.js`, find the block (around line 366 in the current file):

```js
if ((e.key === 'B' || e.key === 'b') && e.shiftKey) {
  if (gameState.batch?.active) { abortBatch(gameState); return; }
  if (gameState.screenPhase !== 'playing') {
    // ... mode setup ...
  }
  const strategies = listStrategies();
  const pick = strategies[(simStrategyIdx++) % strategies.length];
  startBatch(gameState, { strategy: pick, total: 10, speed: 60 });
  return;
}
```

- [ ] **Step 2: Change total from 10 to 100**

```js
  startBatch(gameState, { strategy: pick, total: 100, speed: 60 });
```

- [ ] **Step 3: Syntax check**

Run: `node --check src/main.js`
Expected: clean.

- [ ] **Step 4: Browser verify**

Refresh. Press `Shift+B`. The center banner should read `BATCH 1/100`. Press
`Esc` immediately to abort — we don't want a real batch yet, just confirming
the count.

- [ ] **Step 5: Commit**

```
git add src/main.js
git commit -m "feat(#50): raise sim batch size to 100 runs"
```

---

### Task 6: Wipe stale sim data

**Files:**
- None (browser localStorage operation only).

**Intent:** Any prior sim runs from earlier dev sessions are still in
`localStorage` under `droneDefense.simRuns` and would contaminate the
baseline CSV. Clear them before measurement.

- [ ] **Step 1: Press the clear shortcut in the running game**

Refresh `http://localhost:5050/`. Press `Ctrl+Shift+T` (Mac: `Cmd+Shift+T`).

- [ ] **Step 2: Verify the console**

DevTools Console should log: `[sim] cleared sim log`.

- [ ] **Step 3: No commit**

Nothing to commit (state lives in browser only).

---

### Task 7: Run the baseline batch — 6 strategies × 100 runs

**Files:** none. This is execution.

**Intent:** Produce the v0.1.1 baseline CSV. 600 sims total, ~30 min wall
time worst case but typically 5-10 min since most lose at waves 1-3.

- [ ] **Step 1: For each of the 6 strategies, kick off a 100-run batch**

Refresh after Task 6. Press `Shift+B`. The first strategy fires (per the
existing rotation: `early-rf` first, then `no-defenses`, then in insertion
order `radar-first`, `kinetic-only`, `dew-only`, `balanced-stack`).

Wait for the batch to finish — banner returns to normal HUD. Console logs:
`[batch] end 100/100 runs · wins X · <strategy>`.

Press `Shift+B` again for the next strategy. Repeat 5 more times. Total: 6
batches.

- [ ] **Step 2: Export the CSV**

Press `Shift+T`. Browser downloads `drone-defense-sim-<timestamp>.csv`. The
file contains 600 rows.

- [ ] **Step 3: Save the CSV to the repo for analysis**

```
mv ~/Downloads/drone-defense-sim-*.csv \
   docs/superpowers/data/2026-04-26-baseline.csv
mkdir -p docs/superpowers/data && git add docs/superpowers/data/2026-04-26-baseline.csv
git commit -m "data(#50): v0.1.1 baseline sim batch — 6×100 runs"
```

(Create the `docs/superpowers/data` directory in this step if it doesn't exist.)

---

### Task 8: Aggregate the baseline and compare to acceptance bands

**Files:** none. This is analysis using shell.

**Intent:** Compute per-strategy win rate and mean-waves-survived, compare
to the spec's bands. No persistent code added — just a one-shot analysis.

- [ ] **Step 1: Win-rate per strategy**

Run:

```bash
awk -F, 'NR>1 {n[$2]++; if ($3=="win") w[$2]++} END {for (s in n) printf "%-15s %d/%d  %.1f%% win\n", s, w[s], n[s], 100*w[s]/n[s]}' docs/superpowers/data/2026-04-26-baseline.csv | sort
```

Expected columns from the CSV (one-indexed): 1=recordedAt, 2=strategy,
3=outcome, 4=wavesSurvived, 5=runMs, 6=casualties, 7=structuresLost,
8=defensesLost, 9=lastIntel, 10=payloadPoolRemaining, 11=bridgesLive.
Verify with `head -1 docs/superpowers/data/2026-04-26-baseline.csv` if the
column numbers are off.

- [ ] **Step 2: Mean-waves-survived per strategy**

```bash
awk -F, 'NR>1 {n[$2]++; t[$2]+=$4} END {for (s in n) printf "%-15s mean waves %.2f\n", s, t[s]/n[s]}' docs/superpowers/data/2026-04-26-baseline.csv | sort
```

- [ ] **Step 3: Compare to acceptance bands**

For each strategy, mark which is in band / out of band:

| Strategy | Win-rate target | Observed |
|---|---|---|
| no-defenses | 0-2% | _____ |
| early-rf | 40-60% | _____ |
| radar-first | 20-35% | _____ |
| kinetic-only | 20-35% | _____ |
| dew-only | 20-35% | _____ |
| balanced-stack | 60-80% | _____ |

Also: `wavesSurvived` median ≥ 3 on `early-rf`; wave-5-reach ≤ 60% of
wave-3-reach on `early-rf`.

- [ ] **Step 4: Identify the worst single outlier**

Rank strategies by `(observed - midpoint of band) / half-band-width`. The
strategy with the largest absolute Z is the iteration target.

- [ ] **Step 5: No commit yet**

Analysis is informational at this step. The next task records the
hypothesis and stops there — actual number changes are subsequent
iterations.

---

### Task 9: Record the first tuning hypothesis (no number change yet)

**Files:**
- Modify: `DECISIONS.md` — append baseline section
- Modify: `PLAYTESTS.md` — append baseline observation

**Intent:** Document the data so the next session can pick up. The actual
tunable change is a separate iteration; this plan stops at "we've
identified the first lever".

- [ ] **Step 1: Append to DECISIONS.md**

Add at the top (most recent first):

```markdown
## 2026-04-26 — v0.1.1 baseline measurement (#50)

Sim batch: 6 strategies × 100 runs. Data:
`docs/superpowers/data/2026-04-26-baseline.csv`.

Observed win rates:
- no-defenses    : __%
- early-rf       : __%
- radar-first    : __%
- kinetic-only   : __%
- dew-only       : __%
- balanced-stack : __%

Worst outlier: `<strategy>` at __% (target __-__%).

Hypothesis for first tuning iteration: change `<config.path>` from
`<before>` → `<after>`. Reasoning: <one sentence>.

Affected strategies for re-run: <list>.
```

Replace the underscores with real numbers from Task 8.

- [ ] **Step 2: Append to PLAYTESTS.md**

Add at the top:

```markdown
## 2026-04-26 — v0.1.1 sim baseline

First sim-driven measurement after the v0.1.1 mechanic shipping spree.
600 runs total. The numbers say: <one-line summary>.

Surprises vs keyboard playtest:
- <bullet>
```

Fill the bullets with whatever surprises came out of Task 8.

- [ ] **Step 3: Commit both files**

```
git add DECISIONS.md PLAYTESTS.md
git commit -m "docs(#50): record v0.1.1 baseline + first tuning hypothesis"
```

---

## After this plan

This plan deliberately stops at "first iteration's hypothesis recorded". The
next session picks up by:

1. Applying the hypothesised number change (one knob).
2. Re-running affected strategies (subset).
3. Recording the new baseline + next hypothesis in `DECISIONS.md`.
4. Looping until all five acceptance bands hold for two consecutive
   measurements.

The loop is judgment-driven and not pre-plannable — each iteration's
target depends on the previous result. This plan establishes the loop
mechanics so subsequent iterations are quick.

---

## Self-Review

**Spec coverage:**
- ✅ 6 strategies (Tasks 1-4 add 4 new; existing 2 untouched).
- ✅ 100 sims per strategy (Task 5 raises batch size).
- ✅ Tuning loop process (Tasks 7-9 walk one full cycle).
- ✅ Tunable scope (in/out lists already in spec; not encoded in code).
- ✅ Metrics (Task 8 uses existing CSV columns; spec's hybrid approach honoured).
- ✅ Acceptance bands (Task 8 compares observed vs targets).

**Placeholder scan:** No "TBD"/"TODO" in task text. The DECISIONS /
PLAYTESTS templates have `__` blanks that the engineer fills with real
numbers — that's intentional, not a planning failure.

**Type consistency:** Strategy entries match the existing
`{ waveNumber, type, tile, [facingRad] }` shape. `startBatch` signature
unchanged.

**Scope:** Single cohesive piece — set up the sim loop and run one cycle.
Subsequent iterations are out of scope (and not pre-plannable).
