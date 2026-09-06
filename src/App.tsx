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
    tmiDv,
    reset,
    setThrottle,
    ignite,
    burn,
    arm,
    meco,
  } = useSimLoop()

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <div>
            <div className="brand-title">MISSION CONTROL</div>
            <div className="brand-sub">CONSOLE · REAL createSim PHYSICS</div>
          </div>
        </div>
        <div className="status-pills">
          <span className="pill">PWA</span>
          <span className="pill accent">
            {target === 'MARS_TRANSFER' ? 'MARS' : 'LEO'}
          </span>
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
        tmiDv={tmiDv}
        onReset={reset}
        onThrottle={setThrottle}
        onArm={arm}
        onIgnite={ignite}
        onBurn={burn}
        onMeco={meco}
      />
    </div>
  )
}
