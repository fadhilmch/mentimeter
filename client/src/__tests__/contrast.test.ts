import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(__dirname, '../assets/main.css'), 'utf8')

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const token = (scope: string, name: string) => new RegExp(`${scope}[^}]*?${name}:\\s*(#[0-9a-fA-F]{6})`, 's').exec(css)?.[1] ?? ''

describe('text colour tokens meet WCAG AA (4.5:1)', () => {
  it('light mode muted text on paper and card', () => {
    const ink3 = token(':root \\{', '--ink-3')
    expect(ratio(ink3, token(':root \\{', '--paper'))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(ink3, token(':root \\{', '--card'))).toBeGreaterThanOrEqual(4.5)
  })
  it('light mode error text', () => {
    expect(ratio(token(':root \\{', '--danger-ink'), token(':root \\{', '--paper'))).toBeGreaterThanOrEqual(4.5)
  })
  it('dark mode filled button text on the accent', () => {
    const dark = ":root\\[data-theme='dark'\\] \\{"
    expect(ratio(token(dark, '--on-accent'), token(dark, '--lead'))).toBeGreaterThanOrEqual(4.5)
  })
})
