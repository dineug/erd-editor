import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/ui/theme.actions';

export interface Color {
  color: string;
  background: string;
  foreground: string;
}

export type ThemeProperties = 'font' | 'sidebar' | 'sidebar.title';

export type Theme = Record<ThemeProperties, Partial<Color>>;

export const state = reactive<Theme>({
  font: {
    color: '#cccccc',
    foreground: 'white',
  },
  sidebar: {},
  'sidebar.title': {
    background: '#21252b',
  },
});

export const useThemeStore = createStore(state, actions);
