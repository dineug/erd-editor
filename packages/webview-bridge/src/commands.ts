import { createCommand } from './bridge';
import { type ThemeOptions } from './theme';

type Base64 = string;

export const hostExportFileCommand = createCommand<{
  value: Base64;
  fileName: string;
}>('hostExportFileCommand');
export const hostImportFileCommand = createCommand<{
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  accept: string;
}>('hostImportFileCommand');
export const hostInitialCommand = createCommand('hostInitialCommand');
/**
 * The replica's value after each change. With changed false the change left it
 * as it was, as a scroll the file does not save does: the host writes nothing
 * and marks nothing modified, and a hub still counts it as the save it waits for.
 */
export const hostSaveValueCommand = createCommand<{
  value: string;
  changed: boolean;
}>('hostSaveValueCommand');
export const hostSaveReplicationCommand = createCommand<{
  actions: any;
}>('hostSaveReplicationCommand');
export const hostSaveThemeCommand = createCommand<ThemeOptions>(
  'hostSaveThemeCommand'
);

export const webviewImportFileCommand = createCommand<{
  type: 'json' | 'sql' | 'graphql' | 'dbml' | 'aml';
  op: 'set' | 'diff';
  value: string;
}>('webviewImportFileCommand');
export const webviewInitialValueCommand = createCommand<{
  value: string;
}>('webviewInitialValueCommand');
export const webviewUpdateThemeCommand = createCommand<Partial<ThemeOptions>>(
  'webviewUpdateThemeCommand'
);
export const webviewUpdateReadonlyCommand = createCommand<boolean>(
  'webviewUpdateReadonlyCommand'
);
export const webviewReplicationCommand = createCommand<{
  actions: any;
}>('webviewReplicationCommand');
