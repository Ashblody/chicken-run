import type { Chicken, DepthLayer } from './types'

export const LAYERS: DepthLayer[] = [
  { scale: 0.45, speed: 55, points: 5, yMin: 0.28, yMax: 0.42 },
  { scale: 0.7, speed: 90, points: 10, yMin: 0.35, yMax: 0.5 },
  { scale: 1.0, speed: 130, points: 25, yMin: 0.45, yMax: 0.58 },
  { scale: 1.35, speed: 170, points: 50, yMin: 0.52, yMax: 0.62 },
]

let nextId = 1

export function spawnChicken(w: number, h: number): Chicken {
  const layer = LAYERS[Math.floor(Math.random() * LAYERS.length)]!
  const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1
  const speed = layer.speed * (0.85 + Math.random() * 0.35)
  const y = h * (layer.yMin + Math.random() * (layer.yMax - layer.yMin))
  const margin = 80 * layer.scale
  const x = facing === 1 ? -margin : w + margin
  return {
    id: nextId++,
    x,
    y,
    vx: facing * speed,
    facing,
    layer,
    state: 'flying',
    flap: Math.random() * Math.PI * 2,
    hitT: 0,
    fallVy: 0,
    poofT: 0,
    wobble: Math.random() * Math.PI * 2,
  }
}

export function updateChicken(c: Chicken, dt: number, h: number): void {
  if (c.state === 'flying') {
    c.x += c.vx * dt
    c.flap += dt * 12
    c.wobble += dt * 3
    c.y += Math.sin(c.wobble) * 18 * dt
  } else if (c.state === 'hit') {
    c.hitT += dt
    if (c.hitT > 0.25) {
      c.state = 'falling'
      c.fallVy = 40
    }
  } else if (c.state === 'falling') {
    c.fallVy += 520 * dt
    c.y += c.fallVy * dt
    c.x += c.facing * 20 * dt
    if (c.y > h * 0.72 || c.hitT > 1.4) {
      c.state = 'poof'
      c.poofT = 0
    }
    c.hitT += dt
  } else if (c.state === 'poof') {
    c.poofT += dt
    if (c.poofT > 0.35) c.state = 'gone'
  }
}

export function chickenHitRadius(c: Chicken): number {
  return 28 * c.layer.scale
}

export function drawChicken(ctx: CanvasRenderingContext2D, c: Chicken): void {
  if (c.state === 'gone') return
  const s = c.layer.scale
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.scale(c.facing, 1)

  if (c.state === 'poof') {
    drawPoof(ctx, c.poofT, s)
    ctx.restore()
    return
  }

  const bodyR = 22 * s
  const wingPhase = c.state === 'flying' ? Math.sin(c.flap) : 0.3

  // Shadow
  if (c.state === 'flying') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.beginPath()
    ctx.ellipse(0, bodyR + 14 * s, bodyR * 0.9, 5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Far wing
  ctx.fillStyle = '#d49848'
  ctx.save()
  ctx.translate(-6 * s, -2 * s)
  ctx.rotate(-0.6 + wingPhase * 0.7)
  ctx.beginPath()
  ctx.ellipse(0, 0, 14 * s, 7 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Body
  ctx.fillStyle = '#e8a84a'
  ctx.beginPath()
  ctx.ellipse(0, 2 * s, bodyR, bodyR * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()

  // Belly
  ctx.fillStyle = '#f5c878'
  ctx.beginPath()
  ctx.ellipse(2 * s, 8 * s, bodyR * 0.55, bodyR * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()

  // Near wing
  ctx.fillStyle = '#d08838'
  ctx.save()
  ctx.translate(4 * s, 0)
  ctx.rotate(0.4 - wingPhase * 0.85)
  ctx.beginPath()
  ctx.ellipse(0, 0, 16 * s, 8 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // Tail
  ctx.fillStyle = '#c87828'
  ctx.beginPath()
  ctx.moveTo(-bodyR * 0.7, -4 * s)
  ctx.quadraticCurveTo(-bodyR * 1.4, -18 * s, -bodyR * 0.5, -14 * s)
  ctx.quadraticCurveTo(-bodyR * 1.2, -8 * s, -bodyR * 0.6, 2 * s)
  ctx.closePath()
  ctx.fill()

  // Head
  ctx.fillStyle = '#f0b85a'
  ctx.beginPath()
  ctx.arc(bodyR * 0.55, -bodyR * 0.55, 14 * s, 0, Math.PI * 2)
  ctx.fill()

  // Comb
  ctx.fillStyle = '#e22828'
  ctx.beginPath()
  ctx.moveTo(bodyR * 0.35, -bodyR * 0.95)
  ctx.quadraticCurveTo(bodyR * 0.4, -bodyR * 1.35, bodyR * 0.55, -bodyR * 1.05)
  ctx.quadraticCurveTo(bodyR * 0.7, -bodyR * 1.4, bodyR * 0.8, -bodyR * 1.0)
  ctx.quadraticCurveTo(bodyR * 0.95, -bodyR * 1.3, bodyR * 0.85, -bodyR * 0.9)
  ctx.closePath()
  ctx.fill()

  // Wattle
  ctx.beginPath()
  ctx.ellipse(bodyR * 0.75, -bodyR * 0.25, 4 * s, 6 * s, 0.2, 0, Math.PI * 2)
  ctx.fill()

  // Beak
  ctx.fillStyle = '#ff8800'
  ctx.beginPath()
  ctx.moveTo(bodyR * 0.85, -bodyR * 0.5)
  ctx.lineTo(bodyR * 1.35, -bodyR * 0.42)
  ctx.lineTo(bodyR * 0.85, -bodyR * 0.3)
  ctx.closePath()
  ctx.fill()

  // Eyes
  const ex = bodyR * 0.55
  const ey = -bodyR * 0.65
  if (c.state === 'hit' || c.state === 'falling') {
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2.5 * s
    ctx.lineCap = 'round'
    // X eyes
    for (const ox of [-5 * s, 6 * s]) {
      ctx.beginPath()
      ctx.moveTo(ex + ox - 4 * s, ey - 4 * s)
      ctx.lineTo(ex + ox + 4 * s, ey + 4 * s)
      ctx.moveTo(ex + ox + 4 * s, ey - 4 * s)
      ctx.lineTo(ex + ox - 4 * s, ey + 4 * s)
      ctx.stroke()
    }
  } else {
    for (const ox of [-5 * s, 6 * s]) {
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex + ox, ey, 5 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#222'
      ctx.beginPath()
      ctx.arc(ex + ox + 1.2 * s, ey + 0.5 * s, 2.2 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex + ox + 2 * s, ey - 1 * s, 0.9 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Legs (tucked while flying)
  if (c.state === 'flying') {
    ctx.strokeStyle = '#e8a020'
    ctx.lineWidth = 2 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-4 * s, bodyR * 0.7)
    ctx.lineTo(-2 * s, bodyR * 1.05)
    ctx.moveTo(6 * s, bodyR * 0.7)
    ctx.lineTo(8 * s, bodyR * 1.05)
    ctx.stroke()
  }

  ctx.restore()
}

function drawPoof(ctx: CanvasRenderingContext2D, t: number, s: number): void {
  const p = Math.min(1, t / 0.35)
  const n = 8
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const dist = p * 40 * s
    const r = (1 - p) * 10 * s
    ctx.fillStyle = `rgba(255,220,150,${1 - p})`
    ctx.beginPath()
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(255,255,255,${1 - p})`
  ctx.beginPath()
  ctx.arc(0, 0, (1 - p) * 18 * s, 0, Math.PI * 2)
  ctx.fill()
}
