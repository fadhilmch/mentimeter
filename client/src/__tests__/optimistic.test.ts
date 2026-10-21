import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { setThenSave } from '../optimistic'

const fail = () => Promise.reject(new Error('Disconnected'))

describe('setThenSave', () => {
  it('shows the answer while saving and keeps it once saved', async () => {
    const mine = reactive<Record<number, number>>({})
    let during: number | undefined
    await setThenSave(mine, 2, 7, async () => { during = mine[2] })
    expect(during).toBe(7)
    expect(mine[2]).toBe(7)
  })

  it('removes a first answer that was refused, so it is not shown as saved', async () => {
    const ratings = reactive<Record<number, number>>({})
    await expect(setThenSave(ratings, 0, 9, fail)).rejects.toThrow('Disconnected')
    expect(0 in ratings).toBe(false)
  })

  it('puts the earlier answer back when a change is refused', async () => {
    const ratings = reactive<Record<number, number>>({ 0: 4 })
    await expect(setThenSave(ratings, 0, 9, fail)).rejects.toThrow('Disconnected')
    expect(ratings[0]).toBe(4)
  })

  it('treats an earlier answer of 0 as an answer, not as missing', async () => {
    const votes = reactive<Record<number, number>>({ 1: 0 })
    await expect(setThenSave(votes, 1, 2, fail)).rejects.toThrow()
    expect(votes[1]).toBe(0)
  })
})
