# TODO

Running task list. Check things off, add as they come up. Scratchpad, not a project plan.

## Now

- [x] Step 1: canvas boots at 480×270 with map, structures, zones, chrome
- [x] Step 1b: drones spawn from corridors and traverse (ISR weave, OWA commit, Payload drop)
- [x] Step 1c: per-drone colors + top-bar legend
- [x] Step 2a: Interceptor placed, auto-fires, drones killable, economy loop live
- [ ] Step 2b: RF Jammer placed, area-slow effect (soft-kill)
- [ ] Step 2c: Laser placed, continuous DPS + overheat
- [ ] Step 2d: HPM placed, cone AoE (stretch)

## Next (build order from CLAUDE.md)

- [x] Step 3: resource system + click-to-place UI (done with Interceptor plan)
- [ ] Step 4: wave system with prep phase between waves (replaces the dev auto-spawner)
- [ ] Step 5: all drone types + all defenses landed (see Steps 2b-2d above)
- [ ] Step 6: critical structures with HP, damage, win/lose conditions
- [ ] Step 7: HUD — resources (done), wave counter (placeholder only), structure HP
- [ ] Step 8: tuning pass — balance via playtesting
- [ ] Step 9: visual polish — real pixel sprites, CRT post-processing

## Later

- [ ] First external playtest (after step 7, before step 8 finishes)
- [ ] Sound effects: drone buzz, laser zap, interceptor launch, HPM pulse, explosion, wave-start alert
- [ ] Class writeup draft
- [ ] Record gameplay video for class submission

## HPM-specific watchpoints

The newest defense for v1 and the easiest to cut if scope slips:

- [ ] Cone-shaped area of effect (not circle) — visually distinguishes HPM at a glance
- [ ] Long recharge between pulses to prevent trivializing the game
- [ ] LOS-only (don't fire through buildings — enforceable in later versions)
- [ ] Tooltip emphasizes "one-to-many" and "pennies per kill" framing

## Ideas / v2+ (see HORIZON.md Part 4)

- [ ] Fiber-optic drone type (immune to RF jamming)
- [ ] Autonomous drone type (immune to all soft-kill)
- [ ] Sensor tower defense (detection range as a resource)
- [ ] Drone netting defense (cheap, static, single-use)
- [ ] Stealth drones
- [ ] Goose-flock swarm waves
