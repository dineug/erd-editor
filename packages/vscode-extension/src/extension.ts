import { Effect, ManagedRuntime } from 'effect';
import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { DocumentHub, documentHubLive } from '@/hub';
import { DocumentRegistry } from '@/hub/documentRegistry';
import { warnUnsafe } from '@/hub/services/HubLogger';

/** How long deactivate waits for the lock, the pipe and the sessions to go. */
const DISPOSE_TIMEOUT = '5 seconds';

let runtime: ManagedRuntime.ManagedRuntime<DocumentHub, never> | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Built before the provider, so its Disposable still reaches
  // context.subscriptions synchronously while the hub layer builds.
  const registry = DocumentRegistry.makeUnsafe();
  const version: string = context.extension.packageJSON.version;
  const hub = ManagedRuntime.make(documentHubLive(version, registry));
  runtime = hub;

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
    ),
    { dispose: () => void dispose(hub) }
  );

  // Started last and guarded, so a hub that cannot start leaves the editor working.
  hub
    .runPromise(Effect.void)
    .catch(error => warnUnsafe('could not start the document hub', error));
}

/** VSCode awaits this, unlike a subscription's dispose, so the lock is gone before the host exits. */
export function deactivate(): Promise<void> | undefined {
  const closing = runtime;
  runtime = null;
  return closing ? dispose(closing) : undefined;
}

function dispose(
  hub: ManagedRuntime.ManagedRuntime<DocumentHub, never>
): Promise<void> {
  return Effect.runPromise(
    hub.disposeEffect.pipe(
      Effect.timeout(DISPOSE_TIMEOUT),
      // catchCause, not ignore, which leaves a defect in a finalizer to reach
      // runPromise and become an unhandled rejection in the host.
      Effect.catchCause(cause =>
        Effect.sync(() => warnUnsafe('could not close the document hub', cause))
      )
    )
  );
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE, viewColumn);
}
