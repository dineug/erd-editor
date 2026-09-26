import {
  HubDocuments,
  HubHost,
  type HubHostShape,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, Layer } from 'effect';
import * as vscode from 'vscode';

import { affectsHubEnabled, isHubEnabled } from '@/hub/config';
import { DocumentRegistryService } from '@/hub/documentRegistry';

/**
 * This window as the hub's host: enabled by trust and the setting, its roots
 * the file-scheme workspace folders, since a virtual folder guards no path on
 * disk. Trust and the setting share one event; folders have their own.
 */
export const vscodeHost: HubHostShape = {
  ide: 'vscode',
  isEnabled: isHubEnabled,
  folders: () =>
    (vscode.workspace.workspaceFolders ?? [])
      .filter(folder => folder.uri.scheme === 'file')
      .map(folder => folder.uri.fsPath),
  onEnabledChange: listener => {
    const subscriptions = [
      vscode.workspace.onDidGrantWorkspaceTrust(() => listener()),
      vscode.workspace.onDidChangeConfiguration(event => {
        if (affectsHubEnabled(event)) listener();
      }),
    ];
    return () => subscriptions.forEach(subscription => subscription.dispose());
  },
  onFoldersChange: listener => {
    const subscription = vscode.workspace.onDidChangeWorkspaceFolders(() =>
      listener()
    );
    return () => subscription.dispose();
  },
};

export const layer: Layer.Layer<HubHost> = Layer.succeed(HubHost, vscodeHost);

/** The documents the lock lists are the registry's, published as they open and close. */
export const registryDocuments: Layer.Layer<
  HubDocuments,
  never,
  DocumentRegistryService
> = Layer.effect(
  HubDocuments,
  Effect.map(Effect.service(DocumentRegistryService), registry => ({
    setPublisher: publisher => registry.setPublisher(publisher),
  }))
);
