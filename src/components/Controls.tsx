import type { MissionTarget, Telemetry } from '../physics'

/** Treat remaining ΔV below this (m/s) as depleted for UI gating. */
const DV_DEPLETED_EPS_MS = 1

interface Props {
  telemetry: Telemetry
  target: MissionTarget
  throttle: number
  armed: boolean
  tmiDv: number
  onReset: (t: MissionTarget) => void
  onThrottle: (v: number) => void
  onArm: () => void
  onIgnite: () => void
  onBurn: (deltaVms: number) => void
  onMeco: () => void
}

export function Controls({
  telemetry,
  target,
  throttle,
  armed,
  tmiDv,
  onReset,
  onThrottle,
  onArm,
  onIgnite,
  onBurn,
  onMeco,
}: Props) {
  const phase = telemetry.phase
  const success =
    (phase === 'orbit' || phase === 'transfer') &&
    (telemetry.message?.includes('SUCCESS') ||
      telemetry.message?.includes('TMI') ||
      telemetry.message?.includes('Mars arrival') ||
      telemetry.message?.includes('parking'))
  const failed = phase === 'failed'
  const ended = failed || (phase === 'orbit' && !!telemetry.message?.includes('SUCCESS')) ||
    (phase === 'transfer' && !!telemetry.message?.includes('arrival'))
  const canIgnite = phase === 'pad' && armed
  const canBurn = phase === 'coast' || phase === 'orbit' || phase === 'ascent' || phase === 'transfer'
  const canChangeDest = phase === 'pad' || failed || ended

  const dvRemaining = telemetry.deltaVRemainingMs ?? 0
  const dvDepleted = dvRemaining < DV_DEPLETED_EPS_MS
  const canDoBurn = !dvDepleted

  return (
    <section className="controls" aria-label="Launch controls">
      <div className="dest-row">
        <span className="ctrl-label">DESTINATION</span>
        <div className="dest-toggle" role="group" aria-label="Destination">
          <button
            type="button"
            className={target === 'LEO' ? 'dest-btn active' : 'dest-btn'}
            onClick={() => onReset('LEO')}
            disabled={!canChangeDest}
          >
            LEO
          </button>
          <button
            type="button"
            className={target === 'MARS_TRANSFER' ? 'dest-btn active mars' : 'dest-btn'}
            onClick={() => onReset('MARS_TRANSFER')}
            disabled={!canChangeDest}
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
          disabled={failed}
          aria-label="Throttle"
        />
      </div>

      <div className="action-row">
        {phase === 'pad' && (
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

        {phase === 'ascent' && (
          <>
            <button type="button" className="btn burn" onClick={onMeco}>
              MECO
            </button>
            <button type="button" className="btn reset" onClick={() => onReset(target)}>
              ABORT
            </button>
            <div className="ascent-hint">ASCENT · gravity turn auto · MECO to coast</div>
          </>
        )}

        {canBurn && phase !== 'ascent' && !ended && (
          <>
            <button
              type="button"
              className="btn burn"
              onClick={() => onBurn(100)}
              disabled={!canDoBurn}
              aria-disabled={!canDoBurn}
              title={dvDepleted ? 'No ΔV remaining' : undefined}
            >
              ΔV 100
            </button>
            <button
              type="button"
              className="btn burn"
              onClick={() => onBurn(300)}
              disabled={!canDoBurn}
              aria-disabled={!canDoBurn}
              title={dvDepleted ? 'No ΔV remaining' : undefined}
            >
              ΔV 300
            </button>
            {target === 'MARS_TRANSFER' && (
              <button
                type="button"
                className="btn burn primary"
                onClick={() => onBurn(tmiDv)}
                disabled={!canDoBurn}
                aria-disabled={!canDoBurn}
                title={dvDepleted ? 'No ΔV remaining' : undefined}
              >
                TMI {Math.round(tmiDv)}
              </button>
            )}
            {target === 'LEO' && (
              <button
                type="button"
                className="btn burn primary"
                onClick={() => onBurn(500)}
                disabled={!canDoBurn}
                aria-disabled={!canDoBurn}
                title={dvDepleted ? 'No ΔV remaining' : undefined}
              >
                ΔV 500
              </button>
            )}
            {dvDepleted && (
              <div className="burn-gate-hint" role="status">
                No ΔV remaining
              </div>
            )}
          </>
        )}

        {(ended || failed || success) && (
          <button type="button" className="btn reset" onClick={() => onReset(target)}>
            RESET
          </button>
        )}
      </div>
    </section>
  )
}
