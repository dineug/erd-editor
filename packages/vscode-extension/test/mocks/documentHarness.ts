import { type HubNotification } from '@dineug/erd-editor-agent-hub';
import {
  Bridge,
  hostInitialCommand,
  hostSaveReplicationCommand,
  hostSaveValueCommand,
} from '@dineug/erd-editor-webview-bridge';
import { type Mock, vi } from 'vite-plus/test';
import type { Uri as VscodeUri, WebviewPanel } from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdDocument } from '@/erd-document';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { DocumentRegistry } from '@/hub/documentRegistry';
import { createDocumentHandler } from '@/hub/handlers';
import { type HubConnection } from '@/hub/server';

import { createMemoryHubIo, type MemoryHubIoOptions } from './hubIo';
import {
  commands,
  createExtensionContext,
  createTab,
  createTabGroup,
  createWebviewPanel,
  type MockTab,
  type MockWebview,
  type MockWebviewPanel,
  TabInputCustom,
  Uri,
  window,
  workspace,
} from './vscode';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** A connection double; every notification it is sent lands in notifications. */
export type MockConnection = HubConnection & {
  notify: Mock<(notification: HubNotification) => void>;
  notifications: HubNotification[];
};

export function createConnection(id = 1): MockConnection {
  const notifications: HubNotification[] = [];
  return {
    id,
    client: 'spec',
    notify: vi.fn((notification: HubNotification) => {
      notifications.push(notification);
    }),
    notifications,
  };
}

/** The actions notifications a connection got, as their action arrays. */
export function actionsSent(connection: MockConnection): unknown[][] {
  return connection.notifications
    .filter(notification => notification.method === 'actions')
    .map(
      notification => (notification.params as { actions: unknown[] }).actions
    );
}

/** Lets a chain of already settled promises run, without touching timers. */
export async function microtasks(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
}

/** A ErdEditor relay double, for specs that only check the calls. */
export function createWebviewRelay() {
  return {
    onWebviewReady: vi.fn(),
    onWebviewActions: vi.fn(),
    onValueSaved: vi.fn(),
  };
}

export type OpenedEditor = {
  document: ErdDocument;
  panel: MockWebviewPanel;
  webview: MockWebview;
};

/**
 * A registry, its handler and a provider building the real ErdEditor, over
 * the vscode stub and a memory HubIo. Documents are files of that HubIo,
 * which the stub's fs reads and writes too.
 */
export function createDocumentHarness(options: MemoryHubIoOptions = {}) {
  const io = createMemoryHubIo(options);
  const registry = new DocumentRegistry(io);
  const handler = createDocumentHandler(registry, io);
  const provider = new ErdEditorProvider(
    createExtensionContext() as any,
    widthEditor(ErdEditor),
    registry
  );

  workspace.fs.readFile.mockImplementation(async uri =>
    encoder.encode(io.files.get(uri.fsPath)?.data ?? '<html></html>')
  );
  workspace.fs.writeFile.mockImplementation(async (uri, content) => {
    io.addFile(uri.fsPath, decoder.decode(content));
  });

  async function resolveView(document: ErdDocument): Promise<OpenedEditor> {
    const panel = createWebviewPanel();
    await provider.resolveCustomEditor(
      document,
      panel as unknown as WebviewPanel
    );
    return { document, panel, webview: panel.webview };
  }

  /** Opens a document the way VS Code does: openCustomDocument, then resolveCustomEditor. */
  async function open(
    path: string,
    content = '{}',
    uri: Uri = Uri.file(path)
  ): Promise<OpenedEditor> {
    if (!io.files.has(path)) io.addFile(path, content);
    const document = await provider.openCustomDocument(
      uri as unknown as VscodeUri,
      { backupId: undefined, untitledDocumentData: undefined }
    );
    return resolveView(document);
  }

  /** The webview's first message, from which the registry counts it ready. */
  function ready(editor: OpenedEditor): void {
    editor.webview.__receive(
      Bridge.executeCommand(hostInitialCommand, undefined)
    );
  }

  async function openReady(
    path: string,
    content?: string
  ): Promise<OpenedEditor> {
    const editor = await open(path, content);
    ready(editor);
    return editor;
  }

  /** The webview relays actions of its own shared store. */
  function relay(editor: OpenedEditor, actions: unknown): void {
    editor.webview.__receive(
      Bridge.executeCommand(hostSaveReplicationCommand, { actions })
    );
  }

  /** The webview's replica saved value. */
  async function saveValue(editor: OpenedEditor, value: string): Promise<void> {
    editor.webview.__receive(
      Bridge.executeCommand(hostSaveValueCommand, { value })
    );
    await microtasks();
  }

  /** Makes vscode.openWith open the document, and ready it unless told not to. */
  function serveOpenWith(becomeReady = true): OpenedEditor[] {
    const opened: OpenedEditor[] = [];
    commands.executeCommand.mockImplementation(async (...args: unknown[]) => {
      const [command, uri] = args as [string, Uri];
      if (command !== 'vscode.openWith') return undefined;

      const editor = await open(uri.fsPath);
      opened.push(editor);
      if (becomeReady) ready(editor);
      return undefined;
    });
    return opened;
  }

  /** A custom editor tab on the document that turns dirty on every content change. */
  function trackTab(editor: OpenedEditor): MockTab {
    let group = window.tabGroups.all[0];
    if (!group) {
      group = createTabGroup();
      window.tabGroups.all.push(group);
    }
    const tab = createTab(
      group,
      new TabInputCustom(editor.document.uri as unknown as Uri, VIEW_TYPE),
      { isActive: true }
    );
    provider.onDidChangeCustomDocument(({ document }) => {
      if (document === editor.document) tab.isDirty = true;
    });
    return tab;
  }

  return {
    io,
    registry,
    handler,
    provider,
    open,
    openReady,
    resolveView,
    ready,
    relay,
    saveValue,
    serveOpenWith,
    trackTab,
  };
}

export type DocumentHarness = ReturnType<typeof createDocumentHarness>;
