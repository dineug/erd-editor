import {
  amber,
  amberA,
  amberDark,
  amberDarkA,
  blue,
  blueA,
  blueDark,
  blueDarkA,
  bronze,
  bronzeA,
  bronzeDark,
  bronzeDarkA,
  brown,
  brownA,
  brownDark,
  brownDarkA,
  crimson,
  crimsonA,
  crimsonDark,
  crimsonDarkA,
  cyan,
  cyanA,
  cyanDark,
  cyanDarkA,
  gold,
  goldA,
  goldDark,
  goldDarkA,
  grass,
  grassA,
  grassDark,
  grassDarkA,
  gray,
  grayA,
  grayDark,
  grayDarkA,
  green,
  greenA,
  greenDark,
  greenDarkA,
  indigo,
  indigoA,
  indigoDark,
  indigoDarkA,
  iris,
  irisA,
  irisDark,
  irisDarkA,
  jade,
  jadeA,
  jadeDark,
  jadeDarkA,
  lime,
  limeA,
  limeDark,
  limeDarkA,
  mauve,
  mauveA,
  mauveDark,
  mauveDarkA,
  mint,
  mintA,
  mintDark,
  mintDarkA,
  olive,
  oliveA,
  oliveDark,
  oliveDarkA,
  orange,
  orangeA,
  orangeDark,
  orangeDarkA,
  pink,
  pinkA,
  pinkDark,
  pinkDarkA,
  plum,
  plumA,
  plumDark,
  plumDarkA,
  purple,
  purpleA,
  purpleDark,
  purpleDarkA,
  red,
  redA,
  redDark,
  redDarkA,
  ruby,
  rubyA,
  rubyDark,
  rubyDarkA,
  sage,
  sageA,
  sageDark,
  sageDarkA,
  sand,
  sandA,
  sandDark,
  sandDarkA,
  sky,
  skyA,
  skyDark,
  skyDarkA,
  slate,
  slateA,
  slateDark,
  slateDarkA,
  teal,
  tealA,
  tealDark,
  tealDarkA,
  tomato,
  tomatoA,
  tomatoDark,
  tomatoDarkA,
  violet,
  violetA,
  violetDark,
  violetDarkA,
  yellow,
  yellowA,
  yellowDark,
  yellowDarkA,
} from '@radix-ui/colors';
import { get, identity, set } from 'lodash-es';

import { ValuesType } from '@/internal-types';
import { ThemeConfig } from '@/themes/radix-ui-theme.config';
import { Theme } from '@/themes/tokens';

const Palette = {
  amber,
  amberA,
  amberDark,
  amberDarkA,
  blue,
  blueA,
  blueDark,
  blueDarkA,
  bronze,
  bronzeA,
  bronzeDark,
  bronzeDarkA,
  brown,
  brownA,
  brownDark,
  brownDarkA,
  crimson,
  crimsonA,
  crimsonDark,
  crimsonDarkA,
  cyan,
  cyanA,
  cyanDark,
  cyanDarkA,
  gold,
  goldA,
  goldDark,
  goldDarkA,
  grass,
  grassA,
  grassDark,
  grassDarkA,
  gray,
  grayA,
  grayDark,
  grayDarkA,
  green,
  greenA,
  greenDark,
  greenDarkA,
  indigo,
  indigoA,
  indigoDark,
  indigoDarkA,
  iris,
  irisA,
  irisDark,
  irisDarkA,
  jade,
  jadeA,
  jadeDark,
  jadeDarkA,
  lime,
  limeA,
  limeDark,
  limeDarkA,
  mauve,
  mauveA,
  mauveDark,
  mauveDarkA,
  mint,
  mintA,
  mintDark,
  mintDarkA,
  olive,
  oliveA,
  oliveDark,
  oliveDarkA,
  orange,
  orangeA,
  orangeDark,
  orangeDarkA,
  pink,
  pinkA,
  pinkDark,
  pinkDarkA,
  plum,
  plumA,
  plumDark,
  plumDarkA,
  purple,
  purpleA,
  purpleDark,
  purpleDarkA,
  red,
  redA,
  redDark,
  redDarkA,
  ruby,
  rubyA,
  rubyDark,
  rubyDarkA,
  sage,
  sageA,
  sageDark,
  sageDarkA,
  sand,
  sandA,
  sandDark,
  sandDarkA,
  sky,
  skyA,
  skyDark,
  skyDarkA,
  slate,
  slateA,
  slateDark,
  slateDarkA,
  teal,
  tealA,
  tealDark,
  tealDarkA,
  tomato,
  tomatoA,
  tomatoDark,
  tomatoDarkA,
  violet,
  violetA,
  violetDark,
  violetDarkA,
  yellow,
  yellowA,
  yellowDark,
  yellowDarkA,
} as const;

export const Appearance = {
  dark: 'dark',
  light: 'light',
} as const;
export type Appearance = ValuesType<typeof Appearance>;
export const AppearanceList = Object.values(Appearance);

export const GrayColor = {
  gray: 'gray',
  mauve: 'mauve',
  slate: 'slate',
  sage: 'sage',
  olive: 'olive',
  sand: 'sand',
} as const;
export type GrayColor = ValuesType<typeof GrayColor>;
export const GrayColorList = Object.values(GrayColor);

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
export const AccentColorList = Object.values(AccentColor);

export type ThemeOptions = {
  appearance: Appearance;
  grayColor: GrayColor;
  accentColor: AccentColor;
};

function createRadixUITheme({
  appearance,
  grayColor,
  accentColor,
}: ThemeOptions) {
  const mode = appearance === Appearance.dark ? 'Dark' : '';
  const grayColors = Palette[`${grayColor}${mode}`];
  const accentColors = Palette[`${accentColor}${mode}`];
  const grayAColors = Palette[`${grayColor}${mode}A`];
  const accentAColors = Palette[`${accentColor}${mode}A`];

  return {
    gray: (key: string): string => get(grayColors, `${grayColor}${key}`) ?? '',
    grayA: (key: string): string =>
      get(grayAColors, `${grayColor}A${key}`) ?? '',
    accent: (key: string): string =>
      get(accentColors, `${accentColor}${key}`) ?? '',
    accentA: (key: string): string =>
      get(accentAColors, `${accentColor}A${key}`) ?? '',
  };
}

const ThemeKeys: ReadonlyArray<string> = Object.keys(ThemeConfig);

function toTheme(radixUITheme: ReturnType<typeof createRadixUITheme>): Theme {
  return ThemeKeys.reduce((acc, key) => {
    const colorKey: string = get(ThemeConfig, key);
    const [type, color] = colorKey.split('-');

    if (type === 'override') {
      set(acc, key, color);
      return acc;
    }

    if (type.startsWith('gray') || type.startsWith('accent')) {
      const value = get(radixUITheme, type, identity)(color);
      set(acc, key, value);
      return acc;
    }

    return acc;
  }, {}) as Theme;
}

export const createTheme = ({
  grayColor,
  accentColor,
  appearance,
}: ThemeOptions) =>
  toTheme(
    createRadixUITheme({
      appearance,
      grayColor,
      accentColor,
    })
  );
