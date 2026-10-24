import type {
  createKeyBindingMap,
  defineErdEditor,
  dictionaryRowChords,
  setExportFileCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';

export interface ErdEditorModule {
  setExportFileCallback: typeof setExportFileCallback;
  setImportFileCallback: typeof setImportFileCallback;
  /** Missing from a module an earlier plugin version loaded, which the window keeps until a restart. */
  createKeyBindingMap?: typeof createKeyBindingMap;
  /** Missing from a module an earlier plugin version loaded, as the map may be. */
  dictionaryRowChords?: typeof dictionaryRowChords;
  /** Missing from a module an earlier plugin version loaded, which defined the element as it evaluated. */
  defineErdEditor?: typeof defineErdEditor;
}

const MODULE_KEY = Symbol.for('erd-editor-obsidian/module');

/**
 * Evaluates the editor and defines its custom element once per window. An
 * element cannot be defined twice, so a plugin disabled and enabled again
 * reuses the first module; a new plugin version takes effect after a restart.
 */
export function loadErdEditor(): ErdEditorModule {
  const scope = globalThis as unknown as Record<
    symbol,
    ErdEditorModule | undefined
  >;
  const loaded = scope[MODULE_KEY];
  if (loaded) return loaded;

  // Obsidian evaluates main.js as CommonJS, and the bundler resolves the one call.
  const { erdEditorModule } =
    require('@/erdEditorModule') as typeof import('@/erdEditorModule');
  erdEditorModule.defineErdEditor();
  scope[MODULE_KEY] = erdEditorModule;
  return erdEditorModule;
}
