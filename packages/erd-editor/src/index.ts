import '@/components/customElementRegistry';

export type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
export { setExportFileCallback } from '@/utils/file/exportFile';
export { setImportFileCallback } from '@/utils/file/importFile';
export {
  createKeyBindingMap,
  type KeyBindingMap,
  type KeyBindingName,
  type ShortcutOption,
} from '@/utils/keyboard-shortcut';
