/**
 * SimAPI — playable mission integrator for Graphics to stub against.
 *
 * Ascent frame (documented TrajectoryPoint choice):
 *   x = downrange along surface arc ≈ R_EARTH * θ  (m)
 *   y = altitude above mean Earth radius            (m)
 *
 * Dynamics: 2D polar Earth-centered integrator with μ/r² gravity,
 * thrust along a gravity-turn pitch program, exponential atmosphere drag.
 * Impulsive `burn(Δv)` applies prograde Δv and updates mass via rocket equation.
 */
import {
  AREA_REF,
  CD_REF,
  DEFAULT_DRY_MASS,
  DEFAULT_ISP,
  DEFAULT_THRUST,
  DEFAULT_WET_MASS,
  G0,
  LEO_ALT_MAX,
  LEO_ALT_MIN,
  LEO_ECC_MAX,
  MU_EARTH,
  R_EARTH,
} from './constants';
import { dragForce, dynamicPressure } from './atmosphere';
import {
  altitudeFromRadius,
  apoapsisRadius,
  eccentricityFromState,
  periapsisRadius,
  semiMajorAxis,
  specificEnergy,
} from './orbit';
import { hohmannTransfer } from './hohmann';
import { massFlowRate, propellantForDeltaV } from './rocket';
import type {
  MissionTarget,
  SimAPI,
  Telemetry,
  TrajectoryPoint,
  Vehicle,
} from './types';

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

const DEFAULT_VEHICLE: Vehicle = {
  wetMassKg: DEFAULT_WET_MASS,
  dryMassKg: DEFAULT_DRY_MASS,
  ispSec: DEFAULT_ISP,
  thrustN: DEFAULT_THRUST,
  cd: CD_REF,
  areaM2: AREA_REF,
};

interface State {
  target: MissionTarget;
  vehicle: Vehicle;
  phase: Telemetry['phase'];
  t: number;
  /** Radius from Earth center (m). */
  r: number;
  /** Polar angle from pad radial (rad); downrange = R_EARTH * θ. */
  theta: number;
  vr: number;
  vt: number;
  mass: number;
  throttle: number;
  enginesOn: boolean;
  deltaVUsed: number;
  traj: TrajectoryPoint[];
  message: string;
  /** Heliocentric transfer bookkeeping (Mars). */
  transferDvDepartApplied: boolean;
  transferDvArriveApplied: boolean;
}

function mergeVehicle(partial?: Partial<Vehicle>): Vehicle {
  return { ...DEFAULT_VEHICLE, ...partial };
}

function createState(target: MissionTarget, vehicle?: Partial<Vehicle>): State {
  const v = mergeVehicle(vehicle);
  return {
    target,
    vehicle: v,
    phase: 'pad',
    t: 0,
    r: R_EARTH + 1,
    theta: 0,
    vr: 0,
    vt: 0,
    mass: v.wetMassKg,
    throttle: 1,
    enginesOn: false,
    deltaVUsed: 0,
    traj: [{ t: 0, x: 0, y: 1, altitudeM: 1, speedMs: 0 }],
    message: 'On pad. Set throttle and ignite when TWR > 1.',
    transferDvDepartApplied: false,
    transferDvArriveApplied: false,
  };
}

function fuelKg(s: State): number {
  return Math.max(0, s.mass - s.vehicle.dryMassKg);
}

function remainingDeltaV(s: State): number {
  if (s.mass <= s.vehicle.dryMassKg) return 0;
  return s.vehicle.ispSec * G0 * Math.log(s.mass / s.vehicle.dryMassKg);
}

function orbitalElements(s: State) {
  const v = Math.hypot(s.vr, s.vt);
  const eps = specificEnergy(s.r, v, MU_EARTH);
  const a = semiMajorAxis(eps, MU_EARTH);
  const e = eccentricityFromState({ r: s.r, v, vr: s.vr, vt: s.vt }, MU_EARTH);
  const apo = apoapsisRadius(a, e);
  const peri = periapsisRadius(a, e);
  return { v, eps, a, e, apo, peri };
}

