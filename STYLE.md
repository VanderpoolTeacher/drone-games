# Drone Defense: NYC — Visual Style Guide

Retro arcade aesthetic. Pixel art, bold colors, CRT vibes. Think early-90s arcade cabinet meets modern command console.

## Core principles

- **Readability over detail.** Drones and defenses must be identifiable in 0.2 seconds at small size. Silhouette first, color second, detail last.
- **Low resolution, high intention.** Work at a small virtual pixel size and scale up. Everything snaps to the pixel grid — no anti-aliasing, no sub-pixel positioning.
- **Limited palette breeds coherence.** Stick to the 8-color palette below. Don't introduce new colors for one-off needs.
- **Motion is chunky.** Animate at 8–12 fps for sprites, not 60. Snappy movement, not smooth tweening.

## Technical setup

- **Virtual resolution:** 480 × 270 pixels, scaled up (typically 3×) to fill the canvas
- **Rendering:** `ctx.imageSmoothingEnabled = false` — always
- **Sprite sizes:**
  - Drones: 16 × 16 px
  - Defenses: 24 × 24 px
  - UI icons: 16 × 16 px
  - Critical structures: 32 × 32 px
- **Grid:** map logic runs on a 24 × 24 px tile grid (20 tiles wide × ~11 tall)

## Color palette

Exactly these eight. Constraint drives coherence.

```
Background dark    #0d1b2a   deep navy — base canvas, map negative space
Background mid     #1b2a3f   panels, UI chrome backgrounds
Grid line          #2a3f5f   subtle tile grid, barely visible

Friendly cyan      #4fc3f7   defenses, player-owned elements, highlights
Alert amber        #ffb74d   warnings, wave incoming, resource text
Threat red         #ef5350   enemy drones, damage, lose state
Success green      #66bb6a   drone destroyed, win state, healthy structures

Accent white       #f5f5f5   text, UI borders, critical emphasis
```

Use **threat red** sparingly — only for actual enemies and danger. Overusing it kills its signal value.

## Typography

- **Primary font:** "Press Start 2P" (Google Fonts) — blocky pixel font
- **Fallback:** `monospace`
- **Sizes:** HUD numbers 16px, button labels 8px, tooltips 8px
- Never anti-alias text. Pixel-aligned positions only.

## Drone visual language

Each drone has a distinct silhouette. Color communicates "enemy" (threat red dominant); silhouette communicates type. Labels in UI/codex use doctrinal names from `TERMINOLOGY.md`.

### ISR Drone
- **Silhouette:** small quadcopter, wide horizontal shape, visible "camera eye" pixel
- **Color:** threat red, cyan eye pixel (suggests sensor)
- **Animation:** 2-frame rotor blur, subtle bob

### OWA Drone (One-Way Attack)
- **Silhouette:** narrow, arrow-like, pointed forward
- **Color:** threat red, brighter/saturated, amber warhead tip pixel
- **Animation:** 2-frame propulsion flicker at rear

### Payload-Delivery Drone
- **Silhouette:** large, boxy, visibly carrying something underneath
- **Color:** threat red with darker red armor plating, amber payload indicator
- **Animation:** slow 2-frame rotor, heavy bob

All enemy drones share threat red as dominant color — player parses "enemy" before parsing type.

## Defense visual language

All defenses share friendly cyan as dominant color. Silhouette and accent distinguish them.

### RF Jammer
- **Silhouette:** squat tower with dish/antenna on top
- **Accent:** pulsing cyan waves when active (2-frame ring animation)
- **Range indicator:** dashed cyan circle, faint

### Interceptor System
- **Silhouette:** launcher platform, angled barrel
- **Accent:** amber loading indicator that fills during cooldown
- **Range indicator:** solid thin cyan circle

### Directed Energy (Laser / HEL)
- **Silhouette:** tall, narrow, with focusing lens at top
- **Accent:** white-hot beam when firing (single-pixel line to target)
- **Range indicator:** solid thin cyan circle, slightly larger than Interceptor
- **Overheat state:** beam lens shifts to alert amber when cooling down

