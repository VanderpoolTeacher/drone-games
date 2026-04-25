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

## v0.1.0
- Initial release: Manhattan map, intel loop, commander briefings,
  performance-tuned endings, help overlay
