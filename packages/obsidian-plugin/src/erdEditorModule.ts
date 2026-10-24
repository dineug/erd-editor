import {
  createKeyBindingMap,
  defineErdEditor,
  dictionaryRowChords,
  setExportFileCallback,
  setImportFileCallback,
} from '@dineug/erd-editor';

/**
 * The editor members ErdEditorModule names, imported by name so a bundler can
 * leave out the rest. Only loadErdEditor requires it, in a window without the editor yet,
 * so a re-enabled plugin never evaluates a second copy.
 */
export const erdEditorModule = {
  createKeyBindingMap,
  defineErdEditor,
  dictionaryRowChords,
  setExportFileCallback,
  setImportFileCallback,
};
