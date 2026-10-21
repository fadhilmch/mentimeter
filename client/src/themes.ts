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
  /** categorical chart palette: one stable color per answer */
  pal: string[];
}

export const THEMES: PresentationTheme[] = [
  { id: 'iris', name: 'Iris (default)', sbg: '#111113', stage2: '#1c1c1f', track: 'rgba(255,255,255,0.13)', acc: '#5b5bd6', pal: ['#6e6ade', '#ffb224', '#30a46c', '#e93d82', '#0091ff', '#ffc53d'] },
  { id: 'apricot', name: 'Ink + Apricot', sbg: '#17120d', stage2: '#241b13', track: 'rgba(255,255,255,0.13)', acc: '#ffc9a3', pal: ['#f0945a', '#ffc53d', '#4cc38a', '#6ea8fe', '#e5a0d2', '#ffe27a'] },
  { id: 'plum', name: 'Plum + Peach', sbg: '#1c0f22', stage2: '#2a1733', track: 'rgba(255,255,255,0.13)', acc: '#ffb894', pal: ['#d65ca0', '#ffb894', '#9b8afb', '#3dd9c4', '#ff8a5c', '#ffe0ec'] },
  { id: 'cobalt', name: 'Cobalt + Butter', sbg: '#0b1322', stage2: '#14203a', track: 'rgba(255,255,255,0.13)', acc: '#ffcf4d', pal: ['#4d7ef0', '#ffcf4d', '#ff8a5c', '#3dd68c', '#b08cff', '#7ad4f0'] },
];

export function getTheme(id?: string): PresentationTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function themeVars(theme: PresentationTheme): Record<string, string> {
  return {
    '--t-sbg': theme.sbg,
    '--t-stage2': theme.stage2,
    '--t-track': theme.track,
    '--t-acc': theme.acc,
  };
}
