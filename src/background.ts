/** Painted rural side-view: sky, hills, field, tree, windmill */

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55)
  sky.addColorStop(0, '#9ec8e8')
  sky.addColorStop(0.55, '#c5dff0')
  sky.addColorStop(1, '#e8f0d8')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Soft clouds
  drawCloud(ctx, w * 0.15, h * 0.12, w * 0.18, time * 0.004)
  drawCloud(ctx, w * 0.55, h * 0.08, w * 0.22, time * 0.003)
  drawCloud(ctx, w * 0.85, h * 0.16, w * 0.14, time * 0.005)

  // Distant blue hills
  ctx.fillStyle = '#7a9a88'
  drawHillRange(ctx, w, h * 0.42, h * 0.12, 3, 0.4)

  // Mid green-brown hills
  ctx.fillStyle = '#6a8a4a'
  drawHillRange(ctx, w, h * 0.52, h * 0.14, 4, 0.7)
  ctx.fillStyle = '#5a7a3a'
  drawHillRange(ctx, w, h * 0.58, h * 0.1, 5, 1.1)

  // Windmill (right side)
  drawWindmill(ctx, w * 0.78, h * 0.52, Math.min(w, h) * 0.11, time)

  // Tree (left-center)
  drawTree(ctx, w * 0.32, h * 0.55, Math.min(w, h) * 0.13)

  // Golden wheat field foreground
  const fieldTop = h * 0.62
  const fieldGrad = ctx.createLinearGradient(0, fieldTop, 0, h)
  fieldGrad.addColorStop(0, '#e8c84a')
  fieldGrad.addColorStop(0.4, '#d4a830')
  fieldGrad.addColorStop(1, '#b88820')
  ctx.fillStyle = fieldGrad
  ctx.beginPath()
  ctx.moveTo(0, fieldTop + h * 0.04)
  for (let x = 0; x <= w; x += 20) {
    const wave = Math.sin(x * 0.02 + time * 0.002) * 6
    ctx.lineTo(x, fieldTop + wave)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()

  // Wheat stalks hint
  ctx.strokeStyle = 'rgba(120, 80, 10, 0.25)'
  ctx.lineWidth = 1
  for (let x = 8; x < w; x += 14) {
    const base = fieldTop + 8 + Math.sin(x * 0.05) * 4
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.quadraticCurveTo(x + Math.sin(time * 0.004 + x) * 3, (base + h) / 2, x, base)
    ctx.stroke()
  }
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  drift: number,
): void {
  const cx = x + Math.sin(drift) * 20
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(cx, y, size * 0.5, size * 0.22, 0, 0, Math.PI * 2)
  ctx.ellipse(cx - size * 0.25, y + 4, size * 0.28, size * 0.16, 0, 0, Math.PI * 2)
  ctx.ellipse(cx + size * 0.28, y + 2, size * 0.3, size * 0.18, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawHillRange(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  bumps: number,
  seed: number,
): void {
  ctx.beginPath()
  ctx.moveTo(0, baseY)
  for (let i = 0; i <= bumps; i++) {
    const x1 = ((i + 0.5) / bumps) * w
    const x2 = ((i + 1) / bumps) * w
    const peak = baseY - amp * (0.6 + 0.4 * Math.sin(seed * 3 + i * 1.7))
    ctx.quadraticCurveTo(x1, peak, x2, baseY)
  }
  ctx.lineTo(w, baseY + amp * 3)
  ctx.lineTo(0, baseY + amp * 3)
  ctx.closePath()
  ctx.fill()
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  // Trunk
  ctx.fillStyle = '#6a4422'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.08, y)
  ctx.lineTo(x - s * 0.12, y - s * 0.55)
  ctx.lineTo(x + s * 0.12, y - s * 0.55)
  ctx.lineTo(x + s * 0.1, y)
  ctx.closePath()
  ctx.fill()

  // Autumn foliage
  const colors = ['#c87828', '#d89030', '#a86020', '#e8a848']
  const blobs = [
    [0, -s * 0.85, s * 0.42],
    [-s * 0.28, -s * 0.7, s * 0.32],
    [s * 0.3, -s * 0.68, s * 0.34],
    [-s * 0.1, -s * 1.05, s * 0.3],
    [s * 0.15, -s * 1.0, s * 0.28],
  ]
  blobs.forEach(([dx, dy, r], i) => {
    ctx.fillStyle = colors[i % colors.length]!
    ctx.beginPath()
    ctx.ellipse(x + dx, y + dy, r, r * 0.85, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawWindmill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
): void {
  // Tower
  ctx.fillStyle = '#8a6a4a'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.28, y)
  ctx.lineTo(x - s * 0.18, y - s * 1.35)
  ctx.lineTo(x + s * 0.18, y - s * 1.35)
  ctx.lineTo(x + s * 0.28, y)
  ctx.closePath()
  ctx.fill()

  // Brick lines
  ctx.strokeStyle = 'rgba(60,40,20,0.25)'
  ctx.lineWidth = 1
  for (let i = 1; i < 8; i++) {
    const yy = y - (i / 8) * s * 1.35
    const t = i / 8
    const half = s * (0.28 - t * 0.1)
    ctx.beginPath()
    ctx.moveTo(x - half, yy)
    ctx.lineTo(x + half, yy)
    ctx.stroke()
  }

  // Cap
  ctx.fillStyle = '#5a3a22'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.22, y - s * 1.32)
  ctx.lineTo(x, y - s * 1.55)
  ctx.lineTo(x + s * 0.22, y - s * 1.32)
  ctx.closePath()
  ctx.fill()

  // Hub
  const hx = x
  const hy = y - s * 1.15
  const angle = time * 0.0012

  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(angle)
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    // Sail
    ctx.fillStyle = '#f5f0e0'
    ctx.strokeStyle = '#5a4a30'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(s * 0.08, -s * 0.12)
    ctx.lineTo(s * 0.12, -s * 0.85)
    ctx.lineTo(-s * 0.05, -s * 0.85)
    ctx.lineTo(-s * 0.08, -s * 0.12)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Slats
    ctx.strokeStyle = 'rgba(90,70,40,0.45)'
    for (let k = 1; k < 5; k++) {
      const yy = -s * 0.15 - k * s * 0.14
      ctx.beginPath()
      ctx.moveTo(-s * 0.04, yy)
      ctx.lineTo(s * 0.1, yy)
      ctx.stroke()
    }
  }
  ctx.restore()

  ctx.fillStyle = '#4a3a28'
  ctx.beginPath()
  ctx.arc(hx, hy, s * 0.07, 0, Math.PI * 2)
  ctx.fill()
}
