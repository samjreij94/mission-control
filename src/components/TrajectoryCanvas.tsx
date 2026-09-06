import { useEffect, useRef } from 'react'
import type { MissionTarget, Telemetry, TrajectoryPoint } from '../physics'

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

    ctx.fillStyle = '#05070c'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = 'rgba(180, 210, 255, 0.35)'
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 97) % w) + (i % 7)
      const sy = ((i * 53) % h) + (i % 5)
      ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
    }

    // Physics TrajectoryPoint: x = downrange arc (m), y = altitude (m)
    const maxX = Math.max(200_000, ...trajectory.map((p) => p.x), 1)
    const maxY = Math.max(
      200_000,
      ...trajectory.map((p) => p.y),
      telemetry.altitudeM,
      telemetry.apoapsisM ?? 0,
      1,
    )
    const pad = 28
    const plotW = w - pad * 2
    const plotH = h - pad * 2
    const sx = (x: number) => pad + (x / maxX) * plotW
    const sy = (y: number) => h - pad - (y / maxY) * plotH

    // Ground + LEO band
    ctx.strokeStyle = 'rgba(139, 147, 167, 0.35)'
    ctx.beginPath()
    ctx.moveTo(pad, h - pad)
    ctx.lineTo(w - pad, h - pad)
    ctx.stroke()

    const leoY = sy(400_000)
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'
    ctx.beginPath()
    ctx.moveTo(pad, leoY)
    ctx.lineTo(w - pad, leoY)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(0, 229, 255, 0.45)'
    ctx.font = '9px ui-monospace, monospace'
    ctx.fillText('LEO ~400 km', pad, leoY - 4)

    const isFail = telemetry.phase === 'failed'
    const isSuccess =
      (telemetry.phase === 'orbit' || telemetry.phase === 'transfer') &&
      !!telemetry.message &&
      (telemetry.message.includes('SUCCESS') ||
        telemetry.message.includes('TMI') ||
        telemetry.message.includes('arrival'))
    const color = isFail ? '#ff4d4d' : isSuccess ? '#3dff9a' : '#00e5ff'

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

    ctx.fillStyle = 'rgba(0, 229, 255, 0.55)'
    ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillText('FRAME · DOWNRANGE / ALTITUDE', 12, 18)
    ctx.fillStyle = target === 'MARS_TRANSFER' ? 'rgba(255, 176, 32, 0.75)' : 'rgba(255, 176, 32, 0.7)'
    ctx.fillText(`TGT · ${target === 'MARS_TRANSFER' ? 'MARS' : 'LEO'}`, 12, 32)
  }, [trajectory, target, telemetry])

  return <canvas ref={canvasRef} className="traj-canvas" aria-label="Trajectory plot" />
}
