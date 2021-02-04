import { Theme } from './theme';
import { Keymap } from './keymap';
import { Store } from '../engine/store';

export interface ERDEditorContext {
  theme: Theme;
  keymap: Keymap;
  store: Store;
}
