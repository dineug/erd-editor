import { reactive } from 'vue';

import { createStore } from '@/store';
import * as actions from '@/store/ui/theme.actions';

export interface Color {
  color: string;
  background: string;
  foreground: string;
}

export type ThemeProperties =
  | 'font'
  | 'sidebar'
  | 'sidebar.title'
  | 'editor'
  | 'scrollbar-track'
  | 'scrollbar-thumb'
  | 'scrollbar-thumb-hover';

export type Theme = Record<ThemeProperties, Partial<Color>>;

export const state = reactive<Theme>({
  font: {
    color: '#cccccc',
    foreground: 'white',
  },
  sidebar: {
    background: '#21252b',
  },
  'sidebar.title': {
    background: '#21252b',
  },
  editor: {
    background: '#282c34',
  },
  'scrollbar-track': {
    background: 'transparent',
  },
  'scrollbar-thumb': {
    background: 'rgba(78, 86, 102, 0.38)',
  },
  'scrollbar-thumb-hover': {
    background: 'rgba(90, 99, 117, 0.5)',
  },
});

export const useThemeStore = createStore(state, actions);