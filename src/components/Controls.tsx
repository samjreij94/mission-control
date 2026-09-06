import type { MissionTarget, Telemetry } from '../physics/simApi'

interface Props {
  telemetry: Telemetry
  target: MissionTarget
  throttle: number
  armed: boolean
  onReset: (t: MissionTarget) => void
  onThrottle: (v: number) => void
  onArm: () => void
  onIgnite: () => void
  onBurn: (sec: number) => void
}

export function Controls({
  telemetry,
  target,
  throttle,
  armed,
  onReset,
  onThrottle,
  onArm,
  onIgnite,
  onBurn,
}: Props) {
  const phase = telemetry.phase
  const ended = phase === 'success' || phase === 'fail'
  const canIgnite = phase === 'prelaunch' && armed
  const canBurn =
    phase === 'coast' || phase === 'orbit' || phase === 'transfer'

  return (
    <section className="controls" aria-label="Launch controls">
      <div className="dest-row">
        <span className="ctrl-label">DESTINATION</span>
        <div className="dest-toggle" role="group" aria-label="Destination">
          <button
            type="button"
            className={target === 'leo' ? 'dest-btn active' : 'dest-btn'}
            onClick={() => onReset('leo')}
            disabled={phase !== 'prelaunch' && !ended}
          >
            LEO
          </button>
          <button
            type="button"
            className={target === 'mars' ? 'dest-btn active mars' : 'dest-btn'}
            onClick={() => onReset('mars')}
            disabled={phase !== 'prelaunch' && !ended}
          >
            MARS
          </button>
        </div>
      </div>

      <div className="throttle-row">
        <div className="throttle-header">
          <span className="ctrl-label">THROTTLE</span>
          <span className="throttle-readout">{Math.round(throttle * 100)}%</span>
        </div>
        <input
          className="throttle-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(throttle * 100)}
          onChange={(e) => onThrottle(Number(e.target.value) / 100)}
          disabled={ended || phase === 'prelaunch'}
          aria-label="Throttle"
        />
      </div>

      <div className="action-row">
        {phase === 'prelaunch' && (
          <>
            <button
              type="button"
              className={`btn arm ${armed ? 'armed' : ''}`}
              onClick={onArm}
              disabled={armed}
            >
              {armed ? 'ARMED' : 'ARM'}
            </button>
            <button
              type="button"
              className={`btn ignite ${canIgnite ? 'ready' : ''}`}
              onClick={onIgnite}
              disabled={!canIgnite}
            >
              IGNITE
            </button>
          </>
        )}

        {canBurn && (
          <>
            <button type="button" className="btn burn" onClick={() => onBurn(3)}>
              BURN 3s
            </button>
            <button type="button" className="btn burn primary" onClick={() => onBurn(8)}>
              BURN 8s
            </button>
          </>
        )}

        {(phase === 'ascent' || ended) && (
          <button type="button" className="btn reset" onClick={() => onReset(target)}>
            {ended ? 'RESET' : 'ABORT / RESET'}
          </button>
        )}

        {phase === 'ascent' && (
          <div className="ascent-hint">ASCENT · gravity turn auto</div>
        )}
      </div>
    </section>
  )
}
