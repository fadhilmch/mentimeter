/** Pure helpers for the quiz countdown. The server owns the deadline; the screen only shows it. */

/** Server time minus this device's clock, so a phone with a wrong clock still counts down correctly. */
export const clockOffset = (serverNow: number, deviceNow: number = Date.now()): number => serverNow - deviceNow

/** Milliseconds left, never below zero. `null` when the timer has not started. */
export function remainingMs(endsAt: number | null | undefined, offsetMs: number, deviceNow: number = Date.now()): number | null {
  if (endsAt === null || endsAt === undefined) return null
  return Math.max(0, endsAt - (deviceNow + offsetMs))
}

/** Whole seconds to show: rounds up, so "0" only appears when time is really up. */
export const secondsLeft = (ms: number): number => Math.ceil(ms / 1000)

/** 1 at the start, 0 at the deadline. */
export function fractionLeft(ms: number, durationSec: number): number {
  return durationSec > 0 ? Math.min(1, Math.max(0, ms / (durationSec * 1000))) : 0
}

export const TIME_LIMIT_CHOICES = [10, 15, 20, 30, 45, 60, 90, 120] as const