function autoPitch(alt: number): number {
  // 0 = radial (vertical), π/2 = tangential (horizontal)
  if (alt < 1000) return 0;
  if (alt > 80_000) return Math.PI / 2;
  return ((alt - 1000) / 79_000) * (Math.PI / 2);
}

function recordTraj(s: State, speed: number): void {
  const alt = altitudeFromRadius(s.r);
  const x = R_EARTH * s.theta;
  const y = alt;
  const last = s.traj[s.traj.length - 1];
  if (!last || Math.hypot(x - last.x, y - last.y) > 500 || s.t - last.t >= 1) {
    s.traj.push({ t: s.t, x, y, altitudeM: alt, speedMs: speed });
    if (s.traj.length > 5000) s.traj.splice(0, s.traj.length - 4000);
  }
}

function buildTelemetry(s: State, accelMs2 = 0): Telemetry {
  const alt = altitudeFromRadius(s.r);
  const { v, e, apo, peri } = orbitalElements(s);
  const thrustN = s.enginesOn && fuelKg(s) > 0 ? s.vehicle.thrustN * s.throttle : 0;
  const q = dynamicPressure(alt, v);
  const gamma = Math.atan2(s.vr, Math.max(1e-9, s.vt));
  const apoAlt = Number.isFinite(apo) ? apo - R_EARTH : undefined;
  const periAlt = Number.isFinite(peri) ? peri - R_EARTH : undefined;

  return {
    t: s.t,
    altitudeM: alt,
    speedMs: v,
    massKg: s.mass,
    throttle: s.throttle,
    thrustN,
    accelMs2,
    flightPathAngleRad: gamma,
    qPa: q,
    phase: s.phase,
    apoapsisM: apoAlt,
    periapsisM: periAlt,
    deltaVUsedMs: s.deltaVUsed,
    eccentricity: e,
    deltaVRemainingMs: remainingDeltaV(s),
    message: s.message,
  };
}

function checkLeoOrbit(s: State): boolean {
  const { e, apo, peri } = orbitalElements(s);
  const apoAlt = apo - R_EARTH;
  const periAlt = peri - R_EARTH;
  return (
    Number.isFinite(apo) &&
    Number.isFinite(peri) &&
    periAlt >= LEO_ALT_MIN &&
    apoAlt <= LEO_ALT_MAX &&
    periAlt > 0 &&
    e <= LEO_ECC_MAX
  );
}

function fail(s: State, reason: string): void {
  s.phase = 'failed';
  s.enginesOn = false;
  s.message = `FAILURE: ${reason}`;
}

function applyImpulsiveBurn(s: State, deltaVms: number): void {
  const dv = Math.max(0, deltaVms);
  if (dv <= 0) return;
  if (s.mass <= s.vehicle.dryMassKg) {
    s.message = 'No propellant for burn.';
    return;
  }
  const prop = propellantForDeltaV(dv, s.vehicle.ispSec, s.mass);
  const maxProp = fuelKg(s);
  const actualProp = Math.min(prop, maxProp);
  // Scale Δv if propellant-limited
  let actualDv = dv;
  if (actualProp < prop - 1e-9) {
    const mf = s.mass - actualProp;
    actualDv = s.vehicle.ispSec * G0 * Math.log(s.mass / mf);
  }
  s.mass = Math.max(s.vehicle.dryMassKg, s.mass - actualProp);
  s.deltaVUsed += actualDv;

  // Apply prograde (along velocity); if nearly stationary, along local horizontal
  const speed = Math.hypot(s.vr, s.vt);
  if (speed > 1) {
    s.vr += (s.vr / speed) * actualDv;
    s.vt += (s.vt / speed) * actualDv;
  } else {
    s.vt += actualDv;
  }
}

