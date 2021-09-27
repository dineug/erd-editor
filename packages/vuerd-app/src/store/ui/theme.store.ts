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
  | 'scrollbar-thumb-hover'
  | 'focus'
  | 'contextmenu'
  | 'sash'
  | 'drop'
  | 'tab-bar'
  | 'tab';

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
  focus: {
    color: '#0081c3',
    foreground: 'rgba(78, 86, 102, 0.38)',
  },
  contextmenu: {
    background: '#21252b',
    foreground: '#282c34',
  },
  sash: {
    background: 'black',
    foreground: 'rgba(90, 99, 117)',
  },
  drop: {
    background: '#9DA5B4',
  },
  'tab-bar': {
    background: '#21252b',
  },
  tab: {
    background: '#21252b',
    foreground: '#282c34',
  },
});

export const useThemeStore = createStore(state, actions, 'theme');
