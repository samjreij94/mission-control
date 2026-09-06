# Mission Control Physics

Educational orbital-mechanics core.
See formulas and SimAPI notes below.

## SimAPI surface

- reset(target, vehicle?): LEO or MARS_TRANSFER
- setThrottle(0..1): clamped throttle
- ignite(): leave pad when TWR > 1
- burn(deltaVms): impulsive prograde delta-v + rocket-equation mass update
- step(dtSec): integrate one step; returns Telemetry
- getTrajectory() / getTarget() / getTelemetry()

### Trajectory frame

- x = downrange along surface arc = R_EARTH * theta (m)
- y = altitude above mean Earth radius (m)

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
- Constant Isp; single-stage vehicle
- Exponential atmosphere; Euler dt capped at 2 s
- burn() impulsive; Mars path is Hohmann bookkeeping not full SOI ephemeris

## Tests

Package script test runs Vitest over src/physics/*.test.ts.
Covers rocket identity, LEO speed, Hohmann +/-1%, SimAPI.
