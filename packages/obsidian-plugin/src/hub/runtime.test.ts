import { type LockRecord } from '@dineug/erd-editor-agent-hub';
import {
  HubEnvironment,
  HubListener,
  LockFile,
} from '@dineug/erd-editor-agent-hub-host';
import { Effect, FileSystem, Layer, Stream } from 'effect';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { createHubHarness, VAULT } from '@/__test-utils__/hub';
import { createObsidianHost, HubSwitch } from '@/hub/host';
import { createHubRuntime, type HubMachine } from '@/hub/runtime';

/** Lets the hub's queue and the memory doubles finish, timers included. */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 10; turn++) {
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

/** This machine as memory doubles: the lock records what it is asked to write. */
function createMachine() {
  const records: LockRecord[] = [];
  const lock = {
    write: vi.fn((record: LockRecord) =>
      Effect.sync(() => {
        records.push(record);
        return true;
      })
    ),
    remove: Effect.sync(() => void records.push(undefined as never)),
    removeSync: vi.fn(),
    cleanStale: Effect.void,
  };
  const fileSystem = FileSystem.layerNoop({
    makeDirectory: () => Effect.void,
    remove: () => Effect.void,
    realPath: path => Effect.succeed(path),
  });
  const listen = vi.fn(() => Effect.succeed(Stream.never));
  const machine: HubMachine = Layer.mergeAll(
    Layer.succeed(HubEnvironment, {
      homeDir: '/home/user',
      tmpDir: '/tmp',
      platform: 'linux',
      pid: 4242,
      version: '0.0.0-spec',
      randomToken: Effect.succeed('token'),
      isAlive: () => true,
      lstat: () => Effect.void,
      removeFileSync: vi.fn(),
    }),
    Layer.succeed(HubListener, { listen }),
    Layer.succeed(LockFile, lock),
    fileSystem
  );
  return { records, lock, listen, machine, fileSystem };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createHubRuntime', () => {
  it('serves the registry as obsidian, lists its documents and follows the setting', async () => {
    const harness = createHubHarness();
    await harness.openReady('a.erd');
    const io = createMachine();
    const hubSwitch = new HubSwitch(true);
    const runtime = createHubRuntime({
      registry: harness.registry,
      vault: harness.vault,
      host: createObsidianHost(hubSwitch, () => VAULT),
      fileSystem: io.fileSystem,
      machine: io.machine,
    });

    await runtime.start();
    await flush();
    expect(io.records.at(-1)).toMatchObject({
      ide: 'obsidian',
      version: '0.0.0-spec',
      hub: true,
      workspaceFolders: [VAULT],
      documents: [`${VAULT}/a.erd`],
    });

    hubSwitch.set(false);
    await flush();
    expect(io.records.at(-1)).toMatchObject({ hub: false, pipe: '' });

    runtime.releaseSync();
    expect(io.lock.removeSync).toHaveBeenCalledTimes(1);
    await runtime.dispose();
  });

  it('removes the lock when disposed, and releases nothing before the hub is built', async () => {
    const harness = createHubHarness();
    const io = createMachine();
    const runtime = createHubRuntime({
      registry: harness.registry,
      vault: harness.vault,
      host: createObsidianHost(new HubSwitch(true), () => VAULT),
      fileSystem: io.fileSystem,
      machine: io.machine,
    });

    runtime.releaseSync();
    expect(io.lock.removeSync).not.toHaveBeenCalled();
    await runtime.start();
    await flush();
    await runtime.dispose();

    expect(io.records.at(-1)).toBeUndefined();
  });

  it('logs a hub that cannot build and leaves the registry serving the tabs', async () => {
    const harness = createHubHarness();
    const io = createMachine();
    const runtime = createHubRuntime({
      registry: harness.registry,
      vault: harness.vault,
      host: createObsidianHost(new HubSwitch(true), () => VAULT),
      fileSystem: io.fileSystem,
      machine: Layer.merge(
        io.machine,
        Layer.effect(HubEnvironment, Effect.die(new Error('no home')))
      ),
    });

    await runtime.start();
    runtime.releaseSync();
    await harness.openReady('a.erd');

    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not start the document hub',
      expect.any(Error)
    );
    expect(io.lock.removeSync).not.toHaveBeenCalled();
    expect(harness.registry.documents()).toHaveLength(1);
    await runtime.dispose();
  });

  it('logs a close that fails rather than reject', async () => {
    const harness = createHubHarness();
    const io = createMachine();
    const runtime = createHubRuntime({
      registry: harness.registry,
      vault: harness.vault,
      host: createObsidianHost(new HubSwitch(true), () => VAULT),
      fileSystem: io.fileSystem,
      machine: Layer.merge(
        io.machine,
        Layer.succeed(LockFile, { ...io.lock, remove: Effect.die('EIO') })
      ),
    });
    await runtime.start();
    await flush();

    await expect(runtime.dispose()).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      '[erd-editor hub]',
      'could not close the document hub',
      expect.anything()
    );
  });
});
