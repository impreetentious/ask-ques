import type { Theme, ThemeName } from './types';

/**
 * Colour schemes. To add one, add an entry — the builder page picks these up
 * automatically and the hash codec stores the key, so links stay short.
 *
 * `onAccent` is picked for contrast against `accent`, not for taste: coral and
 * amber are both too light to carry white text at button sizes.
 */
export const THEMES: Record<ThemeName, Theme> = {
  midnight: {
    label: 'Midnight',
    paper: '#0b0a14',
    paperDeep: '#05040b',
    ink: '#f4eef6',
    muted: '#a094ad',
    glow: '#ff6b8b',
    accent: '#ff5d7e',
    accentDeep: '#c8305a',
    onAccent: '#2b0512',
    petals: ['#ff5d7e', '#ff9bb0', '#ffd3dd', '#c8305a', '#ffe9ef'],
  },
  ember: {
    label: 'Ember',
    paper: '#100c08',
    paperDeep: '#070502',
    ink: '#f7efe2',
    muted: '#b0a08a',
    glow: '#ffb347',
    accent: '#ffa62b',
    accentDeep: '#c9741a',
    onAccent: '#241300',
    petals: ['#ffa62b', '#ffcd7a', '#ffe9c4', '#c9741a', '#fff3e0'],
  },
  bloom: {
    label: 'Bloom (light)',
    paper: '#fbf3ee',
    paperDeep: '#f0e0d7',
    ink: '#2a1b21',
    muted: '#7c6169',
    glow: '#e8829b',
    accent: '#d13c62',
    accentDeep: '#9c2646',
    onAccent: '#fff6f8',
    petals: ['#d13c62', '#ef8fa8', '#f8c9d5', '#9c2646', '#ffe6ec'],
  },
  orbit: {
    label: 'Orbit',
    paper: '#050f12',
    paperDeep: '#020809',
    ink: '#e6f7f5',
    muted: '#8bb0ac',
    glow: '#4fe3c1',
    accent: '#3ddcb8',
    accentDeep: '#199f81',
    onAccent: '#00201a',
    petals: ['#3ddcb8', '#8ef0da', '#cdfaef', '#199f81', '#e8fff9'],
  },
};

export const DEFAULT_THEME: ThemeName = 'midnight';

export function themeFor(name: string | undefined): Theme {
  const theme = name === undefined ? undefined : THEMES[name];
  return theme ?? (THEMES[DEFAULT_THEME] as Theme);
}
