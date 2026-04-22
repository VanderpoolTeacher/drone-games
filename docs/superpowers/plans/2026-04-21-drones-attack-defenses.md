# Drones Attack Defenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every defense an HP pool and let OWA / Payload / ISR drones damage or suppress them, so placed defenses become real targets that can be lost.

**Architecture:** `hp` authored per defense type in `CONFIG.defenses`, mirrored on each placed instance. `src/game/defenses.js` gains a death path (explosion + SFX + `stopSfx` + filter), an `isDisabledByIsr` stateless per-frame check that gates firing/jam logic, HP-bar + disable-pulse renderers. `src/game/drones.js` gains OWA opportunistic retargeting via a new `'terminalDefense'` phase and extends Payload drop AoE to also hit defenses.

**Tech Stack:** Vanilla JS ES modules, HTML5 Canvas 2D. Manual browser verification per `CLAUDE.md:61`.

**Spec reference:** `docs/superpowers/specs/2026-04-21-drones-attack-defenses-design.md`

---

## File layout

| File | Action | Responsibility |
|---|---|---|
| `src/config.js` | Modify | `hp` per defense, `combat` block |
| `src/game/defenses.js` | Modify | `hp` init, death path, `isDisabledByIsr`, disable-gate in update, HP-bar + pulse render |
| `src/game/drones.js` | Modify | OWA scan + `terminalDefense` phase, Payload AoE extended to defenses |

---

## Task 1: Config — defense HP + combat block

**Files:**
- Modify: `src/config.js`

- [ ] **Step 1: Add `hp` to each defense entry**

Open `src/config.js`. In the `defenses` block, add `hp: N` to each entry. The final shape of each block (only showing the changed portions):

```js
rfJammer: {
  displayName: 'RF Jammer',
  category: 'soft-kill',
  cost: 50,
  hp: 1,
  // … existing fields unchanged
},
interceptor: {
  displayName: 'Interceptor',
  category: 'hard-kill kinetic',
  cost: 100,
  hp: 2,
  // …
},
laser: {
  displayName: 'Directed Energy (Laser)',
  category: 'directed energy — HEL',
  cost: 200,
  hp: 3,
  // …
},
hpm: {
  displayName: 'HPM',
  category: 'directed energy — HPM',
  cost: 300,
  hp: 3,
  // …
},
```

Preserve ALL existing fields on each entry — `hp` is additive only.

- [ ] **Step 2: Add `combat` block**

Immediately after the `prepTimeBetweenWaves: 20000,` line (or anywhere in `CONFIG` outside `defenses`/`drones`/`waves`), insert:

```js
  combat: {
    owaEngageRange: 60,
    isrDisableRange: 36,
    owaDefenseDamage: 1,
    payloadDefenseDamage: 2,
  },
```

- [ ] **Step 3: Commit**

```bash
git add src/config.js
git commit -m "Task 1: defense HP + combat block"
```

---

## Task 2: Defenses — HP init, disable gate, death, render

**Files:**
- Modify: `src/game/defenses.js`

This is the biggest file change. Five surgical edits.

- [ ] **Step 1: Initialize `hp` in `placeDefense`**

Find the defense literal in `placeDefense`. Add `hp: cfg.hp` to the object. The final shape:

```js
export function placeDefense(state, type, tile, facingRad = 0) {
  const cfg = CONFIG.defenses[type];
  if (!cfg) return null;
  const { x, y } = tileToPixel(tile);
  const defense = {
    id: ++state.defenseIdCounter,
    type,
    tile: { x: tile.x, y: tile.y },
    x,
    y,
    hp: cfg.hp,
    cooldownMs: 0,
    targetId: null,
    heatMs: 0,
    overheated: false,
    facingRad,
    pulseFlashFrame: 0,
    laserFiring: false,
    rfJamming: false,
  };
  state.defenses.push(defense);
  state.resources -= cfg.cost;
  return defense;
}
```

- [ ] **Step 2: Add `isDisabledByIsr` helper**

Near the top of `src/game/defenses.js` (after the imports, before `placeDefense`), add:

