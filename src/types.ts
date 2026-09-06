export type ChickenState = 'flying' | 'hit' | 'falling' | 'poof' | 'gone'

export interface DepthLayer {
  scale: number
  speed: number
  points: number
  yMin: number
  yMax: number
}

export interface Chicken {
  id: number
  x: number
  y: number
  vx: number
  facing: 1 | -1
  layer: DepthLayer
  state: ChickenState
  flap: number
  hitT: number
  fallVy: number
  poofT: number
  wobble: number
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  vy: number
}

export interface Poof {
  x: number
  y: number
  life: number
  scale: number
}

export type GamePhase = 'menu' | 'playing' | 'over'
