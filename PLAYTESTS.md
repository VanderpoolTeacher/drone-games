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