```js
function isDisabledByIsr(state, def) {
  const rSq = CONFIG.combat.isrDisableRange * CONFIG.combat.isrDisableRange;
  for (const d of state.drones) {
    if (d.type !== 'isr') continue;
    if (d.hp <= 0 || d.phase === 'done') continue;
    const dx = d.x - def.x;
    const dy = d.y - def.y;
    if (dx * dx + dy * dy <= rSq) return true;
  }
  return false;
}
```

- [ ] **Step 3: Add disable gate + death sweep to `updateDefenses`**

Replace the entire `updateDefenses` function. The changes: at the top of each per-type branch, if `isDisabledByIsr(state, d)` is true, skip shot logic AND stop continuous sounds cleanly. At the end of the function, filter dead defenses.

```js
export function updateDefenses(state, dt) {
  for (const d of state.defenses) {
    d.cooldownMs = Math.max(0, d.cooldownMs - dt * 1000);

    if (isDisabledByIsr(state, d)) {
      if (d.laserFiring) {
        stopSfx('laser-' + d.id);
        d.laserFiring = false;
      }
      if (d.rfJamming) {
        stopSfx('rf-' + d.id);
        d.rfJamming = false;
      }
      d.targetId = null;
      continue;
    }

    if (d.type === 'interceptor') {
      if (d.cooldownMs > 0) continue;
      const target = pickClosestToStructureTarget(state, d, CONFIG.defenses.interceptor.range);
      if (!target) { d.targetId = null; continue; }
      fireInterceptor(state, d, target);
      playSfx('interceptorLaunch');
      d.cooldownMs = CONFIG.defenses.interceptor.cooldown;
      d.targetId = target.id;
    } else if (d.type === 'rfJammer') {
      // area effect handled by applyJamEffects; jam-sfx transitions also handled there.
    } else if (d.type === 'laser') {
      if (d.overheated) {
        if (d.laserFiring) {
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
        }
        if (d.cooldownMs <= 0) {
          d.overheated = false;
          d.heatMs = 0;
        }
        d.targetId = null;
        continue;
      }
      const target = pickClosestToStructureTarget(state, d, CONFIG.defenses.laser.range);
      if (target) {
        const eff = CONFIG.defenses.laser.effectivenessVs[target.type] ?? 1;
        target.hp -= CONFIG.defenses.laser.dps * dt * eff;
        d.heatMs = Math.min(d.heatMs + dt * 1000, CONFIG.defenses.laser.overheatTime);
        if (!d.laserFiring) {
          startSfx('laserFire', 'laser-' + d.id);
          d.laserFiring = true;
        }
        if (d.heatMs >= CONFIG.defenses.laser.overheatTime) {
          d.overheated = true;
          d.cooldownMs = CONFIG.defenses.laser.cooldownTime;
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
          playSfx('laserOverheat');
        }
        d.targetId = target.id;
      } else {
        d.heatMs = Math.max(0, d.heatMs - dt * 1000);
        if (d.laserFiring) {
          stopSfx('laser-' + d.id);
          d.laserFiring = false;
        }
        d.targetId = null;
      }
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
      d.targetId = victims[0].id;
      playSfx('hpmPulse');
    }
  }

  // Sweep dead defenses: explosion + SFX cleanup + remove.
  for (const d of state.defenses) {
    if (d.hp <= 0) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      if (d.laserFiring) stopSfx('laser-' + d.id);
      if (d.rfJamming) stopSfx('rf-' + d.id);
      playSfx('structureDestroyed');
    }
  }
  state.defenses = state.defenses.filter(d => d.hp > 0);
}
```

- [ ] **Step 4: Extend `renderDefenses` — HP bar + disable pulse**

