import merge from 'lodash/merge';

import { state, Theme } from '@/store/ui/theme.store';

export function changeTheme(theme: Partial<Theme>) {
  merge(state, theme);
}
