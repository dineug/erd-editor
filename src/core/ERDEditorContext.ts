import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { observable } from '@dineug/lit-observable';
import { createTheme } from './theme';
import { createKeymap } from './keymap';
import { createGlobalEventObservable } from './eventHelper';
import { createStore } from '@/engine/store';

export const createdERDEditorContext = (): IERDEditorContext => ({
  theme: observable(createTheme()),
  keymap: observable(createKeymap()),
  globalEvent: createGlobalEventObservable(),
  store: createStore(),
});