### HPM (High-Power Microwave)
- **Silhouette:** wider base than other defenses; recognizable phased-array antenna panel on top (rectangular, pixel grid pattern to suggest array elements)
- **Accent:** amber charge indicator on the antenna panel that fills between pulses; panel flashes accent white for 1 frame on pulse
- **Range indicator:** cone-shaped area (not a full circle), drawn in cyan — the cone is HPM's defining visual
- **Effect on pulse:** a brief expanding cone of cyan "interference" that washes over the firing arc for 2–3 frames; affected drones flicker amber then explode

The cone shape for HPM's area-of-effect is essential — it visually distinguishes HPM from every other defense's circular range and teaches the one-to-many mechanic at a glance.

## Critical structures

- 32×32 px
- Base color: accent white with cyan details when healthy
- Shift to alert amber at 50% HP, threat red at 25% HP
- Icon language: power station = lightning bolt, comms hub = antenna, city hall = columns

## UI layout

```
┌─────────────────────────────────────────────────────────┐
│ [WAVE 2/5]         RESOURCES: 240         [NEXT: 0:12]  │  ← top bar, 24px tall
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    GAME MAP                             │
│                 (top-down NYC)                          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [RF JAM][INTRCPT][LASER][HPM]              [START]      │  ← bottom palette, 32px tall
└─────────────────────────────────────────────────────────┘
```

- **Top bar:** background mid, 1px accent white bottom border
- **Bottom palette:** background mid, 1px accent white top border
- **Defense buttons:** background dark fill, cyan border when affordable, dim gray when not, amber border when selected. No smooth transitions — states change in one frame.
- **Four defenses in the palette** for v1 (RF Jammer, Interceptor, Laser, HPM)

## Placement preview

When placing a defense, show at cursor position:
- Ghosted sprite (50% alpha)
- Range indicator (circle for RF/Interceptor/Laser, **cone** for HPM)
- Invalid tiles show red pixel overlay

## Effects & feedback

- **Drone destroyed:** 3-frame explosion (amber → red → gone), no particle systems
- **Laser firing:** 1-pixel white line for 1 frame per tick
- **Interceptor firing:** small cyan projectile sprite travels to target
- **RF Jammer active:** expanding cyan ring, fades over 30 frames
- **HPM pulse:** expanding cyan cone sweep for 3 frames, affected drones flicker amber
- **Structure hit:** 2-frame red flash
- **Wave incoming:** top bar pulses amber for 2 seconds before wave starts

## CRT post-processing

Apply as final overlay. Subtle — enhances mood without obscuring gameplay.

- Scanlines every 2 pixels at ~15% opacity
- Vignette at edges, ~20% at corners
- Optional: 1px chromatic aberration at edges (tune to taste)
- **Do not add:** heavy bloom, screen curvature (hurts readability), per-frame moving noise (distracting)

Implement as a final canvas pass or CSS filter for simplicity.

## Motion principles

- **Drones:** pixel-aligned smooth movement along paths; sprite animates at 8 fps
- **Projectiles:** snap to whole-pixel positions each frame
- **UI:** no smooth transitions — single-frame state changes
- **Camera:** static for v1

## What to avoid

- Gradients (except within sprite pixel art)
- Drop shadows, glow effects (CRT handles mood)
- Smooth curves in UI — rectangular or stepped only
- Realistic proportions — stylize heavily
- More than 2–3 colors per sprite
- Rounded corners, soft shadows, subtle animation — all wrong for this aesthetic

## Placeholder rules

While building, placeholders follow the palette and grid so the game looks coherent from day one:

- Drones = 16×16 threat-red squares with a single cyan pixel indicator (vary position by type: eye-pixel top for ISR, tip for OWA, center for Payload)
- Defenses = 24×24 friendly-cyan squares with a distinguishing accent pixel
- Structures = 32×32 accent-white squares with a cyan icon pixel
- HPM placeholder = 24×24 cyan square with amber triangle indicator for cone direction (even as a placeholder, show the cone arc)

When real sprites land, the game already feels coherent — just with more detail.
