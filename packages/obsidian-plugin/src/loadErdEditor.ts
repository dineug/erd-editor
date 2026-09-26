import type {
  setExportFileCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';

export interface ErdEditorModule {
  setExportFileCallback: typeof setExportFileCallback;
  setImportFileCallback: typeof setImportFileCallback;
}

const MODULE_KEY = Symbol.for('erd-editor-obsidian/module');

/**
 * Evaluates the editor once per window. Importing it defines its custom
 * element, which cannot happen twice, so a plugin disabled and enabled again
 * reuses the first module; a new plugin version takes effect after a restart.
 */
export function loadErdEditor(): ErdEditorModule {
  const scope = globalThis as unknown as Record<
    symbol,
    ErdEditorModule | undefined
  >;
  // Obsidian evaluates main.js as CommonJS, and the bundler resolves the one call.
  scope[MODULE_KEY] ??= require('@dineug/erd-editor') as ErdEditorModule;
  return scope[MODULE_KEY];
}
