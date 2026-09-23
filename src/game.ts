import { drawBackground } from './background'
import {
  CHALLENGES,
  getChallenge,
  loadStars,
  saveStar,
  starString,
  starsForClear,
} from './challenges'
import {
  chickenHitRadius,
  drawChicken,
  isGoldChicken,
  spawnChicken,
  updateChicken,
} from './chicken'
import type { ChallengeDef, ChallengeId, Chicken, Floater, GamePhase } from './types'

const MAX_AMMO = 5
const AUTO_RELOAD_MS = 900
const HS_KEY = 'chickenrun-highscore'
const STREAK_NEEDED = 5
const STREAK_BONUS = 50
const GOLD_BONUS = 30

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private chickens: Chicken[] = []
  private floaters: Floater[] = []
  private phase: GamePhase = 'menu'
  private score = 0
  private highScore = 0
  private timeLeft = 90
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

  private challenge: ChallengeDef = CHALLENGES[0]!
  private caught = 0
  private misses = 0
  private streak = 0
  private stars: Record<ChallengeId, number> = loadStars()
  private toastTimer: number | null = null

  private elTimer: HTMLElement
  private elScore: HTMLElement
  private elAmmo: HTMLElement
  private elOverlay: HTMLElement
  private elMsg: HTMLElement
  private elHigh: HTMLElement
  private elStart: HTMLButtonElement
  private elReload: HTMLButtonElement
  private elChallengeList: HTMLElement
  private elChallengeProgress: HTMLElement
  private elToast: HTMLElement

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
    this.elChallengeList = must('#challenge-list')
    this.elChallengeProgress = must('#challenge-progress')
    this.elToast = must('#toast')

    this.highScore =
      Number(
        localStorage.getItem(HS_KEY) ||
          localStorage.getItem('chikenrun-highscore') ||
          '0',
      ) || 0
    if (this.highScore > 0 && !localStorage.getItem(HS_KEY)) {
      localStorage.setItem(HS_KEY, String(this.highScore))
    }
    this.elHigh.textContent = String(this.highScore)

    this.bind()
    this.resize()
    this.renderAmmo()
    this.renderChallengeList()
    this.showMenu('Izberi izziv in pritisni Začni!')
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

    document.addEventListener('gesturestart', (e) => e.preventDefault())
  }

  private renderChallengeList(): void {
    this.stars = loadStars()
    this.elChallengeList.innerHTML = ''
    for (const c of CHALLENGES) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className =
        'challenge-card' + (c.id === this.challenge.id ? ' selected' : '')
      btn.dataset.id = c.id
      const stars = this.stars[c.id] || 0
      btn.innerHTML = `
        <span class="ch-icon">${c.icon}</span>
        <span class="ch-body">
          <span class="ch-title">${c.title}</span>
          <span class="ch-desc">${c.desc}</span>
          <span class="ch-stars" aria-label="Zvezdice">${starString(stars)}</span>
        </span>
      `
      btn.addEventListener('click', () => {
        this.challenge = getChallenge(c.id)
        this.renderChallengeList()
        this.elMsg.textContent = c.desc
      })
      this.elChallengeList.appendChild(btn)
    }
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
    this.elStart.textContent =
      this.score > 0 || this.phase === 'over' ? 'Ponovi' : 'Začni'
    this.elOverlay.classList.remove('hidden')
    this.elReload.hidden = true
    this.elChallengeProgress.classList.add('hidden')
    this.renderChallengeList()
  }

  private startRound(): void {
    this.chickens = []
    this.floaters = []
    this.score = 0
    this.caught = 0
    this.misses = 0
    this.streak = 0
    this.timeLeft = this.challenge.duration
    this.ammo = MAX_AMMO
    this.spawnAcc = 0
    this.elapsed = 0
    this.flash = 0
    this.clearAutoReload()
    this.hideToast()
    this.phase = 'playing'
    this.elOverlay.classList.add('hidden')
    this.elReload.hidden = false
    this.elChallengeProgress.classList.remove('hidden')
    this.updateHud()
    this.renderAmmo()
    const opts = {
      goldBoost: this.challenge.goldBoost ?? 0,
      forceGoldLayer: false,
    }
    for (let i = 0; i < 4; i++) {
      this.chickens.push(
        spawnChicken(this.w, this.h, {
          ...opts,
          forceGoldLayer: !!this.challenge.goldOnly && i % 2 === 0,
        }),
      )
    }
  }

  private endRound(won: boolean, reason: string): void {
    this.phase = 'over'
    this.clearAutoReload()
    if (this.score > this.highScore) {
      this.highScore = this.score
      localStorage.setItem(HS_KEY, String(this.highScore))
    }

    if (won) {
      const stars = starsForClear(
        this.challenge,
        this.score,
        this.caught,
        this.misses,
      )
      saveStar(this.challenge.id, stars)
      this.showToast(
        'win',
        `Zmaga! ${reason}`,
        `${starString(stars)}  ·  ${this.score} točk`,
      )
      this.showMenu(`Bravo! ${reason} Rezultat: ${this.score}`)
    } else {
      this.showToast('fail', `Žal … ${reason}`, `Rezultat: ${this.score}`)
      this.showMenu(`Konec! ${reason} Rezultat: ${this.score}`)
    }
  }

  private evaluateEndOfTimer(): void {
    const c = this.challenge

    if (c.id === 'klasika') {
      this.endRound(true, 'Čas je potekel!')
      return
    }

    if (c.surviveFull) {
      if (this.score >= (c.scoreGoal ?? 0)) {
        this.endRound(true, `Preživel si z ${this.score} točkami!`)
      } else {
        this.endRound(
          false,
          `Potreboval si ${c.scoreGoal} točk, imel pa ${this.score}.`,
        )
      }
      return
    }

    if (c.catchGoal && this.caught >= c.catchGoal) {
      this.endRound(true, `Ujel si ${this.caught} kokoši!`)
      return
    }

    if (c.scoreGoal && this.score >= c.scoreGoal) {
      this.endRound(true, `Dosegel si ${this.score} točk!`)
      return
    }

    // Timed out without meeting goal
    if (c.catchGoal) {
      this.endRound(
        false,
        `Ujel si le ${this.caught}/${c.catchGoal} kokoši.`,
      )
    } else if (c.scoreGoal) {
      this.endRound(
        false,
        `Imel si ${this.score}/${c.scoreGoal} točk.`,
      )
    } else {
      this.endRound(true, 'Čas je potekel!')
    }
  }

  private checkEarlyWin(): void {
    if (this.phase !== 'playing') return
    const c = this.challenge
    if (c.surviveFull) return // must wait for timer

    if (c.catchGoal && this.caught >= c.catchGoal) {
      this.endRound(true, `Ujel si ${this.caught} kokoši!`)
      return
    }
    if (c.scoreGoal && !c.surviveFull && this.score >= c.scoreGoal) {
      this.endRound(true, `Dosegel si ${this.score} točk!`)
    }
  }

  private showToast(
    kind: 'win' | 'fail',
    title: string,
    detail: string,
  ): void {
    this.elToast.className = `toast toast-${kind}`
    this.elToast.innerHTML = `<strong>${title}</strong><span>${detail}</span>`
    this.elToast.classList.remove('hidden')
    if (this.toastTimer != null) clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.hideToast(), 3200)
  }

  private hideToast(): void {
    this.elToast.classList.add('hidden')
    if (this.toastTimer != null) {
      clearTimeout(this.toastTimer)
      this.toastTimer = null
    }
  }

  private shoot(): void {
    if (this.ammo <= 0) {
      // Reload stays visible during play; nudge auto-reload if empty
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

      const gold = isGoldChicken(best)
      const countsForGold = !this.challenge.goldOnly || gold

      if (countsForGold) {
        this.caught++
        const distPts = best.layer.points
        let pts = distPts
        let floaterText = `+${distPts}`
        let floaterColor = '#fff'

        if (gold) {
          pts += GOLD_BONUS
          floaterText = `+${distPts} ★+${GOLD_BONUS}`
          floaterColor = '#ffd700'
          // Immediate free full reload
          this.ammo = MAX_AMMO
          this.clearAutoReload()
          this.renderAmmo()
        }

        this.score += pts
        this.floaters.push({
          x: best.x,
          y: best.y - 20,
          text: floaterText,
          life: 0.9,
          vy: -60,
          color: floaterColor,
        })

        this.streak++
        if (this.streak >= STREAK_NEEDED) {
          this.score += STREAK_BONUS
          this.floaters.push({
            x: best.x,
            y: best.y - 48,
            text: `NIZ! +${STREAK_BONUS}`,
            life: 1.05,
            vy: -72,
            color: '#7dffb3',
          })
          this.streak = 0
        }
      } else {
        // Hit non-gold in gold-only mode — no points, mild feedback
        this.floaters.push({
          x: best.x,
          y: best.y - 20,
          text: 'ne šteje',
          life: 0.8,
          vy: -50,
          color: '#ffccaa',
        })
      }
      this.updateHud()
      this.checkEarlyWin()
    } else {
      this.streak = 0
      this.misses++
      if (this.challenge.noMiss) {
        this.endRound(false, 'Zgrešena strela! Izziv ni uspel.')
        return
      }
    }

    if (this.ammo <= 0) {
      this.scheduleAutoReload()
    }
  }

  private reload(): void {
    this.ammo = MAX_AMMO
    this.clearAutoReload()
    // Keep reload visible while playing; hide only on menu/over
    if (this.phase !== 'playing') this.elReload.hidden = true
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

    const c = this.challenge
    let prog = c.title
    if (c.catchGoal) prog += ` · ${this.caught}/${c.catchGoal}`
    else if (c.scoreGoal) prog += ` · ${this.score}/${c.scoreGoal}`
    if (c.noMiss) prog += ` · zgrešeno: ${this.misses}`
    this.elChallengeProgress.textContent = prog
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

    if (this.phase === 'playing') {
      this.timeLeft -= dt
      if (this.timeLeft <= 0) {
        this.timeLeft = 0
        this.updateHud()
        this.evaluateEndOfTimer()
      } else {
        this.updateHud()
      }

      this.spawnAcc += dt
      const interval = Math.max(0.4, 1.05 - this.elapsed * 0.008)
      while (this.spawnAcc >= interval) {
        this.spawnAcc -= interval
        if (this.chickens.filter((c) => c.state === 'flying').length < 10) {
          this.chickens.push(
            spawnChicken(this.w, this.h, {
              goldBoost: this.challenge.goldBoost ?? 0,
              forceGoldLayer:
                !!this.challenge.goldOnly && Math.random() < 0.55,
            }),
          )
        }
      }
    } else if (this.phase === 'menu' || this.phase === 'over') {
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

    const sorted = [...this.chickens].sort(
      (a, b) => a.layer.scale - b.layer.scale,
    )
    for (const c of sorted) drawChicken(ctx, c)

    for (const f of this.floaters) {
      ctx.save()
      ctx.globalAlpha = Math.min(1, f.life * 1.4)
      ctx.font = `bold ${Math.round(22 + (1 - f.life) * 10)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.lineWidth = 4
      ctx.strokeStyle = '#222'
      ctx.fillStyle = f.color || '#fff'
      ctx.strokeText(f.text, f.x, f.y)
      ctx.fillText(f.text, f.x, f.y)
      ctx.restore()
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,180,${this.flash * 2})`
      ctx.beginPath()
      ctx.arc(this.pointer.x, this.pointer.y, 40, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.phase === 'playing' || this.pointer.active) {
      drawCrosshair(ctx, this.pointer.x, this.pointer.y, this.ammo > 0)
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.clearAutoReload()
    this.hideToast()
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
