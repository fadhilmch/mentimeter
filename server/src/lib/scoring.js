/**
 * Quiz scoring rules. Tunable in one place.
 *
 * standard: 1 point for each correct answer, however long it took.
 * speed:    a correct answer scores between SPEED_MAX and SPEED_MIN points. Answering at once earns
 *           the maximum; answering at the deadline earns the minimum. Wrong answers score nothing.
 */
export const SPEED_MAX = 1000;
export const SPEED_MIN = 500;
/** Window used for speed scoring when a question has no time limit of its own. */
export const DEFAULT_SPEED_WINDOW_SECONDS = 30;

export const QUIZ_SCORING_MODES = ['standard', 'speed'];
export const TIME_LIMIT_MIN = 5;
export const TIME_LIMIT_MAX = 300;
/** Grace for network delay when an answer arrives right at the deadline. */
export const DEADLINE_GRACE_MS = 1500;

export const normalizeScoring = (mode) => (mode === 'speed' ? 'speed' : 'standard');

export function windowMs(slide) {
  const seconds = slide.timeLimit > 0 ? slide.timeLimit : DEFAULT_SPEED_WINDOW_SECONDS;
  return seconds * 1000;
}

/** Points for one correct answer given the milliseconds it took. Unknown timing counts as the minimum. */
export function pointsForCorrect(mode, slide, elapsedMs) {
  if (normalizeScoring(mode) !== 'speed') return 1;
  if (!Number.isFinite(elapsedMs)) return SPEED_MIN;
  const window = windowMs(slide);
  const fraction = Math.min(Math.max(elapsedMs / window, 0), 1);
  return Math.round(SPEED_MAX - (SPEED_MAX - SPEED_MIN) * fraction);
}
