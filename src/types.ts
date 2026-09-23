export type ChickenState = 'flying' | 'hit' | 'falling' | 'poof' | 'gone'

export type ChickenPalette = 'brown' | 'ginger' | 'white' | 'speckle' | 'gold'

export interface DepthLayer {
  scale: number
  speed: number
  points: number
  yMin: number
  yMax: number
  /** @deprecated Gold is palette-only; kept optional for compat */
  gold?: boolean
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
  palette: ChickenPalette
}

export interface Floater {
  x: number
  y: number
  text: string
  life: number
  vy: number
  color?: string
}

export type GamePhase = 'menu' | 'playing' | 'over'

export type ChallengeId =
  | 'klasika'
  | 'ujeni20'
  | 'zlata'
  | 'natancno'
  | 'prezivi'

export interface ChallengeDef {
  id: ChallengeId
  title: string
  desc: string
  icon: string
  /** Round length in seconds */
  duration: number
  /** Catch N chickens to win (optional) */
  catchGoal?: number
  /** Score goal to win (optional) */
  scoreGoal?: number
  /** Only gold-palette chickens count for score/catch */
  goldOnly?: boolean
  /** Any miss fails immediately */
  noMiss?: boolean
  /** Must last full duration (timer hits 0) with goals met */
  surviveFull?: boolean
  /** Boost gold chicken spawn chance 0–1 */
  goldBoost?: number
}
