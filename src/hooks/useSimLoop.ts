import { useCallback, useEffect, useRef, useState } from 'react'
import { createSim, hohmannTransfer } from '../physics'
import type { MissionTarget, SimAPI, Telemetry, TrajectoryPoint } from '../physics'

export function useSimLoop() {
  const simRef = useRef<SimAPI | null>(null)
  if (!simRef.current) {
    simRef.current = createSim()
    simRef.current.reset('LEO')
  }

  const [telemetry, setTelemetry] = useState<Telemetry>(() => simRef.current!.getTelemetry())
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>(() =>
    simRef.current!.getTrajectory(),
  )
  const [target, setTarget] = useState<MissionTarget>('LEO')
  const [throttle, setThrottleState] = useState(1)
  const [armed, setArmed] = useState(false)
  const armedRef = useRef(false)
  const lastTs = useRef<number | null>(null)
  const running = useRef(true)
  const lastUi = useRef(0)

  useEffect(() => {
    running.current = true
    lastTs.current = null
    let raf = 0

    const loop = (ts: number) => {
      if (!running.current) return
      const sim = simRef.current!
      if (lastTs.current == null) lastTs.current = ts
      // Physics caps dt at 2s; use realtime + light accel for playability
      const raw = Math.min((ts - lastTs.current) / 1000, 0.05)
      lastTs.current = ts
      const telem = sim.step(raw * 2)

      const terminal = telem.phase === 'orbit' || telem.phase === 'transfer' || telem.phase === 'failed'
      if (ts - lastUi.current > 33 || terminal) {
        lastUi.current = ts
        setTelemetry(telem)
        setTrajectory(sim.getTrajectory())
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => {
      running.current = false
      cancelAnimationFrame(raf)
    }
  }, [])

  const reset = useCallback((next: MissionTarget) => {
    const sim = simRef.current!
    sim.reset(next)
    setTarget(next)
    armedRef.current = false
    setArmed(false)
    setThrottleState(1)
    sim.setThrottle(1)
    setTelemetry(sim.getTelemetry())
    setTrajectory(sim.getTrajectory())
    lastTs.current = null
  }, [])

  const setThrottle = useCallback((v: number) => {
    setThrottleState(v)
    simRef.current!.setThrottle(v)
  }, [])

  const ignite = useCallback(() => {
    if (!armedRef.current) return
    simRef.current!.ignite()
    armedRef.current = false
    setArmed(false)
  }, [])

  const burn = useCallback((deltaVms: number) => {
    simRef.current!.burn(deltaVms)
    setTelemetry(simRef.current!.getTelemetry())
    setTrajectory(simRef.current!.getTrajectory())
  }, [])

  const arm = useCallback(() => {
    armedRef.current = true
    setArmed(true)
  }, [])

  const meco = useCallback(() => {
    simRef.current!.setThrottle(0)
    setThrottleState(0)
  }, [])

  const tmiDv = hohmannTransfer().deltaVDepart

  return {
    telemetry,
    trajectory,
    target,
    throttle,
    armed,
    tmiDv,
    reset,
    setThrottle,
    ignite,
    burn,
    arm,
    meco,
  }
}
