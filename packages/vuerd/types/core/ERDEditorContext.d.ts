import { Command } from '../engine/command';
import { Store } from '../engine/store';
import { Helper } from './helper';
import { Keymap } from './keymap';
import { Theme } from './theme';

export interface ERDEditorContext {
  theme: Theme;
  keymap: Keymap;
  store: Store;
  command: Command;
  helper: Helper;
}
