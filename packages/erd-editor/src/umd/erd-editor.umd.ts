import '@/erd-editor';

// Re-exported from their own modules, never the package barrel, so
// window.ErdEditor keeps these six keys whatever else the barrel exports.
export { dictionaryRowChords } from '@/components/dictionary/dictionaryKeys';
export {
  defineErdEditor,
  ErdEditorElement,
} from '@/components/erd-editor/ErdEditor';
export { setExportFileCallback } from '@/utils/file/exportFile';
export { setImportFileCallback } from '@/utils/file/importFile';
export { createKeyBindingMap } from '@/utils/keyboard-shortcut';
