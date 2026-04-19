# TODO

Running task list. Check things off, add as they come up. Scratchpad, not a project plan.

## Now

- [ ] Step 1: index.html + canvas at 480×270, scaled 3×; one ISR Drone walks a fixed path
- [ ] Confirm `npx serve` setup works end-to-end
- [ ] First git commit after step 1

## Next (build order from CLAUDE.md)

- [ ] Step 2: RF Jammer placed manually, auto-fires on drone in range
- [ ] Step 3: resource system + click-to-place UI
- [ ] Step 4: wave system with prep phase between waves
- [ ] Step 5: add remaining drone types (OWA, Payload-Delivery) and defenses (Interceptor, Laser, HPM)
- [ ] Step 6: critical structures with HP, damage, win/lose conditions
- [ ] Step 7: HUD — resources, wave counter, structure HP
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
