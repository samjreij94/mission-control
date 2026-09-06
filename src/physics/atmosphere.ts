/**
 * Simple exponential Earth atmosphere for ascent drag.
 * ρ(h) = ρ0 * exp(-h / H)
 */
import { AREA_REF, CD_REF, H_SCALE, RHO0 } from './constants';

export function densityAtAltitude(altitudeM: number): number {
  if (altitudeM < 0) return RHO0;
  // Above ~100 km treat as vacuum for gameplay
  if (altitudeM > 100_000) return 0;
  return RHO0 * Math.exp(-altitudeM / H_SCALE);
}

/** Drag force magnitude (N). Opposite to velocity. Fd = ½ ρ v² Cd A */
export function dragForce(altitudeM: number, speedMs: number, cd = CD_REF, area = AREA_REF): number {
  const rho = densityAtAltitude(altitudeM);
  return 0.5 * rho * speedMs * speedMs * cd * area;
}

/** Dynamic pressure q = ½ ρ v² (Pa). */
export function dynamicPressure(altitudeM: number, speedMs: number): number {
  return 0.5 * densityAtAltitude(altitudeM) * speedMs * speedMs;
}
