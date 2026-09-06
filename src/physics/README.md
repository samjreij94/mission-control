# Mission Control Physics

Educational orbital-mechanics core.
See formulas and SimAPI notes below.

## SimAPI surface

- reset(target, vehicle?): LEO or MARS_TRANSFER
- setThrottle(0..1): clamped throttle
- ignite(): leave pad when TWR > 1
- burn(deltaVms): impulsive prograde delta-v + rocket-equation mass update
  (no-op when dry / remaining Δv ≈ 0 — no fake success messaging)
- step(dtSec): integrate one step; returns Telemetry
- getTrajectory() / getTarget() / getTelemetry()

### Trajectory frame

- x = downrange along surface arc = R_EARTH * theta (m)
- y = altitude above mean Earth radius (m)

## Stock vehicle (defaults)

Single-stage stack tuned for a playable LEO path (real rocket equation + drag/gravity):

| Knob | Value | Rationale |
|------|-------|-----------|
| Wet mass | 550 t | Falcon-9-ish stack |
| Dry mass | 25 t | High propellant fraction (~0.955) |
| Isp | 340 s | Mission-average (vac-biased blend of SL ~282 s and vac ~311–348 s) |
| Thrust | 7.6 MN | Liftoff TWR ≈ 1.41 (> 1.2) |

Ideal Δv ≈ Isp · g0 · ln(m0/mf) ≈ **10.3 km/s** — enough for LEO plus gravity/drag losses
with margin for circularization. Mars TMI after parking is a heliocentric handoff that
debits remaining propellant (not a full n-body SOI ephemeris).

### Gravity-turn guidance (`autoPitch`)

- Stay vertical to ~2 km, then open the turn.
- Near-horizontal by ~80 km.
- Ending the turn much later (100–150 km) was tried; with this 2D Euler integrator it
  leaves peri deeply negative and wastes circularization Δv. The 2→80 km program keeps
  peri recoverable while still clearing the dense atmosphere nearer vertical.


### Ascent autopilot MECO

While `phase === 'ascent'`, engines on, and `throttle > 0`, after each integrated step
if **both**:

1. `(apoapsisM ?? 0) ≥ 220 km` and `altitudeM > 90 km` (same gate as the scripted stock tests), and
2. `remaining Δv ≥ 800 m/s` (circularization reserve),

then physics auto-MECO: `throttle = 0`, `enginesOn = false`, `phase = 'coast'`, with a
message like `Autopilot MECO — coast & circularize with ΔV burns.`

This lets the UI path ARM → IGNITE → hold 100% reach coast with burn buttons unlocked
and Δv left for circularization — players who never press MECO no longer burn to dry
(apo ~3.5 Mm / peri ~82 km). Manual `setThrottle(0)` / MECO button still works the same.
Autopilot fires whenever `throttle > 0` at the gate (not only at full throttle) so QC
cannot overshoot past the reserve.

## Constants (sources)

- MU_EARTH = 3.986004418e14 m^3/s^2 (IAU / WGS-84 GM)
- MU_SUN = 1.32712440018e20 m^3/s^2 (IAU 2015 GM_Sun)
- MU_MARS = 4.282837e13 m^3/s^2 (IAU Mars GM)
- AU = 149597870700 m (IAU 2012 exact)
- G0 = 9.80665 m/s^2
- R_EARTH = 6371000 m; R_MARS = 3389500 m
- R_MARS_ORBIT = 1.523679 AU

## Formulas

1. Rocket: delta-v = Isp * g0 * ln(m0/mf); mdot = F/(Isp*g0)
2. Gravity: a = -mu/r^2
3. Drag: Fd = 0.5 * rho * v^2 * Cd * A; rho = rho0 * exp(-h/H)
4. Circular LEO: v = sqrt(mu/r) ~ 7.67-7.8 km/s at 200-300 km
5. Hohmann: a_t=(r1+r2)/2; TOF = pi*sqrt(a_t^3/mu)

## Approximations and risks

- Non-rotating Earth; no J2 / third-body
- Coplanar circular heliocentric orbits; analytic Hohmann only
- Constant mission-average Isp; single-stage vehicle (no staging model)
- Exponential atmosphere; Euler dt capped at 2 s
- burn() impulsive; Mars path is Hohmann bookkeeping not full SOI ephemeris
- Stock residual after LEO may be below full Hohmann depart Δv; TMI still handoffs
  when any propellant remains

## Tests

Package script test runs Vitest over src/physics/*.test.ts.
Covers rocket identity, LEO speed, Hohmann +/-1%, SimAPI including stock LEO / Mars
ascent integration, dry burn no-op, and browser-faithful UI paths (hold 100% throttle
with no manual MECO — autopilot coast then ΔV 100/300/500 burns).
