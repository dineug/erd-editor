import * as vscode from 'vscode';

import { LEGACY_VIEW_TYPE, MODERN_VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorLegacy } from '@/erd-editor-legacy';
import { ErdEditorProvider } from '@/erd-editor-provider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    ErdEditorProvider.register(
      context,
      MODERN_VIEW_TYPE,
      widthEditor(ErdEditor)
    )
  );
  context.subscriptions.push(
    ErdEditorProvider.register(
      context,
      LEGACY_VIEW_TYPE,
      widthEditor(ErdEditorLegacy)
    )
  );
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
  const viewType = /^.+\.erd(.json)?$/.test(uri.path)
    ? MODERN_VIEW_TYPE
    : LEGACY_VIEW_TYPE;

  vscode.commands.executeCommand('vscode.openWith', uri, viewType, viewColumn);
}
