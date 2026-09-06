/** Richer painted rural side-view with soft parallax layers */

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number,
): void {
  const t = time * 0.001

  // Sky gradient — warmer painted look
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.58)
  sky.addColorStop(0, '#6eb0e0')
  sky.addColorStop(0.35, '#9ecce8')
  sky.addColorStop(0.7, '#c8e0f0')
  sky.addColorStop(1, '#e4efd0')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  // Soft sun glow (upper right)
  const sunX = w * 0.82
  const sunY = h * 0.12
  const sun = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, w * 0.28)
  sun.addColorStop(0, 'rgba(255,250,200,0.55)')
  sun.addColorStop(0.4, 'rgba(255,230,160,0.18)')
  sun.addColorStop(1, 'rgba(255,220,140,0)')
  ctx.fillStyle = sun
  ctx.fillRect(0, 0, w, h * 0.5)

  // Far clouds — slow parallax
  const driftFar = t * 8
  drawCloud(ctx, wrap(w * 0.12 + driftFar * 0.15, w), h * 0.1, w * 0.2, 0.4)
  drawCloud(ctx, wrap(w * 0.48 + driftFar * 0.12, w), h * 0.06, w * 0.26, 0.35)
  drawCloud(ctx, wrap(w * 0.88 + driftFar * 0.1, w), h * 0.14, w * 0.16, 0.38)

  // Distant blue-grey hills (parallax slow)
  const farShift = Math.sin(t * 0.15) * 6
  ctx.fillStyle = '#8aab9a'
  drawHillRange(ctx, w, h * 0.4, h * 0.11, 3, 0.4, farShift)
  ctx.fillStyle = '#7a9a88'
  drawHillRange(ctx, w, h * 0.44, h * 0.1, 4, 0.9, farShift * 0.7)

  // Mid clouds
  const driftMid = t * 14
  drawCloud(ctx, wrap(w * 0.3 + driftMid * 0.22, w), h * 0.18, w * 0.14, 0.5)
  drawCloud(ctx, wrap(w * 0.7 + driftMid * 0.18, w), h * 0.22, w * 0.12, 0.45)

  // Mid green hills
  const midShift = Math.sin(t * 0.22 + 1) * 10
  ctx.fillStyle = '#6a8a4a'
  drawHillRange(ctx, w, h * 0.5, h * 0.13, 4, 0.7, midShift)
  ctx.fillStyle = '#5a7a3a'
  drawHillRange(ctx, w, h * 0.56, h * 0.1, 5, 1.1, midShift * 0.8)

  // Windmill (mid-ground, slight bob)
  const wmX = w * 0.78 + Math.sin(t * 0.3) * 2
  drawWindmill(ctx, wmX, h * 0.52, Math.min(w, h) * 0.12, time)

  // Tree left
  drawTree(ctx, w * 0.28 + Math.sin(t * 0.25) * 3, h * 0.55, Math.min(w, h) * 0.14)

  // Small bush / hedge accents
  drawBush(ctx, w * 0.55, h * 0.58, Math.min(w, h) * 0.05)
  drawBush(ctx, w * 0.12, h * 0.6, Math.min(w, h) * 0.04)

  // Distant barn hint
  drawBarn(ctx, w * 0.08, h * 0.52, Math.min(w, h) * 0.07)

  // Golden wheat field foreground — stronger wave
  const fieldTop = h * 0.62
  const fieldGrad = ctx.createLinearGradient(0, fieldTop, 0, h)
  fieldGrad.addColorStop(0, '#f0d458')
  fieldGrad.addColorStop(0.25, '#e8c84a')
  fieldGrad.addColorStop(0.55, '#d4a830')
  fieldGrad.addColorStop(1, '#a87818')
  ctx.fillStyle = fieldGrad
  ctx.beginPath()
  ctx.moveTo(0, fieldTop + h * 0.05)
  for (let x = 0; x <= w; x += 12) {
    const wave =
      Math.sin(x * 0.018 + t * 2.2) * 5 + Math.sin(x * 0.04 + t * 1.4) * 3
    ctx.lineTo(x, fieldTop + wave)
  }
  ctx.lineTo(w, h)
  ctx.lineTo(0, h)
  ctx.closePath()
  ctx.fill()

  // Wheat heads / stalks
  ctx.strokeStyle = 'rgba(100, 70, 10, 0.28)'
  ctx.lineWidth = 1.2
  for (let x = 6; x < w; x += 11) {
    const sway = Math.sin(t * 2.5 + x * 0.08) * 4
    const base = fieldTop + 10 + Math.sin(x * 0.05) * 5
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.quadraticCurveTo(x + sway, (base + h) * 0.55, x + sway * 0.3, base)
    ctx.stroke()
    // Tiny head
    ctx.fillStyle = 'rgba(180, 130, 30, 0.35)'
    ctx.beginPath()
    ctx.ellipse(x + sway * 0.3, base - 2, 2.5, 4, sway * 0.05, 0, Math.PI * 2)
    ctx.fill()
  }

  // Foreground grass tufts (nearest parallax)
  drawGrassTufts(ctx, w, h, t)
}

