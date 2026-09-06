import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSimAPI,
  type MissionTarget,
  type SimAPI,
  type Telemetry,
  type TrajectoryPoint,
} from '../physics/simApi'

export function useSimLoop() {
  const simRef = useRef<SimAPI | null>(null)
  if (!simRef.current) {
    simRef.current = createSimAPI()
    simRef.current.reset('leo')
  }

  const [telemetry, setTelemetry] = useState<Telemetry>(() => simRef.current!.step(0))
  const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>(() =>
    simRef.current!.getTrajectory(),
  )
  const [target, setTarget] = useState<MissionTarget>('leo')
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
      const dt = Math.min((ts - lastTs.current) / 1000, 0.05)
      lastTs.current = ts
      const telem = sim.step(dt)

      if (ts - lastUi.current > 33 || telem.phase === 'success' || telem.phase === 'fail') {
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
    setTelemetry(sim.step(0))
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

  const burn = useCallback((durationSec: number) => {
    simRef.current!.burn(durationSec)
  }, [])

  const arm = useCallback(() => {
    armedRef.current = true
    setArmed(true)
  }, [])

  return {
    telemetry,
    trajectory,
    target,
    throttle,
    armed,
    reset,
    setThrottle,
    ignite,
    burn,
    arm,
  }
}
