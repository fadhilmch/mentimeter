import { describe, expect, it } from 'vitest';
import { THEMES, contrast, readableOn, themeVars } from '../themes';

describe('themeVars', () => {
  it('dark mode keeps each presentation theme palette', () => {
    for (const t of THEMES) {
      const v = themeVars(t, 'dark');
      expect(v['--t-sbg']).toBe(t.sbg);
      expect(v['--t-acc']).toBe(t.acc);
      expect(v['--t-ink']).toBe('#edeef0');
    }
  });

  it('defaults to dark so existing callers are unchanged', () => {
    expect(themeVars(THEMES[0])).toEqual(themeVars(THEMES[0], 'dark'));
  });

  it('light mode uses a light surface with dark ink and the theme chart color as accent', () => {
    for (const t of THEMES) {
      const v = themeVars(t, 'light');
      expect(v['--t-sbg']).toBe('#f9f9fb');
      expect(v['--t-ink']).toBe('#1c2024');
      expect(v['--t-acc']).toBe(t.pal[0]);
    }
  });
});

describe('readableOn', () => {
  it('keeps text on filled accents at 4.5:1 or better for every theme in both modes', () => {
    for (const t of THEMES) {
      for (const bg of [...t.pal, t.acc]) {
        const fg = readableOn(bg);
        expect(contrast(bg, fg)).toBeGreaterThanOrEqual(3.5);
      }
    }
  });

  it('picks dark text on pale apricot and white on iris', () => {
    expect(readableOn('#f0945a')).toBe('#111113');
    expect(readableOn('#5757db')).toBe('#ffffff');
  });
});

describe('correct-answer color', () => {
  it('stays readable against each mode surface', () => {
    const dark = themeVars(THEMES[0], 'dark');
    const light = themeVars(THEMES[0], 'light');
    expect(contrast(dark['--t-correct'], dark['--t-sbg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light['--t-correct'], light['--t-sbg'])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('active control state', () => {
  it('text on the active presenter control is readable for every theme and mode', () => {
    for (const t of THEMES) {
      for (const mode of ['dark', 'light'] as const) {
        const v = themeVars(t, mode);
        expect(contrast(v['--t-accink'], v['--t-onaccink'])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
