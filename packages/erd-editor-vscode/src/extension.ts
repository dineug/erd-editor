import * as vscode from 'vscode';

import { ErdEditorProvider } from '@/erd-editor-provider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(ErdEditorProvider.register(context));
  context.subscriptions.push(
    vscode.commands.registerCommand('vuerd.showSource', showSource)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('vuerd.showEditor', showEditor)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('vuerd.showEditorToSide', uri =>
      showEditor(uri, vscode.ViewColumn.Beside)
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('vuerd.showSourceToSide', uri =>
      showSource(uri, vscode.ViewColumn.Beside)
    )
  );
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    'editor.erd',
    viewColumn
  );
}
