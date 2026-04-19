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
