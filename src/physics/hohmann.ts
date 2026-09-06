/**
 * Coplanar Hohmann transfer between two circular heliocentric orbits.
 * Textbook Earth→Mars values (approx):
 *   Δv_depart ≈ 2.9–3.0 km/s, Δv_arrive ≈ 2.6–2.7 km/s, TOF ≈ 259 days.
 */
import { MU_SUN, R_EARTH_ORBIT, R_MARS_ORBIT } from './constants';
import { circularOrbitSpeed, visViva } from './orbit';

export interface HohmannTransfer {
  r1: number;
  r2: number;
  aTransfer: number;
  vCircular1: number;
  vCircular2: number;
  vPeriapsis: number;
  vApoapsis: number;
  deltaVDepart: number;
  deltaVArrive: number;
  deltaVTotal: number;
  timeOfFlightSec: number;
}

export function hohmannTransfer(
  r1: number = R_EARTH_ORBIT,
  r2: number = R_MARS_ORBIT,
  mu: number = MU_SUN,
): HohmannTransfer {
  const aTransfer = 0.5 * (r1 + r2);
  const vCircular1 = circularOrbitSpeed(r1, mu);
  const vCircular2 = circularOrbitSpeed(r2, mu);
  const vPeriapsis = visViva(r1, aTransfer, mu);
  const vApoapsis = visViva(r2, aTransfer, mu);
  const deltaVDepart = Math.abs(vPeriapsis - vCircular1);
  const deltaVArrive = Math.abs(vCircular2 - vApoapsis);
  const timeOfFlightSec = Math.PI * Math.sqrt((aTransfer * aTransfer * aTransfer) / mu);

  return {
    r1,
    r2,
    aTransfer,
    vCircular1,
    vCircular2,
    vPeriapsis,
    vApoapsis,
    deltaVDepart,
    deltaVArrive,
    deltaVTotal: deltaVDepart + deltaVArrive,
    timeOfFlightSec,
  };
}

/** Sample points along the transfer ellipse for plotting (true anomaly 0…π). */
export function transferEllipsePoints(
  transfer: HohmannTransfer,
  samples = 64,
): Array<{ x: number; y: number }> {
  const { aTransfer, r1, r2 } = transfer;
  const e = (r2 - r1) / (r2 + r1);
  const points: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const nu = (Math.PI * i) / samples; // 0 at peri (Earth) → π at apo (Mars)
    const r = (aTransfer * (1 - e * e)) / (1 + e * Math.cos(nu));
    points.push({ x: r * Math.cos(nu), y: r * Math.sin(nu) });
  }
  return points;
}
