// Undo/redo for the editor. Stores whole-document JSON snapshots. Rapid edits
// (typing) within `windowMs` collapse into one step.
export class EditHistory {
  private stack: string[] = []
  private index = -1
  private lastAt = 0
  constructor(private windowMs = 800, private limit = 100) {}

  /** Set the starting point (after load or save). Clears history. */
  reset(snapshot: string): void {
    this.stack = [snapshot]
    this.index = 0
    this.lastAt = 0
  }

  record(snapshot: string, now = Date.now()): void {
    if (this.index < 0 || snapshot === this.stack[this.index]) return
    this.stack.length = this.index + 1 // a new edit drops the redo branch
    const coalesce = this.index > 0 && now - this.lastAt < this.windowMs
    if (coalesce) this.stack[this.index] = snapshot
    else {
      this.stack.push(snapshot)
      this.index += 1
      if (this.stack.length > this.limit) {
        this.stack.shift()
        this.index -= 1
      }
    }
    this.lastAt = now
  }

  get canUndo(): boolean { return this.index > 0 }
  get canRedo(): boolean { return this.index >= 0 && this.index < this.stack.length - 1 }

  undo(): string | null {
    if (!this.canUndo) return null
    this.index -= 1
    this.lastAt = 0
    return this.stack[this.index]
  }

  redo(): string | null {
    if (!this.canRedo) return null
    this.index += 1
    this.lastAt = 0
    return this.stack[this.index]
  }
}
