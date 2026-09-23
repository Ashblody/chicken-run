import type { Chicken, ChickenPalette, DepthLayer } from './types'

export const LAYERS: DepthLayer[] = [
  { scale: 0.45, speed: 55, points: 5, yMin: 0.28, yMax: 0.42 },
  { scale: 0.7, speed: 90, points: 10, yMin: 0.35, yMax: 0.5 },
  { scale: 1.0, speed: 130, points: 25, yMin: 0.45, yMax: 0.58 },
  { scale: 1.35, speed: 170, points: 50, yMin: 0.52, yMax: 0.62, gold: true },
]

const ART_BASE = `${import.meta.env.BASE_URL}art/sprites/`

const SPRITE_FILES: Record<ChickenPalette, string> = {
  white: 'chicken-white.webp',
  brown: 'chicken-brown.webp',
  ginger: 'chicken-brown.webp',
  speckle: 'chicken-speckle.webp',
  gold: 'chicken-gold.webp',
}

const spriteCache = new Map<string, HTMLImageElement>()
const spriteReady = new Map<string, boolean>()

function loadSprite(file: string): HTMLImageElement {
  let img = spriteCache.get(file)
  if (img) return img
  img = new Image()
  img.decoding = 'async'
  img.onload = () => spriteReady.set(file, true)
  img.onerror = () => spriteReady.set(file, false)
  img.src = `${ART_BASE}${file}`
  spriteCache.set(file, img)
  spriteReady.set(file, false)
  return img
}

function getSprite(palette: ChickenPalette): HTMLImageElement | null {
  const file = SPRITE_FILES[palette]
  const img = loadSprite(file)
  if (spriteReady.get(file) && img.naturalWidth > 0) return img
  return null
}

// Warm-load all variants early
;(['white', 'brown', 'speckle', 'gold'] as const).forEach((p) => loadSprite(SPRITE_FILES[p]))

const PALETTES: Record<
  ChickenPalette,
  { body: string; wing: string; belly: string; tail: string; head: string; accent: string }
> = {
  brown: {
    body: '#c47838',
    wing: '#a85828',
    belly: '#e8b878',
    tail: '#8a4820',
    head: '#d48848',
    accent: '#6a3010',
  },
  ginger: {
    body: '#e8a84a',
    wing: '#d08838',
    belly: '#f5c878',
    tail: '#c87828',
    head: '#f0b85a',
    accent: '#d49848',
  },
  white: {
    body: '#f5f0e8',
    wing: '#e0d8c8',
    belly: '#fffaf0',
    tail: '#d0c8b8',
    head: '#faf6ee',
    accent: '#c8c0b0',
  },
  speckle: {
    body: '#d8c098',
    wing: '#c0a878',
    belly: '#efe0c0',
    tail: '#a88858',
    head: '#e0d0a8',
    accent: '#8a6840',
  },
  gold: {
    body: '#ffd700',
    wing: '#e8b820',
    belly: '#ffe878',
    tail: '#d4a010',
    head: '#ffe040',
    accent: '#c89808',
  },
}

let nextId = 1

