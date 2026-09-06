import { useEffect, useRef } from 'react'
import type { MissionTarget, Telemetry, TrajectoryPoint } from '../physics'

interface Props {
  trajectory: TrajectoryPoint[]
  target: MissionTarget
  telemetry: Telemetry
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tint: string,
  count = 60,
) {
  ctx.fillStyle = tint
  for (let i = 0; i < count; i++) {
    const sx = ((i * 97) % w) + (i % 7)
    const sy = ((i * 53) % h) + (i % 5)
    ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
  }
}

function drawLeoFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  altToY: (y: number) => number,
) {
  // Soft Earth atmosphere glow above the surface
  const groundY = altToY(0)
  const atmosphere = ctx.createLinearGradient(0, groundY - 48, 0, groundY + 8)
  atmosphere.addColorStop(0, 'rgba(0, 229, 255, 0)')
  atmosphere.addColorStop(0.55, 'rgba(0, 140, 220, 0.08)')
  atmosphere.addColorStop(1, 'rgba(20, 90, 160, 0.22)')
  ctx.fillStyle = atmosphere
  ctx.fillRect(pad, groundY - 48, w - pad * 2, 56)

  // Curved Earth horizon (surface)
  ctx.beginPath()
  const curveDepth = Math.min(22, h * 0.08)
  ctx.moveTo(pad, groundY)
  ctx.quadraticCurveTo(w / 2, groundY + curveDepth, w - pad, groundY)
  ctx.lineTo(w - pad, h)
  ctx.lineTo(pad, h)
  ctx.closePath()
  const earthFill = ctx.createLinearGradient(0, groundY, 0, h)
  earthFill.addColorStop(0, 'rgba(18, 70, 110, 0.55)')
  earthFill.addColorStop(1, 'rgba(6, 24, 42, 0.9)')
  ctx.fillStyle = earthFill
  ctx.fill()

  ctx.strokeStyle = 'rgba(120, 190, 255, 0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(pad, groundY)
  ctx.quadraticCurveTo(w / 2, groundY + curveDepth, w - pad, groundY)
  ctx.stroke()

  // LEO altitude band (160–400 km target corridor)
  const leoLo = altToY(160_000)
  const leoHi = altToY(400_000)
  const bandTop = Math.min(leoLo, leoHi)
  const bandBot = Math.max(leoLo, leoHi)
  ctx.fillStyle = 'rgba(0, 229, 255, 0.06)'
  ctx.fillRect(pad, bandTop, w - pad * 2, Math.max(2, bandBot - bandTop))

  ctx.setLineDash([4, 4])
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, leoHi)
  ctx.lineTo(w - pad, leoHi)
  ctx.stroke()
  ctx.setLineDash([])

  // Circular-orbit target ring cue (right side)
  const ringCx = w - pad - 36
  const ringCy = leoHi
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.arc(ringCx, ringCy, 18, -Math.PI * 0.85, Math.PI * 0.15)
  ctx.stroke()
  ctx.setLineDash([2, 3])
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)'
  ctx.beginPath()
  ctx.arc(ringCx, ringCy, 18, Math.PI * 0.15, Math.PI * 1.15)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
  ctx.font = '9px ui-monospace, monospace'
  ctx.fillText('LEO BAND · 160–400 km', pad, leoHi - 5)
  ctx.fillText('CIRC', ringCx - 10, ringCy + 28)

}

function drawMarsFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
) {
  // Amber-tinted heliocentric wash (distinct from LEO cyan Earth plot)
  const wash = ctx.createRadialGradient(w * 0.28, h * 0.55, 4, w * 0.28, h * 0.55, w * 0.7)
  wash.addColorStop(0, 'rgba(255, 176, 32, 0.14)')
  wash.addColorStop(0.35, 'rgba(255, 120, 40, 0.05)')
  wash.addColorStop(1, 'rgba(5, 7, 12, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  const cx = w * 0.30
  const cy = h * 0.58
  const earthR = Math.min(w, h) * 0.16
  const marsR = earthR * 1.52
  const transferA = (earthR + marsR) / 2
  const transferB = transferA * 0.62

  // Sun
  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 210, 90, 0.95)'
  ctx.shadowColor = 'rgba(255, 176, 32, 0.55)'
  ctx.shadowBlur = 12
  ctx.fill()
  ctx.shadowBlur = 0

  // Earth orbit ring
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.arc(cx, cy, earthR, 0, Math.PI * 2)
  ctx.stroke()

  // Mars orbit ring
  ctx.strokeStyle = 'rgba(255, 140, 70, 0.45)'
  ctx.beginPath()
  ctx.arc(cx, cy, marsR, 0, Math.PI * 2)
  ctx.stroke()

  // Hohmann transfer ellipse hint (semi-major along +x)
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.55)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(cx + (marsR - earthR) / 2, cy, transferA, transferB, 0, -Math.PI * 0.92, Math.PI * 0.15)
  ctx.stroke()
  ctx.setLineDash([])

  // Body markers
  const earthX = cx + earthR
  const marsX = cx + marsR
  ctx.fillStyle = 'rgba(90, 200, 255, 0.9)'
  ctx.beginPath()
  ctx.arc(earthX, cy, 3.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 120, 70, 0.95)'
  ctx.beginPath()
  ctx.arc(marsX, cy, 3.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.font = '9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
  ctx.fillText('EARTH', earthX - 14, cy + 16)
  ctx.fillStyle = 'rgba(255, 160, 90, 0.7)'
  ctx.fillText('MARS', marsX - 12, cy + 16)
  ctx.fillStyle = 'rgba(255, 176, 32, 0.55)'
  ctx.fillText('HOHMANN', cx + transferA * 0.35, cy - transferB - 6)

  // Axis cue strip at bottom (distinct from LEO ground line)
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, h - pad)
  ctx.lineTo(w - pad, h - pad)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 176, 32, 0.4)'
  ctx.font = '8px ui-monospace, monospace'
  ctx.fillText('1 AU', pad, h - pad + 12)
  ctx.fillText('1.52 AU', w - pad - 42, h - pad + 12)
}

