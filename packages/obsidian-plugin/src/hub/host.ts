import { existsSync } from 'node:fs';

import {
  type HubHostShape,
  type Unsubscribe,
} from '@dineug/erd-editor-agent-hub-host';

/** The coding-agent setting, which tells its listeners each time it changes. */
export class HubSwitch {
  private readonly listeners = new Set<() => void>();

  constructor(private value: boolean) {}

  get enabled(): boolean {
    return this.value;
  }

  set(value: boolean): void {
    if (value === this.value) return;
    this.value = value;
    for (const listener of Array.from(this.listeners)) listener();
  }

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }
}

/**
 * This vault window as the hub's host: enabled by the plugin setting, its one
 * root the vault folder, which never changes while the window is open.
 */
export function createObsidianHost(
  hubSwitch: HubSwitch,
  vaultFolder: () => string
): HubHostShape {
  return {
    ide: 'obsidian',
    isEnabled: () => hubSwitch.enabled,
    folders: () => [vaultFolder()],
    onEnabledChange: listener => hubSwitch.subscribe(listener),
    onFoldersChange: () => () => undefined,
  };
}

/** What pidSandbox reads of the machine; the process and the file system in the plugin. */
export type SandboxProbe = {
  readonly platform: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly exists: (path: string) => boolean;
};

const machine: SandboxProbe = {
  platform: process.platform,
  env: process.env,
  exists: existsSync,
};

/**
 * The sandbox giving this window process ids of its own, or null. Locks are
 * named and swept by pid, and a Flatpak pid names no process outside it, so a
 * hub there would sweep live windows' locks and its own would read as dead.
 */
export function pidSandbox(probe: SandboxProbe = machine): 'Flatpak' | null {
  if (probe.platform !== 'linux') return null;
  return probe.env.FLATPAK_ID || probe.exists('/.flatpak-info')
    ? 'Flatpak'
    : null;
}
