import '@/erd-editor';

export { dictionaryRowChords } from '@/components/dictionary/dictionaryKeys';
export {
  defineErdEditor,
  ErdEditorElement,
} from '@/components/erd-editor/ErdEditor';
export {
  defineErdViewer,
  ErdViewerElement,
} from '@/components/erd-viewer/ErdViewer';
export type { LocaleCode, LocaleOption } from '@/i18n/locales';
export { setExportFileCallback } from '@/utils/file/exportFile';
export { setImportFileCallback } from '@/utils/file/importFile';
export {
  createKeyBindingMap,
  type KeyBindingMap,
  type KeyBindingName,
  type ShortcutOption,
} from '@/utils/keyboard-shortcut';
export type { SchemaSQLOptions } from '@/utils/schema-sql';
