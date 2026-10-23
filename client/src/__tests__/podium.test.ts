import { describe, expect, it } from 'vitest'
import { placeLabel, podiumDisplayOrder, podiumPlaces, scoreLabel, scoringHint } from '../podium'

const entry = (name: string, score: number, rank: number) => ({ key: name, name, score, rank })

describe('winners podium', () => {
  it('groups the top three ranks', () => {
    const places = podiumPlaces([entry('Ada', 3, 1), entry('Bo', 2, 2), entry('Cy', 1, 3), entry('Di', 0, 4)])
    expect(places.map((p) => [p.rank, p.entries.map((e) => e.name)])).toEqual([[1, ['Ada']], [2, ['Bo']], [3, ['Cy']]])
  })

  it('players who tie share a place and the next rank is skipped', () => {
    const places = podiumPlaces([entry('Ada', 3, 1), entry('Bo', 3, 1), entry('Cy', 1, 3)])
    expect(places.map((p) => [p.rank, p.entries.length])).toEqual([[1, 2], [3, 1]])
    expect(placeLabel(places[0])).toBe('Ada & Bo')
  })

  it('shortens a big tie to one line', () => {
    const places = podiumPlaces([entry('Ada', 3, 1), entry('Bo', 3, 1), entry('Cy', 3, 1), entry('Di', 3, 1)])
    expect(placeLabel(places[0])).toBe('Ada & 3 others')
  })

  it('shows second, first, third left to right and copes with a small field', () => {
    const full = podiumDisplayOrder(podiumPlaces([entry('Ada', 3, 1), entry('Bo', 2, 2), entry('Cy', 1, 3)]))
    expect(full.map((p) => p.rank)).toEqual([2, 1, 3])
    expect(podiumDisplayOrder(podiumPlaces([entry('Ada', 3, 1)])).map((p) => p.rank)).toEqual([1])
    expect(podiumPlaces(null)).toEqual([])
  })

  it('words the score for the scoring mode', () => {
    expect(scoreLabel(1, 'standard')).toBe('1 pt')
    expect(scoreLabel(3, undefined)).toBe('3 pts')
    expect(scoreLabel(1750, 'speed')).toBe('1,750 pts')
    expect(scoringHint('speed')).toMatch(/faster/i)
    expect(scoringHint('standard')).toMatch(/correct answer adds a point/i)
  })
})
