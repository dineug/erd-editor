import { ValuesType } from '@/internal-types';

export const Appearance = {
  dark: 'dark',
  light: 'light',
} as const;
export type Appearance = ValuesType<typeof Appearance>;

export const GrayColor = {
  gray: 'gray',
  mauve: 'mauve',
  slate: 'slate',
  sage: 'sage',
  olive: 'olive',
  sand: 'sand',
} as const;
export type GrayColor = ValuesType<typeof GrayColor>;

export const AccentColor = {
  gray: 'gray',
  gold: 'gold',
  bronze: 'bronze',
  brown: 'brown',
  yellow: 'yellow',
  amber: 'amber',
  orange: 'orange',
  tomato: 'tomato',
  red: 'red',
  ruby: 'ruby',
  crimson: 'crimson',
  pink: 'pink',
  plum: 'plum',
  purple: 'purple',
  violet: 'violet',
  iris: 'iris',
  indigo: 'indigo',
  blue: 'blue',
  cyan: 'cyan',
  teal: 'teal',
  jade: 'jade',
  green: 'green',
  grass: 'grass',
  lime: 'lime',
  mint: 'mint',
  sky: 'sky',
} as const;
export type AccentColor = ValuesType<typeof AccentColor>;

export type ThemeOptions = {
  appearance: Appearance | 'auto';
  grayColor: GrayColor;
  accentColor: AccentColor;
};
