import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';

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
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE, viewColumn);
}