Open `src/game/defenses.js`. Find the `renderDefenses` function. Add two renderers AFTER the per-type sprite code for each defense. Replace the full function with this version:

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
    } else if (d.type === 'laser') {
      ctx.fillStyle = d.overheated ? CONFIG.colors.alertAmber : CONFIG.colors.accentWhite;
      ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y - DEFENSE_SIZE / 2) + 1, 2, 2);
    } else if (d.type === 'hpm') {
      const cfg = CONFIG.defenses.hpm;

      const wedgeX = Math.floor(d.x + Math.cos(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
      const wedgeY = Math.floor(d.y + Math.sin(d.facingRad) * (DEFENSE_SIZE / 2 - 2)) - 1;
      ctx.fillStyle = CONFIG.colors.accentWhite;
      ctx.fillRect(wedgeX, wedgeY, 2, 2);

      const chargeFrac = 1 - Math.min(1, d.cooldownMs / cfg.pulseCooldown);
      const barLen = Math.floor(chargeFrac * (DEFENSE_SIZE - 2));
      if (barLen > 0) {
        ctx.fillStyle = CONFIG.colors.alertAmber;
        ctx.fillRect(Math.floor(d.x - DEFENSE_SIZE / 2) + 1, Math.floor(d.y - DEFENSE_SIZE / 2) - 1, barLen, 1);
      }

      if (d.pulseFlashFrame > 0) {
        const halfAngleRad = cfg.coneHalfAngleDeg * Math.PI / 180;
        const flashFrac = (4 - d.pulseFlashFrame) / 3;
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

    // HP segments — only if damaged
    const maxHp = CONFIG.defenses[d.type].hp;
    if (d.hp < maxHp) {
      const segW = Math.max(1, Math.floor(DEFENSE_SIZE / maxHp) - 1);
      const barY = Math.floor(d.y - DEFENSE_SIZE / 2) - 4;
      let segX = Math.floor(d.x - DEFENSE_SIZE / 2);
      for (let i = 0; i < maxHp; i++) {
        ctx.fillStyle = i < d.hp ? CONFIG.colors.friendlyCyan : CONFIG.colors.gridLine;
        ctx.fillRect(segX, barY, segW, 2);
        segX += segW + 1;
      }
    }
  }
}
```

- [ ] **Step 5: Add disable-pulse renderer**

Add a new export function below `renderDefenses`:

```js
export function renderDefenseDisablePulse(ctx, state, tMs) {
  if (Math.floor(tMs / 125) % 2 !== 0) return;
  for (const d of state.defenses) {
    if (!isDisabledByIsr(state, d)) continue;
    ctx.fillStyle = CONFIG.colors.threatViolet;
    ctx.fillRect(Math.floor(d.x) - 1, Math.floor(d.y) - 1, 3, 3);
  }
}
```

- [ ] **Step 5b: Gate `applyJamEffects` on disabled jammers**

`applyJamEffects` runs separately from `updateDefenses` and would otherwise keep slowing drones (and toggling `rfJamming` / the continuous SFX each frame) even when an ISR drone is disabling the jammer. Replace the function with a version that skips disabled jammers entirely:

```js
export function applyJamEffects(state) {
  const cfg = CONFIG.defenses.rfJammer;

  const jammersActiveThisFrame = new Set();

  for (const d of state.drones) {
    if (d.hp <= 0 || d.phase === 'done') { d.speedMultiplier = 1; continue; }

    let minMult = 1;
    for (const def of state.defenses) {
      if (def.type !== 'rfJammer') continue;
      if (isDisabledByIsr(state, def)) continue;
      const dx = d.x - def.x;
      const dy = d.y - def.y;
      if (Math.hypot(dx, dy) > cfg.range) continue;
      jammersActiveThisFrame.add(def.id);
      const eff = cfg.effectivenessVs[d.type] ?? 0;
      const mult = 1 - (1 - cfg.slowFactor) * eff;
      if (mult < minMult) minMult = mult;
    }
    d.speedMultiplier = minMult;
  }

  for (const def of state.defenses) {
    if (def.type !== 'rfJammer') continue;
    const active = jammersActiveThisFrame.has(def.id);
    if (active && !def.rfJamming) {
      startSfx('rfJam', 'rf-' + def.id);
      def.rfJamming = true;
    } else if (!active && def.rfJamming) {
      stopSfx('rf-' + def.id);
      def.rfJamming = false;
    }
  }
}
```

Only one-line change from the current version: `if (isDisabledByIsr(state, def)) continue;` inside the jammer loop. That alone prevents the flip-flop.

- [ ] **Step 6: Wire the pulse into main.js**

Open `src/main.js`. Find the existing defense render line:
```js
  renderDefenses(ctx, gameState);
```

Update its import line (currently `import { updateDefenses, renderDefenses, placeDefense, applyJamEffects, renderBeams } from './game/defenses.js';`) to include the new export:

```js
import { updateDefenses, renderDefenses, placeDefense, applyJamEffects, renderBeams, renderDefenseDisablePulse } from './game/defenses.js';
```

Add the pulse render IMMEDIATELY AFTER `renderDefenses(ctx, gameState);`:

```js
  renderDefenses(ctx, gameState);
  renderDefenseDisablePulse(ctx, gameState, tMs);
```

- [ ] **Step 7: Commit**

```bash
git add src/game/defenses.js src/main.js
git commit -m "Task 2: defense HP + ISR disable gate + death sweep + HP bar + pulse"
```

---

## Task 3: Drones — OWA retarget, new phase, Payload AoE on defenses

**Files:**
- Modify: `src/game/drones.js`

- [ ] **Step 1: Replace `updateOwa` to add opportunistic retargeting + new `terminalDefense` phase**

Find the existing `updateOwa` function (around line 277) and replace it entirely with:

```js
function updateOwa(d, dt, state) {
  if (d.commitLineFrame > 0) d.commitLineFrame -= 1;

  if (d.phase === 'cruise') {
    // Opportunistic defense retarget during cruise.
    const def = findClosestDefenseInRange(state, d, CONFIG.combat.owaEngageRange);
    if (def) {
      d.targetDefenseId = def.id;
      d.phase = 'terminalDefense';
      d.commitLineFrame = 1;
      return;
    }

    const corridor = MAP.corridors.owa[d.corridorIdx];
    if (d.wpIdx >= corridor.waypoints.length) {
      d.phase = 'terminal';
      d.commitLineFrame = 1;
      return;
    }
    advanceCruise(d, dt);
    return;
  }

  if (d.phase === 'terminalDefense') {
    const def = state.defenses.find(x => x.id === d.targetDefenseId);
    if (!def) {
      // Chosen defense died; fall back to the authored structure.
      d.targetDefenseId = null;
      d.phase = 'terminal';
      return;
    }

    const dx = def.x - d.x;
    const dy = def.y - d.y;
    const dist = Math.hypot(dx, dy);
    const speed = CONFIG.drones.owa.speed * (d.speedMultiplier ?? 1);
    const step = speed * dt;

    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      def.hp -= CONFIG.combat.owaDefenseDamage;
      d.phase = 'done';
      return;
    }

    d.vx = (dx / dist) * speed;
    d.vy = (dy / dist) * speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return;
  }

  if (d.phase === 'terminal') {
    const target = structurePixelPos(d.targetId);
    if (!target) { d.phase = 'exiting'; return; }

    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy);

    const speed = CONFIG.drones.owa.speed * (d.speedMultiplier ?? 1);
    const step = speed * dt;

    if (dist <= OWA_ARRIVAL_PX || step >= dist) {
      state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
      applyDamage(state, d.targetId, CONFIG.structures.damageFromOWAStrike);
      d.phase = 'done';
      return;
    }

    d.vx = (dx / dist) * speed;
    d.vy = (dy / dist) * speed;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
  }
}
```

- [ ] **Step 2: Add `findClosestDefenseInRange` helper**

In `src/game/drones.js`, add this helper near the bottom of the file (after `structurePixelPos`):

```js
function findClosestDefenseInRange(state, drone, range) {
  let best = null;
  let bestDist = Infinity;
  const rSq = range * range;
  for (const def of state.defenses) {
    const dx = def.x - drone.x;
    const dy = def.y - drone.y;
    const dSq = dx * dx + dy * dy;
    if (dSq > rSq) continue;
    if (dSq < bestDist) {
      best = def;
      bestDist = dSq;
    }
  }
  return best;
}
```

- [ ] **Step 3: Extend `updatePayload` — defenses in AoE take damage**

Find `updatePayload`. Replace its body (from the `if (Math.hypot…)` block downward) with a version that also iterates `state.defenses`:

```js
function updatePayload(d, dt, state) {
  advanceCruise(d, dt);

  if (!d.dropPoint) return;
  const drop = tileToPixel(d.dropPoint);
  const dx = drop.x - d.x;
  const dy = drop.y - d.y;
  if (Math.hypot(dx, dy) <= PAYLOAD_DROP_PX) {
    state.explosions.push({ x: d.x, y: d.y, frame: 0, frameTimer: 0 });
    for (const s of MAP.structures) {
      const sp = tileToPixel(s.tile);
      if (Math.hypot(sp.x - drop.x, sp.y - drop.y) <= PAYLOAD_AOE_RADIUS) {
        applyDamage(state, s.id, CONFIG.structures.damageFromPayloadDrop);
      }
    }
    for (const def of state.defenses) {
      if (Math.hypot(def.x - drop.x, def.y - drop.y) <= PAYLOAD_AOE_RADIUS) {
        def.hp -= CONFIG.combat.payloadDefenseDamage;
      }
    }
    d.phase = 'done';
  }
}
```

- [ ] **Step 4: Manual verify**

```bash
cd "/Users/michaelvanderpool/Documents/GitHub/GameJam/Drone Games"
pkill -f "npx serve" 2>/dev/null
npx serve -l 3000 &
sleep 2
```

Open http://localhost:3000/:

1. Start screen, press to begin, place an RF Jammer in the north corridor.
2. Wave 1 ISR drones pass near it → Jammer renders a pulsing threatViolet square and the `rfJam` hum stops while any ISR is within ~36 px. After ISR leaves, resumes.
3. Fast-forward to wave 3. Place a Laser near the east corridor. When an OWA drone gets within 60 px of the Laser mid-cruise, it should break off its structure target and fly straight at the Laser. Contact → 1 dmg to Laser, HP bar appears above showing 2/3 segments. Repeat attacks eventually destroy the Laser (explosion + `structureDestroyed` SFX).
4. Wave 4 Payload drop within 48 px of a defense → defense loses 2 HP.
5. Let a Laser die mid-firing — `laserFire` hum cuts cleanly, no leaked audio.
6. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/game/drones.js
git commit -m "Task 3: OWA opportunistic retarget + Payload AoE on defenses"
```

