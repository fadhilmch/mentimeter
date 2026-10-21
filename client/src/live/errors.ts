/** True when a live-action error means the presentation no longer exists (deleted by its owner). */
export function isPresentationGone(message: string): boolean {
  return /presentation is gone|no presentation with that code/i.test(message)
}