class Sim implements SimAPI {
  private s: State;

  constructor() {
    this.s = createState('LEO');
  }

  reset(target: MissionTarget, vehicle?: Partial<Vehicle>): void {
    this.s = createState(target, vehicle);
  }

  setThrottle(throttle: number): void {
    this.s.throttle = clamp(throttle, 0, 1);
    // UI MECO calls setThrottle(0) only — must enter coast so burn controls unlock.
    if (this.s.throttle === 0 && this.s.phase === 'ascent' && this.s.t > 0) {
      this.s.enginesOn = false;
      this.s.phase = 'coast';
      this.s.message = 'MECO — coasting. Use burn() to circularize.';
    }
  }

  ignite(): void {
    const s = this.s;
    if (s.phase === 'failed' || s.phase === 'orbit' || s.phase === 'transfer') return;
    if (fuelKg(s) <= 0) {
      s.message = 'No propellant — cannot ignite.';
      return;
    }
    const twr = (s.vehicle.thrustN * s.throttle) / (s.mass * G0);
    if (s.phase === 'pad') {
      if (twr <= 1) {
        s.message = `TWR ${twr.toFixed(2)} ≤ 1 — increase throttle or thrust.`;
        return;
      }
      s.phase = 'ascent';
      s.enginesOn = true;
      s.message = 'Liftoff! Gravity turn in progress.';
      return;
    }
    // Re-light in coast for circularization / TMI assist
    s.enginesOn = true;
    if (s.phase === 'coast') {
      s.phase = 'ascent';
      s.message = 'Engines restarted.';
    }
  }

  burn(deltaVms: number): void {
    const s = this.s;
    if (s.phase === 'pad' || s.phase === 'failed') return;
    applyImpulsiveBurn(s, deltaVms);

    if (s.target === 'LEO' || s.phase === 'ascent' || s.phase === 'coast') {
      if (checkLeoOrbit(s)) {
        s.phase = 'orbit';
        s.enginesOn = false;
        s.message = 'SUCCESS — Stable LEO (circularization via burn/guidance).';
      } else {
        s.message = `Impulsive burn ${deltaVms.toFixed(0)} m/s applied.`;
      }
    }

    if (s.target === 'MARS_TRANSFER') {
      const h = hohmannTransfer();
      // First significant burn after reaching high altitude / orbit → departure
      if (!s.transferDvDepartApplied && (s.phase === 'orbit' || checkLeoOrbit(s) || altitudeFromRadius(s.r) > LEO_ALT_MIN)) {
        s.transferDvDepartApplied = true;
        s.phase = 'transfer';
        s.enginesOn = false;
        s.message = `TMI / Hohmann depart Δv ≈ ${h.deltaVDepart.toFixed(0)} m/s applied (analytic ${h.deltaVDepart.toFixed(0)}).`;
      } else if (s.transferDvDepartApplied && !s.transferDvArriveApplied && s.phase === 'transfer') {
        s.transferDvArriveApplied = true;
        s.message = `Mars arrival Δv ≈ ${h.deltaVArrive.toFixed(0)} m/s applied. TOF ${((h.timeOfFlightSec) / 86400).toFixed(1)} days.`;
      }
    }
  }

