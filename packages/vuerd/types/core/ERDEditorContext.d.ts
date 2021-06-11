import { Command } from '../engine/command';
import { ExportedStore, Store } from '../engine/store';
import { Helper } from './helper';
import { Keymap } from './keymap';
import { Theme } from './theme';

export interface ERDEditorContext {
  theme: Theme;
  keymap: Keymap;
  store: Store;
  snapshots: ExportedStore[];
  command: Command;
  helper: Helper;
}
