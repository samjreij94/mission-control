/**
 * Two-body orbital energy & elements helpers (Earth-centered or heliocentric).
 * Specific energy ε = v²/2 − μ/r
 * Semi-major axis a = −μ / (2ε)
 * For circular orbit: v = sqrt(μ/r), ε = −μ/(2r)
 */
import { MU_EARTH, R_EARTH } from './constants';

export interface OrbitalState {
  /** Position magnitude from central body center (m). */
  r: number;
  /** Speed (m/s). */
  v: number;
  /** Radial velocity component (m/s), positive outward. */
  vr: number;
  /** Tangential / horizontal velocity (m/s). */
  vt: number;
}

export function specificEnergy(r: number, v: number, mu: number): number {
  return (v * v) / 2 - mu / r;
}

export function semiMajorAxis(energy: number, mu: number): number {
  if (energy >= 0) return Infinity; // parabolic / hyperbolic
  return -mu / (2 * energy);
}

export function eccentricityFromState(state: OrbitalState, mu: number): number {
  const { r, v, vr, vt } = state;
  // e = |e_vec|, e_vec = ((v²−μ/r)r − (r·v)v) / μ
  // With polar components: h = r * vt, e² = 1 + (2ε h²)/μ²
  const h = r * vt;
  const eps = specificEnergy(r, v, mu);
  const e2 = 1 + (2 * eps * h * h) / (mu * mu);
  return Math.sqrt(Math.max(0, e2));
}

export function apoapsisRadius(a: number, e: number): number {
  if (!Number.isFinite(a)) return Infinity;
  return a * (1 + e);
}

export function periapsisRadius(a: number, e: number): number {
  if (!Number.isFinite(a)) return Infinity;
  return a * (1 - e);
}

export function circularOrbitSpeed(r: number, mu: number): number {
  return Math.sqrt(mu / r);
}

export function altitudeFromRadius(r: number, bodyRadius = R_EARTH): number {
  return r - bodyRadius;
}

/** Vis-viva: v = sqrt(μ (2/r − 1/a)) */
export function visViva(r: number, a: number, mu: number): number {
  return Math.sqrt(mu * (2 / r - 1 / a));
}

export function orbitalPeriod(a: number, mu: number): number {
  return 2 * Math.PI * Math.sqrt((a * a * a) / mu);
}

/** Flight-path angle γ from velocity components (rad). */
export function flightPathAngle(vr: number, vt: number): number {
  return Math.atan2(vr, vt);
}

export { MU_EARTH };
