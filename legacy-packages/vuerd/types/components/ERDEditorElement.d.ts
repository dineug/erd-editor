import { ExtensionConfig } from '../core/extension';
import { Keymap } from '../core/keymap';
import { LoadLiquibaseData } from '../core/liquibaseParser';
import { Theme } from '../core/theme';
import { Database } from '../engine/store/canvas.state';

export interface ERDEditorProps {
  width: number;
  height: number;
  automaticLayout: boolean;
  readonly: boolean;
}

export interface ERDEditorElement extends ERDEditorProps, HTMLElement {
  value: string;
  focus(): void;
  blur(): void;
  clear(): void;
  initLoadJson(json: string): void;
  loadSQLDDL(sql: string): void;
  loadLiquibase(data: LoadLiquibaseData): void;
  setTheme(theme: Partial<Theme>): void;
  setKeymap(keymap: Partial<Keymap>): void;
  getSQLDDL(database?: Database): string;
  extension(config: Partial<ExtensionConfig>): void;
}