function pickPalette(layer: DepthLayer, goldBoost = 0): ChickenPalette {
  if (layer.gold) {
    // Closest layer is often golden
    if (Math.random() < 0.55 + goldBoost * 0.3) return 'gold'
  } else if (goldBoost > 0 && Math.random() < goldBoost * 0.35) {
    return 'gold'
  }
  const pool: ChickenPalette[] = ['brown', 'ginger', 'white', 'speckle', 'ginger', 'brown']
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function spawnChicken(
  w: number,
  h: number,
  opts?: { goldBoost?: number; forceGoldLayer?: boolean },
): Chicken {
  let layer: DepthLayer
  if (opts?.forceGoldLayer || (opts?.goldBoost && Math.random() < opts.goldBoost)) {
    layer = LAYERS[3]!
  } else {
    layer = LAYERS[Math.floor(Math.random() * LAYERS.length)]!
  }
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
    palette: pickPalette(layer, opts?.goldBoost ?? 0),
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

export function isGoldChicken(c: Chicken): boolean {
  return c.palette === 'gold' || !!c.layer.gold
}

export function drawChicken(ctx: CanvasRenderingContext2D, c: Chicken): void {
  if (c.state === 'gone') return
  const s = c.layer.scale
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.scale(c.facing, 1)

  if (c.state === 'poof') {
    drawPoof(ctx, c.poofT, s, c.palette === 'gold')
    ctx.restore()
    return
  }

  const bodyR = 22 * s
  const wingPhase = c.state === 'flying' ? Math.sin(c.flap) : 0.3

  // Soft ground shadow
  if (c.state === 'flying') {
    ctx.fillStyle = 'rgba(0,0,0,0.14)'
    ctx.beginPath()
    ctx.ellipse(0, bodyR + 16 * s, bodyR * 0.95, 5.5 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Gold glow
  if (c.palette === 'gold' && c.state === 'flying') {
    const g = ctx.createRadialGradient(0, 0, bodyR * 0.3, 0, 0, bodyR * 2.2)
    g.addColorStop(0, 'rgba(255,220,80,0.35)')
    g.addColorStop(1, 'rgba(255,200,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, bodyR * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  const sprite = getSprite(c.palette)
  if (sprite) {
    drawChickenSprite(ctx, c, sprite, s, bodyR, wingPhase)
  } else {
    drawChickenProcedural(ctx, c, s, bodyR, wingPhase)
  }

  // Tiny crown sparkles for gold
  if (c.palette === 'gold' && c.state === 'flying') {
    const sparkle = (Math.sin(c.flap * 0.7) + 1) * 0.5
    ctx.fillStyle = `rgba(255,255,200,${0.5 + sparkle * 0.5})`
    for (const [dx, dy] of [
      [-bodyR * 0.2, -bodyR * 1.35],
      [bodyR * 0.9, -bodyR * 1.1],
      [bodyR * 0.1, -bodyR * 0.2],
    ] as const) {
      drawSpark(ctx, dx, dy, 3.5 * s * (0.7 + sparkle * 0.4))
    }
  }

  ctx.restore()
}

function drawChickenSprite(
  ctx: CanvasRenderingContext2D,
  c: Chicken,
  img: HTMLImageElement,
  s: number,
  bodyR: number,
  wingPhase: number,
): void {
  const targetH = bodyR * 3.15
  const aspect = img.naturalWidth / img.naturalHeight
  const drawH = targetH
  const drawW = drawH * aspect

  const bob = c.state === 'flying' ? Math.sin(c.flap * 0.5) * 2.5 * s : 0
  const flapRot = c.state === 'flying' ? wingPhase * 0.08 : 0
  const flapScaleY = c.state === 'flying' ? 1 + wingPhase * 0.04 : 1
  const fallRot = c.state === 'falling' || c.state === 'hit' ? c.hitT * 2.2 : 0

  ctx.save()
  ctx.translate(0, bob)
  ctx.rotate(flapRot + fallRot * c.facing)
  ctx.scale(1, flapScaleY)

  // Anchor roughly at body center of the standing sprite
  ctx.drawImage(img, -drawW * 0.48, -drawH * 0.58, drawW, drawH)

  if (c.state === 'hit' || c.state === 'falling') {
    // X eyes overlay
    const ex = drawW * 0.12
    const ey = -drawH * 0.22
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2.5 * s
    ctx.lineCap = 'round'
    for (const ox of [-6 * s, 7 * s]) {
      ctx.beginPath()
      ctx.moveTo(ex + ox - 4 * s, ey - 4 * s)
      ctx.lineTo(ex + ox + 4 * s, ey + 4 * s)
      ctx.moveTo(ex + ox + 4 * s, ey - 4 * s)
      ctx.lineTo(ex + ox - 4 * s, ey + 4 * s)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawChickenProcedural(
  ctx: CanvasRenderingContext2D,
  c: Chicken,
  s: number,
  bodyR: number,
  wingPhase: number,
): void {
  const pal = PALETTES[c.palette]

  // Far wing (behind body)
  ctx.fillStyle = pal.wing
  ctx.save()
  ctx.translate(-6 * s, -2 * s)
  ctx.rotate(-0.55 + wingPhase * 0.75)
  ctx.beginPath()
  ctx.ellipse(0, 0, 15 * s, 7.5 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = pal.accent
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 1 * s
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(-4 * s, i * 3 * s)
    ctx.quadraticCurveTo(4 * s, i * 2 * s, 12 * s, i * 4 * s)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Body
  ctx.fillStyle = pal.body
  ctx.beginPath()
  ctx.ellipse(0, 2 * s, bodyR, bodyR * 0.85, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.beginPath()
  ctx.ellipse(-4 * s, -4 * s, bodyR * 0.45, bodyR * 0.28, -0.4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = pal.belly
  ctx.beginPath()
  ctx.ellipse(3 * s, 9 * s, bodyR * 0.55, bodyR * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()

  if (c.palette === 'speckle') {
    ctx.fillStyle = 'rgba(90,60,30,0.35)'
    for (const [dx, dy, r] of [
      [-8, 0, 2.2],
      [6, 6, 1.8],
      [-2, 10, 2],
      [10, -2, 1.6],
      [-12, 8, 1.5],
    ] as const) {
      ctx.beginPath()
      ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Near wing
  ctx.fillStyle = pal.wing
  ctx.save()
  ctx.translate(5 * s, 0)
  ctx.rotate(0.45 - wingPhase * 0.9)
  ctx.beginPath()
  ctx.ellipse(0, 0, 17 * s, 8.5 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = pal.accent
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1.1 * s
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath()
    ctx.moveTo(-6 * s, i * 3.5 * s)
    ctx.quadraticCurveTo(2 * s, i * 2 * s, 12 * s, i * 4 * s)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()

  const tailColors = [pal.tail, pal.accent, pal.wing]
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = tailColors[i]!
    ctx.beginPath()
    const ox = -bodyR * (0.55 + i * 0.08)
    const tipY = -18 * s - i * 4 * s
    ctx.moveTo(ox, -2 * s)
    ctx.quadraticCurveTo(ox - bodyR * 0.85, tipY, ox + 4 * s, -12 * s - i * 2 * s)
    ctx.quadraticCurveTo(ox - bodyR * 0.5, -4 * s, ox + 2 * s, 4 * s)
    ctx.closePath()
    ctx.fill()
  }

  ctx.fillStyle = pal.head
  ctx.beginPath()
  ctx.arc(bodyR * 0.55, -bodyR * 0.55, 14 * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,120,100,0.25)'
  ctx.beginPath()
  ctx.ellipse(bodyR * 0.72, -bodyR * 0.4, 4 * s, 3 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#e22828'
  ctx.beginPath()
  ctx.moveTo(bodyR * 0.32, -bodyR * 0.92)
  ctx.quadraticCurveTo(bodyR * 0.28, -bodyR * 1.38, bodyR * 0.48, -bodyR * 1.08)
  ctx.quadraticCurveTo(bodyR * 0.55, -bodyR * 1.45, bodyR * 0.68, -bodyR * 1.05)
  ctx.quadraticCurveTo(bodyR * 0.82, -bodyR * 1.42, bodyR * 0.9, -bodyR * 0.98)
  ctx.quadraticCurveTo(bodyR * 1.0, -bodyR * 1.22, bodyR * 0.88, -bodyR * 0.85)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#d02020'
  ctx.beginPath()
  ctx.ellipse(bodyR * 0.78, -bodyR * 0.22, 4.2 * s, 6.5 * s, 0.25, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ff9a20'
  ctx.beginPath()
  ctx.moveTo(bodyR * 0.85, -bodyR * 0.52)
  ctx.lineTo(bodyR * 1.4, -bodyR * 0.42)
  ctx.lineTo(bodyR * 0.85, -bodyR * 0.28)
  ctx.closePath()
  ctx.fill()

  const ex = bodyR * 0.55
  const ey = -bodyR * 0.65
  if (c.state === 'hit' || c.state === 'falling') {
    ctx.strokeStyle = '#222'
    ctx.lineWidth = 2.5 * s
    ctx.lineCap = 'round'
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
      ctx.ellipse(ex + ox, ey, 5.2 * s, 5.5 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = c.palette === 'gold' ? '#5a3a08' : '#2a1810'
      ctx.beginPath()
      ctx.arc(ex + ox + 1.4 * s, ey + 0.6 * s, 2.4 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#111'
      ctx.beginPath()
      ctx.arc(ex + ox + 1.6 * s, ey + 0.7 * s, 1.3 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(ex + ox + 2.4 * s, ey - 1.2 * s, 1.1 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (c.state === 'flying') {
    ctx.strokeStyle = '#e89820'
    ctx.lineWidth = 2.2 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(-4 * s, bodyR * 0.7)
    ctx.lineTo(-2 * s, bodyR * 1.08)
    ctx.moveTo(6 * s, bodyR * 0.7)
    ctx.lineTo(8 * s, bodyR * 1.08)
    ctx.stroke()
  }
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.lineTo(x + r * 0.25, y - r * 0.25)
  ctx.lineTo(x + r, y)
  ctx.lineTo(x + r * 0.25, y + r * 0.25)
  ctx.lineTo(x, y + r)
  ctx.lineTo(x - r * 0.25, y + r * 0.25)
  ctx.lineTo(x - r, y)
  ctx.lineTo(x - r * 0.25, y - r * 0.25)
  ctx.closePath()
  ctx.fill()
}

function drawPoof(
  ctx: CanvasRenderingContext2D,
  t: number,
  s: number,
  gold: boolean,
): void {
  const p = Math.min(1, t / 0.35)
  const n = 10
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const dist = p * 44 * s
    const r = (1 - p) * 11 * s
    ctx.fillStyle = gold
      ? `rgba(255,220,80,${1 - p})`
      : `rgba(255,220,150,${1 - p})`
    ctx.beginPath()
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = `rgba(255,255,255,${1 - p})`
  ctx.beginPath()
  ctx.arc(0, 0, (1 - p) * 20 * s, 0, Math.PI * 2)
  ctx.fill()
}
