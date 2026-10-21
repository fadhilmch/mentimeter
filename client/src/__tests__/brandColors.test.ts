import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEMES, contrast, themeVars } from '../themes'

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
const css = read('assets/main.css')
const token = (name: string, block = css) => block.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase()
const fills = new Set([...read('assets/logo-mark.svg').matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1].toLowerCase()))

describe('the app uses the logo colours', () => {
  it('base indigo, pink and amber are the logo file values', () => {
    expect(fills).toEqual(new Set(['#5757db', '#f12f83', '#ffb224']))
    expect(token('--lead')).toBe('#5757db')
    expect(token('--signal')).toBe('#f12f83')
    expect(token('--warmth')).toBe('#ffb224')
    expect(token('--t-acc')).toBe('#5757db')
    const iris = THEMES.find((t) => t.id === 'iris')!
    expect(iris.acc).toBe('#5757db')
    expect(iris.pal).toContain('#f12f83')
    expect(iris.pal).toContain('#ffb224')
  })

  it('keeps text readable: white on indigo, indigo text on the soft tint, dark text on amber', () => {
    expect(contrast('#ffffff', '#5757db')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#5757db', '#f0f1fe')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#5151cd', '#f0f1fe')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#111113', '#ffb224')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the lighter indigo variant for dark mode, where the logo indigo is too dim for text', () => {
    const dark = css.slice(css.indexOf(":root[data-theme='dark']"))
    expect(token('--lead', dark)).toBe('#7d7de8')
    expect(contrast('#7d7de8', '#111113')).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps the first chart colour readable as a graphic (3:1) on the stage in both modes', () => {
    const iris = THEMES.find((t) => t.id === 'iris')!
    for (const mode of ['light', 'dark'] as const) {
      const v = themeVars(iris, mode)
      expect(contrast(iris.pal[0], v['--t-sbg'])).toBeGreaterThanOrEqual(3)
    }
  })
})
