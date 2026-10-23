/** Shared slide-type metadata for the editor: the sorter, the Add a slide sheet
    and the edit form all read from this one list. */

export type { SlideType } from '../types'
import type { SlideType } from '../types'

export interface SlideTypeMeta {
  type: SlideType
  /** Full name, e.g. in the sheet and the sorter on wide screens. */
  label: string
  /** Short name for the phone sorter strip. */
  short: string
  /** One-line explanation, shown in the Add a slide sheet and under the edit form. */
  hint: string
  hasOptions: boolean
  /** False for layout slides: content only, nothing for the audience to answer. */
  interactive: boolean
}

export const SLIDE_TYPES: SlideTypeMeta[] = [
  { type: 'multiple-choice', label: 'Multiple choice', short: 'Choice', hint: 'Options with live bars as votes come in.', hasOptions: true, interactive: true },
  { type: 'quiz', label: 'Quiz', short: 'Quiz', hint: 'Mark the correct answer. Scores and a leaderboard.', hasOptions: true, interactive: true },
  { type: 'word-cloud', label: 'Word cloud', short: 'Cloud', hint: 'One word per person; repeated words grow bigger.', hasOptions: false, interactive: true },
  { type: 'rating', label: 'Rating', short: 'Rating', hint: 'The audience rates 1-10; the stage shows the average.', hasOptions: false, interactive: true },
  { type: 'ranking', label: 'Ranking', short: 'Ranking', hint: 'The audience orders your options; points build the ranking.', hasOptions: true, interactive: true },
  { type: 'open-ended', label: 'Open question', short: 'Open', hint: 'Free-text answers the room can upvote.', hasOptions: false, interactive: true },
  { type: 'title', label: 'Title slide', short: 'Title', hint: 'A big title with a subtitle. Nothing to answer.', hasOptions: false, interactive: false },
  { type: 'columns', label: 'Columns', short: 'Columns', hint: 'Two or three blocks of text side by side. Nothing to answer.', hasOptions: false, interactive: false },
  { type: 'image', label: 'Image only', short: 'Image', hint: 'A full-width picture with an optional caption. Nothing to answer.', hasOptions: false, interactive: false },
]

const byType = (type: SlideType) => SLIDE_TYPES.find((t) => t.type === type)

export const typeLabel = (type: SlideType) => byType(type)?.label ?? type
export const typeShort = (type: SlideType) => byType(type)?.short ?? type
export const typeHint = (type: SlideType) => byType(type)?.hint ?? ''
export const hasOptions = (type: SlideType) => byType(type)?.hasOptions ?? false

export const isInteractive = (type: SlideType) => byType(type)?.interactive ?? true
