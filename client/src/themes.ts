export interface PresentationTheme {
  id: 'iris' | 'apricot' | 'plum' | 'cobalt';
  name: string;
  /** stage background */
  sbg: string;
  /** raised surface on the stage (topbar, chips) */
  stage2: string;
  /** bar track on the stage */
  track: string;
  /** theme accent (join chip, highlights) */
  acc: string;
  /** accent ink for text on the dark stage (>= 4.5:1 on track) */
  accInk: string;
  /** categorical chart palette: one stable color per answer */
  pal: string[];
}

export const THEMES: PresentationTheme[] = [
  { id: 'iris', name: 'Candy (default)', sbg: '#111113', stage2: '#1c1c1f', track: 'rgba(255,255,255,0.13)', acc: '#5757db', accInk: '#b8baf8', pal: ['#5757db', '#f12f83', '#ffb224', '#b18cff', '#ff7a5c', '#ffc53d'] },
  { id: 'apricot', name: 'Ink + Apricot', sbg: '#17120d', stage2: '#241b13', track: 'rgba(255,255,255,0.13)', acc: '#ffc9a3', accInk: '#ffc9a3', pal: ['#f0945a', '#ffc53d', '#4cc38a', '#6ea8fe', '#e5a0d2', '#ffe27a'] },
  { id: 'plum', name: 'Plum + Peach', sbg: '#1c0f22', stage2: '#2a1733', track: 'rgba(255,255,255,0.13)', acc: '#ffb894', accInk: '#ffb894', pal: ['#d65ca0', '#ffb894', '#9b8afb', '#3dd9c4', '#ff8a5c', '#ffe0ec'] },
  { id: 'cobalt', name: 'Cobalt + Butter', sbg: '#0b1322', stage2: '#14203a', track: 'rgba(255,255,255,0.13)', acc: '#ffcf4d', accInk: '#ffcf4d', pal: ['#4d7ef0', '#ffcf4d', '#ff8a5c', '#3dd68c', '#b08cff', '#7ad4f0'] },
];

export function getTheme(id?: string): PresentationTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export type ColorMode = 'light' | 'dark';

/** Light stage surfaces: shared across presentation themes, accent follows the theme's first chart color. */
export function themeVars(theme: PresentationTheme, mode: ColorMode = 'dark'): Record<string, string> {
  if (mode === 'light') {
    return {
      '--t-sbg': '#f9f9fb',
      '--t-stage2': '#ffffff',
      '--t-track': 'rgba(28,32,36,0.09)',
      '--t-acc': theme.pal[0],
      '--t-accink': '#3e3fa0',
      '--t-onaccink': readableOn('#3e3fa0'),
      '--t-ink': '#1c2024',
      '--t-correct': '#18794e',
    };
  }
  return {
    '--t-sbg': theme.sbg,
    '--t-stage2': theme.stage2,
    '--t-track': theme.track,
    '--t-acc': theme.acc,
    '--t-accink': theme.accInk,
    '--t-onaccink': readableOn(theme.accInk),
    '--t-ink': '#edeef0',
    '--t-correct': '#3dd68c',
  };
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG contrast ratio of two #rrggbb colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text color (white or near-black) with the better contrast on a filled accent. */
export function readableOn(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#111113') ? '#ffffff' : '#111113';
}
