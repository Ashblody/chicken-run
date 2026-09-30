import './style.css'
import { Game } from './game'
import { chickenCenter, chickenHitRadius } from './chicken'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas #game not found')

const game = new Game(canvas)

// Dev-only test hook (stripped from production builds)
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__cr = { game, chickenCenter, chickenHitRadius }
}
