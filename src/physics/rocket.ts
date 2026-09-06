/**
 * Tsiolkovsky rocket equation and propellant bookkeeping.
 * Δv = Isp * g0 * ln(m0 / mf)
 */
import { G0 } from './constants';

/** Ideal vacuum Δv available from a propellant burn (m/s). */
export function rocketDeltaV(ispSec: number, massInitialKg: number, massFinalKg: number): number {
  if (massInitialKg <= 0 || massFinalKg <= 0 || massFinalKg > massInitialKg) {
    throw new Error('Invalid masses for rocket equation');
  }
  return ispSec * G0 * Math.log(massInitialKg / massFinalKg);
}

/** Propellant mass required for a target Δv at given Isp (kg). */
export function propellantForDeltaV(
  deltaVms: number,
  ispSec: number,
  massInitialKg: number,
): number {
  if (deltaVms < 0) throw new Error('Δv must be non-negative');
  if (ispSec <= 0 || massInitialKg <= 0) throw new Error('Invalid Isp or mass');
  const massRatio = Math.exp(deltaVms / (ispSec * G0));
  const massFinal = massInitialKg / massRatio;
  return massInitialKg - massFinal;
}

/** Mass flow rate from thrust and Isp: ṁ = F / (Isp * g0) (kg/s). */
export function massFlowRate(thrustN: number, ispSec: number): number {
  if (ispSec <= 0) throw new Error('Isp must be positive');
  return thrustN / (ispSec * G0);
}

/** Instantaneous exhaust velocity ve = Isp * g0 (m/s). */
export function exhaustVelocity(ispSec: number): number {
  return ispSec * G0;
}
