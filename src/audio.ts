/**
 * Synthesized sound effects (Web Audio API, no audio files).
 * - AudioContext is created lazily on the first user gesture and resumed on later ones.
 * - Everything goes through a master gain + soft limiter so nothing clips.
 * - Mute state persists in localStorage (default: sound ON).
 */

const MUTE_KEY = 'chickenrun-muted'
const MASTER_VOLUME = 0.55

type WaveType = OscillatorType

class Sfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1'
    } catch {
      this.muted = false
    }
    const gesture = (): void => this.unlock()
    // pointerdown creates the context early; pointerup/click/touchend/keydown are the events iOS accepts to resume
    for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(ev, gesture, { capture: true, passive: true })
    }
    document.addEventListener('visibilitychange', () => {
      const c = this.ctx
      if (!c) return
      if (document.hidden) void c.suspend().catch(() => {})
      else void c.resume().catch(() => {})
    })
  }

  isMuted(): boolean {
    return this.muted
  }

  /** Current AudioContext state (for diagnostics): 'none' until the first gesture. */
  state(): string {
    return this.ctx ? this.ctx.state : 'none'
  }

  setMuted(m: boolean): void {
    this.muted = m
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0')
    } catch {
      /* private mode etc. */
    }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime)
      this.master.gain.setTargetAtTime(m ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.01)
    }
  }

  /** Create (first call) and resume the AudioContext. Must be called from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        const ctx = new AC()
        const master = ctx.createGain()
        master.gain.value = this.muted ? 0 : MASTER_VOLUME
        const limiter = ctx.createDynamicsCompressor()
        limiter.threshold.value = -10
        limiter.knee.value = 12
        limiter.ratio.value = 12
        limiter.attack.value = 0.003
        limiter.release.value = 0.15
        master.connect(limiter)
        limiter.connect(ctx.destination)
        this.ctx = ctx
        this.master = master
      }
      if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => {})
    } catch {
      /* audio is optional - never break the game */
    }
  }

  // ---- building blocks --------------------------------------------------

  /** True when we can (and should) schedule sound right now. */
  private ready(): AudioContext | null {
    if (this.muted || !this.ctx || !this.master) return null
    if (this.ctx.state === 'closed') return null
    return this.ctx
  }

  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.5)
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
    }
    return this.noiseBuf
  }

  /** One enveloped oscillator with optional pitch glide. */
  private tone(
    ctx: AudioContext,
    t: number,
    o: {
      type?: WaveType
      f0: number
      f1?: number
      dur: number
      vol: number
      attack?: number
      filter?: { type: BiquadFilterType; freq: number; q?: number }
      vibrato?: { rate: number; depth: number }
    },
  ): void {
    const osc = ctx.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(o.f0, t)
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur)
    const g = ctx.createGain()
    const a = o.attack ?? 0.004
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(o.vol, t + a)
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    let node: AudioNode = osc
    if (o.filter) {
      const f = ctx.createBiquadFilter()
      f.type = o.filter.type
      f.frequency.value = o.filter.freq
      f.Q.value = o.filter.q ?? 1
      node.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(this.master!)
    if (o.vibrato) {
      const lfo = ctx.createOscillator()
      const lg = ctx.createGain()
      lfo.frequency.value = o.vibrato.rate
      lg.gain.value = o.vibrato.depth
      lfo.connect(lg)
      lg.connect(osc.frequency)
      lfo.start(t)
      lfo.stop(t + o.dur + 0.02)
    }
    osc.start(t)
    osc.stop(t + o.dur + 0.02)
  }

  /** Filtered noise burst with a filter sweep. */
  private burst(
    ctx: AudioContext,
    t: number,
    o: { dur: number; vol: number; type: BiquadFilterType; f0: number; f1: number; q?: number },
  ): void {
    const src = ctx.createBufferSource()
    src.buffer = this.noise(ctx)
    const f = ctx.createBiquadFilter()
    f.type = o.type
    f.Q.value = o.q ?? 0.8
    f.frequency.setValueAtTime(o.f0, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t + o.dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(o.vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    src.connect(f)
    f.connect(g)
    g.connect(this.master!)
    src.start(t)
    src.stop(t + o.dur + 0.02)
  }

  // ---- game sounds ------------------------------------------------------

  /** Short pop/bang. */
  shot(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime
    this.burst(c, t, { dur: 0.13, vol: 0.5, type: 'lowpass', f0: 3200, f1: 260 })
    this.tone(c, t, { type: 'sine', f0: 190, f1: 45, dur: 0.14, vol: 0.55 })
  }

  /** Dry click for an empty magazine. */
  empty(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime
    this.tone(c, t, { type: 'square', f0: 1500, f1: 900, dur: 0.03, vol: 0.12 })
    this.burst(c, t, { dur: 0.03, vol: 0.2, type: 'highpass', f0: 3000, f1: 2000 })
  }

  /** Two-tone mechanical click. */
  reload(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime
    this.tone(c, t, { type: 'square', f0: 520, f1: 380, dur: 0.05, vol: 0.14 })
    this.burst(c, t, { dur: 0.04, vol: 0.18, type: 'bandpass', f0: 2500, f1: 1500, q: 2 })
    this.tone(c, t + 0.11, { type: 'square', f0: 820, f1: 620, dur: 0.06, vol: 0.14 })
    this.burst(c, t + 0.11, { dur: 0.04, vol: 0.2, type: 'bandpass', f0: 3200, f1: 2000, q: 2 })
  }

  /** Squawk-like chirp. */
  hit(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + 0.03
    const base = 620 + Math.random() * 160
    this.tone(c, t, {
      type: 'sawtooth',
      f0: base,
      f1: base * 1.7,
      dur: 0.09,
      vol: 0.22,
      filter: { type: 'bandpass', freq: 1400, q: 1.6 },
      vibrato: { rate: 38, depth: 50 },
    })
    this.tone(c, t + 0.09, {
      type: 'sawtooth',
      f0: base * 1.7,
      f1: base * 0.7,
      dur: 0.13,
      vol: 0.2,
      filter: { type: 'bandpass', freq: 1100, q: 1.6 },
      vibrato: { rate: 32, depth: 60 },
    })
  }

  /** Sparkle arpeggio for a golden chicken. */
  gold(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + 0.05
    const notes = [1046.5, 1318.5, 1568, 2093, 2637, 3136]
    notes.forEach((f, i) => {
      this.tone(c, t + i * 0.055, { type: 'triangle', f0: f, dur: 0.22, vol: 0.13 })
      this.tone(c, t + i * 0.055, { type: 'sine', f0: f * 2, dur: 0.12, vol: 0.05 })
    })
  }

  /** Rising jingle for a streak bonus. */
  streak(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + 0.12
    const notes = [523.3, 659.3, 784, 1046.5]
    notes.forEach((f, i) => {
      const last = i === notes.length - 1
      this.tone(c, t + i * 0.08, {
        type: 'square',
        f0: f,
        dur: last ? 0.3 : 0.11,
        vol: 0.1,
        filter: { type: 'lowpass', freq: 2600 },
      })
      this.tone(c, t + i * 0.08, { type: 'triangle', f0: f * 2, dur: last ? 0.3 : 0.11, vol: 0.07 })
    })
  }

  /** Round win fanfare. `delay` in seconds. */
  win(delay = 0): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + delay
    const seq: [number, number, number][] = [
      [523.3, 0, 0.14],
      [659.3, 0.14, 0.14],
      [784, 0.28, 0.14],
      [1046.5, 0.42, 0.2],
      [784, 0.64, 0.12],
      [1046.5, 0.76, 0.5],
    ]
    for (const [f, o, d] of seq) {
      this.tone(c, t + o, {
        type: 'square',
        f0: f,
        dur: d,
        vol: 0.1,
        filter: { type: 'lowpass', freq: 2800 },
      })
      this.tone(c, t + o, { type: 'triangle', f0: f / 2, dur: d, vol: 0.12 })
    }
    this.tone(c, t + 0.76, { type: 'triangle', f0: 1318.5, dur: 0.5, vol: 0.08 })
  }

  /** Round over / fail jingle (descending, gentle). `delay` in seconds. */
  over(delay = 0): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime + delay
    const seq: [number, number, number][] = [
      [392, 0, 0.2],
      [330, 0.22, 0.2],
      [262, 0.44, 0.22],
    ]
    for (const [f, o, d] of seq) {
      this.tone(c, t + o, {
        type: 'triangle',
        f0: f,
        dur: d,
        vol: 0.2,
        vibrato: { rate: 6, depth: 4 },
      })
    }
    this.tone(c, t + 0.66, { type: 'triangle', f0: 247, f1: 165, dur: 0.5, vol: 0.2 })
  }

  pause(): void {
    const c = this.ready()
    if (!c) return
    this.tone(c, c.currentTime, { type: 'square', f0: 720, f1: 440, dur: 0.07, vol: 0.1 })
  }

  resume(): void {
    const c = this.ready()
    if (!c) return
    this.tone(c, c.currentTime, { type: 'square', f0: 440, f1: 720, dur: 0.07, vol: 0.1 })
  }

  /** Generic UI button tap. */
  tap(): void {
    const c = this.ready()
    if (!c) return
    const t = c.currentTime
    this.tone(c, t, { type: 'triangle', f0: 660, f1: 880, dur: 0.06, vol: 0.16 })
  }
}

export const sfx = new Sfx()
