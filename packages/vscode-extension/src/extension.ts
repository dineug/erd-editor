import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { type DocumentHub, startDocumentHub } from '@/hub';
import { DocumentRegistry } from '@/hub/documentRegistry';
import { createDocumentHandler } from '@/hub/handlers';
import { warn } from '@/hub/log';

let hub: DocumentHub | null = null;

export function activate(context: vscode.ExtensionContext) {
  const registry = new DocumentRegistry();

  context.subscriptions.push(
    ErdEditorProvider.register(context, widthEditor(ErdEditor), registry),
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
    const started = startDocumentHub(context, createDocumentHandler(registry));
    hub = started;
    registry.setPublisher(documents => started.setDocuments(documents));
    context.subscriptions.push(started);
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
