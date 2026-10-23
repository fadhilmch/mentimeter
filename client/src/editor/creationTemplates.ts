/** The deliberate first step of creating a deck: pick Quiz, Presentation or Blank, name it,
    then land in the same editor. Replaces the old one-click "Untitled presentation" row that
    appeared on the dashboard even when nobody meant to keep it. */

import type { SlideType } from './slideTypes'

export type CreationKind = 'quiz' | 'presentation' | 'blank'

export interface CreationTemplate {
  kind: CreationKind
  name: string
  /** One line on what the choice means for the deck, shown on the choice card. */
  blurb: string
  namePlaceholder: string
  /** Slide type the editor opens with, or null for an empty canvas. */
  starterSlide: SlideType | null
}

export const CREATION_TEMPLATES: CreationTemplate[] = [
  {
    kind: 'quiz',
    name: 'Quiz',
    blurb: 'Right answers, points and a leaderboard. Starts with a quiz slide.',
    namePlaceholder: 'Friday trivia',
    starterSlide: 'quiz',
  },
  {
    kind: 'presentation',
    name: 'Presentation',
    blurb: 'Polls, word clouds and open questions. No scores or leaderboard.',
    namePlaceholder: 'Team kickoff',
    starterSlide: 'multiple-choice',
  },
  {
    kind: 'blank',
    name: 'Blank',
    blurb: 'An empty deck. Add any slide types yourself in the editor.',
    namePlaceholder: 'My presentation',
    starterSlide: null,
  },
]

export const creationTemplate = (kind: CreationKind) => CREATION_TEMPLATES.find((t) => t.kind === kind)!

/** Reads the one-time start hint the dashboard passes to the editor after creating a deck. */
export function creationKindFromQuery(value: unknown): CreationKind | null {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === 'quiz' || raw === 'presentation' || raw === 'blank' ? raw : null
}
