import type { ErdEditorElement } from '@dineug/erd-editor';
import { Notice, TextFileView, type TFile, type WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_ERD = 'erd-editor';

/** The extensions Obsidian can register; vuerd is the legacy document the editor migrates. */
export const DIAGRAM_EXTENSIONS = ['erd', 'vuerd'];

const DIAGRAM_JSON_SUFFIX = /\.(erd|vuerd)$/;

/** A .erd.json or .vuerd.json file, which Obsidian itself sees as json. */
export function isDiagramJson(file: TFile): boolean {
  return file.extension === 'json' && DIAGRAM_JSON_SUFFIX.test(file.basename);
}

/** Empty starts a new diagram; otherwise a v3 document or the v2 one .vuerd files hold. */
function isReadableDiagram(text: string): boolean {
  if (text.trim() === '') return true;
  try {
    const json: unknown = JSON.parse(text);
    return (
      typeof json === 'object' &&
      json !== null &&
      ('doc' in json || 'canvas' in json)
    );
  } catch {
    return false;
  }
}

/** One diagram file in a tab: the file text is the editor's JSON document. */
export class ErdView extends TextFileView {
  private editor: ErdEditorElement | null = null;
  /** The file text as loaded, handed back while the document is unchanged. */
  private loadedData = '';
  /** editor.value right after the load, which tells an edit from the load itself. */
  private loadedValue: string | null = null;
  private unreadable = false;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    // A plaintext view merges an outside change into unsaved edits as text,
    // which can break the JSON; a diagram takes the file's version instead.
    Object.assign(this, { isPlaintext: false });
  }

  getViewType(): string {
    return VIEW_TYPE_ERD;
  }

  getDisplayText(): string {
    if (!this.file) return 'ERD';
    return isDiagramJson(this.file)
      ? this.file.basename.replace(DIAGRAM_JSON_SUFFIX, '')
      : this.file.basename;
  }

  getIcon(): string {
    return 'database';
  }

  async onOpen(): Promise<void> {
    this.contentEl.addClass('erd-editor-view');

    const editor = this.contentEl.createEl('erd-editor');
    this.editor = editor;
    this.syncAppearance();

    this.registerDomEvent(editor, 'change', () => this.requestSave());
    this.registerEvent(
      this.app.workspace.on('css-change', () => this.syncAppearance())
    );

    // The file may have loaded before the view opened.
    if (this.file) {
      this.loadDocument(this.data ?? '');
    }
  }

  async onClose(): Promise<void> {
    // The core close saves through getViewData; destroy() would empty the document first.
    await super.onClose();
    this.editor?.destroy();
    this.editor?.remove();
    this.editor = null;
  }

  getViewData(): string {
    if (!this.editor || this.loadedValue === null || this.unreadable) {
      return this.loadedData;
    }
    const value = this.editor.value;
    // Opening a file must not rewrite it: a .vuerd would migrate, any file reformat.
    return value === this.loadedValue ? this.loadedData : value;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (!this.editor) return;
    // Another view of this file saved what this one already shows; keep its undo.
    if (!clear && !this.unreadable && data === this.editor.value) return;
    this.loadDocument(data);
  }

  clear(): void {
    this.loadedData = '';
    this.loadedValue = null;
    this.unreadable = false;
  }

  private loadDocument(data: string): void {
    const editor = this.editor;
    if (!editor) return;

    this.unreadable = !isReadableDiagram(data);
    editor.readonly = this.unreadable;
    editor.setInitialValue(this.unreadable ? '' : data);
    this.loadedData = data;
    this.loadedValue = editor.value;

    if (this.unreadable) {
      new Notice(
        `${this.file?.path ?? 'This file'} is not a diagram the editor can read. It is open read-only and left as it is.`
      );
    }
  }

  private syncAppearance(): void {
    this.editor?.setPresetTheme({
      appearance: document.body.hasClass('theme-dark') ? 'dark' : 'light',
    });
  }
}
