/** Shared slide-type metadata for the editor: the sorter, the Add a slide sheet
    and the edit form all read from this one list. */

export type SlideType = 'multiple-choice' | 'open-ended' | 'word-cloud' | 'rating' | 'ranking' | 'quiz'

export interface SlideTypeMeta {
  type: SlideType
  /** Full name, e.g. in the sheet and the sorter on wide screens. */
  label: string
  /** Short name for the phone sorter strip. */
  short: string
  /** One-line explanation, shown in the Add a slide sheet and under the edit form. */
  hint: string
  hasOptions: boolean
}

export const SLIDE_TYPES: SlideTypeMeta[] = [
  { type: 'multiple-choice', label: 'Multiple choice', short: 'Poll', hint: 'Options with live bars as votes come in.', hasOptions: true },
  { type: 'quiz', label: 'Quiz', short: 'Quiz', hint: 'Mark the correct answer. Scores and a leaderboard.', hasOptions: true },
  { type: 'word-cloud', label: 'Word cloud', short: 'Cloud', hint: 'One word per person; repeated words grow bigger.', hasOptions: false },
  { type: 'rating', label: 'Rating', short: 'Rating', hint: 'The audience rates 1-10; the stage shows the average.', hasOptions: false },
  { type: 'ranking', label: 'Ranking', short: 'Ranking', hint: 'The audience orders your options; points build the ranking.', hasOptions: true },
  { type: 'open-ended', label: 'Open question', short: 'Open', hint: 'Free-text answers the room can upvote.', hasOptions: false },
]

const byType = (type: SlideType) => SLIDE_TYPES.find((t) => t.type === type)

export const typeLabel = (type: SlideType) => byType(type)?.label ?? type
export const typeShort = (type: SlideType) => byType(type)?.short ?? type
export const typeHint = (type: SlideType) => byType(type)?.hint ?? ''
export const hasOptions = (type: SlideType) => byType(type)?.hasOptions ?? false
