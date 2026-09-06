/**
 * SimAPI — Mission Control physics contract.
 *
 * This file defines the stable interface the UI drives, plus a DEMO STUB that
 * returns plausible Telemetry / trajectory so the console is playable without
 * the real Physics module.
 *
 * Physics will replace/harden the real implementation behind createSimAPI()
 * while keeping these type and method names exactly.
 */

export type MissionTarget = 'leo' | 'mars'

export interface Vehicle {
  dryMassKg: number
  propellantKg: number
  ispSec: number
  thrustN: number
}

export interface Telemetry {
  t: number // s
  altitudeM: number
  velocityMs: number
  dynamicPressurePa: number
  propellantKg: number
  apoapsisM?: number
  periapsisM?: number
  deltaVSpentMs: number
  deltaVRemainingMs: number
  phase: 'prelaunch' | 'ascent' | 'coast' | 'orbit' | 'transfer' | 'success' | 'fail'
  failReason?: string
}

export interface TrajectoryPoint {
  x: number // meters, Earth- or Sun-centered depending on phase
  y: number
}

export interface SimAPI {
  reset(target: MissionTarget, vehicle?: Vehicle): void
  setThrottle(throttle01: number): void // 0..1
  ignite(): void // start ascent
  burn(durationSec: number): void // orbital/transfer burn
  step(dtSec: number): Telemetry
  getTrajectory(): TrajectoryPoint[]
  getTarget(): MissionTarget
}

const G0 = 9.80665
const R_EARTH = 6_371_000
const R_EARTH_ORBIT = 149_597_870_700 // 1 AU
const R_MARS_ORBIT = 1.523679 * R_EARTH_ORBIT

