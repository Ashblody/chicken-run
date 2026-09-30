/** Lightweight particle system: feathers, gold sparkles and muzzle puffs. Capped for performance. */

export const MAX_PARTICLES = 150

type Kind = 'feather' | 'spark' | 'puff'

interface Particle {
  kind: Kind
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  life: number
  max: number
  size: number
  color: string
  phase: number
}

const FEATHER_COLORS = ['#ffffff', '#fff6e6', '#f2e2c4', '#e6c99a', '#d9b27a', '#f3d98a']
const GOLD_FEATHERS = ['#ffd84a', '#ffe680', '#f5c020', '#fff2b0']
const SPARK_COLORS = ['#fff6a0', '#ffd700', '#ffffff', '#ffe066']

export class Particles {
  private list: Particle[] = []

  get count(): number {
    return this.list.length
  }

  clear(): void {
    this.list.length = 0
  }

  private add(p: Particle): void {
    if (this.list.length >= MAX_PARTICLES) this.list.shift() // drop the oldest
    this.list.push(p)
  }

  /** Feather burst at a hit. `scale` ~ chicken size (0.6..1.4). `mul` 0 disables (reduced motion). */
  hit(x: number, y: number, gold: boolean, scale: number, mul: number): void {
    if (mul <= 0) return
    const nFeathers = Math.round((gold ? 12 : 14) * mul)
    for (let i = 0; i < nFeathers; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 90 + Math.random() * 220
      const palette = gold && Math.random() < 0.7 ? GOLD_FEATHERS : FEATHER_COLORS
      this.add({
        kind: 'feather',
        x: x + (Math.random() - 0.5) * 14 * scale,
        y: y + (Math.random() - 0.5) * 14 * scale,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 110,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 12,
        life: 0.8,
        max: 0.8,
        size: (7 + Math.random() * 6) * scale,
        color: palette[(Math.random() * palette.length) | 0]!,
        phase: Math.random() * 6.28,
      })
    }
    if (gold) {
      const nSparks = Math.round(16 * mul)
      for (let i = 0; i < nSparks; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = 60 + Math.random() * 200
        this.add({
          kind: 'spark',
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 40,
          rot: Math.random() * 1.5,
          vr: (Math.random() - 0.5) * 6,
          life: 0.7 + Math.random() * 0.1,
          max: 0.8,
          size: (3 + Math.random() * 4) * scale,
          color: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0]!,
          phase: 0,
        })
      }
    }
  }

  /** Small smoke puff at the muzzle / pointer. */
  puff(x: number, y: number, mul: number): void {
    if (mul <= 0) return
    const n = Math.max(2, Math.round(5 * mul))
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 20 + Math.random() * 50
      this.add({
        kind: 'puff',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 15,
        rot: 0,
        vr: 0,
        life: 0.3,
        max: 0.3,
        size: 5 + Math.random() * 4,
        color: '#f4efe4',
        phase: 0,
      })
    }
  }

  update(dt: number): void {
    const list = this.list
    let w = 0
    for (let i = 0; i < list.length; i++) {
      const p = list[i]!
      p.life -= dt
      if (p.life <= 0) continue
      if (p.kind === 'feather') {
        p.vy += 520 * dt // gravity
        const drag = Math.exp(-2.2 * dt)
        p.vx *= drag
        p.vy *= Math.exp(-0.9 * dt)
        p.phase += dt * 14
      } else if (p.kind === 'spark') {
        p.vy += 220 * dt
        const drag = Math.exp(-2.5 * dt)
        p.vx *= drag
        p.vy *= drag
      } else {
        const drag = Math.exp(-4 * dt)
        p.vx *= drag
        p.vy *= drag
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      list[w++] = p
    }
    list.length = w
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const k = p.life / p.max // 1 -> 0
      ctx.save()
      ctx.translate(p.x, p.y)
      if (p.kind === 'feather') {
        ctx.globalAlpha = Math.min(1, k * 1.8)
        ctx.rotate(p.rot)
        ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.phase))) // flutter
        ctx.fillStyle = p.color
        ctx.strokeStyle = 'rgba(90,60,20,0.45)'
        ctx.lineWidth = 0.8
        ctx.beginPath()
        ctx.ellipse(0, 0, p.size, p.size * 0.38, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.beginPath() // quill
        ctx.moveTo(-p.size, 0)
        ctx.lineTo(p.size * 0.8, 0)
        ctx.stroke()
      } else if (p.kind === 'spark') {
        ctx.globalAlpha = Math.min(1, k * 1.6)
        ctx.rotate(p.rot)
        const s = p.size * (0.6 + 0.4 * k)
        ctx.fillStyle = p.color
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 6
        ctx.beginPath() // 4-point star
        ctx.moveTo(0, -s * 1.6)
        ctx.lineTo(s * 0.4, -s * 0.4)
        ctx.lineTo(s * 1.6, 0)
        ctx.lineTo(s * 0.4, s * 0.4)
        ctx.lineTo(0, s * 1.6)
        ctx.lineTo(-s * 0.4, s * 0.4)
        ctx.lineTo(-s * 1.6, 0)
        ctx.lineTo(-s * 0.4, -s * 0.4)
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.globalAlpha = k * 0.55
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(0, 0, p.size * (1.6 - k * 0.8), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
  }
}
