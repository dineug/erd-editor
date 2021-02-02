import { ERDEditorContext } from '@type/core/ERDEditorContext';
import { observable } from '@dineug/lit-observable';
import { createTheme } from './theme';
import { createKeymap } from './keymap';

export const createdERDEditorContext = (): ERDEditorContext => ({
  theme: observable(createTheme()),
  keymap: observable(createKeymap()),
});
