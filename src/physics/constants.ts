/**
 * Physical & astronomical constants used by Mission Control.
 * SI units unless noted. Values are textbook / IAU-standard approximations
 * suitable for educational orbital mechanics (not precision ephemerides).
 */

/** Standard gravitational parameter μ = GM (m³/s²). */
export const MU_EARTH = 3.986004418e14;
export const MU_SUN = 1.32712440018e20;
export const MU_MARS = 4.282837e13;

/** Mean volumetric radii (m). */
export const R_EARTH = 6_371_000;
export const R_MARS = 3_389_500;

/** Astronomical unit (m) — IAU 2012 exact definition. */
export const AU = 149_597_870_700;

/** Standard gravity for rocket equation / Isp (m/s²). */
export const G0 = 9.80665;

/** Approximate circular heliocentric radii for coplanar Hohmann planning. */
export const R_EARTH_ORBIT = 1.0 * AU;
export const R_MARS_ORBIT = 1.523679 * AU;

/** Earth atmosphere model (exponential, sea-level ISA-ish). */
export const RHO0 = 1.225; // kg/m³ at sea level
export const H_SCALE = 8500; // m — scale height
export const CD_REF = 0.3; // typical slender rocket Cd
export const AREA_REF = 10.0; // m² reference cross-section

/** Sphere-of-influence approximations (Hill sphere order-of-magnitude). */
export const SOI_EARTH = 0.929e9; // m ≈ 0.929 million km
export const SOI_MARS = 0.576e9; // m

/** Target LEO altitude band for mission success (m above surface). */
export const LEO_ALT_MIN = 160_000;
export const LEO_ALT_MAX = 2_000_000;
export const LEO_ECC_MAX = 0.15;

/**
 * Default vehicle — single-stage Falcon-9-ish stack tuned for playable LEO.
 *
 * Masses: wet 550 t / dry 25 t → propellant fraction ≈ 0.955.
 * Isp 340 s is a mission-average (SL Merlin ~282 s blended toward vac ~311–348 s),
 * not a single engine rating. Ideal Δv = Isp g0 ln(m0/mf) ≈ 10.3 km/s — enough for
 * LEO + gravity/drag losses with circularization margin; Mars TMI is a heliocentric
 * handoff that debits remaining propellant after parking.
 *
 * Liftoff TWR ≈ 7.6e6 / (550e3 * g0) ≈ 1.41 (> 1.2).
 */
export const DEFAULT_WET_MASS = 550_000; // kg
export const DEFAULT_DRY_MASS = 25_000; // kg (structure + residual + payload)
export const DEFAULT_ISP = 340; // s — mission-average (vac-biased), not SL-only
export const DEFAULT_THRUST = 7.6e6; // N (~7600 kN)
