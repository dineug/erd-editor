import { Theme } from '../core/theme';
import { Keymap } from '../core/keymap';
import { User } from '../core/share';
import { ExtensionConfig } from '../core/extension';

export interface ERDEditorProps {
  width: number;
  height: number;
  automaticLayout: boolean;
}

export interface ERDEditorElement extends ERDEditorProps, HTMLElement {
  value: string;
  focus(): void;
  blur(): void;
  clear(): void;
  initLoadJson(json: string): void;
  loadSQLDDL(sql: string): void;
  setTheme(theme: Partial<Theme>): void;
  setKeymap(keymap: Partial<Keymap>): void;
  setUser(user: User): void;
  // sharePull(effect: (commands: Array<Command<CommandType>>) => void): void;
  // sharePush(commands: Array<Command<CommandType>>): void;
  // getSQLDDL(database?: Database): string;
  extension(config: Partial<ExtensionConfig>): void;
}
