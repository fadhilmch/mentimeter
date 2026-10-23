import { describe, expect, it } from 'vitest'
import { deleteBlock, fitWithin, imageFileProblem, uploadQuota } from '../imageUpload'
import { imageSrc } from '../api'

describe('image upload helpers', () => {
  it('shrinks to the long edge and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })

  it('never enlarges a small picture', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })

  it('refuses files that are not jpeg, png or webp', () => {
    expect(imageFileProblem({ type: 'image/png', size: 1000 })).toBeNull()
    expect(imageFileProblem({ type: 'image/webp', size: 1000 })).toBeNull()
    expect(imageFileProblem({ type: 'image/svg+xml', size: 1000 })).toMatch(/JPEG, PNG or WebP/)
    expect(imageFileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/JPEG, PNG or WebP/)
    expect(imageFileProblem({ type: 'image/jpeg', size: 30 * 1024 * 1024 })).toMatch(/too large/)
  })

  it('serves uploaded images from the API and leaves other links alone', () => {
    expect(imageSrc('/api/media/0123456789abcdef01234567')).toBe('/api/media/0123456789abcdef01234567')
    expect(imageSrc('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(imageSrc(undefined)).toBeUndefined()
  })

  it('blocks deleting an image that is selected or used, and says where', () => {
    const free = { url: '/api/media/a', usedIn: [] }
    expect(deleteBlock(free, undefined)).toBe('')
    expect(deleteBlock(free, '/api/media/a')).toMatch(/Remove it from the slide/)
    expect(deleteBlock({ url: '/api/media/b', usedIn: [{ title: 'Kickoff' }] }, undefined)).toContain('"Kickoff"')
  })

  it('words the upload quota, including when it is full', () => {
    expect(uploadQuota(3, 200)).toBe('3 of 200 uploads used')
    expect(uploadQuota(200, 200)).toMatch(/Delete images/)
  })
})
