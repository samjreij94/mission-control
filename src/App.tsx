import { Controls } from './components/Controls'
import { TelemetryPanel } from './components/TelemetryPanel'
import { TrajectoryCanvas } from './components/TrajectoryCanvas'
import { useSimLoop } from './hooks/useSimLoop'

export default function App() {
  const {
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
  } = useSimLoop()

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <div className="brand-title">MISSION CONTROL</div>
            <div className="brand-sub">CONSOLE · DEMO STUB PHYSICS</div>
          </div>
        </div>
        <div className="status-pills">
          <span className="pill">PWA</span>
          <span className="pill accent">{target.toUpperCase()}</span>
        </div>
      </header>

      <main className="main-stage">
        <div className="traj-wrap">
          <TrajectoryCanvas trajectory={trajectory} target={target} telemetry={telemetry} />
        </div>
        <TelemetryPanel telemetry={telemetry} />
      </main>

      <Controls
        telemetry={telemetry}
        target={target}
        throttle={throttle}
        armed={armed}
        onReset={reset}
        onThrottle={setThrottle}
        onArm={arm}
        onIgnite={ignite}
        onBurn={burn}
      />
    </div>
  )
}
