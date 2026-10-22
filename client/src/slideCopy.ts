/** The parts of an editable slide that a copy needs. */
export interface CopyableSlide {
  id?: string
  questionType: string
  question: string
  options: { id?: string; text: string }[]
  correctOptionId?: string
  design?: Record<string, unknown>
}

/**
 * A copy of a slide for the editor: same content and design, but no slide id (the server stamps
 * a new one on save) and fresh option ids, with the quiz answer key remapped to the new options.
 * Votes and responses live on the server under the old ids, so the copy starts empty.
 */
export function copySlide<T extends CopyableSlide>(slide: T, newId: () => string = () => crypto.randomUUID()): T {
  const idMap = new Map<string, string>()
  const options = slide.options.map((option) => {
    const id = newId()
    if (option.id) idMap.set(option.id, id)
    return { ...option, id }
  })
  const { id: _dropped, ...rest } = slide
  return {
    ...rest,
    options,
    correctOptionId: slide.correctOptionId ? idMap.get(slide.correctOptionId) : undefined,
    design: slide.design ? { ...slide.design } : {},
  } as unknown as T
}
