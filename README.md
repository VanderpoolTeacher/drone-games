# Drone Defense: NYC

Tower defense prototype. Top-down NYC map, real-world-inspired counter-UAS (C-UAS) technology.

Built for applied AI design thinking class. Solo project, prototype + playtesting phase.

**Design thesis:** no single C-UAS system wins alone, and the defender's real problem is cost-exchange. See `DESIGN.md`.

## Run it

```
npx serve
```

Then open the URL it prints (usually `http://localhost:3000`).

Requires Node.js. No `npm install` step — no dependencies.

## Project docs

Source-of-truth (build from these):
- `CLAUDE.md` — operating manual for Claude Code
- `DESIGN.md` — game design, mechanics, v1 scope
- `STYLE.md` — visual style guide
- `TERMINOLOGY.md` — real-world C-UAS vocabulary
- `CONCEPTS.md` — how drones actually operate

Reference (read, don't build from):
- `HORIZON.md` — forward-looking tech and v2+ backlog

Supporting:
- `DECISIONS.md` — decision log
- `PLAYTESTS.md` — playtest notes
- `TODO.md` — task list

## V1 scope at a glance

- 3 drone types: **ISR, OWA, Payload-Delivery** (real DoD doctrinal names)
- 4 defenses: **RF Jammer, Interceptor, Laser (HEL), HPM**
- 3 critical structures, 5 waves, 5–10 min session
- Single NYC map, retro pixel-art aesthetic

## Current state

**Works:**
- (nothing yet — starting step 1)

**In progress:**
- Step 1: canvas + one ISR drone walking a fixed path

**Known issues:**
- (none yet)

## Build order

See `CLAUDE.md`. Short version: playable end-to-end before adding polish.