function wrap(x: number, w: number): number {
  const m = ((x % (w + 80)) + (w + 80)) % (w + 80)
  return m - 40
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
): void {
  ctx.save()
  ctx.fillStyle = `rgba(255,255,255,${alpha})`
  ctx.beginPath()
  ctx.ellipse(x, y, size * 0.52, size * 0.22, 0, 0, Math.PI * 2)
  ctx.ellipse(x - size * 0.28, y + 5, size * 0.3, size * 0.17, 0, 0, Math.PI * 2)
  ctx.ellipse(x + size * 0.3, y + 3, size * 0.32, size * 0.19, 0, 0, Math.PI * 2)
  ctx.ellipse(x + size * 0.05, y - 8, size * 0.22, size * 0.14, 0, 0, Math.PI * 2)
  ctx.fill()
  // Soft underside shade
  ctx.fillStyle = `rgba(200,215,230,${alpha * 0.35})`
  ctx.beginPath()
  ctx.ellipse(x, y + size * 0.1, size * 0.4, size * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawHillRange(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amp: number,
  bumps: number,
  seed: number,
  shift = 0,
): void {
  ctx.beginPath()
  ctx.moveTo(0, baseY + amp)
  ctx.lineTo(0, baseY)
  for (let i = 0; i <= bumps; i++) {
    const x1 = ((i + 0.5) / bumps) * w + shift
    const x2 = ((i + 1) / bumps) * w + shift
    const peak = baseY - amp * (0.55 + 0.45 * Math.sin(seed * 3 + i * 1.7))
    ctx.quadraticCurveTo(x1, peak, x2, baseY)
  }
  ctx.lineTo(w, baseY + amp * 3)
  ctx.lineTo(0, baseY + amp * 3)
  ctx.closePath()
  ctx.fill()
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  // Trunk with bark shade
  const trunk = ctx.createLinearGradient(x - s * 0.1, y, x + s * 0.1, y)
  trunk.addColorStop(0, '#5a3818')
  trunk.addColorStop(0.5, '#7a5028')
  trunk.addColorStop(1, '#4a280f')
  ctx.fillStyle = trunk
  ctx.beginPath()
  ctx.moveTo(x - s * 0.09, y)
  ctx.lineTo(x - s * 0.13, y - s * 0.58)
  ctx.lineTo(x + s * 0.13, y - s * 0.58)
  ctx.lineTo(x + s * 0.11, y)
  ctx.closePath()
  ctx.fill()

  // Autumn foliage blobs — richer palette
  const colors = ['#c87828', '#e09838', '#a86020', '#f0b050', '#d88830', '#b87028']
  const blobs = [
    [0, -s * 0.88, s * 0.44],
    [-s * 0.3, -s * 0.72, s * 0.34],
    [s * 0.32, -s * 0.7, s * 0.36],
    [-s * 0.12, -s * 1.08, s * 0.32],
    [s * 0.16, -s * 1.02, s * 0.3],
    [s * 0.02, -s * 0.55, s * 0.28],
    [-s * 0.22, -s * 0.95, s * 0.22],
  ]
  blobs.forEach(([dx, dy, r], i) => {
    ctx.fillStyle = colors[i % colors.length]!
    ctx.beginPath()
    ctx.ellipse(x + dx, y + dy, r, r * 0.82, 0, 0, Math.PI * 2)
    ctx.fill()
  })
  // Leaf highlight
  ctx.fillStyle = 'rgba(255,220,120,0.25)'
  ctx.beginPath()
  ctx.ellipse(x - s * 0.08, y - s * 1.05, s * 0.18, s * 0.12, -0.3, 0, Math.PI * 2)
  ctx.fill()
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const colors = ['#4a7a30', '#3a6a28', '#5a8a38']
  ;[
    [0, 0, 1],
    [-0.7, 0.1, 0.7],
    [0.75, 0.05, 0.75],
  ].forEach(([dx, dy, sc], i) => {
    ctx.fillStyle = colors[i % colors.length]!
    ctx.beginPath()
    ctx.ellipse(x + dx * s, y + dy * s, s * sc, s * sc * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawBarn(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#a84838'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.55, y)
  ctx.lineTo(x - s * 0.55, y - s * 0.7)
  ctx.lineTo(x, y - s * 1.15)
  ctx.lineTo(x + s * 0.55, y - s * 0.7)
  ctx.lineTo(x + s * 0.55, y)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#6a3020'
  ctx.beginPath()
  ctx.moveTo(x - s * 0.6, y - s * 0.68)
  ctx.lineTo(x, y - s * 1.2)
  ctx.lineTo(x + s * 0.6, y - s * 0.68)
  ctx.lineTo(x + s * 0.5, y - s * 0.62)
  ctx.lineTo(x, y - s * 1.05)
  ctx.lineTo(x - s * 0.5, y - s * 0.62)
  ctx.closePath()
  ctx.fill()
  // Door
  ctx.fillStyle = '#3a2010'
  ctx.fillRect(x - s * 0.12, y - s * 0.35, s * 0.24, s * 0.35)
}

function drawWindmill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
): void {
  // Soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath()
  ctx.ellipse(x + 4, y + 4, s * 0.35, s * 0.08, 0, 0, Math.PI * 2)
  ctx.fill()

  // Tower with gradient
  const tower = ctx.createLinearGradient(x - s * 0.3, y, x + s * 0.3, y)
  tower.addColorStop(0, '#6a4a30')
  tower.addColorStop(0.45, '#a08058')
  tower.addColorStop(1, '#5a3a22')
  ctx.fillStyle = tower
  ctx.beginPath()
  ctx.moveTo(x - s * 0.3, y)
  ctx.lineTo(x - s * 0.17, y - s * 1.4)
  ctx.lineTo(x + s * 0.17, y - s * 1.4)
  ctx.lineTo(x + s * 0.3, y)
  ctx.closePath()
  ctx.fill()

  // Brick lines
  ctx.strokeStyle = 'rgba(50,30,15,0.28)'
  ctx.lineWidth = 1
  for (let i = 1; i < 9; i++) {
    const yy = y - (i / 9) * s * 1.4
    const t = i / 9
    const half = s * (0.3 - t * 0.13)
    ctx.beginPath()
    ctx.moveTo(x - half, yy)
    ctx.lineTo(x + half, yy)
    ctx.stroke()
  }

  // Window
  ctx.fillStyle = '#2a4060'
  ctx.fillRect(x - s * 0.06, y - s * 0.7, s * 0.12, s * 0.16)

  // Cap
  const cap = ctx.createLinearGradient(x, y - s * 1.6, x, y - s * 1.3)
  cap.addColorStop(0, '#3a2210')
  cap.addColorStop(1, '#6a4428')
  ctx.fillStyle = cap
  ctx.beginPath()
  ctx.moveTo(x - s * 0.24, y - s * 1.35)
  ctx.lineTo(x, y - s * 1.62)
  ctx.lineTo(x + s * 0.24, y - s * 1.35)
  ctx.closePath()
  ctx.fill()

  const hx = x
  const hy = y - s * 1.18
  const angle = time * 0.00115

  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(angle)
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2)
    // Sail frame
    ctx.fillStyle = '#f8f4e8'
    ctx.strokeStyle = '#4a3a22'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(s * 0.1, -s * 0.1)
    ctx.lineTo(s * 0.14, -s * 0.9)
    ctx.lineTo(-s * 0.06, -s * 0.9)
    ctx.lineTo(-s * 0.1, -s * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Cloth tint
    ctx.fillStyle = 'rgba(220, 210, 180, 0.35)'
    ctx.fill()
    // Slats
    ctx.strokeStyle = 'rgba(80,60,35,0.5)'
    ctx.lineWidth = 1
    for (let k = 1; k < 6; k++) {
      const yy = -s * 0.14 - k * s * 0.13
      ctx.beginPath()
      ctx.moveTo(-s * 0.05, yy)
      ctx.lineTo(s * 0.12, yy)
      ctx.stroke()
    }
  }
  ctx.restore()

  // Hub
  ctx.fillStyle = '#3a2a18'
  ctx.beginPath()
  ctx.arc(hx, hy, s * 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c8a858'
  ctx.beginPath()
  ctx.arc(hx, hy, s * 0.035, 0, Math.PI * 2)
  ctx.fill()
}

function drawGrassTufts(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
): void {
  const y0 = h * 0.92
  for (let i = 0; i < 18; i++) {
    const x = ((i * 73 + Math.floor(t * 20)) % (w + 40)) - 20
    const sway = Math.sin(t * 3 + i) * 3
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(60,100,30,0.45)' : 'rgba(40,80,20,0.4)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, h)
    ctx.quadraticCurveTo(x + sway, y0, x + sway * 1.2, y0 - 18 - (i % 5) * 3)
    ctx.stroke()
  }
}
