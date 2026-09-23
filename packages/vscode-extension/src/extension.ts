import { type Platform } from '@dineug/erd-editor-agent-hub';
import { Effect, ManagedRuntime } from 'effect';
import * as vscode from 'vscode';

import { VIEW_TYPE } from '@/constants/viewType';
import { widthEditor } from '@/editor';
import { ErdEditor } from '@/erd-editor';
import { ErdEditorProvider } from '@/erd-editor-provider';
import { documentHubLive, extensionLive, registryLive } from '@/hub';
import {
  DocumentRegistry,
  type DocumentRegistryService,
} from '@/hub/documentRegistry';
import { warnUnsafe } from '@/hub/services/HubLogger';

/** How long deactivate waits for the lock, the pipe and the sessions to go. */
const DISPOSE_TIMEOUT = '5 seconds';

type Hub = {
  readonly registry: DocumentRegistry;
  readonly runtime: ManagedRuntime.ManagedRuntime<
    DocumentRegistryService,
    never
  >;
};

let current: Hub | null = null;

export function activate(context: vscode.ExtensionContext) {
  // Built before the provider, so its Disposable still reaches
  // context.subscriptions synchronously; what it registers before the
  // runtime has built waits in the registry's queue.
  const registry = DocumentRegistry.makeUnsafe(process.platform as Platform);
  const version: string = context.extension.packageJSON.version;
  const hub: Hub = {
    registry,
    runtime: ManagedRuntime.make(
      extensionLive(registryLive(registry), documentHubLive(version))
    ),
  };
  current = hub;

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

  // Started last. The hub logs its own failure to build, so this exit fails
  // only when a dispose interrupted the build, and that dispose closes the
  // registry itself.
  void hub.runtime.runPromiseExit(Effect.void);
}

/** VSCode awaits this, unlike a subscription's dispose, so the lock is gone before the host exits. */
export function deactivate(): Promise<void> | undefined {
  const closing = current;
  current = null;
  return closing ? dispose(closing) : undefined;
}

function dispose(hub: Hub): Promise<void> {
  return Effect.runPromise(
    hub.runtime.disposeEffect.pipe(
      Effect.timeout(DISPOSE_TIMEOUT),
      // catchCause, not ignore, which leaves a defect in a finalizer to reach
      // runPromise and become an unhandled rejection in the host.
      Effect.catchCause(cause =>
        Effect.sync(() => warnUnsafe('could not close the document hub', cause))
      ),
      // A build the dispose interrupted never reached the registry's release,
      // so what the registry still queues settles here instead.
      Effect.ensuring(Effect.sync(() => hub.registry.close()))
    )
  );
}

function showSource(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.window.showTextDocument(uri, { viewColumn });
}

function showEditor(uri: vscode.Uri, viewColumn?: vscode.ViewColumn) {
  vscode.commands.executeCommand('vscode.openWith', uri, VIEW_TYPE, viewColumn);
}
