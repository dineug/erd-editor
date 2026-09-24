import {
  createPeerStore,
  type PeerStore,
  tableActions,
  tableActions$,
  tableColumnActions$,
} from '@dineug/erd-editor/peer.js';
import { vi } from 'vite-plus/test';

import {
  createChannelHub,
  createFakeDrive,
  createLockManager,
  type FakeDriveFile,
} from '@/__test-utils__/gdrive';
import {
  createDocumentController,
  type DocumentControllerDeps,
  type EditorAdapter,
} from '@/services/gdrive/documentController';
import { createDriveClient } from '@/services/gdrive/driveClient';
import type { FileLockManagerLike } from '@/services/gdrive/fileLeader';
import {
  type TokenStatus,
  TokenUnavailableError,
} from '@/services/gdrive/tokenManager';
import type { ChannelLike } from '@/services/gdrive/types';

export const SUB = 'sub-1';

/** Runs the timers due within ms, and every task and microtask they queue. */
export const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

/** A document as the engine saves it, from a peer store that dispatched actions. */
export function documentWith(build: (store: PeerStore) => void = () => {}) {
  const store = createPeerStore({ nickname: 'seed', presence: false });
  store.setInitialValue('');
  build(store);
  const value = store.value;
  store.destroy();
  return value;
}

/** One table, users, with an id column. */
export const USERS_DOCUMENT = documentWith(store => {
  const [tableId] = store.dispatch([
    tableActions$.addTableAction$(),
  ]).createdIds;
  store.dispatch([
    tableActions.changeTableNameAction({ id: tableId, value: 'users' }),
  ]);
  store.dispatch([tableColumnActions$.addColumnAction$(tableId)]);
});

/** Documents compared across replicas: each replica stamps its own entity meta. */
export function comparable(value: string) {
  const document = JSON.parse(value);
  for (const entities of Object.values<Record<string, any>>(
    document.collections
  )) {
    for (const entity of Object.values<any>(entities)) delete entity.meta;
  }
  return document;
}

/**
 * A headless editor behind the adapter the controller drives, as the element
 * would be: its shared store's batches go out, and any change is a change.
 * With presence, it sends its focus as the element's tracker does.
 */
export function createPeerEditor(nickname: string, presence = false) {
  const store = createPeerStore({ nickname, presence });
  const changes = new Set<() => void>();
  const changed = () => [...changes].forEach(listener => listener());

  const adapter: EditorAdapter = {
    getValue: () => store.value,
    setInitialValue: value => store.setInitialValue(value),
    subscribeLocal: listener => store.subscribe(actions => listener(actions)),
    applyRemote: actions => {
      store.receive(actions as any);
      changed();
    },
    onChange: listener => {
      changes.add(listener);
      return () => {
        changes.delete(listener);
      };
    },
  };

  /** A local edit: dispatched, sent and noticed, as a click in the element. */
  const edit = (actions: Parameters<PeerStore['dispatch']>[0]) => {
    const report = store.dispatch(actions);
    store.flushStreamBuffers();
    changed();
    return report;
  };

  return {
    store,
    adapter,
    edit,
    /** Adds a table named tableName, the edit most tests make. */
    addTable(tableName: string) {
      const [id] = edit([tableActions$.addTableAction$()]).createdIds;
      edit([tableActions.changeTableNameAction({ id, value: tableName })]);
      return id;
    },
    destroy: () => store.destroy(),
  };
}

export type PeerEditor = ReturnType<typeof createPeerEditor>;

/**
 * The tabs of one browser: one channel hub and lock manager, one Drive in
 * memory. Each tab gets its own access token, so a request tells its tab.
 */
