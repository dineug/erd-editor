import type { ErdEditorElement } from '@dineug/erd-editor';
import { createReplicationStoreWorker } from '@dineug/erd-editor-replication-store-worker';
import {
  Bridge,
  hostSaveValueCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
} from '@dineug/erd-editor-webview-bridge';
import { Notice, TextFileView, type TFile, type WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_ERD = 'erd-editor';

/** The extensions Obsidian can register; vuerd is the legacy document the editor migrates. */
export const DIAGRAM_EXTENSIONS = ['erd', 'vuerd'];

const DIAGRAM_JSON_SUFFIX = /\.(erd|vuerd)$/;

/**
 * The tabs showing each file, like the webviews vscode-extension keeps per
 * document: a tab hands the others every edit as it makes it, and the first
 * tab alone writes the file, since overlapping writes leave it marked saving.
 */
const tabsByFile = new WeakMap<TFile, ErdView[]>();

/** What a file's writer last handed Obsidian to save, which its other tabs already show. */
const handedByFile = new WeakMap<TFile, string>();

type SharedStore = ReturnType<ErdEditorElement['getSharedStore']>;
type Actions = Parameters<Parameters<SharedStore['subscribe']>[0]>[0];

/** The core TextFileView field a save compares against; not in the public types. */
type SavedData = { lastSavedData: string | null };

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

/**
 * One diagram file in a tab. A replica of the document in a worker serializes
 * it for every save, as in the IDE hosts, so the tab never stringifies a large
 * schema on the main thread, not even when it closes.
 */
export class ErdView extends TextFileView {
  private editor: ErdEditorElement | null = null;
  private replica: Worker | null = null;
  private disposeReplica: (() => void) | null = null;
  /** The file this tab shares with its other tabs, and the store it shares it through. */
  private session: TFile | null = null;
  private sharedStore: SharedStore | null = null;
  private disposeSharedStore: (() => void) | null = null;
  /** The document as loaded, handed back while nothing has changed it. */
  private loadedData = '';
  /** The document as the replica last serialized it, which a save writes. */
  private replicaValue: string | null = null;
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
    this.editor = this.contentEl.createEl('erd-editor');
    this.syncAppearance();

    this.registerEvent(
      this.app.workspace.on('css-change', () => this.syncAppearance())
    );
    // Quitting does not wait out the 2 s save, which the app would take with it
    // (checked with the smoke's last step); the replica's last value is written
    // as a quit task instead.
    this.registerEvent(
      this.app.workspace.on('quit', tasks => {
        tasks.add(() => this.save());
      })
    );

    // The file may have loaded before the view opened.
    if (this.file) {
      this.setViewData(this.data ?? '', true);
    }
  }

  async onClose(): Promise<void> {
    // The core close saves through getViewData; destroy() would empty the document first.
    await super.onClose();
    this.leave();
    this.stopReplica();
    this.editor?.destroy();
    this.editor?.remove();
    this.editor = null;
  }

  async onUnloadFile(file: TFile): Promise<void> {
    // A drag the shared store still holds goes out to the other tabs first,
    // which keep it; the tab itself saves the replica's last value.
    this.sharedStore?.flushStreamBuffers();
    try {
      await super.onUnloadFile(file);
    } finally {
      this.leave();
    }
  }

  getViewData(): string {
    if (this.unreadable) return this.loadedData;
    // Handing back what was last saved is what keeps a second tab from writing.
    if (!this.isWriter()) {
      return (this as unknown as SavedData).lastSavedData ?? this.loadedData;
    }
    const data = this.replicaValue ?? this.loadedData;
    if (this.session) handedByFile.set(this.session, data);
    return data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (!this.editor) return;

    if (clear) {
      if (this.file) this.join(this.file);
      // A tab opened beside another starts from that one's replica value, saved
      // or not; a drag still held there reaches it once it subscribes.
      const peer = this.tabs().find(tab => tab !== this && tab.hasDocument());
      this.loadDocument(peer?.currentValue() ?? data);
    } else {
      // The write of this file's writer coming back, which this tab already shows.
      const handed = this.session && handedByFile.get(this.session);
      if (!this.unreadable && (data === this.replicaValue || data === handed)) {
        return;
      }
      this.loadDocument(data);
    }

    if (this.unreadable) {
      this.closeSharedStore();
    } else if (!this.sharedStore) {
      this.openSharedStore();
    }
  }

  clear(): void {
    this.loadedData = '';
    this.replicaValue = null;
    this.unreadable = false;
  }

  private tabs(): ErdView[] {
    return (this.session && tabsByFile.get(this.session)) || [this];
  }

  private isWriter(): boolean {
    return this.tabs()[0] === this;
  }

  private join(file: TFile): void {
    this.leave();
    tabsByFile.set(file, [...(tabsByFile.get(file) ?? []), this]);
    this.session = file;
  }

  private leave(): void {
    this.closeSharedStore();
    const file = this.session;
    if (!file) return;
    const tabs = (tabsByFile.get(file) ?? []).filter(tab => tab !== this);
    if (tabs.length) {
      tabsByFile.set(file, tabs);
    } else {
      tabsByFile.delete(file);
      handedByFile.delete(file);
    }
    this.session = null;
  }

  /**
   * Opened once the document is in the editor: its first subscription asks the
   * other tabs for their last-writer-wins state, which they answer through
   * theirs, so an edit made here is not taken there for an older one.
   */
  private openSharedStore(): void {
    const { editor } = this;
    if (!editor) return;

    const sharedStore = editor.getSharedStore({
      mouseTracker: false,
      focusTracker: false,
    });
    this.sharedStore = sharedStore;
    const unsubscribe = sharedStore.subscribe(actions => {
      this.replicate(actions);
      for (const tab of this.tabs()) {
        if (tab !== this) tab.receive(actions);
      }
    });
    this.disposeSharedStore = () => {
      unsubscribe();
      sharedStore.destroy();
    };
  }

  private closeSharedStore(): void {
    this.disposeSharedStore?.();
    this.disposeSharedStore = null;
    this.sharedStore = null;
  }

  private hasDocument(): boolean {
    return Boolean(this.sharedStore);
  }

  /** The document as this tab's replica last serialized it, as a new webview starts in the IDE hosts. */
  private currentValue(): string {
    return this.replicaValue ?? this.loadedData;
  }

  /** Another tab's edit, applied as the IDE hosts apply one from another webview. */
  private receive(actions: Actions): void {
    if (!this.sharedStore) return;
    this.sharedStore.dispatch(actions);
    this.replicate(actions);
  }

  private replicate(actions: Actions): void {
    this.replica?.postMessage(
      Bridge.executeCommand(webviewReplicationCommand, { actions })
    );
  }

  private loadDocument(data: string): void {
    const { editor } = this;
    if (!editor) return;

    this.unreadable = !isReadableDiagram(data);
    const value = this.unreadable ? '' : data;

    editor.readonly = this.unreadable;
    if (this.unreadable) {
      this.stopReplica();
    } else {
      this.startReplica(value);
    }
    editor.setInitialValue(value);
    this.loadedData = data;
    this.replicaValue = null;

    if (this.unreadable) {
      new Notice(
        `${this.file?.path ?? 'This file'} is not a diagram the editor can read. It is open read-only and left as it is.`
      );
    }
  }

  /**
   * A replica per load: one started for an earlier document could still post a
   * value of it after the next one loads, and that value would be saved over it.
   */
  private startReplica(value: string): void {
    this.stopReplica();

    const replica = createReplicationStoreWorker({
      name: 'erd-editor-obsidian/replication-store-worker',
    });
    const bridge = new Bridge();
    const handleMessage = (event: MessageEvent) => {
      bridge.executeAction(event.data);
    };
    const handleError = (event: Event) => {
      console.error('[erd-editor] the replica worker failed', event);
      new Notice(
        'ERD Editor stopped saving this diagram in the background. It is saved when the tab closes.'
      );
    };

    replica.addEventListener('message', handleMessage);
    replica.addEventListener('error', handleError);
    replica.addEventListener('messageerror', handleError);
    const disposeCommand = bridge.registerCommand(
      hostSaveValueCommand,
      ({ value }) => {
        this.replicaValue = value;
        if (this.isWriter()) this.requestSave();
      }
    );
    replica.postMessage(
      Bridge.executeCommand(webviewInitialValueCommand, { value })
    );

    this.replica = replica;
    this.disposeReplica = () => {
      disposeCommand();
      replica.removeEventListener('message', handleMessage);
      replica.removeEventListener('error', handleError);
      replica.removeEventListener('messageerror', handleError);
      replica.terminate();
    };
  }

  private stopReplica(): void {
    this.disposeReplica?.();
    this.disposeReplica = null;
    this.replica = null;
  }

  private syncAppearance(): void {
    this.editor?.setPresetTheme({
      appearance: document.body.hasClass('theme-dark') ? 'dark' : 'light',
    });
  }
}
