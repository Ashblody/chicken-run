import type { ChallengeDef, ChallengeId } from './types'

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'klasika',
    title: 'Classic',
    desc: '90 seconds — far chickens are worth more points!',
    icon: '🏆',
    duration: 90,
  },
  {
    id: 'ujeni20',
    title: 'Catch 20 Chickens',
    desc: 'Catch 20 chickens in 90 seconds.',
    icon: '🐔',
    duration: 90,
    catchGoal: 20,
  },
  {
    id: 'zlata',
    title: 'Golden Hunt',
    desc: 'Only golden chickens count — distance points plus gold bonus. Reach 100!',
    icon: '⭐',
    duration: 90,
    scoreGoal: 100,
    goldOnly: true,
    goldBoost: 0.45,
  },
  {
    id: 'natancno',
    title: 'No Misses',
    desc: 'No missed shots! Catch 12 chickens.',
    icon: '🎯',
    duration: 90,
    catchGoal: 12,
    noMiss: true,
  },
  {
    id: 'prezivi',
    title: 'Survive 90s',
    desc: 'Score at least 200 points before time runs out.',
    icon: '⏱️',
    duration: 90,
    scoreGoal: 200,
    surviveFull: true,
  },
]

// Note: challenge ids are internal (used for saved stars); they are never shown to players.
const STARS_KEY = 'chickenrun-challenge-stars'

export function loadStars(): Record<ChallengeId, number> {
  const empty = Object.fromEntries(
    CHALLENGES.map((c) => [c.id, 0]),
  ) as Record<ChallengeId, number>
  try {
    const raw = localStorage.getItem(STARS_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<Record<ChallengeId, number>>
    for (const c of CHALLENGES) {
      const v = Number(parsed[c.id] || 0)
      empty[c.id] = Math.max(0, Math.min(3, Math.floor(v)))
    }
  } catch {
    /* ignore */
  }
  return empty
}

export function saveStar(id: ChallengeId, stars: number): void {
  const cur = loadStars()
  cur[id] = Math.max(cur[id], Math.max(0, Math.min(3, stars)))
  localStorage.setItem(STARS_KEY, JSON.stringify(cur))
}

export function getChallenge(id: ChallengeId): ChallengeDef {
  return CHALLENGES.find((c) => c.id === id) ?? CHALLENGES[0]!
}

/** Stars 1–3 for a successful clear */
export function starsForClear(
  def: ChallengeDef,
  score: number,
  caught: number,
  misses: number,
): number {
  if (def.id === 'klasika') {
    if (score >= 400) return 3
    if (score >= 250) return 2
    if (score >= 100) return 1
    return 1 // finished round counts as at least 1
  }
  if (def.noMiss && misses === 0) {
    if (caught >= (def.catchGoal ?? 12) + 8) return 3
    if (caught >= (def.catchGoal ?? 12) + 4) return 2
    return 1
  }
  if (def.goldOnly) {
    if (score >= 200) return 3
    if (score >= 150) return 2
    return 1
  }
  if (def.surviveFull) {
    if (score >= 350) return 3
    if (score >= 275) return 2
    return 1
  }
  if (def.catchGoal) {
    if (caught >= def.catchGoal + 10) return 3
    if (caught >= def.catchGoal + 5) return 2
    return 1
  }
  return 1
}

export function starString(n: number): string {
  return '★'.repeat(n) + '☆'.repeat(3 - n)
}
