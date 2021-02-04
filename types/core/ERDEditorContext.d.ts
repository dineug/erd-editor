import { Theme } from './theme';
import { Keymap } from './keymap';
import { Store } from '../engine/store';
import { Command } from '../engine/command';

export interface ERDEditorContext {
  theme: Theme;
  keymap: Keymap;
  store: Store;
  command: Command;
}
