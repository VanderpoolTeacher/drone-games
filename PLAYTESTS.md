# Playtests

Log every play session once there's anything to play — even solo ones. Design gold for the class writeup and catches problems before they calcify.

Template:

```
## YYYY-MM-DD — [Tester name or "solo"]

**Build:** [commit hash or short description]
**Session length:** X min
**Result:** Won / Lost on wave N / Quit

### What happened
- ...

### What felt off
- ...

### What worked
- ...

### Questions raised
- ...
```

---

<!-- First playtest goes below. Most recent at the top once there are multiple. -->

## 2026-04-21 — solo (CRT post-process)

**Build:** feat/crt-postprocess — src/ui/crt.js wired last in frame()
**Session length:** ~5 min render check
**Result:** N/A (visual pass, not a play session)

### What happened
- Scanlines + vignette render on top of gameplay and both overlays.
- Verified prep, active, lose, and win states with CRT active.

### What worked
- Scanlines read as "CRT" without obscuring charge bars, drone colors, or legend text.
- Vignette darkens corners subtly; no visible halo at the map edge.
- Overlay headlines (DEFENSE FAILED / CITY HELD) stay legible under the final pass.

### What felt off
- Nothing — alphas (15% / 20%) feel right on first look. Leaving as-is; will revisit if an outside playtest flags readability.

### Questions raised
- Real sprites + SFX still pending before the v1 class submission.

## 2026-04-21 — solo (Wave system + win condition)

**Build:** wave system plan complete — full v1 loop playable end-to-end
**Session length:** ~6 min (two complete runs: one won, one lost)
**Result:** First game that actually ends with WIN or LOSE

### What happened
- Run 1 (won): placed RF Jammer + Interceptor + Laser during wave 1 prep. Survived through wave 3 with moderate stress. Added HPM at (8,5) facing south during wave 3 prep. Cleared waves 4-5 cleanly. CITY HELD.
- Run 2 (lost): greedy — only placed 2 Interceptors before wave 1. OWAs in wave 3 broke through; Payload in wave 4 took out comms in two drops. DEFENSE FAILED on wave 4.
- Both restarted cleanly; no state leak between runs.

### What worked
- 15s prep phase is exactly right for initial placement. Longer would feel slow; shorter would be unfair.
- Chevron + icon telegraphs read instantly — the first time S chevron appeared with an amber OWA icon, I knew I needed to rotate defenses toward the harbor before wave 3 active started.
- Wave bonus ($200 per clear) keeps resources climbing as waves scale, so late-wave placements are affordable.
- INCOMING vs NEXT 0:NN vs COMPLETE in the palette HUD gives the phase state without any extra UI.
- Win / lose overlays both use the same restart gesture → muscle memory carries between outcomes.

### What felt off
- Wave 5 is brutal as designed. First lose run, I leaked on wave 4 because I'd under-committed. Felt fair.
- Payload shows only one chevron (W xor E) during wave 4-5 prep even though both edges spawn Payload. Known limitation per the spec; second Payload crossing felt "unfair" the first time because no telegraph. Flag for polish-plan dual-chevron.
- No audio on wave clear, wave start, or win — very silent for such big moments. Polish plan.
- CITY HELD overlay has no stats (waves survived, structures remaining, etc). Future stats screen.

### Questions raised
- Should the wave system skip prep between waves if the player clicks a "READY" button? Might help advanced players. v2 feature.
- Balance: HPM feels required for wave 5 saturation, which matches the design thesis but makes HPM's "stretch" framing in CLAUDE.md no longer accurate — it's effectively required. Worth revisiting thesis language.

## 2026-04-21 — solo (Structure HP + lose condition)

**Build:** structure-hp plan complete — drones now matter
**Session length:** ~3 min (two deaths, one survival run)
**Result:** Game has stakes for the first time

