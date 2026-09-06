import type { Telemetry } from '../physics'

interface Props {
  telemetry: Telemetry
}

function fmtAlt(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (Math.abs(m) >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`
  if (Math.abs(m) >= 1000) return `${(m / 1000).toFixed(1)} km`
  return `${m.toFixed(0)} m`
}

function fmtVel(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} km/s`
  return `${ms.toFixed(0)} m/s`
}

function fmtDv(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} km/s`
  return `${ms.toFixed(0)} m/s`
}

function fmtMass(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg.toFixed(0)} kg`
}

function fmtQ(pa: number): string {
  if (pa >= 1000) return `${(pa / 1000).toFixed(1)} kPa`
  return `${pa.toFixed(0)} Pa`
}

export function TelemetryPanel({ telemetry: t }: Props) {
  const isSuccess =
    (t.phase === 'orbit' || t.phase === 'transfer') &&
    !!t.message &&
    (t.message.includes('SUCCESS') || t.message.includes('arrival') || t.message.includes('TMI'))
  const isFail = t.phase === 'failed'
  const phaseClass = isSuccess ? 'phase-success' : isFail ? 'phase-fail' : 'phase-active'
  const failReason = isFail
    ? (t.message?.replace(/^FAILURE:\s*/i, '') ?? 'Unknown failure')
    : undefined

  return (
    <section className="telemetry" aria-label="Telemetry">
      <div className={`phase-badge ${phaseClass}`}>
        <span className="phase-dot" />
        <span className="phase-label">{t.phase.toUpperCase()}</span>
        <span className="phase-time">T+{t.t.toFixed(1)}s</span>
      </div>

      {t.message && (
        <div className="telem-message" role="status">
          {t.message}
        </div>
      )}

      <div className="telem-grid">
        <TelemCell label="ALT" value={fmtAlt(t.altitudeM)} accent="cyan" />
        <TelemCell label="VEL" value={fmtVel(t.speedMs)} accent="cyan" />
        <TelemCell label="MASS" value={fmtMass(t.massKg)} accent="amber" />
        <TelemCell label="DYN Q" value={fmtQ(t.qPa)} accent="amber" />
        <TelemCell label="ΔV USED" value={fmtDv(t.deltaVUsedMs)} accent="cyan" />
        <TelemCell
          label="ΔV LEFT"
          value={fmtDv(t.deltaVRemainingMs ?? 0)}
          accent="amber"
        />
        {t.apoapsisM != null && (
          <TelemCell label="APO" value={fmtAlt(t.apoapsisM)} accent="cyan" />
        )}
        {t.periapsisM != null && (
          <TelemCell label="PERI" value={fmtAlt(t.periapsisM)} accent="cyan" />
        )}
      </div>

      {(isSuccess || isFail) && (
        <div className={`end-state ${isSuccess ? 'ok' : 'bad'}`} role="status">
          {isSuccess ? (
            <>
              <strong>MISSION SUCCESS</strong>
              <span>{t.message}</span>
            </>
          ) : (
            <>
              <strong>MISSION FAILED</strong>
              <span>{failReason}</span>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function TelemCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: 'cyan' | 'amber'
}) {
  return (
    <div className={`telem-cell accent-${accent}`}>
      <div className="telem-label">{label}</div>
      <div className="telem-value">{value}</div>
    </div>
  )
}
