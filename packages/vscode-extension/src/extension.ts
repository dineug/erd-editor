import { HubErrorCode, HubRequestError } from '@dineug/erd-editor-agent-hub';
import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { type DocumentHub, type HubHandler, startDocumentHub } from '@/hub';
import { warn } from '@/hub/log';

let hub: DocumentHub | null = null;

function notServed(): never {
  throw new HubRequestError(
    HubErrorCode.notOpen,
    'This VS Code window does not serve ERD documents to agents yet'
  );
}

/**
 * Answers every document request with notOpen, which sends the MCP server on
 * to its next candidate, until a document registry takes the hub's requests.
 */
const unservedDocuments: HubHandler = {
  listDocuments: async () => notServed(),
  openDocument: async () => notServed(),
  join: async () => notServed(),
  leave: async () => notServed(),
  save: async () => notServed(),
  actions: ({ path }) => warn(`dropped actions for ${path}: no peer can join`),
  disconnect: () => undefined,
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    ErdEditorProvider.register(context, widthEditor(ErdEditor)),
    // Wrapped rather than passed by reference: contributed to editor/title,
    // VSCode calls the handler with arguments beyond the resource uri, and a
    // bare reference would read the second as viewColumn.
    vscode.commands.registerCommand('vuerd.showSource', uri => showSource(uri)),
    vscode.commands.registerCommand('vuerd.showEditor', uri => showEditor(uri)),
    vscode.commands.registerCommand('vuerd.showEditorToSide', uri =>
      showEditor(uri, vscode.ViewColumn.Beside)
    ),
    vscode.commands.registerCommand('vuerd.showSourceToSide', uri =>
      showSource(uri, vscode.ViewColumn.Beside)
    )
  );

  // Started last and guarded, so a hub that cannot start leaves the editor working.
  try {
    hub = startDocumentHub(context, unservedDocuments);
    context.subscriptions.push(hub);
  } catch (error) {
    warn('could not start the document hub', error);
  }
}

/** VSCode awaits this, unlike a subscription's dispose, so the lock is gone before the host exits. */
export function deactivate(): Promise<void> | undefined {
  const closing = hub?.close();
  hub = null;
  return closing;
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE, viewColumn);
}
