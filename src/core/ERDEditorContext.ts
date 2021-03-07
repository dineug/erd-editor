import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { observable } from '@dineug/lit-observable';
import { createTheme } from './theme';
import { createKeymap } from './keymap';
import { createGlobalEventObservable } from './helper/event.helper';
import { createStore } from '@/engine/store';
import { createCommand } from '@/engine/command';
import { Helper } from '@/core/helper/editor.helper';

export const createdERDEditorContext = (): IERDEditorContext => ({
  theme: observable(createTheme()),
  keymap: observable(createKeymap()),
  globalEvent: createGlobalEventObservable(),
  store: createStore(),
  command: createCommand(),
  helper: new Helper(),
});
