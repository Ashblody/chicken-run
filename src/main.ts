import './style.css'
import { Game } from './game'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) throw new Error('Canvas #game not found')

new Game(canvas)