---

## Task 4: Docs

**Files:**
- Modify: `DECISIONS.md`
- Modify: `TODO.md`
- Modify: `PLAYTESTS.md`

- [ ] **Step 1: Append entries to `DECISIONS.md`**

Open `DECISIONS.md`. Append at the end using the flat `YYYY-MM-DD — sentence` style:

```markdown

2026-04-21 — Defenses are now mortal. HP per type: RF 1, Interceptor 2, Laser 3, HPM 3. Stored on each instance; no refund on destruction.

2026-04-21 — OWA drones retarget opportunistically. During cruise, if a defense sits within 60px, OWA switches to a new `terminalDefense` phase, flies straight at the defense, contact kills itself + deals 1 HP to the defense. Fallback to authored structure target if the chosen defense dies mid-flight.

2026-04-21 — Payload AoE (48px) now also damages defenses — 2 HP per hit. Same iteration pattern as the existing structure damage.

2026-04-21 — ISR drones temp-disable defenses within 36px each frame. Stateless check — `isDisabledByIsr(state, def)` scans live ISR drones every tick. Disabled defenses stop firing, stop jamming, cut any continuous SFX, and render a pulsing threatViolet square. Resumes instantly when ISR leaves range.

2026-04-21 — Defense destruction reuses the `structureDestroyed` SFX and existing explosion FX. Continuous SFX (`laser-<id>`, `rf-<id>`) are stopped cleanly in the death sweep so audio doesn't leak past removal.

2026-04-21 — HP segments render above each damaged defense (only when HP < max) — friendlyCyan for remaining segments, gridLine for lost. Hidden at full HP to avoid clutter.
```

