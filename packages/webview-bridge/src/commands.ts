import { createCommand } from './bridge';
import { type LocaleSetting } from './locale';
import { type Appearance, type ThemeOptions } from './theme';

type Base64 = string;

export const hostExportFileCommand = createCommand<{
  value: Base64;
  fileName: string;
}>('hostExportFileCommand');
/**
 * Whether an import takes the document's place or joins it below the diagram,
 * as Import and Add does. The editor names it only for an append, and a host
 * or a page that knows no mode reads its absence as a replace.
 */
export type ImportMode = 'replace' | 'append';

export const hostImportFileCommand = createCommand<{
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  accept: string;
  mode?: ImportMode;
}>('hostImportFileCommand');
export const hostInitialCommand = createCommand('hostInitialCommand');
/**
 * The replica's document after each change. With changed false the change left
 * value as it was, as a scroll the file does not save does: the host writes nothing
 * and marks nothing modified, and a hub still counts it as the save it waits for.
 */
export const hostSaveValueCommand = createCommand<{
  /** The document in the form a file holds: what the host writes and compares. */
  value: string;
  changed: boolean;
  /** The document as the replica holds it: what the host hands a second view or a joining agent, and never writes. */
  runtimeValue: string;
}>('hostSaveValueCommand');
export const hostSaveReplicationCommand = createCommand<{
  actions: any;
}>('hostSaveReplicationCommand');
export const hostSaveThemeCommand = createCommand<ThemeOptions>(
  'hostSaveThemeCommand'
);
export const hostSaveLocaleCommand = createCommand<{
  locale: LocaleSetting;
}>('hostSaveLocaleCommand');

export const webviewImportFileCommand = createCommand<{
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  value: string;
  mode?: ImportMode;
}>('webviewImportFileCommand');
export const webviewInitialValueCommand = createCommand<{
  value: string;
}>('webviewInitialValueCommand');
export const webviewUpdateThemeCommand = createCommand<
  Partial<ThemeOptions> & {
    /** What auto shows, from a host that knows it outside the page; left out, the page reads it. */
    systemAppearance?: Appearance;
  }
>('webviewUpdateThemeCommand');
export const webviewUpdateLocaleCommand = createCommand<{
  locale: LocaleSetting;
  /** What auto follows, the host's UI language as a BCP 47 tag; left out, the page keeps the one it has. */
  systemLocale?: string;
}>('webviewUpdateLocaleCommand');
export const webviewUpdateReadonlyCommand = createCommand<boolean>(
  'webviewUpdateReadonlyCommand'
);
export const webviewReplicationCommand = createCommand<{
  actions: any;
}>('webviewReplicationCommand');
