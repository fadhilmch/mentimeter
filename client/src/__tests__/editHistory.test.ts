import { describe, expect, it } from 'vitest'
import { EditHistory } from '../editHistory'

describe('EditHistory', () => {
  it('undoes and redoes steps', () => {
    const h = new EditHistory()
    h.reset('a')
    h.record('b', 0)
    h.record('c', 10_000)
    expect(h.undo()).toBe('b')
    expect(h.undo()).toBe('a')
    expect(h.undo()).toBeNull()
    expect(h.redo()).toBe('b')
    expect(h.canRedo).toBe(true)
  })
  it('collapses rapid typing into one step', () => {
    const h = new EditHistory(800)
    h.reset('')
    h.record('h', 10_000)
    h.record('he', 10_100)
    h.record('hel', 10_200)
    expect(h.undo()).toBe('')
  })
  it('drops the redo branch after a new edit and ignores no-ops', () => {
    const h = new EditHistory()
    h.reset('a')
    h.record('b', 0)
    h.undo()
    h.record('a', 5000)
    expect(h.canUndo).toBe(false)
    h.record('c', 20_000)
    expect(h.canRedo).toBe(false)
    expect(h.undo()).toBe('a')
  })
  it('caps stored steps', () => {
    const h = new EditHistory(0, 3)
    h.reset('0')
    for (let i = 1; i <= 10; i += 1) h.record(String(i), i * 10_000)
    let steps = 0
    while (h.undo() !== null) steps += 1
    expect(steps).toBe(2)
  })
})
