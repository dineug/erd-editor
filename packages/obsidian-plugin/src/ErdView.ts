import type { ErdEditorElement } from '@dineug/erd-editor';
import { createReplicationStoreWorker } from '@dineug/erd-editor-replication-store-worker';
import {
  Bridge,
  hostSaveValueCommand,
  webviewInitialValueCommand,
  webviewReplicationCommand,
} from '@dineug/erd-editor-webview-bridge';
import {
  Notice,
  Scope,
  TextFileView,
  type TFile,
  type WorkspaceLeaf,
} from 'obsidian';

import { type DocumentRegistry, type HubTab } from '@/hub';
import { type ScopeKey } from '@/keys';
import { type ResolvedTheme, type ThemeHost } from '@/settings';
import {
  currentValue,
  hasUnsavedValue,
  seedValue,
  type TabSaveState,
  viewData,
} from '@/tabSave';

export const VIEW_TYPE_ERD = 'erd-editor';

/** The extensions Obsidian can register; vuerd is the legacy document the editor migrates. */
export const DIAGRAM_EXTENSIONS = ['erd', 'vuerd'];

/** Matched without regard to case, as the hub and the MCP server match a diagram file name. */
const DIAGRAM_JSON_SUFFIX = /\.(erd|vuerd)$/i;

/** What a file's writer last handed Obsidian to save, which its other tabs already show; an outside change drops it. */
const handedByFile = new WeakMap<TFile, string>();

type SharedStore = ReturnType<ErdEditorElement['getSharedStore']>;
type Actions = Parameters<Parameters<SharedStore['subscribe']>[0]>[0];

/** The core TextFileView fields a save reads and sets; not in the public types. */
type SaveState = { lastSavedData: string | null; saving: boolean };

/** How often, and how long at most, saveDocument waits out a save already under way. */
const SAVING_POLL_MS = 50;
const SAVING_WAIT_MS = 2_000;

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
export class ErdView extends TextFileView implements HubTab {
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
  /** Stops the load a tab opened beside others may still wait for. */
  private pendingSeed: (() => void) | null = null;
  /**
   * Set while the tab lets go of its file. Obsidian's closing save clears the
   * tab before it writes, and the tab stays the writer until the write is done,
   * so no tab opening meanwhile may take its document from it.
   */
  private unloading = false;

  /**
   * The registry keeps the tabs of each file, as vscode-extension keeps the
   * webviews of a document: a tab hands the others every edit it makes, and
   * the first alone writes the file, since overlapping writes leave it saving.
   */
  constructor(
    leaf: WorkspaceLeaf,
    private readonly registry: DocumentRegistry<ErdView>,
    private readonly theme: ThemeHost,
    editorKeys: readonly ScopeKey[]
  ) {
    super(leaf);
    // A plaintext view merges an outside change into unsaved edits as text,
    // which can break the JSON; a diagram takes the file's version instead.
    Object.assign(this, { isPlaintext: false });
    // Obsidian runs a command bound to a key before the page sees the key. The
    // active view's scope answers first, and true lets the key through untouched.
    this.scope = new Scope(this.app.scope);
    for (const { modifiers, key } of editorKeys) {
      this.scope.register(modifiers, key, () => true);
    }
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
    // What the builder picks becomes the theme of every open diagram, as in VS Code.
    editor.enableThemeBuilder = true;
    editor.addEventListener('changePresetTheme', this.handlePickedTheme);
    this.applyTheme(this.theme.current());

    // Quitting does not wait out the 2 s save, so a value not yet written goes
    // as a quit task. Only then: any task turns a reload into closing the window.
    this.registerEvent(
      this.app.workspace.on('quit', tasks => {
        if (this.hasUnsavedValue()) tasks.add(() => this.save());
      })
    );
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', leaf => {
        if (leaf === this.leaf) this.registry.setActive(this);
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
    this.editor?.removeEventListener(
      'changePresetTheme',
      this.handlePickedTheme
    );
    this.editor?.destroy();
    this.editor?.remove();
    this.editor = null;
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.unloading = true;
    // A drag the shared store still holds goes out to the other tabs first,
    // which keep it; the tab itself saves the replica's last value.
    this.sharedStore?.flushStreamBuffers();
    try {
      await super.onUnloadFile(file);
    } finally {
      this.leave();
      this.unloading = false;
    }
  }

  getViewData(): string {
    const state = this.tabState();
    const data = viewData(state);
    // Only the writer's own value is one the other tabs already show.
    if (this.session && state.writer && !state.seeding && !state.unreadable) {
      handedByFile.set(this.session, data);
    }
    return data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (!this.editor) return;

    if (clear) {
      if (this.file) this.join(this.file);
      if (this.app.workspace.getActiveViewOfType(ErdView) === this) {
        this.registry.setActive(this);
      }
      this.seed(data);
      return;
    }

    // The write of this file's writer coming back, which this tab already shows.
    const handed = this.session && handedByFile.get(this.session);
    if (!this.unreadable && (data === this.replicaValue || data === handed)) {
      return;
    }
    // An outside change: every tab takes the file's version, a waiting one too.
    // What the writer handed is no longer the file's, and a seed must not load it.
    if (this.session && data !== handed) handedByFile.delete(this.session);
    this.cancelSeed();
    this.loadDocument(data);
    this.registry.loaded(this, data, true);
    this.syncSharedStore();
  }

