import { drawBackground } from './background'
import {
  chickenHitRadius,
  drawChicken,
  spawnChicken,
  updateChicken,
} from './chicken'
import type { Chicken, Floater, GamePhase } from './types'

const ROUND_SEC = 90
const MAX_AMMO = 5
const AUTO_RELOAD_MS = 900
const HS_KEY = 'chikenrun-highscore'

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private chickens: Chicken[] = []
  private floaters: Floater[] = []
  private phase: GamePhase = 'menu'
  private score = 0
  private highScore = 0
  private timeLeft = ROUND_SEC
  private ammo = MAX_AMMO
  private spawnAcc = 0
  private pointer = { x: 0, y: 0, active: false }
  private lastTs = 0
  private raf = 0
  private autoReloadTimer: number | null = null
  private flash = 0
  private w = 0
  private h = 0
  private elapsed = 0

  private elTimer: HTMLElement
  private elScore: HTMLElement
  private elAmmo: HTMLElement
  private elOverlay: HTMLElement
  private elMsg: HTMLElement
  private elHigh: HTMLElement
  private elStart: HTMLButtonElement
  private elReload: HTMLButtonElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D ni na voljo')
    this.ctx = ctx

    this.elTimer = must('#timer')
    this.elScore = must('#score')
    this.elAmmo = must('#ammo')
    this.elOverlay = must('#overlay')
    this.elMsg = must('#overlay-msg')
    this.elHigh = must('#high-score')
    this.elStart = must('#start-btn') as HTMLButtonElement
    this.elReload = must('#reload-btn') as HTMLButtonElement

    this.highScore = Number(localStorage.getItem(HS_KEY) || '0') || 0
    this.elHigh.textContent = String(this.highScore)

    this.bind()
    this.resize()
    this.renderAmmo()
    this.showMenu('Lovi lude kokoši! Klikni ali tapni, da ustreliš.')
    this.loop(performance.now())
  }

  private bind(): void {
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => this.resize())

    const move = (x: number, y: number) => {
      const r = this.canvas.getBoundingClientRect()
      this.pointer.x = ((x - r.left) / r.width) * this.w
      this.pointer.y = ((y - r.top) / r.height) * this.h
      this.pointer.active = true
    }

    this.canvas.addEventListener('pointermove', (e) => {
      move(e.clientX, e.clientY)
    })
    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.canvas.setPointerCapture(e.pointerId)
      move(e.clientX, e.clientY)
      if (this.phase === 'playing') this.shoot()
    })

    this.elStart.addEventListener('click', () => this.startRound())
    this.elReload.addEventListener('click', () => this.reload())

    // Prevent scroll/zoom gestures on mobile
    document.addEventListener('gesturestart', (e) => e.preventDefault())
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.w = Math.max(320, Math.floor(rect.width))
    this.h = Math.max(240, Math.floor(rect.height))
    this.canvas.width = Math.floor(this.w * dpr)
    this.canvas.height = Math.floor(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.pointer.x = this.w / 2
    this.pointer.y = this.h / 2
  }

  private showMenu(msg: string): void {
    this.phase = this.score > 0 && this.timeLeft <= 0 ? 'over' : 'menu'
    this.elMsg.textContent = msg
    this.elHigh.textContent = String(this.highScore)
    this.elStart.textContent = this.score > 0 || this.phase === 'over' ? 'Ponovi' : 'Začni'
    this.elOverlay.classList.remove('hidden')
    this.elReload.hidden = true
  }

  private startRound(): void {
    this.chickens = []
    this.floaters = []
    this.score = 0
    this.timeLeft = ROUND_SEC
    this.ammo = MAX_AMMO
    this.spawnAcc = 0
    this.elapsed = 0
    this.flash = 0
    this.clearAutoReload()
    this.phase = 'playing'
    this.elOverlay.classList.add('hidden')
    this.elReload.hidden = true
    this.updateHud()
    this.renderAmmo()
    // Seed a few chickens
    for (let i = 0; i < 4; i++) this.chickens.push(spawnChicken(this.w, this.h))
  }

  private endRound(): void {
    this.phase = 'over'
    this.clearAutoReload()
    if (this.score > this.highScore) {
      this.highScore = this.score
      localStorage.setItem(HS_KEY, String(this.highScore))
    }
    this.showMenu(`Konec! Tvoj rezultat: ${this.score}`)
  }

  private shoot(): void {
    if (this.ammo <= 0) {
      this.elReload.hidden = false
      this.scheduleAutoReload()
      return
    }
    this.ammo--
    this.flash = 0.08
    this.renderAmmo()

    let best: Chicken | null = null
    let bestDist = Infinity
    for (const c of this.chickens) {
      if (c.state !== 'flying') continue
      const dx = c.x - this.pointer.x
      const dy = c.y - this.pointer.y
      const d = Math.hypot(dx, dy)
      const r = chickenHitRadius(c)
      if (d <= r && d < bestDist) {
        best = c
        bestDist = d
      }
    }

    if (best) {
      best.state = 'hit'
      best.hitT = 0
      const pts = best.layer.points
      this.score += pts
      this.floaters.push({
        x: best.x,
        y: best.y - 20,
        text: `+${pts}`,
        life: 0.9,
        vy: -60,
      })
      this.updateHud()
    }

    if (this.ammo <= 0) {
      this.elReload.hidden = false
      this.scheduleAutoReload()
    }
  }

  private reload(): void {
    this.ammo = MAX_AMMO
    this.clearAutoReload()
    this.elReload.hidden = true
    this.renderAmmo()
  }

  private scheduleAutoReload(): void {
    this.clearAutoReload()
    this.autoReloadTimer = window.setTimeout(() => {
      if (this.phase === 'playing' && this.ammo <= 0) this.reload()
    }, AUTO_RELOAD_MS)
  }

  private clearAutoReload(): void {
    if (this.autoReloadTimer != null) {
      clearTimeout(this.autoReloadTimer)
      this.autoReloadTimer = null
    }
  }

  private updateHud(): void {
    const t = Math.max(0, Math.ceil(this.timeLeft))
    const m = Math.floor(t / 60)
    const s = t % 60
    this.elTimer.textContent = `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`
    this.elScore.textContent = String(this.score)
  }

  private renderAmmo(): void {
    this.elAmmo.innerHTML = ''
    for (let i = 0; i < MAX_AMMO; i++) {
      const d = document.createElement('div')
      d.className = 'shell'
      if (i >= this.ammo) d.classList.add('empty')
      this.elAmmo.appendChild(d)
    }
  }

  private loop = (ts: number): void => {
    const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000)
    this.lastTs = ts
    this.update(dt)
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  private update(dt: number): void {
    this.elapsed += dt
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt)

    // Always animate background chickens lightly in menu? Keep scene alive.
    if (this.phase === 'playing') {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) {
        this.timeLeft = 0
        this.updateHud()
        this.endRound()
      } else {
        this.updateHud()
      }

      this.spawnAcc += dt
      const interval = Math.max(0.45, 1.1 - this.elapsed * 0.008)
      while (this.spawnAcc >= interval) {
        this.spawnAcc -= interval
        if (this.chickens.filter((c) => c.state === 'flying').length < 10) {
          this.chickens.push(spawnChicken(this.w, this.h))
        }
      }
    } else if (this.phase === 'menu' || this.phase === 'over') {
      // Ambient chickens behind overlay
      this.spawnAcc += dt
      if (this.spawnAcc > 1.2) {
        this.spawnAcc = 0
        if (this.chickens.filter((c) => c.state === 'flying').length < 5) {
          this.chickens.push(spawnChicken(this.w, this.h))
        }
      }
    }

    for (const c of this.chickens) updateChicken(c, dt, this.h)
    this.chickens = this.chickens.filter((c) => {
      if (c.state === 'gone') return false
      if (c.state === 'flying') {
        const m = 100 * c.layer.scale
        if (c.facing === 1 && c.x > this.w + m) return false
        if (c.facing === -1 && c.x < -m) return false
      }
      return true
    })

    for (const f of this.floaters) {
      f.life -= dt
      f.y += f.vy * dt
    }
    this.floaters = this.floaters.filter((f) => f.life > 0)
  }

  private draw(): void {
    const { ctx, w, h } = this
    drawBackground(ctx, w, h, this.elapsed * 1000)

    // Sort chickens back-to-front by scale
    const sorted = [...this.chickens].sort((a, b) => a.layer.scale - b.layer.scale)
    for (const c of sorted) drawChicken(ctx, c)

    // Floating points
    for (const f of this.floaters) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, f.life * 1.4)
      ctx.font = `bold ${Math.round(22 + (1 - f.life) * 10)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = '#222'
      ctx.fillStyle = '#fff'
      ctx.strokeText(f.text, f.x, f.y)
      ctx.fillText(f.text, f.x, f.y)
      ctx.restore()
    }

    // Muzzle flash vignette
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,180,${this.flash * 2})`
      ctx.beginPath()
      ctx.arc(this.pointer.x, this.pointer.y, 40, 0, Math.PI * 2)
      ctx.fill()
    }

    // Crosshair (only when playing or pointer active)
    if (this.phase === 'playing' || this.pointer.active) {
      drawCrosshair(ctx, this.pointer.x, this.pointer.y, this.ammo > 0)
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.clearAutoReload()
  }
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  loaded: boolean,
): void {
  const r = 18
  ctx.save()
  ctx.strokeStyle = loaded ? '#fff' : '#ff8888'
  ctx.lineWidth = 2.5
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 2
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - r - 8, y)
  ctx.lineTo(x - r + 2, y)
  ctx.moveTo(x + r - 2, y)
  ctx.lineTo(x + r + 8, y)
  ctx.moveTo(x, y - r - 8)
  ctx.lineTo(x, y - r + 2)
  ctx.moveTo(x, y + r - 2)
  ctx.lineTo(x, y + r + 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fillStyle = loaded ? '#fff' : '#ff8888'
  ctx.fill()
  ctx.restore()
}

function must(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Manjka element ${sel}`)
  return el as HTMLElement
}
