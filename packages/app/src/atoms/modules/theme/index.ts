import { Theme } from '@radix-ui/themes';
import { atomWithStorage } from 'jotai/utils';
import { withImmer } from 'jotai-immer';
import { ComponentProps } from 'react';

type ThemeProps = ComponentProps<typeof Theme>;
type ThemeState = {
  appearance: ThemeProps['appearance'];
  accentColor: ThemeProps['accentColor'];
  grayColor: ThemeProps['grayColor'];
};

const themeStorageAtom = atomWithStorage<ThemeState>('@theme', {
  appearance: 'dark',
  accentColor: 'jade',
  grayColor: 'olive',
});

export const themeAtom = withImmer(themeStorageAtom);
