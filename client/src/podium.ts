import type { LeaderboardEntry } from './types'

export interface PodiumPlace {
  /** 1, 2 or 3: competition rank, so players who tie share a place. */
  rank: number
  entries: LeaderboardEntry[]
}

/** The places for the winners' podium: everyone ranked 1 to 3, grouped by rank. Ties share a place. */
export function podiumPlaces(board: LeaderboardEntry[] | null | undefined): PodiumPlace[] {
  const places: PodiumPlace[] = []
  for (const entry of board ?? []) {
    if (entry.rank < 1 || entry.rank > 3) continue
    const place = places.find((p) => p.rank === entry.rank)
    if (place) place.entries.push(entry)
    else places.push({ rank: entry.rank, entries: [entry] })
  }
  return places.sort((a, b) => a.rank - b.rank)
}

/** Podium order left to right: 2nd, 1st, 3rd. Missing places are skipped. */
export const podiumDisplayOrder = (places: PodiumPlace[]): PodiumPlace[] =>
  [2, 1, 3].flatMap((rank) => places.filter((p) => p.rank === rank))

/** "Ada", "Ada & Bo" or "Ada & 2 others": a podium place has room for one short line. */
export function placeLabel(place: PodiumPlace): string {
  const [first, ...rest] = place.entries
  if (!first) return ''
  if (rest.length === 0) return first.name
  if (rest.length === 1) return `${first.name} & ${rest[0].name}`
  return `${first.name} & ${rest.length} others`
}

/** Score text that matches the scoring mode: a point per correct answer, or faster-is-more points. */
export const scoreLabel = (score: number, scoring: 'standard' | 'speed' | undefined): string =>
  scoring === 'speed' ? `${score.toLocaleString('en-US')} pts` : `${score} pt${score === 1 ? '' : 's'}`

/** One sentence under the board that explains how the points were earned. */
export const scoringHint = (scoring: 'standard' | 'speed' | undefined): string =>
  scoring === 'speed' ? 'Faster correct answers score more.' : 'Every correct answer adds a point.'
