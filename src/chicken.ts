import type { Chicken, ChickenPalette, DepthLayer, SpriteKey } from './types'

/** Sky layers for flying chickens. Farther (smaller scale) = more points. */
export const LAYERS: DepthLayer[] = [
  { scale: 0.45, speed: 55, points: 50, yMin: 0.28, yMax: 0.42 },
  { scale: 0.7, speed: 90, points: 25, yMin: 0.35, yMax: 0.5 },
  { scale: 1.0, speed: 130, points: 10, yMin: 0.45, yMax: 0.58 },
  { scale: 1.35, speed: 170, points: 5, yMin: 0.52, yMax: 0.62 },
]

/** Ground rows (feet y as a fraction of the canvas height). Farther row = smaller = more points. */
export const GROUND_ROWS: DepthLayer[] = [
  { scale: 0.62, speed: 28, points: 0, yMin: 0.66, yMax: 0.66 },
  { scale: 0.8, speed: 38, points: 0, yMin: 0.73, yMax: 0.73 },
  { scale: 1.0, speed: 50, points: 0, yMin: 0.8, yMax: 0.8 },
]

/** Base points per ground kind, indexed by ground row (far, mid, near). */
const GROUND_POINTS = {
  hen: [25, 20, 15],
  rooster: [30, 25, 20],
  crossbow: [50, 45, 40],
} as const

export const MAX_AIR = 10
export const MAX_GROUND = 4
export const GROUND_SHARE = 0.35

const ART_BASE = `${import.meta.env.BASE_URL}art/sprites/`

interface SpriteInfo {
  file: string
  /** natural width / height of the webp */
  aspect: number
  /** direction the artwork faces (1 = right, -1 = left) */
  native: 1 | -1
  /** ground: height relative to the row height unit */
  hFactor: number
}

