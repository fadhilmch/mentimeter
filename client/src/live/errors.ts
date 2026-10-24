/** True when a live-action error means the presentation no longer exists (deleted by its owner). */
export function isPresentationGone(message: string): boolean {
  return /presentation is gone|no presentation with that code|session has ended/i.test(message)
}

/** True when the server says this code belonged to a session that has ended (it is not unknown or deleted). */
export function isSessionEnded(message: string): boolean {
  return /session has ended/i.test(message)
}
