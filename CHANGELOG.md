# Changelog

Player-facing change log. The in-game overlay (Shift+C) parses this file at
load time, splitting on `## ` version headings.

## v0.1.1 (in progress)
- Sim harness: live sidebar event log during a run; batch mode runs 10
  sims back-to-back at 60x with no render and exports CSV (#43)
- Fix: click coords respect `object-fit: contain` letterbox so the
  palette and other targets are reachable on non-16:9 windows
- Backdrop: auto-grid during prep, auto-image during attack; manual
  B-key override wins for the current phase only (#45)
- Changelog overlay: Shift+C surfaces what changed (#46)
- Briefings: waves 2-5 expanded into two-page commander briefings
  matching wave 1's tone — timestamp opening, situational beat,
  stakes, command voice. Dynamic intel/defense prefix still prepends
  to page 0 (#34)
- Pause: Space toggles pause during a live run (#12). Briefing
  dismissal still gets first dibs on Space, so the player can read
  before pausing.
- Briefings: every wave now ends with an INTEL FORECAST page tagging
  each upcoming drone group HIGH / MED / LOW based on prior-wave
  recon. HIGH gives precise counts; MED hedges with ~; LOW just says
  "maybe" + "(unconfirmed)". Color-coded green / amber / grey (#11)
- Wave timer: each wave now hard-caps at 60 s (waves 1-2) or 90 s
  (waves 3-5). Spawning stops 5 s before the cap; surviving drones
  are cleared when the cap hits so the wave doesn't bleed into prep
  (#49)

## v0.1.0
- Initial release: Manhattan map, intel loop, commander briefings,
  performance-tuned endings, help overlay
