import { useEffect, useRef } from 'react'
import { LEO_ALT_MIN } from '../physics'
import type { MissionTarget, Telemetry, TrajectoryPoint } from '../physics'

/** Visual LEO corridor upper edge (physics success allows higher apo; UI focuses the classic band). */
const LEO_VIS_MAX = 400_000

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

/** Compact pill callout — phone-safe, high contrast. */
function drawTargetCallout(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  stroke: string,
  textColor: string,
) {
  ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  const tw = ctx.measureText(text).width
  const pw = tw + 14
  const ph = 20
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1.5
  const r = 4
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + pw - r, y)
  ctx.quadraticCurveTo(x + pw, y, x + pw, y + r)
  ctx.lineTo(x + pw, y + ph - r)
  ctx.quadraticCurveTo(x + pw, y + ph, x + pw - r, y + ph)
  ctx.lineTo(x + r, y + ph)
  ctx.quadraticCurveTo(x, y + ph, x, y + ph - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = textColor
  ctx.fillText(text, x + 7, y + 14)
}

function drawLeoFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  altToY: (y: number) => number,
  craftAltM: number,
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

  // LEO altitude band — bold target corridor (LEO_ALT_MIN … classic ~400 km)
  const leoLo = altToY(LEO_ALT_MIN)
  const leoHi = altToY(LEO_VIS_MAX)
  const bandTop = Math.min(leoLo, leoHi)
  const bandBot = Math.max(leoLo, leoHi)
  const bandH = Math.max(3, bandBot - bandTop)

  // Glow wash behind band
  ctx.fillStyle = 'rgba(0, 229, 255, 0.10)'
  ctx.fillRect(pad, bandTop - 2, w - pad * 2, bandH + 4)

  // Solid band body
  ctx.fillStyle = 'rgba(0, 229, 255, 0.16)'
  ctx.fillRect(pad, bandTop, w - pad * 2, bandH)

  // Bold top / bottom edges
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(pad, bandTop)
  ctx.lineTo(w - pad, bandTop)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.55)'
  ctx.lineWidth = 1.5
  ctx.setLineDash([5, 3])
  ctx.beginPath()
  ctx.moveTo(pad, bandBot)
  ctx.lineTo(w - pad, bandBot)
  ctx.stroke()
  ctx.setLineDash([])

  // Circular-orbit target ring cue (right side) — bold
  const ringCx = w - pad - 34
  const ringCy = (bandTop + bandBot) / 2
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(ringCx, ringCy, 16, -Math.PI * 0.85, Math.PI * 0.15)
  ctx.stroke()
  ctx.setLineDash([2, 3])
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.arc(ringCx, ringCy, 16, Math.PI * 0.15, Math.PI * 1.15)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(0, 229, 255, 0.95)'
  ctx.beginPath()
  ctx.arc(ringCx, ringCy, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '700 8px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0, 229, 255, 0.8)'
  ctx.fillText('CIRC', ringCx - 11, ringCy + 26)

  // Rocket vs target gap cue (left edge, compact)
  const craftY = altToY(Math.max(0, craftAltM))
  const inBand = craftAltM >= LEO_ALT_MIN && craftAltM <= LEO_VIS_MAX
  const gapM = inBand
    ? 0
    : craftAltM < LEO_ALT_MIN
      ? LEO_ALT_MIN - craftAltM
      : craftAltM - LEO_VIS_MAX
  const gapKm = Math.round(gapM / 1000)
  const gapX = pad + 6

  if (!inBand && Number.isFinite(craftAltM) && craftAltM > 5_000) {
    const targetEdgeY = craftAltM < LEO_ALT_MIN ? bandBot : bandTop
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.75)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(gapX, craftY)
    ctx.lineTo(gapX, targetEdgeY)
    ctx.stroke()
    ctx.setLineDash([])

    // End caps
    ctx.beginPath()
    ctx.moveTo(gapX - 4, craftY)
    ctx.lineTo(gapX + 4, craftY)
    ctx.moveTo(gapX - 4, targetEdgeY)
    ctx.lineTo(gapX + 4, targetEdgeY)
    ctx.stroke()

    const midY = (craftY + targetEdgeY) / 2
    const gapLabel =
      craftAltM < LEO_ALT_MIN ? `↑ ${gapKm} km to TARGET` : `↓ ${gapKm} km above BAND`
    ctx.font = '700 9px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(255, 176, 32, 0.95)'
    // Keep label inside plot on ~390px
    const labelX = Math.min(gapX + 8, w - pad - 110)
    ctx.fillText(gapLabel, labelX, midY + 3)
  } else if (inBand) {
    ctx.font = '700 9px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(61, 255, 154, 0.9)'
    ctx.fillText('IN TARGET BAND', Math.min(w * 0.35, ringCx - 90), (bandTop + bandBot) / 2 + 3)
  }

  // Band edge altitudes — left of CIRC ring to avoid overlap
  ctx.font = '700 8px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0, 229, 255, 0.75)'
  ctx.fillText(`${Math.round(LEO_VIS_MAX / 1000)} km`, ringCx - 52, bandTop - 4)
  ctx.fillText(`${Math.round(LEO_ALT_MIN / 1000)} km`, ringCx - 52, bandBot + 11)
}

function drawCraftMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  size = 7,
) {
  // Chevron / rocket nose — distinct from circular planet markers
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -size)
  ctx.lineTo(size * 0.7, size * 0.6)
  ctx.lineTo(0, size * 0.25)
  ctx.lineTo(-size * 0.7, size * 0.6)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.shadowColor = color
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.restore()
}

function drawMarsFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  pad: number,
  phase: string,
) {
  // Amber-tinted heliocentric wash (distinct from LEO cyan Earth plot)
  const wash = ctx.createRadialGradient(w * 0.28, h * 0.55, 4, w * 0.28, h * 0.55, w * 0.7)
  wash.addColorStop(0, 'rgba(255, 176, 32, 0.14)')
  wash.addColorStop(0.35, 'rgba(255, 120, 40, 0.05)')
  wash.addColorStop(1, 'rgba(5, 7, 12, 0)')
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, w, h)

  const cx = w * 0.28
  const cy = h * 0.56
  const earthR = Math.min(w, h) * 0.15
  const marsR = earthR * 1.52
  const transferA = (earthR + marsR) / 2
  const transferB = transferA * 0.62
  const ellipseCx = cx + (marsR - earthR) / 2

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

  // Mars orbit ring — bold target orbit
  ctx.strokeStyle = 'rgba(255, 120, 60, 0.85)'
  ctx.lineWidth = 2.25
  ctx.beginPath()
  ctx.arc(cx, cy, marsR, 0, Math.PI * 2)
  ctx.stroke()
  // Outer halo on Mars orbit
  ctx.strokeStyle = 'rgba(255, 140, 70, 0.25)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy, marsR, 0, Math.PI * 2)
  ctx.stroke()

  // Hohmann transfer ellipse hint
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.65)'
  ctx.lineWidth = 1.75
  ctx.beginPath()
  ctx.ellipse(ellipseCx, cy, transferA, transferB, 0, -Math.PI * 0.92, Math.PI * 0.15)
  ctx.stroke()
  ctx.setLineDash([])

  // Body markers — Earth small cyan, Mars BOLD amber target
  const earthX = cx + earthR
  const marsX = cx + marsR

  ctx.fillStyle = 'rgba(90, 200, 255, 0.95)'
  ctx.beginPath()
  ctx.arc(earthX, cy, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '700 9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0, 229, 255, 0.7)'
  ctx.fillText('EARTH', earthX - 14, cy + 18)

  // Bold Mars target marker + arrival ring
  ctx.shadowColor = 'rgba(255, 100, 40, 0.7)'
  ctx.shadowBlur = 14
  ctx.fillStyle = 'rgba(255, 100, 50, 1)'
  ctx.beginPath()
  ctx.arc(marsX, cy, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255, 200, 120, 0.95)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(marsX, cy, 12, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([3, 2])
  ctx.strokeStyle = 'rgba(255, 160, 80, 0.55)'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.arc(marsX, cy, 17, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.font = '700 9px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(255, 180, 100, 0.95)'
  ctx.fillText('ARRIVAL', marsX - 18, cy - 22)
  ctx.fillStyle = 'rgba(255, 160, 90, 0.85)'
  ctx.fillText('MARS ORBIT', marsX - 24, cy + 28)

  ctx.fillStyle = 'rgba(255, 176, 32, 0.55)'
  ctx.font = '8px ui-monospace, monospace'
  ctx.fillText('HOHMANN', cx + transferA * 0.28, cy - transferB - 4)

  // Craft on transfer schematic — chevron ≠ circular planet markers
  let craftT = 0.06 // near Earth
  if (phase === 'ascent' || phase === 'coast') craftT = 0.1
  if (phase === 'orbit') craftT = 0.14
  if (phase === 'transfer') craftT = 0.55
  const theta0 = -Math.PI * 0.92
  const theta1 = Math.PI * 0.15
  const theta = theta0 + craftT * (theta1 - theta0)
  const craftX = ellipseCx + transferA * Math.cos(theta)
  const craftY = cy + transferB * Math.sin(theta)
  drawCraftMarker(ctx, craftX, craftY, '#ffb020', 6)
  ctx.font = '700 8px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(255, 200, 100, 0.95)'
  ctx.fillText('CRAFT', craftX - 14, craftY - 12)

  // Axis cue strip at bottom
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

  // Primary TARGET · MARS callout (top-left under frame badge)
  drawTargetCallout(
    ctx,
    12,
    38,
    'TARGET · MARS',
    'rgba(40, 18, 8, 0.92)',
    'rgba(255, 140, 60, 0.95)',
    '#ffc080',
  )
}

function drawAscentPath(
  ctx: CanvasRenderingContext2D,
  trajectory: TrajectoryPoint[],
  telemetry: Telemetry,
  sx: (x: number) => number,
  sy: (y: number) => number,
  accent: string,
  useCraftChevron: boolean,
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

    if (useCraftChevron && !isFail) {
      drawCraftMarker(ctx, lx, ly, color, 6)
    } else {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(lx, ly, 4, 0, Math.PI * 2)
      ctx.fill()
    }

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
      isMars ? 120_000 : 450_000, // room to show full LEO target band
      ...trajectory.map((p) => p.y),
      telemetry.altitudeM,
      telemetry.apoapsisM ?? 0,
      1,
    )

    const sx = (x: number) => plotLeft + (x / maxX) * plotW
    const sy = (y: number) => plotBottom - (y / maxY) * plotH

    if (isMars) {
      drawMarsFrame(ctx, w, h, pad, telemetry.phase)
      // Subtle plot well for ascent polyline
      ctx.fillStyle = 'rgba(8, 10, 16, 0.35)'
      ctx.fillRect(plotLeft - 6, plotTop - 6, plotW + 12, plotH + 12)
      ctx.strokeStyle = 'rgba(255, 176, 32, 0.18)'
      ctx.strokeRect(plotLeft - 6, plotTop - 6, plotW + 12, plotH + 12)
      ctx.fillStyle = 'rgba(255, 176, 32, 0.4)'
      ctx.font = '8px ui-monospace, monospace'
      ctx.fillText('ASCENT INSET', plotLeft, plotTop - 10)
    } else {
      drawLeoFrame(ctx, w, h, pad, sy, telemetry.altitudeM)
    }

    drawAscentPath(
      ctx,
      trajectory,
      telemetry,
      sx,
      sy,
      isMars ? '#ffb020' : '#00e5ff',
      true,
    )

    // Frame badge + bold TARGET callout (destination must scream)
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
    if (isMars) {
      ctx.fillStyle = 'rgba(255, 176, 32, 0.7)'
      ctx.fillText('FRAME · HELIO · HOHMANN XFER', 12, 18)
      // TARGET · MARS drawn inside drawMarsFrame
    } else {
      ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
      ctx.fillText('FRAME · EARTH · DOWNRANGE / ALT', 12, 18)
      const leoLabel = `TARGET · LEO ${Math.round(LEO_ALT_MIN / 1000)}–${Math.round(LEO_VIS_MAX / 1000)} km`
      drawTargetCallout(
        ctx,
        12,
        24,
        leoLabel,
        'rgba(0, 40, 55, 0.92)',
        'rgba(0, 229, 255, 0.95)',
        '#7ef0ff',
      )
    }
  }, [trajectory, target, telemetry])

  return <canvas ref={canvasRef} className="traj-canvas" aria-label="Trajectory plot" />
}
