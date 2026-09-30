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
  MAX_AIR,
  MAX_GROUND,
  GROUND_SHARE,
  chickenCenter,
  chickenHitRadius,
  drawChicken,
  isGoldChicken,
  isTargetable,
  spawnAirChicken,
  spawnChicken,
  spawnGroundChicken,
  updateChicken,
} from './chicken'
import { sfx } from './audio'
import { Particles } from './particles'
import type { ChallengeDef, ChallengeId, Chicken, Floater, GamePhase } from './types'

const MAX_AMMO = 5
const AUTO_RELOAD_MS = 900
const HS_KEY = 'chickenrun-highscore'
const STREAK_NEEDED = 5
const STREAK_BONUS = 50
const GOLD_BONUS = 30
const MENU_MSG = 'Pick a game and start hunting!'
const VIEW_OUT_MS = 150
const COUNT_STEP_S = 0.8 // seconds per number in the 3-2-1 countdown
const COUNT_FROM = 3
const GO_SHOW_S = 0.75 // how long "GO!" stays on screen (the round is already running)

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
  private autoReloadLeft: number | null = null // ms, counted down in update() so pause freezes it
  private paused = false
  private viewTimer: number | null = null
  private flash = 0
  private particles = new Particles()
  private shake = 0
  private w = 0
  private h = 0
  private elapsed = 0
  private roundElapsed = 0 // seconds of actual play (drives spawn pacing)
  private cdT = 0 // seconds since the countdown started
  private cdStep = -1
  private goLeft = 0

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
  private elBack: HTMLButtonElement
  private elModeList: HTMLElement
  private menuStep: 'modes' | 'challenges' = 'modes'
  private elReload: HTMLButtonElement
  private elChallengeList: HTMLElement
  private elChallengeProgress: HTMLElement
  private elToast: HTMLElement
  private elApp: HTMLElement
  private elViews: HTMLElement
  private elPauseBtn: HTMLButtonElement
  private elPauseOverlay: HTMLElement
  private elPauseInfo: HTMLElement
  private elResume: HTMLButtonElement
  private elMute: HTMLButtonElement
  private elReady: HTMLElement
  private elReadyCard: HTMLElement
  private elReadyIcon: HTMLElement
  private elReadyTitle: HTMLElement
  private elReadyGoal: HTMLElement
  private elStart: HTMLButtonElement
  private elReadyBack: HTMLButtonElement
  private elCountdown: HTMLElement
  private elAgain: HTMLButtonElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D is not available')
    this.ctx = ctx

    this.elTimer = must('#timer')
    this.elScore = must('#score')
    this.elAmmo = must('#ammo')
    this.elOverlay = must('#overlay')
    this.elMsg = must('#overlay-msg')
    this.elHigh = must('#high-score')
    this.elBack = must('#back-btn') as HTMLButtonElement
    this.elModeList = must('#mode-list')
    this.elReload = must('#reload-btn') as HTMLButtonElement
    this.elChallengeList = must('#challenge-list')
    this.elChallengeProgress = must('#challenge-progress')
    this.elToast = must('#toast')
    this.elApp = must('#app')
    this.elViews = must('#views')
    this.elPauseBtn = must('#pause-btn') as HTMLButtonElement
    this.elPauseOverlay = must('#pause-overlay')
    this.elPauseInfo = must('#pause-info')
    this.elResume = must('#resume-btn') as HTMLButtonElement
    this.elMute = must('#mute-btn') as HTMLButtonElement
    this.elReady = must('#ready')
    this.elReadyCard = must('#ready-card')
    this.elReadyIcon = must('#ready-icon')
    this.elReadyTitle = must('#ready-title')
    this.elReadyGoal = must('#ready-goal')
    this.elStart = must('#start-btn') as HTMLButtonElement
    this.elReadyBack = must('#ready-back') as HTMLButtonElement
    this.elCountdown = must('#countdown')
    this.elAgain = must('#again-btn') as HTMLButtonElement

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

    this.renderMute()
    this.bind()
    this.resize()
    this.renderAmmo()
    this.renderChallengeList()
    this.showMenu(MENU_MSG)
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
      if (this.phase === 'playing' && !this.paused) this.shoot()
    })

    // Generic UI tap sound for buttons that have no sound of their own
    this.elApp.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button')
      if (!b || b.id === 'mute-btn' || b.id === 'reload-btn' || b.id === 'pause-btn' || b.id === 'resume-btn' || b.id === 'start-btn') return
      sfx.tap()
    })
    this.elMute.addEventListener('click', () => {
      sfx.setMuted(!sfx.isMuted())
      this.renderMute()
      if (!sfx.isMuted()) sfx.tap()
    })

    this.elBack.addEventListener('click', () => this.setMenuStep('modes'))
    this.elReload.addEventListener('click', () => this.reload())

    this.elStart.addEventListener('click', () => this.beginCountdown())
    this.elReadyBack.addEventListener('click', () => this.quitToMenu())
    this.elAgain.addEventListener('click', () => this.playAgain())

    this.elPauseBtn.addEventListener('click', () => this.pause())
    this.elResume.addEventListener('click', () => this.resume())
    must('#restart-btn').addEventListener('click', () => this.restart())
    must('#quit-btn').addEventListener('click', () => this.quitToMenu())

    // Auto-pause when the tab/app goes to the background
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onHidden()
    })
    window.addEventListener('pagehide', () => this.onHidden())

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.phase === 'countdown') {
          this.cancelCountdown()
          return
        }
        if (this.paused) this.resume()
        else this.pause()
      }
    })

    document.addEventListener('gesturestart', (e) => e.preventDefault())
  }

  private renderMute(): void {
    const m = sfx.isMuted()
    this.elMute.classList.toggle('muted', m)
    this.elMute.setAttribute('aria-pressed', String(m))
    this.elMute.setAttribute('aria-label', m ? 'Sound off (tap to turn on)' : 'Sound on (tap to mute)')
    this.elMute.title = m ? 'Sound off' : 'Sound on'
  }

  private renderChallengeList(): void {
    this.stars = loadStars()
    const base = import.meta.env.BASE_URL
    const sprite = (n: string) => `${base}art/sprites/chicken-${n}.webp`
    this.elModeList.innerHTML = ''
    this.elChallengeList.innerHTML = ''

    const sub = ['ujeni20', 'natancno', 'prezivi'] as ChallengeId[]
    const subStars = sub.reduce((n, id) => n + (this.stars[id] || 0), 0)
    const modes: {
      cls: string
      icon: string
      img: string
      title: string
      desc: string
      badge: string
      run: () => void
    }[] = [
      {
        cls: 'mode-classic',
        icon: '🏆',
        img: sprite('brown'),
        title: 'Classic',
        desc: '90 seconds of hunting — far chickens are worth more!',
        badge: starString(this.stars.klasika || 0),
        run: () => this.pickChallenge('klasika'),
      },
      {
        cls: 'mode-challenges',
        icon: '🎯',
        img: sprite('speckle'),
        title: 'Challenges',
        desc: 'Three special missions with stars.',
        badge: `★ ${subStars}/${sub.length * 3}`,
        run: () => this.setMenuStep('challenges'),
      },
      {
        cls: 'mode-gold',
        icon: '⭐',
        img: sprite('gold'),
        title: 'Golden Hunt',
        desc: 'Only golden chickens count. Reach 100 points!',
        badge: starString(this.stars.zlata || 0),
        run: () => this.pickChallenge('zlata'),
      },
    ]
    for (const m of modes) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = `mode-card ${m.cls}`
      btn.innerHTML = `
        <span class="mode-art"><img src="${m.img}" alt="" draggable="false" /></span>
        <span class="mode-body">
          <span class="mode-title"><span class="mode-icon">${m.icon}</span> ${m.title}</span>
          <span class="mode-desc">${m.desc}</span>
          <span class="mode-stars" aria-label="Stars">${m.badge}</span>
        </span>
        <span class="mode-go" aria-hidden="true">▶</span>
      `
      btn.addEventListener('click', m.run)
      this.elModeList.appendChild(btn)
    }

    for (const id of sub) {
      const c = getChallenge(id)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'challenge-card'
      btn.dataset.id = c.id
      btn.innerHTML = `
        <span class="ch-icon">${c.icon}</span>
        <span class="ch-body">
          <span class="ch-title">${c.title}</span>
          <span class="ch-desc">${c.desc}</span>
          <span class="ch-stars" aria-label="Stars">${starString(this.stars[c.id] || 0)}</span>
        </span>
        <span class="mode-go" aria-hidden="true">▶</span>
      `
      btn.addEventListener('click', () => this.pickChallenge(c.id))
      this.elChallengeList.appendChild(btn)
    }
  }

  /** Switch between the mode list and the challenge sub-list with a short fade/slide. */
  private setMenuStep(step: 'modes' | 'challenges', animate = true): void {
    const from = this.menuStep
    this.menuStep = step
    if (this.viewTimer != null) {
      clearTimeout(this.viewTimer)
      this.viewTimer = null
    }
    const toChallenges = step === 'challenges'
    const showEl = toChallenges ? this.elChallengeList : this.elModeList
    const hideEl = toChallenges ? this.elModeList : this.elChallengeList
    this.elViews.dataset.dir = toChallenges ? 'fwd' : 'back'

    const enter = (): void => {
      for (const el of [this.elModeList, this.elChallengeList, this.elBack]) {
        el.classList.remove('view-out', 'view-in')
      }
      hideEl.hidden = true
      showEl.hidden = false
      this.elBack.hidden = !toChallenges
      for (const el of toChallenges ? [showEl, this.elBack] : [showEl]) {
        void el.offsetWidth // restart the CSS animation
        el.classList.add('view-in')
      }
    }

    if (!animate || from === step || hideEl.hidden || prefersReducedMotion()) {
      enter()
      return
    }
    hideEl.classList.add('view-out')
    if (!toChallenges) this.elBack.classList.add('view-out')
    this.viewTimer = window.setTimeout(() => {
      this.viewTimer = null
      enter()
    }, VIEW_OUT_MS)
  }

  private pickChallenge(id: ChallengeId): void {
    this.challenge = getChallenge(id)
    this.prepareRound()
  }

  /** 'Play again' on the result screen: same mode, straight into the countdown. */
  private playAgain(): void {
    if (this.phase !== 'over') return
    this.prepareRound()
    this.beginCountdown()
  }

  /** Tab/app went to the background: pause a running round, or cancel a countdown back to ready. */
  private onHidden(): void {
    if (this.phase === 'countdown') this.cancelCountdown()
    else this.pause()
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

  private showMenu(msg: string, isResult = false): void {
    this.phase = isResult ? 'over' : 'menu'
    this.paused = false
    if (!isResult) this.particles.clear()
    this.elMsg.textContent = msg
    this.elHigh.textContent = String(this.highScore)
    this.elMsg.classList.remove('result')
    if (isResult) {
      void this.elMsg.offsetWidth // replay the pop-in animation
      this.elMsg.classList.add('result')
    }
    this.renderChallengeList()
    this.setMenuStep('modes', false)
    this.setPlayingUi(false)
    this.setPreUi(null)
    this.hideCountdown()
    this.elAgain.hidden = !isResult
    this.setOverlay(this.elPauseOverlay, false)
    this.setOverlay(this.elOverlay, true)
  }

  /** Show/hide an overlay (CSS fades it); hidden overlays are inert for keyboard/AT. */
  private setOverlay(el: HTMLElement, visible: boolean): void {
    el.classList.toggle('hidden', !visible)
    el.toggleAttribute('inert', !visible)
    el.setAttribute('aria-hidden', String(!visible))
  }

  /** Fade in/out the in-play UI (HUD, ammo, reload, pause button). */
  private setPlayingUi(on: boolean): void {
    this.elApp.classList.toggle('playing', on)
    this.elChallengeProgress.classList.toggle('hidden', !on)
  }

  /** Ready / countdown UI: #ready container, Start card, and the dimmed pause + hidden reload buttons. */
  private setPreUi(state: 'ready' | 'countdown' | null): void {
    const on = state != null
    this.elApp.classList.toggle('pre', on)
    this.elPauseBtn.disabled = on
    this.elReload.disabled = on
    this.setOverlay(this.elReady, on)
    const showCard = state === 'ready'
    this.elReadyCard.classList.toggle('off', !showCard)
    this.elReadyCard.toggleAttribute('inert', !showCard)
  }

  private showCountdownText(text: string, go = false): void {
    const el = this.elCountdown
    el.textContent = text
    el.classList.toggle('go', go)
    el.classList.remove('off', 'cd-anim')
    void el.offsetWidth // restart the CSS animation
    el.classList.add('cd-anim')
  }

  private hideCountdown(): void {
    this.goLeft = 0
    this.elCountdown.classList.add('off')
    this.elCountdown.classList.remove('cd-anim')
  }

  /** Start pressed: 3 - 2 - 1, then the round begins. */
  private beginCountdown(): void {
    if (this.phase !== 'ready') return
    this.phase = 'countdown'
    this.cdT = 0
    this.cdStep = 0
    this.setPreUi('countdown')
    ;(document.activeElement as HTMLElement | null)?.blur()
    this.showCountdownText(String(COUNT_FROM))
    sfx.tick()
  }

  /** Countdown interrupted (tab hidden / Esc): back to the ready screen, nothing started. */
  private cancelCountdown(): void {
    if (this.phase !== 'countdown') return
    this.phase = 'ready'
    this.cdStep = -1
    this.hideCountdown()
    this.setPreUi('ready')
  }

  /** Countdown finished: timer, spawns and shooting go live. The ready-state chickens stay on screen. */
  private beginPlay(): void {
    this.phase = 'playing'
    this.roundElapsed = 0
    this.spawnAcc = 0
    this.setPreUi(null)
    this.showCountdownText('GO!', true)
    this.goLeft = GO_SHOW_S
    sfx.go()
  }

  private pause(): void {
    if (this.phase !== 'playing' || this.paused) return
    this.paused = true
    this.hideCountdown()
    if (!document.hidden) sfx.pause()
    const t = Math.max(0, Math.ceil(this.timeLeft))
    const mm = String(Math.floor(t / 60)).padStart(2, '0')
    const ss = String(t % 60).padStart(2, '0')
    this.elPauseInfo.textContent = `${this.challenge.title} · Score ${this.score} · Time ${mm}:${ss}`
    this.setOverlay(this.elPauseOverlay, true)
    this.elResume.focus({ preventScroll: true })
  }

  private resume(): void {
    if (!this.paused) return
    this.paused = false
    sfx.resume()
    this.lastTs = 0
    this.setOverlay(this.elPauseOverlay, false)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  private restart(): void {
    if (!this.paused) return
    this.setOverlay(this.elPauseOverlay, false)
    ;(document.activeElement as HTMLElement | null)?.blur()
    this.prepareRound()
    this.beginCountdown() // quick: skip the Start button
  }

  /** Leave the round without a result: no win, no stars, no high score. */
  private quitToMenu(): void {
    if (this.phase !== 'playing' && this.phase !== 'ready' && this.phase !== 'countdown') return
    this.clearAutoReload()
    this.hideToast()
    this.showMenu(MENU_MSG)
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  /** Enter the ready state: fresh round values, idle chickens, HUD at full, Start button waiting. */
  private prepareRound(): void {
    this.chickens = []
    this.floaters = []
    this.particles.clear()
    this.shake = 0
    this.score = 0
    this.caught = 0
    this.misses = 0
    this.streak = 0
    this.timeLeft = this.challenge.duration
    this.ammo = MAX_AMMO
    this.spawnAcc = 0
    this.roundElapsed = 0
    this.flash = 0
    this.cdT = 0
    this.cdStep = -1
    this.clearAutoReload()
    this.hideToast()
    this.hideCountdown()
    this.phase = 'ready'
    this.paused = false
    this.elReadyIcon.textContent = this.challenge.icon
    this.elReadyTitle.textContent = this.challenge.title
    this.elReadyGoal.textContent = this.challenge.desc
    this.setOverlay(this.elOverlay, false)
    this.setOverlay(this.elPauseOverlay, false)
    this.setPlayingUi(true)
    this.setPreUi('ready')
    this.updateHud()
    this.renderAmmo()
    const opts = {
      goldBoost: this.challenge.goldBoost ?? 0,
      forceGoldLayer: false,
    }
    // Opening wave: 3 flyers + 2 walkers already on screen
    for (let i = 0; i < 5; i++) {
      const o = {
        ...opts,
        onScreen: true,
        forceGoldLayer: !!this.challenge.goldOnly && i % 2 === 0,
      }
      this.chickens.push(
        i < 3 ? spawnAirChicken(this.w, this.h, o) : spawnGroundChicken(this.w, this.h, o),
      )
    }
  }

  private endRound(won: boolean, reason: string): void {
    this.phase = 'over'
    this.clearAutoReload()
    this.paused = false
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
      sfx.win(0.3)
      this.showToast(
        'win',
        `Victory! ${reason}`,
        `${starString(stars)}  ·  ${this.score} points`,
      )
      this.showMenu(`🎉 Well done! ${reason} Score: ${this.score}`, true)
    } else {
      sfx.over(0.3)
      this.showToast('fail', `Oh no … ${reason}`, `Score: ${this.score}`)
      this.showMenu(`Game over! ${reason} Score: ${this.score}`, true)
    }
  }

  private evaluateEndOfTimer(): void {
    const c = this.challenge

    if (c.id === 'klasika') {
      this.endRound(true, "Time's up!")
      return
    }

    if (c.surviveFull) {
      if (this.score >= (c.scoreGoal ?? 0)) {
        this.endRound(true, `You survived with ${this.score} points!`)
      } else {
        this.endRound(
          false,
          `You needed ${c.scoreGoal} points but got ${this.score}.`,
        )
      }
      return
    }

    if (c.catchGoal && this.caught >= c.catchGoal) {
      this.endRound(true, `You caught ${this.caught} chickens!`)
      return
    }

    if (c.scoreGoal && this.score >= c.scoreGoal) {
      this.endRound(true, `You reached ${this.score} points!`)
      return
    }

    // Timed out without meeting goal
    if (c.catchGoal) {
      this.endRound(
        false,
        `You caught only ${this.caught}/${c.catchGoal} chickens.`,
      )
    } else if (c.scoreGoal) {
      this.endRound(
        false,
        `You had ${this.score}/${c.scoreGoal} points.`,
      )
    } else {
      this.endRound(true, "Time's up!")
    }
  }

  private checkEarlyWin(): void {
    if (this.phase !== 'playing') return
    const c = this.challenge
    if (c.surviveFull) return // must wait for timer

    if (c.catchGoal && this.caught >= c.catchGoal) {
      this.endRound(true, `You caught ${this.caught} chickens!`)
      return
    }
    if (c.scoreGoal && !c.surviveFull && this.score >= c.scoreGoal) {
      this.endRound(true, `You reached ${this.score} points!`)
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
      sfx.empty()
      return
    }
    this.ammo--
    sfx.shot()
    this.particles.puff(this.pointer.x, this.pointer.y, this.fxAmount(false))
    this.flash = 0.08
    this.renderAmmo()

    let best: Chicken | null = null
    let bestDist = Infinity
    for (const c of this.chickens) {
      if (!isTargetable(c)) continue
      const ctr = chickenCenter(c)
      const d = Math.hypot(ctr.x - this.pointer.x, ctr.y - this.pointer.y)
      const r = chickenHitRadius(c)
      if (d <= r && d < bestDist) {
        best = c
        bestDist = d
      }
    }

    if (best) {
      best.state = 'hit'
      best.hitT = 0
      const hc = chickenCenter(best)
      const isGold = isGoldChicken(best)
      this.particles.hit(hc.x, hc.y, isGold, Math.min(1.5, Math.max(0.6, best.layer.scale)), this.fxAmount(true))
      sfx.hit()
      if (navigator.vibrate && !prefersReducedMotion()) {
        try {
          navigator.vibrate(15)
        } catch {
          /* unsupported */
        }
      }
      if (isGold && !prefersReducedMotion()) this.shake = 0.22

      const gold = isGoldChicken(best)
      const countsForGold = !this.challenge.goldOnly || gold

      if (countsForGold) {
        this.caught++
        const distPts = best.points
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
          sfx.gold()
        }

        this.score += pts
        const fc = chickenCenter(best)
        this.floaters.push({
          x: fc.x,
          y: fc.y - 20,
          text: floaterText,
          life: 0.9,
          vy: -60,
          color: floaterColor,
        })

        this.streak++
        if (this.streak >= STREAK_NEEDED) {
          this.score += STREAK_BONUS
          this.floaters.push({
            x: fc.x,
            y: fc.y - 48,
            text: `STREAK! +${STREAK_BONUS}`,
            life: 1.05,
            vy: -72,
            color: '#7dffb3',
          })
          sfx.streak()
          this.streak = 0
        }
      } else {
        // Hit non-gold in gold-only mode — no points, mild feedback
        const nc = chickenCenter(best)
        this.floaters.push({
          x: nc.x,
          y: nc.y - 20,
          text: 'no points',
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
        this.endRound(false, 'Missed shot! Challenge failed.')
        return
      }
    }

    if (this.ammo <= 0) {
      this.scheduleAutoReload()
    }
  }

  private reload(): void {
    sfx.reload()
    this.ammo = MAX_AMMO
    this.clearAutoReload()
    this.renderAmmo()
  }

  private scheduleAutoReload(): void {
    this.autoReloadLeft = AUTO_RELOAD_MS
  }

  private clearAutoReload(): void {
    this.autoReloadLeft = null
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
    if (c.noMiss) prog += ` · misses: ${this.misses}`
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
    // Paused: freeze timer, spawns, chicken movement, floaters and auto-reload
    if (this.paused) return
    this.elapsed += dt
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt)
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt)
    this.particles.update(dt)

    if (this.phase === 'countdown') {
      this.cdT += dt
      const step = Math.floor(this.cdT / COUNT_STEP_S)
      if (step >= COUNT_FROM) {
        this.beginPlay()
      } else if (step !== this.cdStep) {
        this.cdStep = step
        this.showCountdownText(String(COUNT_FROM - step))
        sfx.tick()
      }
    }
    if (this.goLeft > 0) {
      this.goLeft -= dt
      if (this.goLeft <= 0) this.hideCountdown()
    }

    if (this.phase === 'playing') {
      this.roundElapsed += dt
      if (this.autoReloadLeft != null) {
        this.autoReloadLeft -= dt * 1000
        if (this.autoReloadLeft <= 0) {
          this.autoReloadLeft = null
          if (this.ammo <= 0) this.reload()
        }
      }
      this.timeLeft -= dt
      if (this.timeLeft <= 0) {
        this.timeLeft = 0
        this.updateHud()
        this.evaluateEndOfTimer()
      } else {
        this.updateHud()
      }

      this.spawnAcc += dt
      const interval = Math.max(0.4, 1.05 - this.roundElapsed * 0.008)
      while (this.spawnAcc >= interval) {
        this.spawnAcc -= interval
        this.spawnOne({
          goldBoost: this.challenge.goldBoost ?? 0,
          forceGoldLayer: !!this.challenge.goldOnly && Math.random() < 0.55,
        })
      }
    } else {
      this.spawnAcc += dt
      if (this.spawnAcc > 1.2) {
        this.spawnAcc = 0
        const air = this.chickens.filter((c) => c.domain === 'air').length
        const ground = this.chickens.filter((c) => c.domain === 'ground').length
        if (air + ground < 6) {
          this.chickens.push(
            ground < 2 && Math.random() < 0.4
              ? spawnGroundChicken(this.w, this.h)
              : air < 4
                ? spawnChicken(this.w, this.h)
                : spawnGroundChicken(this.w, this.h),
          )
        }
      }
    }

    for (const c of this.chickens) updateChicken(c, dt, this.w, this.h)
    this.chickens = this.chickens.filter((c) => {
      if (c.state === 'gone') return false
      if (c.state === 'flying' || c.state === 'walking' || c.state === 'pecking') {
        const m = 130 * c.layer.scale
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

  /** Spawn one chicken: ~65% air / ~35% ground, respecting the on-screen caps. */
  private spawnOne(opts: { goldBoost: number; forceGoldLayer: boolean }): void {
    const air = this.chickens.filter((c) => c.domain === 'air' && c.state === 'flying').length
    const ground = this.chickens.filter((c) => c.domain === 'ground' && isTargetable(c)).length
    const wantGround = Math.random() < GROUND_SHARE
    if (wantGround && ground < MAX_GROUND) {
      this.chickens.push(spawnGroundChicken(this.w, this.h, opts))
    } else if (air < MAX_AIR) {
      this.chickens.push(spawnAirChicken(this.w, this.h, opts))
    } else if (ground < MAX_GROUND) {
      this.chickens.push(spawnGroundChicken(this.w, this.h, opts))
    }
  }

  private draw(): void {
    const { ctx, w, h } = this
    ctx.save()
    if (this.shake > 0) {
      const a = (this.shake / 0.22) * 3 // max 3px, decays
      ctx.translate((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a)
    }
    drawBackground(ctx, w, h, this.elapsed * 1000)

    // Painter's order: sky chickens (far first) and ground chickens sorted by feet y.
    // Air chickens sit above the horizon; ground ones are drawn after so nearer rows overlap farther ones.
    const air = this.chickens
      .filter((c) => c.domain === 'air')
      .sort((a, b) => a.layer.scale - b.layer.scale)
    const ground = this.chickens
      .filter((c) => c.domain === 'ground')
      .sort((a, b) => a.baseY - b.baseY)
    for (const c of air) drawChicken(ctx, c, h)
    for (const c of ground) drawChicken(ctx, c, h)

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

    this.particles.draw(ctx)
    ctx.restore()

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,180,${this.flash * 2})`
      ctx.beginPath()
      ctx.arc(this.pointer.x, this.pointer.y, 40, 0, Math.PI * 2)
      ctx.fill()
    }

    if (this.phase === 'playing' || (this.pointer.active && this.phase !== 'ready' && this.phase !== 'countdown')) {
      drawCrosshair(ctx, this.pointer.x, this.pointer.y, this.ammo > 0)
    }
  }

  /** Particle amount multiplier (reduced motion = very few / none). */
  private fxAmount(hit: boolean): number {
    if (prefersReducedMotion()) return hit ? 0.3 : 0
    return 1
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

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function must(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`Missing element ${sel}`)
  return el as HTMLElement
}
