/** A name only matters on the quiz leaderboard, so only decks with a quiz slide ask for one. */
export function deckHasQuiz(slides: { questionType: string }[] | undefined): boolean {
  return (slides ?? []).some((slide) => slide.questionType === 'quiz')
}

/** Players must choose a nickname before their first quiz question, and only then (never on polls or plain decks).
 *  A name saved on this device from an earlier quiz counts as chosen. */
export function shouldPromptNow(
  slides: { questionType: string }[] | undefined,
  currentSlide: number,
  savedNickname: string | null | undefined,
): boolean {
  return slides?.[currentSlide]?.questionType === 'quiz' && !savedNickname?.trim()
}
