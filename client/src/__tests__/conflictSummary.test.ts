import { describe, expect, it } from 'vitest'
import { summarizeConflict } from '../conflictSummary'

const s = (id: string | undefined, question: string, options: string[] = ['a', 'b']) => ({ id, question, questionType: 'multiple-choice', options: options.map((text) => ({ text })) })

describe('summarizeConflict', () => {
  it('reports title, question, option, added and removed differences', () => {
    const lines = summarizeConflict(
      { title: 'Mine', slides: [s('1', 'Q1'), s('2', 'Q2'), s(undefined, 'New')] },
      { title: 'Theirs', slides: [s('1', 'Q1 edited'), s('3', 'Q3', ['x']), s('2', 'Q2', ['a', 'c'])] },
    )
    expect(lines.join('\n')).toContain('Title: yours "Mine", saved "Theirs"')
    expect(lines.join('\n')).toContain('Question changed: yours "Q1", saved "Q1 edited"')
    expect(lines.join('\n')).toContain('Added elsewhere: "Q3"')
    expect(lines.join('\n')).toContain('Options changed on "Q2"')
    expect(lines.join('\n')).toContain('1 new slide only in your version')
  })
  it('says so when only the revision moved', () => {
    expect(summarizeConflict({ title: 'T', slides: [s('1', 'Q')] }, { title: 'T', slides: [s('1', 'Q')] })[0]).toMatch(/same text/)
  })
})