const DEFAULT_VEHICLE: Vehicle = {
  dryMassKg: 50_000,
  propellantKg: 500_000,
  ispSec: 300,
  thrustN: 7.6e6,
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function rocketDv(isp: number, m0: number, mf: number): number {
  if (mf <= 0 || m0 <= mf) return 0
  return isp * G0 * Math.log(m0 / mf)
}

/**
 * Lightweight stub SimAPI — kinematic / scripted phases that look right on
 * the console. Not physically rigorous; Physics owns the real model.
 */
export function createSimAPI(): SimAPI {
  let target: MissionTarget = 'leo'
  let vehicle: Vehicle = { ...DEFAULT_VEHICLE }
  let throttle = 1
  let phase: Telemetry['phase'] = 'prelaunch'
  let failReason: string | undefined
  let t = 0
  let altitudeM = 0
  let velocityMs = 0
  let propellantKg = vehicle.propellantKg
  let deltaVSpentMs = 0
  let traj: TrajectoryPoint[] = [{ x: 0, y: R_EARTH }]
  let theta = 0 // ascent angle around Earth / heliocentric true anomaly
  let burnTimer = 0
  let ascentPitch = 0 // 0 vertical → π/2 horizontal
  let apoapsisM = 0
  let periapsisM = 0
  let heliocentric = false
  let helioR = R_EARTH_ORBIT
  let coastTimer = 0

  function mass(): number {
    return vehicle.dryMassKg + propellantKg
  }

  function deltaVRemaining(): number {
    const m0 = mass()
    const mf = vehicle.dryMassKg
    return rocketDv(vehicle.ispSec, m0, mf)
  }

  function pushTraj(): void {
    if (heliocentric) {
      traj.push({
        x: helioR * Math.cos(theta),
        y: helioR * Math.sin(theta),
      })
    } else {
      const r = R_EARTH + altitudeM
      traj.push({
        x: r * Math.sin(theta),
        y: r * Math.cos(theta),
      })
    }
    if (traj.length > 2500) traj = traj.slice(-2000)
  }

  function telemetry(): Telemetry {
    // Rough dynQ during ascent only
    const rho =
      altitudeM < 0
        ? 1.225
        : altitudeM > 100_000
          ? 0
          : 1.225 * Math.exp(-altitudeM / 8500)
    const dynamicPressurePa =
      phase === 'ascent' ? 0.5 * rho * velocityMs * velocityMs : 0

    const telem: Telemetry = {
      t,
      altitudeM: heliocentric ? helioR - R_EARTH_ORBIT : altitudeM,
      velocityMs,
      dynamicPressurePa,
      propellantKg,
      deltaVSpentMs,
      deltaVRemainingMs: deltaVRemaining(),
      phase,
    }
    if (apoapsisM > 0 || periapsisM > 0) {
      telem.apoapsisM = apoapsisM
      telem.periapsisM = periapsisM
    }
    if (failReason) telem.failReason = failReason
    return telem
  }

  function consumePropellant(dt: number, throttle01: number): number {
    if (throttle01 <= 0 || propellantKg <= 0) return 0
    const mdot = vehicle.thrustN / (vehicle.ispSec * G0)
    const burned = Math.min(propellantKg, mdot * throttle01 * dt)
    const m0 = mass()
    propellantKg -= burned
    const mf = mass()
    const dv = rocketDv(vehicle.ispSec, m0, Math.max(mf, vehicle.dryMassKg * 1.000001))
    deltaVSpentMs += dv
    return dv
  }

  function fail(reason: string): void {
    phase = 'fail'
    failReason = reason
    burnTimer = 0
  }

  function succeed(): void {
    phase = 'success'
    burnTimer = 0
  }

  return {
    reset(nextTarget: MissionTarget, nextVehicle?: Vehicle) {
      target = nextTarget
      vehicle = { ...(nextVehicle ?? DEFAULT_VEHICLE) }
      throttle = 1
      phase = 'prelaunch'
      failReason = undefined
      t = 0
      altitudeM = 0
      velocityMs = 0
      propellantKg = vehicle.propellantKg
      deltaVSpentMs = 0
      traj = [{ x: 0, y: R_EARTH }]
      theta = 0
      burnTimer = 0
      ascentPitch = 0
      apoapsisM = 0
      periapsisM = 0
      heliocentric = false
      helioR = R_EARTH_ORBIT
      coastTimer = 0
    },

    setThrottle(throttle01: number) {
      throttle = clamp(throttle01, 0, 1)
    },

    ignite() {
      if (phase !== 'prelaunch') return
      if (propellantKg <= 0) {
        fail('No propellant on pad')
        return
      }
      phase = 'ascent'
      ascentPitch = 0
    },

    burn(durationSec: number) {
      if (phase === 'success' || phase === 'fail' || phase === 'prelaunch' || phase === 'ascent') {
        return
      }
      if (propellantKg <= 0) {
        fail('Dry tanks — cannot burn')
        return
      }
      burnTimer = Math.max(0, durationSec)
      if (phase === 'coast' || phase === 'orbit') {
        // Circularization / TMI
        if (target === 'mars' && altitudeM > 150_000) {
          phase = 'transfer'
        } else {
          phase = 'orbit'
        }
      }
    },

    step(dtSec: number): Telemetry {
      const dt = clamp(dtSec, 0, 0.1)
      if (phase === 'success' || phase === 'fail' || phase === 'prelaunch') {
        return telemetry()
      }

      t += dt

      if (phase === 'ascent') {
        const dv = consumePropellant(dt, throttle)
        // Gravity turn + accel approx
        const thrustA = (vehicle.thrustN * throttle) / Math.max(mass(), 1)
        const gLocal = G0 * (R_EARTH / (R_EARTH + altitudeM)) ** 2
        ascentPitch = clamp(ascentPitch + dt * 0.12, 0, Math.PI / 2)
        const ax = thrustA * Math.sin(ascentPitch)
        const ay = thrustA * Math.cos(ascentPitch) - gLocal
        velocityMs = Math.max(0, velocityMs + (ay * Math.cos(ascentPitch) + ax) * dt * 0.55 + dv * 0.35)
        altitudeM += velocityMs * Math.cos(ascentPitch * 0.85) * dt * 0.45
        theta += ((velocityMs * Math.sin(ascentPitch)) / (R_EARTH + Math.max(altitudeM, 1))) * dt

        // Max-Q style peak around 12–14 km
        if (altitudeM < 0) {
          fail('Impact — negative altitude')
          return telemetry()
        }
        if (propellantKg <= 0 && altitudeM < 80_000) {
          fail('Flameout below staging altitude')
          return telemetry()
        }
        // Auto MECO near vacuum / horizontal
        if (altitudeM > 120_000 || (ascentPitch > 1.35 && altitudeM > 90_000)) {
          phase = 'coast'
          coastTimer = 0
          apoapsisM = Math.max(altitudeM + velocityMs * 40, altitudeM)
          periapsisM = Math.max(0, altitudeM * 0.35)
        }
        pushTraj()
        return telemetry()
      }

      if (phase === 'coast') {
        coastTimer += dt
        // Ballistic arc approx
        const gLocal = G0 * (R_EARTH / (R_EARTH + altitudeM)) ** 2
        velocityMs = Math.max(100, velocityMs - gLocal * Math.sin(0.2) * dt * 0.15)
        altitudeM += (velocityMs * 0.08 - 20) * dt
        theta += (velocityMs / (R_EARTH + Math.max(altitudeM, 1))) * dt * 0.4
        apoapsisM = Math.max(apoapsisM, altitudeM)
        periapsisM = Math.min(periapsisM || altitudeM, altitudeM)

        if (altitudeM < 50_000 && coastTimer > 8) {
          fail('Reentry — periapsis too low')
          return telemetry()
        }
        if (burnTimer > 0) {
          // player requested burn while coasting
          phase = target === 'mars' ? 'transfer' : 'orbit'
        }
        pushTraj()
        return telemetry()
      }

      if (phase === 'orbit') {
        if (burnTimer > 0) {
          const slice = Math.min(burnTimer, dt)
          burnTimer -= slice
          consumePropellant(slice, Math.max(throttle, 0.6))
          velocityMs += 80 * slice
          periapsisM = Math.min(periapsisM + 25_000 * slice, apoapsisM)
          altitudeM = 0.5 * (apoapsisM + periapsisM)
        }
        theta += (7800 / (R_EARTH + Math.max(altitudeM, 200_000))) * dt
        altitudeM = 0.5 * ((apoapsisM || altitudeM) + (periapsisM || altitudeM))
        velocityMs = Math.max(7600, Math.min(7900, velocityMs))

        const periOk = (periapsisM || 0) >= 160_000
        const apoOk = (apoapsisM || 0) <= 2_000_000 && (apoapsisM || 0) >= 160_000
        if (periOk && apoOk && burnTimer <= 0 && target === 'leo') {
          succeed()
        } else if (burnTimer <= 0 && !periOk && t > 120) {
          // allow more burns; soft timeout fail
          if (t > 240) fail('Mission timeout — LEO not circularized')
        }
        pushTraj()
        return telemetry()
      }

      if (phase === 'transfer') {
        if (!heliocentric) {
          heliocentric = true
          helioR = R_EARTH_ORBIT
          theta = 0
          traj = [{ x: helioR, y: 0 }]
          velocityMs = 29_800
        }
        if (burnTimer > 0) {
          const slice = Math.min(burnTimer, dt)
          burnTimer -= slice
          consumePropellant(slice, Math.max(throttle, 0.7))
          // Raise apo toward Mars
          helioR += 40_000_000 * slice // scripted expand
          velocityMs += 40 * slice
        } else {
          // Coast along transfer — accelerate time perception
          const progress = clamp(theta / Math.PI, 0, 1)
          helioR = R_EARTH_ORBIT + (R_MARS_ORBIT - R_EARTH_ORBIT) * 0.5 * (1 - Math.cos(theta))
          theta += dt * 0.015 // ~few minutes of UI time for half-ellipse
          velocityMs = 32_000 - 4000 * progress
          apoapsisM = R_MARS_ORBIT
          periapsisM = R_EARTH_ORBIT
          if (theta >= Math.PI * 0.92) {
            if (propellantKg > vehicle.propellantKg * 0.02 || deltaVSpentMs > 8000) {
              succeed()
            } else {
              // still succeed if we got there — stub is generous for demo
              succeed()
            }
          }
        }
        if (propellantKg <= 0 && burnTimer > 0) {
          fail('TMI aborted — propellant depleted')
          return telemetry()
        }
        pushTraj()
        return telemetry()
      }

      return telemetry()
    },

    getTrajectory() {
      return traj.slice()
    },

    getTarget() {
      return target
    },
  }
}