  clear(): void {
    this.loadedData = '';
    this.replicaValue = null;
    this.unreadable = false;
  }

  /** An agent batch or another tab's edit, applied as the IDE hosts apply one from another webview. */
  receive(actions: unknown[]): void {
    if (!this.sharedStore) return;
    this.sharedStore.dispatch(actions as Actions);
    this.replicate(actions as Actions);
  }

  /** erd_save through the hub: writes now, then answers whether the file holds what the tab shows. */
  async saveDocument(): Promise<boolean> {
    try {
      await this.save();
      // A save already under way returned at once; it saves again once done.
      for (
        let waited = 0;
        this.saveState().saving && waited < SAVING_WAIT_MS;
        waited += SAVING_POLL_MS
      ) {
        await new Promise(resolve =>
          window.setTimeout(resolve, SAVING_POLL_MS)
        );
      }
      const { saving, lastSavedData } = this.saveState();
      return !saving && lastSavedData === currentValue(this.tabState());
    } catch (error) {
      // The core save has shown the failure already.
      console.error(error);
      return false;
    }
  }

  lastSaved(): string | null {
    return this.saveState().lastSavedData;
  }

  /** The theme every open diagram shows; one the tab's own builder picked is on screen already. */
  applyTheme(theme: ResolvedTheme): void {
    this.editor?.setPresetTheme(theme);
  }

  private readonly handlePickedTheme = (event: Event): void => {
    this.theme.picked((event as CustomEvent<unknown>).detail);
  };

  private saveState(): SaveState {
    return this as unknown as SaveState;
  }

  /** What a save would write and the file does not hold yet; only the writer writes. */
  private hasUnsavedValue(): boolean {
    return hasUnsavedValue(this.tabState());
  }

  private tabState(): TabSaveState {
    return {
      unreadable: this.unreadable,
      seeding: this.pendingSeed !== null,
      writer: this.isWriter(),
      loaded: this.loadedData,
      replica: this.replicaValue,
      saved: this.lastSaved(),
    };
  }

  private tabs(): readonly ErdView[] {
    return (this.session && this.registry.tabsOf(this.session)) || [this];
  }

  private isWriter(): boolean {
    return this.tabs()[0] === this;
  }

  private join(file: TFile): void {
    this.leave();
    this.registry.addTab(file, this);
    this.session = file;
  }

  private leave(): void {
    this.cancelSeed();
    this.closeSharedStore();
    const file = this.session;
    if (!file) return;
    this.registry.removeTab(this);
    if (!this.registry.tabsOf(file)) handedByFile.delete(file);
    this.session = null;
  }

  /**
   * Loads the tab once every edit its file's other tabs made is in their
   * replica values. Until then it has no replica, is read-only, hands back
   * what the file holds and is not ready, so it neither writes nor takes an edit.
   */
  private seed(data: string): void {
    this.stopReplica();
    this.loadedData = data;
    this.replicaValue = null;
    this.unreadable = false;
    if (this.editor) this.editor.readonly = true;
    this.syncHubState();

    let seeded = false;
    const cancel = this.registry.seedWhenQuiet(this, () => {
      seeded = true;
      this.pendingSeed = null;
      // A drag still held in the other tab reaches this one once it subscribes.
      const peer = this.tabs().find(tab => tab !== this && tab.hasDocument());
      const value = seedValue({
        peer: peer && currentValue(peer.tabState()),
        handed: this.session ? handedByFile.get(this.session) : undefined,
        file: this.data,
        opened: data,
      });
      this.loadDocument(value);
      this.registry.loaded(this, value, false);
      this.syncSharedStore();
    });
    this.pendingSeed = seeded ? null : cancel;
  }

  private cancelSeed(): void {
    this.pendingSeed?.();
    this.pendingSeed = null;
  }

  /** Opens the shared store on a readable document, closes it on an unreadable one. */
  private syncSharedStore(): void {
    if (this.unreadable) {
      this.closeSharedStore();
    } else if (!this.sharedStore) {
      this.openSharedStore();
    }
    this.syncHubState();
  }

  /** Ready for the hub once loaded with its shared store open; an unreadable tab is a read-only view. */
  private syncHubState(): void {
    this.registry.setTabState(this, {
      live: Boolean(this.sharedStore),
      unreadable: this.unreadable,
    });
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
      this.registry.relay(this, actions);
    });
    this.disposeSharedStore = () => {
      unsubscribe();
      sharedStore.destroy();
    };
  }

  private closeSharedStore(): void {
    if (!this.sharedStore) return;
    this.disposeSharedStore?.();
    this.disposeSharedStore = null;
    this.sharedStore = null;
    this.syncHubState();
  }

  /** A tab another may seed from: its document open, and not being let go of. */
  private hasDocument(): boolean {
    return Boolean(this.sharedStore) && !this.unloading;
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
        this.registry.valueSaved(this, value);
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
}