function drawAscentPath(
  ctx: CanvasRenderingContext2D,
  trajectory: TrajectoryPoint[],
  telemetry: Telemetry,
  sx: (x: number) => number,
  sy: (y: number) => number,
  accent: string,
) {
  const isFail = telemetry.phase === 'failed'
  const isSuccess =
    (telemetry.phase === 'orbit' || telemetry.phase === 'transfer') &&
    !!telemetry.message &&
    (telemetry.message.includes('SUCCESS') ||
      telemetry.message.includes('TMI') ||
      telemetry.message.includes('arrival'))
  const color = isFail ? '#ff4d4d' : isSuccess ? '#3dff9a' : accent

  if (trajectory.length > 1) {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    trajectory.forEach((p, i) => {
      const x = sx(p.x)
      const y = sy(Math.max(0, p.y))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    const last = trajectory[trajectory.length - 1]
    const lx = sx(last.x)
    const ly = sy(Math.max(0, last.y))
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(lx, ly, 4, 0, Math.PI * 2)
    ctx.fill()
    if (isFail) {
      ctx.strokeStyle = 'rgba(255,77,77,0.7)'
      ctx.beginPath()
      ctx.moveTo(lx - 7, ly - 7)
      ctx.lineTo(lx + 7, ly + 7)
      ctx.moveTo(lx + 7, ly - 7)
      ctx.lineTo(lx - 7, ly + 7)
      ctx.stroke()
    }
    if (isSuccess) {
      ctx.strokeStyle = 'rgba(61,255,154,0.55)'
      ctx.beginPath()
      ctx.arc(lx, ly, 10, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
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

    const isMars = target === 'MARS_TRANSFER'

    ctx.fillStyle = isMars ? '#07060a' : '#05070c'
    ctx.fillRect(0, 0, w, h)

    drawStars(
      ctx,
      w,
      h,
      isMars ? 'rgba(255, 210, 160, 0.28)' : 'rgba(180, 210, 255, 0.35)',
      isMars ? 48 : 60,
    )

    // Physics TrajectoryPoint: x = downrange arc (m), y = altitude (m)
    // Mars keeps ascent plot in a right inset so Hohmann schematic stays readable.
    const pad = 28
    const plotLeft = isMars ? Math.floor(w * 0.52) : pad
    const plotRight = w - pad
    const plotTop = pad + (isMars ? 8 : 0)
    const plotBottom = h - pad
    const plotW = Math.max(40, plotRight - plotLeft)
    const plotH = Math.max(40, plotBottom - plotTop)

    const maxX = Math.max(200_000, ...trajectory.map((p) => p.x), 1)
    const maxY = Math.max(
      isMars ? 120_000 : 200_000,
      ...trajectory.map((p) => p.y),
      telemetry.altitudeM,
      telemetry.apoapsisM ?? 0,
      1,
    )

    const sx = (x: number) => plotLeft + (x / maxX) * plotW
    const sy = (y: number) => plotBottom - (y / maxY) * plotH

    if (isMars) {
      drawMarsFrame(ctx, w, h, pad)
      // Subtle plot well for ascent polyline
      ctx.fillStyle = 'rgba(8, 10, 16, 0.35)'
      ctx.fillRect(plotLeft - 6, plotTop - 6, plotW + 12, plotH + 12)
      ctx.strokeStyle = 'rgba(255, 176, 32, 0.18)'
      ctx.strokeRect(plotLeft - 6, plotTop - 6, plotW + 12, plotH + 12)
      ctx.fillStyle = 'rgba(255, 176, 32, 0.4)'
      ctx.font = '8px ui-monospace, monospace'
      ctx.fillText('ASCENT INSET', plotLeft, plotTop - 10)
    } else {
      drawLeoFrame(ctx, w, h, pad, sy)
    }

    drawAscentPath(ctx, trajectory, telemetry, sx, sy, isMars ? '#ffb020' : '#00e5ff')

    // Frame badges — distinct copy per destination
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
    if (isMars) {
      ctx.fillStyle = 'rgba(255, 176, 32, 0.7)'
      ctx.fillText('FRAME · HELIO · HOHMANN XFER', 12, 18)
      ctx.fillStyle = 'rgba(255, 176, 32, 0.85)'
      ctx.fillText('TGT · MARS TRANSFER', 12, 32)
    } else {
      ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
      ctx.fillText('FRAME · EARTH · DOWNRANGE / ALT', 12, 18)
      ctx.fillStyle = 'rgba(255, 176, 32, 0.7)'
      ctx.fillText('TGT · LEO', 12, 32)
    }
  }, [trajectory, target, telemetry])

  return <canvas ref={canvasRef} className="traj-canvas" aria-label="Trajectory plot" />
}