  step(dtSec: number): Telemetry {
    const s = this.s;
    const dt = Math.max(0, Math.min(dtSec, 2)); // hard cap for stability
    if (dt === 0 || s.phase === 'pad' || s.phase === 'failed' || s.phase === 'orbit' || s.phase === 'transfer') {
      return buildTelemetry(s);
    }

    const alt = altitudeFromRadius(s.r);
    if (alt < -50) {
      fail(s, 'Impact with Earth.');
      return buildTelemetry(s);
    }

    const pitch = s.phase === 'ascent' ? autoPitch(alt) : Math.PI / 2;
    const speed = Math.hypot(s.vr, s.vt);
    const g = MU_EARTH / (s.r * s.r);

    let thrustAcc = 0;
    let thrustN = 0;
    if (s.enginesOn && fuelKg(s) > 0 && s.throttle > 0) {
      thrustN = s.vehicle.thrustN * s.throttle;
      const mdot = massFlowRate(thrustN, s.vehicle.ispSec);
      const dm = mdot * dt;
      if (dm >= fuelKg(s)) {
        // Burn to dry mass
        const dtUse = fuelKg(s) / mdot;
        thrustAcc = thrustN / s.mass;
        s.deltaVUsed += thrustAcc * dtUse;
        s.mass = s.vehicle.dryMassKg;
        s.enginesOn = false;
        s.message = 'MECO — propellant depleted.';
        if (s.phase === 'ascent') s.phase = 'coast';
      } else {
        thrustAcc = thrustN / s.mass;
        s.deltaVUsed += thrustAcc * dt;
        s.mass -= dm;
      }
    } else if (s.enginesOn && fuelKg(s) <= 0) {
      s.enginesOn = false;
      if (s.phase === 'ascent') s.phase = 'coast';
    }

    // MECO / throttle-cut during ascent → coast (do not require enginesOn already false;
    // UI only calls setThrottle(0) and may leave enginesOn true until this step).
    if (s.phase === 'ascent' && s.t > 0 && (s.throttle === 0 || !s.enginesOn)) {
      s.enginesOn = false;
      s.phase = 'coast';
      if (!s.message.startsWith('MECO — propellant depleted')) {
        s.message = 'MECO — coasting. Use burn() to circularize.';
      }
    }

    let ar = -g;
    let at = 0;

    const cd = s.vehicle.cd ?? CD_REF;
    const area = s.vehicle.areaM2 ?? AREA_REF;
    if (speed > 1) {
      const Fd = dragForce(alt, speed, cd, area);
      const ad = Fd / s.mass;
      ar -= ad * (s.vr / speed);
      at -= ad * (s.vt / speed);
    }

    if (thrustAcc > 0) {
      ar += thrustAcc * Math.cos(pitch);
      at += thrustAcc * Math.sin(pitch);
    }

    const dvr = ar + (s.vt * s.vt) / s.r;
    const dvt = at - (s.vr * s.vt) / s.r;

    s.vr += dvr * dt;
    s.vt += dvt * dt;
    s.r += s.vr * dt;
    if (s.r < R_EARTH * 0.5) {
      fail(s, 'Trajectory singularity.');
      return buildTelemetry(s);
    }
    s.theta += (s.vt / s.r) * dt;
    s.t += dt;

    if (s.r < R_EARTH) {
      fail(s, 'Impact with Earth surface.');
      return buildTelemetry(s);
    }

    const newSpeed = Math.hypot(s.vr, s.vt);
    recordTraj(s, newSpeed);

    // Coast → orbit success for LEO when elements look good and not thrusting
    if ((s.phase === 'coast' || s.phase === 'ascent') && !s.enginesOn && checkLeoOrbit(s)) {
      s.phase = 'orbit';
      s.message = 'SUCCESS — Stable LEO achieved.';
    }

    // Mars: once in rough LEO parking, tip player toward burn for TMI
    if (s.target === 'MARS_TRANSFER' && checkLeoOrbit(s) && s.phase === 'coast' && !s.enginesOn) {
      s.phase = 'orbit';
      s.message = 'LEO parking orbit. Call burn(hohmann.deltaVDepart) for TMI.';
    }

    const netA = Math.hypot(dvr, dvt);
    return buildTelemetry(s, netA);
  }

  getTrajectory(): TrajectoryPoint[] {
    return this.s.traj.slice();
  }

  getTarget(): MissionTarget {
    return this.s.target;
  }

  getTelemetry(): Telemetry {
    return buildTelemetry(this.s);
  }
}

/** Factory matching the SimAPI contract. */
export function createSim(): SimAPI {
  return new Sim();
}

export { Sim };