export function createDriveEnv() {
  const hub = createChannelHub();
  const locks = createLockManager();
  const drive = createFakeDrive();
  let ids = 0;
  const tokenStatus: { current: TokenStatus | null } = { current: null };

  const clientFor = (tab: string) => {
    const token = `token-${tab}`;
    drive.tokens.add(token);
    return createDriveClient({
      fetch: drive.fetch,
      getAccessToken: async () => {
        if (tokenStatus.current) {
          throw new TokenUnavailableError(tokenStatus.current);
        }
        return token;
      },
      onUnauthorized: async () => {
        throw new TokenUnavailableError('signed-out');
      },
    });
  };

  /** What every tab posted, in order, and a hook that sees each post as it happens. */
  const sent: Array<{ tab: string; message: any }> = [];
  const onSend: { current: ((tab: string, message: any) => void) | null } = {
    current: null,
  };

  return {
    hub,
    locks,
    drive,
    tokenStatus,
    sent,
    onSend,
    clientFor,
    createId: () => `id-${++ids}`,
    /** The tab a Drive request came from, by its token. */
    tabOf: (call: { headers: Headers }) =>
      call.headers.get('Authorization')?.replace(/^Bearer token-/, ''),
    patches(fileId = 'file-1') {
      return drive
        .callsTo('PATCH')
        .filter(
          call => call.url.pathname === `/upload/drive/v3/files/${fileId}`
        );
    },
    downloads(fileId = 'file-1') {
      return drive
        .callsTo('GET')
        .filter(
          call =>
            call.url.pathname === `/drive/v3/files/${fileId}` &&
            call.url.searchParams.get('alt') === 'media'
        );
    },
    addFile(partial: Partial<FakeDriveFile> = {}): FakeDriveFile {
      return drive.add({
        id: 'file-1',
        name: 'shop.erd.json',
        content: USERS_DOCUMENT,
        ...partial,
      });
    },
  };
}

export type DriveEnv = ReturnType<typeof createDriveEnv>;

export type TabOptions = {
  name: string;
  fileId?: string;
  locks?: FileLockManagerLike | null;
  /** Mounts an editor whenever a document is ready, as GdriveEditor will. */
  autoAttach?: boolean;
  /** Editors that send their focus, as the element's presence tracker does. */
  presence?: boolean;
} & Partial<
  Pick<DocumentControllerDeps, 'document' | 'tokens' | 'retry' | 'now'>
>;

/** A tab with the file open: its controller, and a new editor for every load. */
export function openTab(env: DriveEnv, options: TabOptions) {
  const {
    name,
    fileId = 'file-1',
    locks = env.locks,
    autoAttach = true,
    presence = false,
    retry = { random: () => 0 },
    ...rest
  } = options;
  const downloads: Array<{ fileName: string; text: string }> = [];
  const editors: PeerEditor[] = [];
  const channels: ChannelLike[] = [];
  const controller = createDocumentController({
    fileId,
    sub: SUB,
    drive: env.clientFor(name),
    locks,
    createChannel: channelName => {
      const channel = env.hub.create(channelName);
      const post = channel.postMessage.bind(channel);
      channel.postMessage = message => {
        env.sent.push({ tab: name, message });
        env.onSend.current?.(name, message);
        post(message);
      };
      channels.push(channel);
      return channel;
    },
    download: (fileName, text) => downloads.push({ fileName, text }),
    createId: env.createId,
    retry,
    ...rest,
  });

  let mounted: string | null = null;
  const mount = () => {
    const { phase, epoch } = controller.getSnapshot();
    if (phase !== 'ready' || epoch === mounted) return;
    mounted = epoch;
    const editor = createPeerEditor(name, presence);
    editors.push(editor);
    controller.attach(editor.adapter);
  };
  const off = controller.subscribe(() => {
    // After the render, as a layout effect would.
    if (autoAttach) queueMicrotask(mount);
  });

  const tab = {
    name,
    controller,
    downloads,
    editors,
    snapshot: () => controller.getSnapshot(),
    get editor(): PeerEditor {
      return editors.at(-1)!;
    },
    value: () => editors.at(-1)!.store.value,
    mount,
    /** The tab stops answering while it keeps its lock, as a frozen tab does. */
    freeze: () => channels.forEach(channel => env.hub.mute(channel)),
    edit: (actions: Parameters<PeerStore['dispatch']>[0]) =>
      editors.at(-1)!.edit(actions),
    addTable: (tableName: string) => editors.at(-1)!.addTable(tableName),
    close() {
      off();
      controller.dispose();
      editors.forEach(editor => editor.destroy());
    },
  };
  return tab;
}

export type Tab = ReturnType<typeof openTab>;

/** The names of a document's tables, sorted, to compare what two replicas hold. */
export function tableNames(value: string): string[] {
  const { doc, collections } = JSON.parse(value);
  return doc.tableIds
    .map((id: string) => collections.tableEntities[id].name)
    .sort();
}