### What happened
- Run 1: no defenses placed, watched OWAs eat City Hall in 4 hits, Comms in 4 hits, Power in 4 hits. DEFENSE FAILED at ~45s.
- Run 2: after restart, placed HPM aimed south at (8,5), Interceptor at (7,6), Laser at (12,5). Survived indefinitely.
- Payload drops only damaging one structure each (AoE radius 48 ≈ 2 tiles means adjacent structures on current map don't chain)

### What worked
- HP tier colors read perfectly — amber = "this is getting concerning", red = "panic", gridLine ruin = "too late"
- 2-frame flash feels weighty; confirms hits without being gaudy
- DEFENSE FAILED overlay reads clearly; restart is one click away — friction-free replay loop
- Drones freeze on loss but explosions finish animating — feels deliberate, not crashed
- resetGameState wipes cleanly; second run starts fresh with no stale state

### What felt off
- No audio on structure destroyed or on lose — visual only feels muted for such a big moment
- No on-screen HP number. Visual tiers work but "am I at 60 or 35" is hard to read precisely
- Payload AoE radius (48 px) is conservative — on current map no Payload threatens two structures. During tuning, might widen to 72–96 to create real multi-hit moments. Logged for later.

### Questions raised
- Should destroyed structures also fade their sprite over a few frames instead of snap-to-gray? Polish plan.
- When the wave system lands, we need a WIN overlay too. Similar primitive: green-toned "CITY HELD" overlay with a "CONTINUE" or "RESTART" hint.

## 2026-04-19 — solo (HPM)

**Build:** HPM plan complete — v1 defense roster shipped
**Session length:** ~90 s soak with all four defenses placed
**Result:** First complete layered defense run

### What happened
- Placed HPM at (8, 5) aimed south at the OWA harbor corridor + Interceptor at (7, 6) for cleanup
- First saturation OWA cluster got pulsed (4-drone kill in one flash); remaining stragglers died to the Interceptor
- Placed second HPM at (12, 5) aimed east at the Payload corridor — Payload still takes 4 pulses but now it slow-cooks in the cone
- RF Jammer at (6, 1) for N corridor ISR still does its soft-kill job

### What worked
- Aim-toward-mouse placement is intuitive — rotating the cone in real time reads immediately as "aim before commit"
- 3-frame cone-sweep pulse flash feels weighty and snappy without being gaudy
- Amber charge bar is a clear "am I ready" affordance; saves having to memorize cooldowns
- One-shot kill on ISR/OWA makes HPM feel POWERFUL (which is correct per design thesis)
- Facing wedge at rest is enough to remember which way each HPM points

### What felt off
- Placing an HPM "at mouse angle" is easy but means angling a shot to NE requires mouse position above-and-right. That's a bit awkward when the cursor is also on the palette button side of the screen. Defer fix.
- No audio on pulse — visual only is readable but missing kinetic feel
- Payload takes 4 pulses (16 s) which feels long solo. Pair HPM with Laser for Payload: Laser absorbs 120 hp in 2.5 s; HPM is for swarm, not singles

### Questions raised
- Should HPM cone outline be always-on (dim) at rest so the player can see coverage without re-arming? Defer — the facing wedge is a lighter-weight affordance
- Does the player need a "rotate HPM" action post-placement? Probably yes in v2, but placement locks in v1 per spec

## 2026-04-19 — solo (Laser)

**Build:** Laser plan complete (third defense live)
**Session length:** ~90 s soak
**Result:** All three required defenses now present; first overheat cycle observed

### What happened
- Placed Laser at tile (8, 5) covering the Payload corridor + one at (12, 5) for redundancy
- Payload drones died in ~2.5 s of continuous beam; lens started amber (overheat) about halfway through the second Payload in a row
- OWAs melted in ~0.4 s each; 3-4 OWAs in a row pushed the Laser to overheat
- ISR took ~1.7 s each, visibly inefficient vs the Interceptor

### What worked
- Beam is highly readable even without polish — a single pixel is enough to telegraph "this drone is being shot"
- Lens color flip (white → amber) reads as overheat without explanation
- Passive cooling during gaps in drone arrivals means one Laser can clear sparse waves indefinitely
- Cost (200) feels right vs per-kill damage — expensive upfront but cheap per kill on OWA/Payload corridors

### What felt off
- No audio or FX on overheat onset — it just quietly stops. Easy to miss in heavy action. Defer to polish.
- Laser accent when overheated (amber 2×2 at top) visually matches Interceptor accent. Real polish-plan sprites should differentiate.
- With three defenses placed, the visual density gets high during wave 5-equivalent saturation. Legend + sprite accents help but a cleaner render pass might be worth a pass later.

### Questions raised
- Should overheat be accompanied by a 1-frame visual "pop" on the Laser to make it noticeable? Polish plan concern.
- Should the Laser prioritize higher-HP drones (Payload) over low-HP (OWA) since it overkills OWAs? Currently "closest to structure" — works well in practice but might tune later.

## 2026-04-19 — solo (RF Jammer)

**Build:** RF Jammer plan complete (second defense live)
**Session length:** ~90 s soak
**Result:** First visible "layered defense" moment

### What happened
- Placed two RF Jammers in the N corridor + one Interceptor near City Hall
- ISR drones slowed to ~half speed through the jam band; Interceptor killed them easily as they crept by
- OWAs barely noticed the jammers, continued to terminal commit at full-ish speed
- Payload crossings took a beat longer but not dramatically

### What worked
- Dashed vs solid range circles read instantly in placement mode
- White dish / amber tip accents differentiate jammer and interceptor placeholders
- Scaled slow formula makes the matchup table "real" — the difference between ISR (0.5x) and OWA (0.85x) is visible without numbers
- Stacking by min prevents jammer-spam exploits; two jammers is for coverage, not cumulative slow

### What felt off
- No active visual telegraph on the jammer itself (no pulsing ring yet). Easy to forget which defense is doing what when both are placed nearby.
- ISR passing through a jam zone and then leaving snaps back to full speed instantly (no recovery delay). Feels slightly arcade-y; doesn't match realistic C2 reacquisition timing. Deferring to tuning.

### Questions raised
- RF Jammer range (80 px) is tight for N corridor coverage at the corners. One jammer at (6,1) handles middle ISR corridor nicely but misses corridor 2. Do we widen range, or expect player to place two? Defer to tuning pass.
- Should defense accent colors become palette-aligned? White dish pops, but an amber or successGreen dish might fit the palette better. Visual polish concern.

## 2026-04-19 — solo (defenses + placement + Interceptor)

**Build:** defenses-placement-interceptor plan complete (Interceptor only, no waves)
**Session length:** ~90 s soak
**Result:** Playable core loop (drones in, defenses fire, bonuses pay)

### What happened
- Click INTRCPT button → armed; click valid zone → placed for $100
- Interceptors fired on drones in range with 1.5 s cooldown
- Drones took damage per effectivenessVs (ISR ×0.5, OWA/Payload ×1.0); dying drones triggered explosions and credited bonuses
- Economy stable: starting $400, kept affording placements as kill bonuses rolled in

### What worked
- Two-click placement (palette → zone) reads fast; ESC / right-click / re-click cancel all work
- Range circle at ghost position telegraphs coverage before commit
- Red 2×2 overlays on non-zone tiles kept placement decisions readable
- Targeting "closest to any structure" felt right — Interceptors engaged OWAs committing before distant ISRs

### What felt off
- Interceptor cooldown (1.5 s) against ISR spawning every 3 s from three corridors means one Interceptor can't cover much; designed for later to reward multi-placement + defense mix
- Payload takes 4 hits and its movement is slow, so a single Interceptor can chew through one solo. Once Laser/HPM land the matchup variance will sharpen

### Questions raised
- Should projectiles be removed on target death mid-flight? Currently they continue and may hit nearby drones. Feels realistic for a kinetic shot; revisit if it causes confusion
- Are 100 px range + corridor positions well-aligned? Some zones cover only one corridor by design; confirm during tuning pass

## 2026-04-19 — solo (drones + corridor traversal)

**Build:** drones-traversal plan complete (no wave system / defenses yet)
**Session length:** ~2 min soak
**Result:** N/A (no gameplay loop yet; this tests threat-vector rendering)

### What happened
- Dev auto-spawner produces drones at 3s/5s/7s intervals for ISR/OWA/Payload
- All three drone types behaved per spec: ISR weaves N→S and exits, OWA terminal-commits to authored structure and explodes, Payload crosses W↔E and explodes on drop
- Trails, commit lines, explosions all render correctly

### What worked
- Round-robin corridor selection made coverage of all authored paths visible in the first ~15s
- ISR jitter reads as "operator-flown" without looking random
- 3-frame explosions feel snappy, not sluggish
- No drones piled up after 60s

### What felt off
- Payload dropPoint landing on top of a structure tile makes the explosion visually merge with the structure sprite — may need a drop offset or structure damage animation when that plan lands
- ISR trail at maximum length sometimes reads busier than expected when multiple ISR drones overlap — tuning candidate

### Questions raised
- Dev spawn intervals (3/5/7 s) feel paced for development, not gameplay. Will need re-tuning once wave system replaces the stub.
- Should Payload drones survive their drop and continue off-grid, or despawn at drop? Currently despawn; matches spec.

## 2026-04-19 — solo (map render only)

**Build:** map foundation plan complete (static render)
**Session length:** n/a — render check, not a play session
**Result:** N/A (no gameplay yet)

### What happened
- Loaded index.html via `npx serve`, map renders as spec'd

### What worked
- Peninsula silhouette reads clearly at 480x270 × 4x scale
- Structure placeholders, zones, coastline, chrome bars all render at the right positions
- Pulse timing on zones is crisp (1-frame state change, no tween)

### What felt off
- Placeholder structure sprites are identical — can't visually distinguish power / comms / city hall until real sprites land
- No drones, placement interaction, or waves yet — this is just the foundation

### Questions raised
- Will the 32×32 structures reading "too dominant" against 16×16 drones + 24×24 defenses become a problem during waves? Defer to first wave playtest.
