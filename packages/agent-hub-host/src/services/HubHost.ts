import { Context } from 'effect';

import { type HubHandler } from '@/server';

/** Ends a subscription; calling it again does nothing. */
export type Unsubscribe = () => void;

export type HubHostShape = {
  /** The name the lock and every hello advertise, such as vscode or obsidian. */
  readonly ide: string;
  /**
   * Whether the hub should listen now. It may throw, as reading a broken
   * setting does: the hub logs it and keeps the state it had.
   */
  readonly isEnabled: () => boolean;
  /** The host's root folders on disk; the hub takes each by its real path. */
  readonly folders: () => readonly string[];
  /** Calls listener whenever the answer of isEnabled may have changed. */
  readonly onEnabledChange: (listener: () => void) => Unsubscribe;
  /** Calls listener whenever the answer of folders may have changed. */
  readonly onFoldersChange: (listener: () => void) => Unsubscribe;
};

/**
 * The editor host the hub serves: its name, whether it wants a hub and the
 * folders its lock covers. Enabled and folder changes stay two events, since
 * only the first may make the hub listen, which an editor opening never awaits.
 */
export class HubHost extends Context.Service<HubHost, HubHostShape>()(
  '@dineug/erd-editor-agent-hub-host/HubHost'
) {}

/** Receives the real paths of the open file documents, which the lock lists. */
export type DocumentPublisher = (documents: string[]) => Promise<void>;

export type HubDocumentsShape = {
  /**
   * Publishes the documents open now at once, before any change, and then on
   * every change to them. The hub never awaits what this returns.
   */
  readonly setPublisher: (publisher: DocumentPublisher) => unknown;
};

/** The host's open documents, which the lock lists and guards. */
export class HubDocuments extends Context.Service<
  HubDocuments,
  HubDocumentsShape
>()('@dineug/erd-editor-agent-hub-host/HubDocuments') {}

/** The hub's request half, so the connection server needs nothing of the host. */
export class HubHandlerService extends Context.Service<
  HubHandlerService,
  HubHandler
>()('@dineug/erd-editor-agent-hub-host/HubHandler') {}
