# Mission Control

iPhone-first Progressive Web App: NASA/SpaceX-style launch console.
UI is wired to the real Physics **SimAPI** (`createSim`, `Telemetry`, `MissionTarget`).

**Play live:** [https://samjreij94.github.io/mission-control/](https://samjreij94.github.io/mission-control/)

## Quick start

```bash
npm install
npm run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

```bash
npm test
npm run build
npm run preview
```

## How to play

### LEO
1. Select **LEO** as the mission target.
2. **ARM** → set throttle → **IGNITE** for liftoff (gravity turn).
3. **MECO** to coast when apoapsis looks useful.
4. Use impulsive **Δv burns** (or re-ignite) to circularize.
5. Success when telemetry phase becomes `orbit` (peri ≥ ~160 km, low eccentricity).

### Mars transfer
1. Select **MARS_TRANSFER**.
2. Launch / climb as for LEO (parking orbit helps).
3. Apply the suggested **TMI** impulsive burn (Hohmann depart Δv).
4. Success when phase becomes `transfer` (analytic Hohmann bookkeeping in SimAPI).

**RESET** returns you to the pad anytime.

## Install on iPhone

1. On your iPhone, open **Safari** and go to **[https://samjreij94.github.io/mission-control/](https://samjreij94.github.io/mission-control/)**.
2. Tap **Share** → **Add to Home Screen**.
3. Launch from the home-screen icon for a standalone, full-screen console.

Manifest + service worker come from `vite-plugin-pwa`.

## Physics assumptions

Full detail: [`src/physics/README.md`](src/physics/README.md).

- Two-body gravity (`μ_Earth` / `μ_Sun` / `μ_Mars`), rocket equation, exponential atmosphere drag.
- Ascent: 2D polar integrator + gravity-turn pitch program; impulsive `burn(Δv)` for circularize / TMI.
- Trajectory plot frame: `x = R_Earth·θ` (downrange), `y` = altitude.
- Mars path is coplanar Hohmann analytics (not full SOI ephemeris).
- Approximations: non-rotating Earth, no J₂ / third-body, Euler `dt` capped at 2 s, single-stage.

## Stack

Vite + React 18 + TypeScript · Canvas 2D · vitest · vite-plugin-pwa

## Known limits (v1)

- Manual MECO / circularization (no full ascent autopilot).
- Mars success is SimAPI `transfer` phase, not a heliocentric encounter sim.
- Landscape / a11y / haptics are minimal.
