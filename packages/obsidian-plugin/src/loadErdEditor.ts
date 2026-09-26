import type {
  setExportFileCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';

export interface ErdEditorModule {
  setExportFileCallback: typeof setExportFileCallback;
  setImportFileCallback: typeof setImportFileCallback;
}

/** Obsidian evaluates main.js as CommonJS, and the bundler resolves the one call. */
declare function require(id: string): unknown;

const MODULE_KEY = Symbol.for('erd-editor-obsidian/module');

/**
 * Evaluates the editor bundle once per window. Its custom element cannot be
 * defined twice, so a plugin disabled and enabled again reuses the module the
 * first load evaluated; a new plugin version takes effect after a restart.
 */
export function loadErdEditor(): ErdEditorModule {
  const scope = globalThis as unknown as Record<
    symbol,
    ErdEditorModule | undefined
  >;
  scope[MODULE_KEY] ??= require('@dineug/erd-editor/umd') as ErdEditorModule;
  return scope[MODULE_KEY];
}
