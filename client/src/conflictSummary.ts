interface SlideLike { id?: string; question: string; questionType: string; options: { text: string }[] }
interface DocLike { title: string; slides: SlideLike[] }

/** Plain-language differences between the editor's version and the saved one, for the conflict panel. */
export function summarizeConflict(mine: DocLike, theirs: DocLike): string[] {
  const lines: string[] = []
  if (mine.title.trim() !== theirs.title.trim()) lines.push(`Title: yours "${mine.title.trim()}", saved "${theirs.title.trim()}"`)
  const mineById = new Map(mine.slides.filter((s) => s.id).map((s) => [s.id as string, s]))
  const theirById = new Map(theirs.slides.filter((s) => s.id).map((s) => [s.id as string, s]))
  for (const [id, t] of theirById) {
    const m = mineById.get(id)
    if (!m) {
      lines.push(`Added elsewhere: "${t.question}"`)
      continue
    }
    if (m.question.trim() !== t.question.trim()) lines.push(`Question changed: yours "${m.question.trim()}", saved "${t.question.trim()}"`)
    const mo = m.options.map((o) => o.text.trim()).join(' | ')
    const to = t.options.map((o) => o.text.trim()).join(' | ')
    if (mo !== to) lines.push(`Options changed on "${t.question}": yours [${mo}], saved [${to}]`)
  }
  for (const [id, m] of mineById) if (!theirById.has(id)) lines.push(`Removed elsewhere: "${m.question}"`)
  const newHere = mine.slides.filter((s) => !s.id).length
  if (newHere) lines.push(`${newHere} new slide${newHere === 1 ? '' : 's'} only in your version`)
  if (!lines.length) lines.push('The saved version has the same text; only its internal revision moved.')
  return lines
}
