import { createCommand } from './bridge';
import { type ThemeOptions } from './theme';

type Base64 = string;

export const hostExportFileCommand = createCommand<{
  value: Base64;
  fileName: string;
}>('hostExportFileCommand');
export const hostImportFileCommand = createCommand<{
  type: 'json' | 'sql';
  op: 'set' | 'diff';
  accept: string;
}>('hostImportFileCommand');
export const hostInitialCommand = createCommand('hostInitialCommand');
export const hostSaveValueCommand = createCommand<{
  value: string;
}>('hostSaveValueCommand');
export const hostSaveReplicationCommand = createCommand<{
  actions: any;
}>('hostSaveReplicationCommand');
export const hostSaveThemeCommand = createCommand<ThemeOptions>(
  'hostSaveThemeCommand'
);

export const webviewImportFileCommand = createCommand<{
  type: 'json' | 'sql';
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
