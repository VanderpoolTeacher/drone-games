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
