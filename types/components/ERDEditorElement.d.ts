import { Theme } from '../core/theme';
import { Keymap } from '../core/keymap';
import { User } from '../core/share';
import { ExtensionConfig } from '../core/extension';

export interface ERDEditorElement extends HTMLElement {
  width: number;
  height: number;
  value: string;
  automaticLayout: boolean;
  focus(): void;
  blur(): void;
  clear(): void;
  initLoadJson(json: string): void;
  loadSQLDDL(sql: string): void;
  setTheme(theme: Theme): void;
  setKeymap(keymap: Keymap): void;
  setUser(user: User): void;
  // sharePull(effect: (commands: Array<Command<CommandType>>) => void): void;
  // sharePush(commands: Array<Command<CommandType>>): void;
  // getSQLDDL(database?: Database): string;
  extension(config: ExtensionConfig): void;
}
