/** A name only matters on the quiz leaderboard, so only decks with a quiz slide ask for one. */
export function deckHasQuiz(slides: { questionType: string }[] | undefined): boolean {
  return (slides ?? []).some((slide) => slide.questionType === 'quiz')
}

/** Offer the optional name prompt once: quiz decks only, and not if a name is saved or the prompt was dismissed. */
export function shouldAskForName(
  slides: { questionType: string }[] | undefined,
  savedNickname: string | null | undefined,
  dismissed: boolean,
): boolean {
  return deckHasQuiz(slides) && !savedNickname?.trim() && !dismissed
}
