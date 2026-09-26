import { existsSync } from 'node:fs';

import { describe, expect, it, vi } from 'vite-plus/test';

import { createObsidianHost, HubSwitch, pidSandbox } from '@/hub/host';

describe('HubSwitch', () => {
  it('tells its listeners of a change, not of a set that changes nothing, until they unsubscribe', () => {
    const hubSwitch = new HubSwitch(true);
    const listener = vi.fn();
    const unsubscribe = hubSwitch.subscribe(listener);

    hubSwitch.set(true);
    expect(listener).not.toHaveBeenCalled();
    hubSwitch.set(false);
    expect(hubSwitch.enabled).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    hubSwitch.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('createObsidianHost', () => {
  it('names obsidian, follows the setting, and covers the vault folder alone', () => {
    const hubSwitch = new HubSwitch(true);
    const host = createObsidianHost(hubSwitch, () => '/Users/me/vault');
    const enabledChange = vi.fn();
    const foldersChange = vi.fn();

    host.onEnabledChange(enabledChange);
    const unsubscribeFolders = host.onFoldersChange(foldersChange);
    hubSwitch.set(false);
    unsubscribeFolders();

    expect(host.ide).toBe('obsidian');
    expect(host.isEnabled()).toBe(false);
    expect(host.folders()).toEqual(['/Users/me/vault']);
    expect(enabledChange).toHaveBeenCalledTimes(1);
    expect(foldersChange).not.toHaveBeenCalled();
  });
});

describe('pidSandbox', () => {
  const linux = (
    env: Record<string, string | undefined>,
    files: string[] = []
  ) => ({
    platform: 'linux',
    env,
    exists: (path: string) => files.includes(path),
  });

  it('names Flatpak by its app id or by the info file every Flatpak sandbox holds', () => {
    expect(pidSandbox(linux({ FLATPAK_ID: 'md.obsidian.Obsidian' }))).toBe(
      'Flatpak'
    );
    expect(pidSandbox(linux({}, ['/.flatpak-info']))).toBe('Flatpak');
  });

  it('finds none outside Linux or outside a sandbox', () => {
    expect(pidSandbox(linux({}))).toBeNull();
    expect(
      pidSandbox({
        platform: 'darwin',
        env: { FLATPAK_ID: 'md.obsidian.Obsidian' },
        exists: () => true,
      })
    ).toBeNull();
    expect(pidSandbox()).toBe(
      process.platform === 'linux' &&
        (process.env.FLATPAK_ID || existsSync('/.flatpak-info'))
        ? 'Flatpak'
        : null
    );
  });
});
