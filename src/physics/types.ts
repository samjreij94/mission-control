/**
 * SimAPI contract types for Mission Control physics.
 * Graphics / UI stub against these names exactly.
 */
 
export type MissionTarget = 'LEO' | 'MARS_TRANSFER';

export type FlightPhase =
  | 'pad'
  | 'ascent'
  | 'coast'
  | 'orbit'
  | 'transfer'
  | 'failed';

export interface Vehicle {
  wetMassKg: number;
  dryMassKg: number;
  ispSec: number;
  thrustN: number;
  /** Drag coefficient (default CD_REF). */
  cd?: number;
  /** Reference cross-section area m2 (default AREA_REF). */
  areaM2?: number;
}

export interface Telemetry {
  /** Mission elapsed time (s). */
  t: number;
  altitudeM: number;
  speedMs: number;
  massKg: number;
  /** Throttle setpoint 0–1. */
  throttle: number;
  /** Current thrust magnitude (N) after throttle. */
  thrustN: number;
  /** Net acceleration magnitude (m/s2)s*/
  accelMs2: number;
  flightPathAngleRad: number;
  qPa: number;
  phase: FlightPhase;
  apoapsisM?: number;
  periapsisM?: number;
  deltaVUsedMs: number;
  /** Small UI extras */
  eccentricity?: number;
  deltaVRemainingMs?: number;
  message?: string;
}

/**
 * Trajectory sample in the ascent plane.
 * Choice: x=downrange along surface arc – R_EARTH ×", y=altitude above surface (m).
  * (Heliocentric transfer points use the same fields with x/y in AU-order meters; see README.)
  */
export interface TrajectoryPoint {
  t: number;
  x: number;
  y: number;
  altitudeM: number;
  speedMs: number;
}

export interface SimAPI {
  reset(target: MissionTarget, vehicle?: Partial<Vehicle>): void;
  setThrottle(throttle: number): void;
  ignite(): void;
  burn(deltaVms: number): void;
  step(dtSec: number): Telemetry;
  getTrajectory(): TrajectoryPoint[];
  getTarget(): MissionTarget;
  getTelemetry(): Telemetry;
}
