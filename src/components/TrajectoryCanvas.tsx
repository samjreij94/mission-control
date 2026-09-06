import { useEffect, useRef } from 'react'
import type { MissionTarget, Telemetry, TrajectoryPoint } from '../physics/simApi'

const R_EARTH = 6_371_000
const AU = 149_597_870_700

interface Props {
  trajectory: TrajectoryPoint[]
  target: MissionTarget
  telemetry: Telemetry
}

export function TrajectoryCanvas({ trajectory, target, telemetry }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = parent.clientWidth
    const h = parent.clientHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // Background
    ctx.fillStyle = '#05070c'
    ctx.fillRect(0, 0, w, h)

    // Starfield
    ctx.fillStyle = 'rgba(180, 210, 255, 0.35)'
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97) % w) + (i % 7)
      const sy = ((i * 53) % h) + (i % 5)
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
    }

    const heliocentric =
      telemetry.phase === 'transfer' ||
      (telemetry.phase === 'success' && target === 'mars') ||
      (trajectory.length > 2 && Math.hypot(trajectory[trajectory.length - 1].x, trajectory[trajectory.length - 1].y) > R_EARTH * 50)

    const cx = w * 0.5
    const cy = h * 0.55

    if (heliocentric) {
      drawHeliocentric(ctx, w, h, cx, cy, trajectory, telemetry)
    } else {
      drawEarth(ctx, w, h, cx, cy, trajectory, telemetry, target)
    }

    // Frame label
    ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText(heliocentric ? 'FRAME · HELIOCENTRIC' : 'FRAME · EARTH-CENTERED', 12, 18)
    ctx.fillStyle = 'rgba(255, 176, 32, 0.7)'
    ctx.fillText(`TGT · ${target.toUpperCase()}`, 12, 32)
  }, [trajectory, target, telemetry])

  return <canvas ref={canvasRef} className="traj-canvas" aria-label="Trajectory plot" />
}

function drawEarth(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  trajectory: TrajectoryPoint[],
  telemetry: Telemetry,
  target: MissionTarget,
) {
  const maxR = R_EARTH + Math.max(2_200_000, telemetry.altitudeM * 1.4, telemetry.apoapsisM ?? 0)
  const scale = Math.min(w, h) * 0.38 / maxR

  // LEO band
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, (R_EARTH + 400_000) * scale, 0, Math.PI * 2)
  ctx.stroke()

  // Earth
  const er = R_EARTH * scale
  const grad = ctx.createRadialGradient(cx - er * 0.3, cy - er * 0.3, er * 0.1, cx, cy, er)
  grad.addColorStop(0, '#1a6fb5')
  grad.addColorStop(0.7, '#0c3d6e')
  grad.addColorStop(1, '#071828')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(cx, cy, er, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
  ctx.stroke()

  // Atmosphere glow
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(cx, cy, er + 4, 0, Math.PI * 2)
  ctx.stroke()

  drawPath(ctx, trajectory, cx, cy, scale, telemetry.phase)

  if (target === 'mars') {
    ctx.fillStyle = 'rgba(255, 176, 32, 0.5)'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillText('REACH LEO → TMI', w - 110, 18)
  }
}

function drawHeliocentric(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  trajectory: TrajectoryPoint[],
  telemetry: Telemetry,
) {
  const marsR = 1.524 * AU
  const scale = Math.min(w, h) * 0.4 / (marsR * 1.15)

  // Sun
  const sunGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 14)
  sunGrad.addColorStop(0, '#fff6c8')
  sunGrad.addColorStop(0.4, '#ffb020')
  sunGrad.addColorStop(1, 'rgba(255, 120, 0, 0)')
  ctx.fillStyle = sunGrad
  ctx.beginPath()
  ctx.arc(cx, cy, 14, 0, Math.PI * 2)
  ctx.fill()

  // Earth & Mars orbits
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, AU * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 100, 60, 0.4)'
  ctx.beginPath()
  ctx.arc(cx, cy, marsR * scale, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Bodies
  ctx.fillStyle = '#3db4ff'
  ctx.beginPath()
  ctx.arc(cx + AU * scale, cy, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff6b3d'
  ctx.beginPath()
  ctx.arc(cx + marsR * scale, cy, 3.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(200,220,255,0.5)'
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillText('EARTH', cx + AU * scale - 12, cy - 8)
  ctx.fillStyle = 'rgba(255,160,120,0.6)'
  ctx.fillText('MARS', cx + marsR * scale - 10, cy - 8)

  drawPath(ctx, trajectory, cx, cy, scale, telemetry.phase)
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  trajectory: TrajectoryPoint[],
  cx: number,
  cy: number,
  scale: number,
  phase: Telemetry['phase'],
) {
  if (trajectory.length < 2) return
  const color =
    phase === 'fail'
      ? '#ff4d4d'
      : phase === 'success'
        ? '#3dff9a'
        : '#00e5ff'

  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.beginPath()
  for (let i = 0; i < trajectory.length; i++) {
    const p = trajectory[i]
    const x = cx + p.x * scale
    const y = cy - p.y * scale
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  const last = trajectory[trajectory.length - 1]
  const lx = cx + last.x * scale
  const ly = cy - last.y * scale
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(lx, ly, phase === 'success' || phase === 'fail' ? 5 : 3.5, 0, Math.PI * 2)
  ctx.fill()

  if (phase === 'success') {
    ctx.strokeStyle = 'rgba(61, 255, 154, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(lx, ly, 10, 0, Math.PI * 2)
    ctx.stroke()
  }
  if (phase === 'fail') {
    ctx.strokeStyle = 'rgba(255, 77, 77, 0.6)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(lx - 8, ly - 8)
    ctx.lineTo(lx + 8, ly + 8)
    ctx.moveTo(lx + 8, ly - 8)
    ctx.lineTo(lx - 8, ly + 8)
    ctx.stroke()
  }
}