const SPRITES: Record<SpriteKey, SpriteInfo> = {
  'fly-white': { file: 'fly-white.webp', aspect: 512 / 488, native: 1, hFactor: 1 },
  'fly-speckled': { file: 'fly-speckled.webp', aspect: 512 / 416, native: -1, hFactor: 1 },
  'fly-golden': { file: 'fly-golden.webp', aspect: 512 / 288, native: 1, hFactor: 1 },
  'hen-speckled': { file: 'hen-speckled.webp', aspect: 377 / 417, native: 1, hFactor: 0.82 },
  'hen-golden': { file: 'hen-golden.webp', aspect: 339 / 443, native: 1, hFactor: 0.82 },
  'rooster-white': { file: 'rooster-white.webp', aspect: 378 / 512, native: 1, hFactor: 1 },
  'rooster-crossbow': { file: 'rooster-crossbow.webp', aspect: 489 / 512, native: 1, hFactor: 0.92 },
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

function getSprite(key: SpriteKey): HTMLImageElement | null {
  const file = SPRITES[key].file
  const img = loadSprite(file)
  if (spriteReady.get(file) && img.naturalWidth > 0) return img
  return null
}

// Warm-load everything early
;(Object.keys(SPRITES) as SpriteKey[]).forEach((k) => loadSprite(SPRITES[k].file))

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

export interface SpawnOpts {
  goldBoost?: number
  forceGoldLayer?: boolean
  /** Start already on screen (used for the first chickens of a round). */
  onScreen?: boolean
}

function wantsGold(opts?: SpawnOpts): boolean {
  if (opts?.forceGoldLayer) return true
  const boost = opts?.goldBoost ?? 0
  if (boost > 0) return Math.random() < Math.min(0.9, 0.2 + boost) || Math.random() < boost
  return Math.random() < 0.1
}

function baseChicken() {
  return {
    turned: false,
    id: nextId++,
    flap: Math.random() * Math.PI * 2,
    hitT: 0,
    fallVy: 0,
    poofT: 0,
    wobble: Math.random() * Math.PI * 2,
    walkPhase: Math.random() * Math.PI * 2,
    pauseT: 0,
    nextPauseT: 0,
  }
}

/** Flying chicken crossing the sky. */
export function spawnAirChicken(w: number, h: number, opts?: SpawnOpts): Chicken {
  const layer = LAYERS[Math.floor(Math.random() * LAYERS.length)]!
  const gold = wantsGold(opts)
  const palette: ChickenPalette = gold ? 'gold' : Math.random() < 0.5 ? 'white' : 'speckle'
  const sprite: SpriteKey = gold ? 'fly-golden' : palette === 'white' ? 'fly-white' : 'fly-speckled'
  const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1
  const speed = layer.speed * (0.85 + Math.random() * 0.35)
  const y = h * (layer.yMin + Math.random() * (layer.yMax - layer.yMin))
  const margin = 80 * layer.scale
  const x = opts?.onScreen
    ? w * (0.15 + Math.random() * 0.7)
    : facing === 1
      ? -margin
      : w + margin
  return {
    ...baseChicken(),
    x,
    y,
    baseY: y,
    vx: facing * speed,
    facing,
    layer,
    state: 'flying',
    palette,
    sprite,
    domain: 'air',
    points: layer.points,
  }
}

/** Hen / rooster walking along the meadow floor. */
export function spawnGroundChicken(w: number, h: number, opts?: SpawnOpts): Chicken {
  const row = GROUND_ROWS[Math.floor(Math.random() * GROUND_ROWS.length)]!
  const rowIdx = GROUND_ROWS.indexOf(row)
  let sprite: SpriteKey
  let kind: keyof typeof GROUND_POINTS
  if (wantsGold(opts)) {
    sprite = 'hen-golden'
    kind = 'hen'
  } else {
    const r = Math.random()
    if (r < 0.08) {
      sprite = 'rooster-crossbow'
      kind = 'crossbow'
    } else if (r < 0.54) {
      sprite = 'rooster-white'
      kind = 'rooster'
    } else {
      sprite = 'hen-speckled'
      kind = 'hen'
    }
  }
  const palette: ChickenPalette =
    sprite === 'hen-golden' ? 'gold' : sprite === 'hen-speckled' ? 'speckle' : sprite === 'rooster-white' ? 'white' : 'brown'
  const facing: 1 | -1 = Math.random() < 0.5 ? 1 : -1
  const speed = row.speed * (0.8 + Math.random() * 0.4)
  const feetY = h * row.yMin + (Math.random() - 0.5) * h * 0.012
  const margin = 70 * row.scale
  const x = opts?.onScreen
    ? w * (0.12 + Math.random() * 0.76)
    : facing === 1
      ? -margin
      : w + margin
  return {
    ...baseChicken(),
    x,
    y: feetY,
    baseY: feetY,
    vx: facing * speed,
    facing,
    layer: row,
    state: 'walking',
    palette,
    sprite,
    domain: 'ground',
    points: GROUND_POINTS[kind][rowIdx]!,
    nextPauseT: 1 + Math.random() * 3,
  }
}

/** Generic spawn (menu / tests): ~35% ground, 65% air. */
export function spawnChicken(w: number, h: number, opts?: SpawnOpts): Chicken {
  return Math.random() < GROUND_SHARE
    ? spawnGroundChicken(w, h, opts)
    : spawnAirChicken(w, h, opts)
}

/** True while the chicken can still be shot. */
export function isTargetable(c: Chicken): boolean {
  return c.state === 'flying' || c.state === 'walking' || c.state === 'pecking'
}

export function updateChicken(c: Chicken, dt: number, w: number, h: number): void {
  if (c.state === 'flying') {
    c.x += c.vx * dt
    c.flap += dt * 12
    c.wobble += dt * 3
    c.y += Math.sin(c.wobble) * 18 * dt
  } else if (c.state === 'walking') {
    c.x += c.vx * dt
    // steps get quicker with the walking speed
    c.walkPhase += dt * (6 + Math.abs(c.vx) * 0.09)
    c.nextPauseT -= dt
    if (c.nextPauseT <= 0) {
      c.state = 'pecking'
      c.pauseT = 0.8 + Math.random() * 1.0
    }
  } else if (c.state === 'pecking') {
    c.pauseT -= dt
    c.walkPhase += dt * 11
    if (c.pauseT <= 0) {
      c.state = 'walking'
      c.nextPauseT = 1.5 + Math.random() * 3.5
      // sometimes turn around (only well inside the screen so nobody gets stuck off-screen)
      if (Math.random() < 0.3 && c.x > w * 0.2 && c.x < w * 0.8) {
        c.facing = (c.facing * -1) as 1 | -1
        c.vx = -c.vx
      }
    }
  } else if (c.state === 'hit') {
    c.hitT += dt
    if (c.hitT > 0.25) {
      c.state = 'falling'
      c.fallVy = c.domain === 'ground' ? -260 : 40 // ground: little hop up, then tumble
    }
  } else if (c.state === 'falling') {
    c.hitT += dt
    if (c.domain === 'ground') {
      c.fallVy += 1100 * dt
      c.y += c.fallVy * dt
      c.x += c.facing * 25 * dt
      if (c.fallVy > 0 && c.y >= c.baseY) {
        c.y = c.baseY
        c.state = 'poof'
        c.poofT = 0
      }
    } else {
      c.fallVy += 520 * dt
      c.y += c.fallVy * dt
      c.x += c.facing * 20 * dt
      if (c.y > h * 0.72 || c.hitT > 1.4) {
        c.state = 'poof'
        c.poofT = 0
      }
    }
  } else if (c.state === 'poof') {
    c.poofT += dt
    if (c.poofT > 0.35) c.state = 'gone'
  }
}

/** Drawn size of the chicken sprite in canvas px. */
function spriteSize(c: Chicken, canvasH: number): { w: number; h: number } {
  const info = SPRITES[c.sprite]
  const s = c.layer.scale
  if (c.domain === 'air') {
    let dw = 120 * s
    let dh = dw / info.aspect
    const maxH = 100 * s
    if (dh > maxH) {
      dh = maxH
      dw = dh * info.aspect
    }
    return { w: dw, h: dh }
  }
  const unit = Math.min(150, Math.max(96, canvasH * 0.24))
  const dh = unit * s * info.hFactor
  return { w: dh * info.aspect, h: dh }
}

let lastCanvasH = 600

/** Body centre (used for hit testing, floaters and the poof). */
export function chickenCenter(c: Chicken): { x: number; y: number } {
  if (c.domain === 'ground') return { x: c.x, y: c.y - spriteSize(c, lastCanvasH).h * 0.5 }
  return { x: c.x, y: c.y }
}

export function chickenHitRadius(c: Chicken): number {
  const { w, h } = spriteSize(c, lastCanvasH)
  return Math.max(18, Math.sqrt(w * h) * 0.42)
}

export function isGoldChicken(c: Chicken): boolean {
  return c.palette === 'gold'
}

export function drawChicken(ctx: CanvasRenderingContext2D, c: Chicken, canvasH: number): void {
  if (c.state === 'gone') return
  lastCanvasH = canvasH
  const { w: dw, h: dh } = spriteSize(c, canvasH)
  const ground = c.domain === 'ground'
  const gold = c.palette === 'gold'
  const s = dh / 69 // "legacy" scale used by the procedural fallback / effects
  const center = chickenCenter(c)

  if (c.state === 'poof') {
    ctx.save()
    ctx.translate(center.x, center.y)
    drawPoof(ctx, c.poofT, s, gold)
    ctx.restore()
    return
  }

  // Soft shadow on the grass (ground chickens stay tied to the floor, also when tumbling)
  if (ground) {
    const lift = Math.max(0, c.baseY - c.y)
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.06, 0.24 - lift * 0.002)})`
    ctx.beginPath()
    ctx.ellipse(c.x, c.baseY, dw * 0.4, Math.max(3, dh * 0.055), 0, 0, Math.PI * 2)
    ctx.fill()
  }

  const flying = c.state === 'flying'
  const walking = c.state === 'walking' || c.state === 'pecking'
  const tumbling = c.state === 'hit' || c.state === 'falling'
  const sprite = getSprite(c.sprite)
  const info = SPRITES[c.sprite]
  const flipX = c.facing * info.native

  // Gold glow
  if (gold && (flying || walking)) {
    const r = Math.max(dw, dh) * 0.75
    const g = ctx.createRadialGradient(center.x, center.y, r * 0.15, center.x, center.y, r)
    g.addColorStop(0, 'rgba(255,220,80,0.35)')
    g.addColorStop(1, 'rgba(255,200,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(center.x, center.y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.save()
  if (walking) {
    // waddle: small hop + tilt around the feet, peck = nod forward
    const hop = Math.abs(Math.sin(c.walkPhase)) * dh * 0.035
    let tilt = Math.sin(c.walkPhase) * 0.06
    if (c.state === 'pecking') {
      const nod = 0.5 + 0.5 * Math.sin(c.walkPhase)
      tilt = nod * 0.32
    }
    ctx.translate(c.x, c.y - (c.state === 'pecking' ? 0 : hop))
    ctx.rotate(tilt * c.facing)
    ctx.scale(flipX, 1)
    if (sprite) ctx.drawImage(sprite, -dw / 2, -dh, dw, dh)
    else {
      ctx.translate(0, -dh * 0.5)
      ctx.scale(c.facing / flipX, 1)
      drawChickenProcedural(ctx, c, s, 22 * s, 0.3)
    }
  } else {
    // air (flapping) or tumbling (hit / falling) — pivot around the body centre
    const phase = Math.sin(c.flap)
    const bob = flying ? Math.sin(c.flap * 0.5) * 3 * c.layer.scale : 0
    const flapRot = flying ? phase * 0.09 : 0
    const flapScaleY = flying ? 1 + phase * 0.07 : 1
    let rot = 0
    if (c.state === 'hit') rot = Math.sin(c.hitT * 60) * 0.12
    else if (c.state === 'falling') rot = c.hitT * (ground ? 5 : 2.2) * c.facing
    ctx.translate(center.x, center.y + bob)
    ctx.rotate(flapRot * c.facing + rot)
    ctx.scale(flipX, flapScaleY)
    if (sprite) ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh)
    else {
      ctx.scale(c.facing / flipX, 1)
      drawChickenProcedural(ctx, c, s, 22 * s, phase)
    }
  }
  ctx.restore()

  if (tumbling) {
    // dizzy stars around the head
    ctx.fillStyle = '#ffe066'
    const t = c.hitT * 9
    for (let i = 0; i < 3; i++) {
      const a = t + (i * Math.PI * 2) / 3
      drawSpark(ctx, center.x + Math.cos(a) * dw * 0.4, center.y - dh * 0.38 + Math.sin(a) * dh * 0.08, 4 * s + 2)
    }
  }

  if (gold && (flying || walking)) {
    const sparkle = (Math.sin(c.flap * 0.7 + c.walkPhase * 0.7) + 1) * 0.5
    ctx.fillStyle = `rgba(255,255,200,${0.5 + sparkle * 0.5})`
    for (const [dx, dy] of [
      [-0.3, -0.42],
      [0.32, -0.3],
      [0.05, 0.05],
    ] as const) {
      drawSpark(ctx, center.x + dx * dw, center.y + dy * dh, 3.5 * s * (0.7 + sparkle * 0.4) + 1)
    }
  }
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
