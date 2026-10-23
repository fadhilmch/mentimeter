/** Slide image upload: the browser shrinks the picture first, so uploads stay small and phones load them fast. */

export const MAX_IMAGE_EDGE = 1600
export const MAX_UPLOAD_BYTES = 600 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** Size that fits inside `max` on the long edge, keeping the shape. Never enlarges. */
export function fitWithin(width: number, height: number, max: number = MAX_IMAGE_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const scale = max / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Why a chosen file cannot be used, or null when it can. */
export function imageFileProblem(file: { type: string; size: number }): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Choose a JPEG, PNG or WebP image.'
  if (file.size > 25 * 1024 * 1024) return 'That file is too large. Choose an image under 25 MB.'
  return null
}

/** Loads the file, scales it down and encodes it as JPEG, lowering quality until it fits the upload limit. */
export async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize images.')
  // JPEG has no transparency: paint white first so transparent PNGs do not turn black.
  context.fillStyle = 'white'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  for (const quality of [0.86, 0.74, 0.62, 0.5, 0.4]) {
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob
  }
  throw new Error('That image is too detailed to shrink enough. Try a smaller one.')
}