- [ ] **Step 2: Update `TODO.md`**

Open `TODO.md`. Find:

```markdown
- [x] Hover tooltips — name + matchup info (issue #3)
- [ ] Class writeup draft
```

Insert a new entry between them:

```markdown
- [x] Drones attack defenses — HP pools + OWA retarget + Payload AoE + ISR disable (issue #17)
```

- [ ] **Step 3: Append playtest entry to `PLAYTESTS.md`**

Open `PLAYTESTS.md`. Insert a new session at the top after the `<!-- First playtest goes below. ... -->` comment:

```markdown
## 2026-04-21 — solo (Drones attack defenses)

**Build:** feat/drones-attack-defenses — defense HP, OWA retarget, Payload AoE, ISR disable
**Session length:** ~12 min full run
**Result:** N/A (feature pass; needs external playtest for tuning)

### What happened
- Wave 1 ISR passes disabled RF Jammer at expected range; pulse visual legible.
- Wave 3 OWA broke off mid-cruise to attack a Laser near the east corridor; second OWA finished it off.
- Wave 4 Payload drop inside a defense cluster took out the Jammer and chipped the HPM by 2.

### What worked
- Defense HP bar only showing when damaged keeps the HUD clean but still informative.
- OWA retargeting feels like real opportunism — the drones that switch targets feel "smart."
- ISR disable pulse + audio cut is an unmistakable "this defense is suppressed right now" signal.

### What felt off
- Wave 5 sometimes clears with ~3 defenses lost; might need to nudge defense HP up or OWA damage down for balance.
- Laser dying mid-beam fires `structureDestroyed` SFX — a bit dramatic for a single laser. Candidate for a dedicated "defense destroyed" SFX in a later pass.

### Questions raised
- Should Interceptor projectile kill defenses too? (No — friendly fire would be confusing. Ignore.)
- Should HPM pulses disable ISR drones before they get into disable range? HPM effectivenessVs.isr = 1.0 already handles this; check tuning.
```

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md TODO.md PLAYTESTS.md
git commit -m "Task 4: drones-attack-defenses docs"
```

---

## Self-review checklist (controller runs before hand-off)

1. **Spec coverage**
   - `hp` per defense + `combat` block → Task 1 ✓
   - `hp` init on place → Task 2 Step 1 ✓
   - `isDisabledByIsr` stateless check → Task 2 Step 2 ✓
   - Disable gate at top of update branches + continuous-SFX cleanup → Task 2 Step 3 ✓
   - Death sweep (explosion + SFX + filter) → Task 2 Step 3 ✓
   - HP-bar render → Task 2 Step 4 ✓
   - Disable pulse render → Task 2 Step 5 + wired Step 6 ✓
   - OWA scan + `terminalDefense` phase + fallback → Task 3 Step 1-2 ✓
   - Payload AoE on defenses → Task 3 Step 3 ✓
   - Docs → Task 4 ✓

2. **Type consistency**
   - `d.hp` referenced identically in placeDefense init, update sweep, render, and drone damage paths.
   - `state.defenses` filtered in Task 2 Step 3 — no other site holds stale references within the same frame (verified by reading surrounding code).
   - Continuous SFX ids (`'laser-' + d.id`, `'rf-' + d.id`) consistent across startSfx / stopSfx calls in updateDefenses (both the existing state machine branches and the new disable gate + death sweep).
   - OWA phase strings: `'cruise'`, `'terminal'`, `'terminalDefense'`, `'done'`, `'exiting'` — `terminalDefense` is the only new one; fallback path goes `terminalDefense → terminal`.

3. **Placeholder scan** — no TBD / TODO / vague-handling placeholders.

4. **Logic audit**
   - Disable gate in `updateDefenses` fires BEFORE the per-type branches, so Interceptor/Laser/HPM all skip their shot logic. ✓
   - RF Jammer has a special note — its disable needs to also unset `rfJamming` flag AND stop the continuous SFX. The `applyJamEffects` function runs separately from `updateDefenses`; when a jammer is disabled, `applyJamEffects` still runs. Need to check: does `applyJamEffects` need an `isDisabledByIsr` check too? YES — otherwise the jammer still slows drones via the effectiveness multiplier even when "disabled."
