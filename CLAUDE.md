# Drone Defense

Tower defense prototype. Solo project, built for an applied AI design thinking class. Currently in prototype + playtesting phase.

## Source-of-truth docs — read before starting work

When writing code or player-facing text, treat these as authoritative:

- **`DESIGN.md`** — game design, mechanics, win/lose, v1 scope
- **`STYLE.md`** — visual style: palette, sprites, CRT treatment
- **`TERMINOLOGY.md`** — real-world DoD/C-UAS vocabulary; use for all labels, tooltips, briefings
- **`CONCEPTS.md`** — how drones actually operate; justifies behaviors and matchups
- **`HORIZON.md`** — reference only; forward-looking tech for v2+ planning and the class writeup. **Do not build from this doc unless explicitly asked.**

Supporting docs (update as you go, don't build from):

- **`DECISIONS.md`** — decision log
- **`PLAYTESTS.md`** — playtest notes
- **`TODO.md`** — running task list
- **`README.md`** — quick-reference for running and current state

## Stack

- Vanilla HTML5 Canvas + JavaScript (ES modules)
- No build step, no framework, no bundler, no lint/format tooling — this is intentional
- Runs by serving `index.html` with `npx serve` (or any static server)
- No dependencies unless we explicitly add one

## Project structure (target)

Code layout:

```
/
├── index.html          # Entry point, canvas + minimal UI chrome
├── src/config.js       # All tunable values
├── src/
│   ├── main.js         # Boot + game loop
│   ├── game/           # Core game logic (state, waves, economy)
│   ├── entities/       # One file per drone type + per defense
│   ├── ui/             # HUD, placement cursor, menus
│   └── assets/         # Images, sounds (placeholders OK for now)
└── *.md                # Docs (CLAUDE, DESIGN, STYLE, TERMINOLOGY, CONCEPTS, HORIZON, DECISIONS, PLAYTESTS, TODO, README)
```

## Conventions

- One entity type per file (e.g. `entities/isrDrone.js`, `entities/rfJammer.js`)
- Prefer plain objects and pure functions over classes where reasonable
- Game state lives in one central object, not scattered globals
- `requestAnimationFrame` for the loop; pass `deltaTime` **in seconds** to update functions (convert the raw ms timestamp at the loop boundary)
- Coordinates in pixels
- No magic numbers in game logic — all tunable values in `config.js`
- Follow the retro pixel-art rules in `STYLE.md`: 480×270 virtual resolution, `ctx.imageSmoothingEnabled = false`, 8-color palette only
- All player-facing text uses real DoD/C-UAS vocabulary per `TERMINOLOGY.md`

## Verifying changes

No automated tests. Before claiming a change works:

1. `npx serve` and open `index.html`
2. Play the relevant slice (at minimum: wave 1 start → first drone killed or leaked)
3. Check the browser console for errors
4. If the change affects tuning, note observed behavior in `PLAYTESTS.md`

## V1 scope (current build target)

Single city map, 5–10 minute session, 5 waves. Three drone types, three critical structures, and three defenses required (HPM is the stretch fourth — see Working style).

- **Drones (real doctrinal names):** ISR Drone (surveillance/scouting), OWA Drone (one-way attack / kamikaze), Payload-Delivery Drone (heavy armored cargo)
- **Required defenses:** RF Jammer (soft-kill), Interceptor (hard-kill kinetic), Directed Energy / Laser (hard-kill DEW)
- **Stretch defense:** HPM (high-power microwave, one-to-many swarm defeat)
- Win by surviving all 5 waves with ≥1 critical structure intact
- Lose when all critical structures destroyed

### Out of scope for v1

All items in `HORIZON.md` Part 4 backlog, plus:
- Stealth drones, fiber-optic drones, autonomous drones
- GPS spoofer, sensor tower, drone netting defenses
- Progression, upgrades, persistence, menus beyond start/restart
- Audio polish, multiple maps, difficulty settings
- Multiplayer

## Build order

Work in this sequence. Each step should end with something runnable.

1. Canvas renders at correct virtual resolution; one ISR drone walks a fixed path
2. RF Jammer placed manually, auto-fires on drone in range
3. Resource/economy system + click-to-place UI
4. Wave system — spawn drones over time with prep phase between waves
5. Add remaining drone types (OWA, Payload-Delivery) and defenses (Interceptor, Laser, HPM)
6. Critical structures with HP, damage from drone contact/payload, win/lose conditions
7. HUD: resources, wave counter, structure HP
8. Tuning pass — balance numbers via playtesting (this is where `config.js` gets rewritten)
9. Visual polish: proper pixel sprites, CRT post-processing

Steps 1–7 get the game playable. 8 makes it good. 9 makes it look good.

## Working style

- Before adding features, run what exists and confirm it works
- If a decision comes up that isn't in `DESIGN.md`, `CONCEPTS.md`, or `CLAUDE.md`, ask before assuming. Then log the decision in `DECISIONS.md`.
- At the end of each session, summarize decisions and propose doc updates
- Small commits — one logical change per commit
- If something in a source-of-truth doc seems wrong or fights good gameplay, flag it rather than silently working around it
- HPM is the newest and highest-risk defense. It is a **stretch**, not required — ship v1 with the three required defenses and a complete tuning pass before sinking time into HPM. Only promote HPM to "required" if waves 1–5 play well without it and there's clear time left.
