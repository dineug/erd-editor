import {
  createPeerStore,
  type PeerStore,
  tableActions,
  tableActions$,
  tableColumnActions,
} from '@dineug/erd-editor/peer.js';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  createConnection,
  createDocumentHarness,
  type DocumentHarness,
  type OpenedEditor,
} from '../test/mocks/documentHarness';
import { resetVscodeMock, Uri } from '../test/mocks/vscode';

const PATH = '/ws/shop.erd';
const USERS = 'users';
const USER_ID = 'users_id';
const USER_NAME = 'users_name';

/** Lets the store hooks an edit or a load schedules run, as their timers do. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 30));

/** One batch a peer sends, as its subscribers get it. */
type Batch = Parameters<Parameters<PeerStore['subscribe']>[0]>[0];

const peers: PeerStore[] = [];

function createPeer(nickname: string, value?: string): PeerStore {
  const peer = createPeerStore({ nickname, presence: false });
  peers.push(peer);
  if (value !== undefined) peer.setInitialValue(value);
  return peer;
}

/** A file as an editor saves it: one users table with an id and a name column. */
function fileWithUsers(): string {
  const writer = createPeer('writer');
  writer.dispatch([
    tableActions.addTableAction({
      id: USERS,
      ui: { x: 100, y: 100, zIndex: 2 },
    }),
    tableActions.changeTableNameAction({ id: USERS, value: 'users' }),
    tableColumnActions.addColumnAction({ id: USER_ID, tableId: USERS }),
    tableColumnActions.changeColumnNameAction({
      id: USER_ID,
      tableId: USERS,
      value: 'id',
    }),
    tableColumnActions.addColumnAction({ id: USER_NAME, tableId: USERS }),
    tableColumnActions.changeColumnNameAction({
      id: USER_NAME,
      tableId: USERS,
      value: 'name',
    }),
  ]);
  return writer.value;
}

type Removed = {
  harness: DocumentHarness;
  first: OpenedEditor;
  author: PeerStore;
  /** What the author sends from now on, as its webview relays it. */
  batches: Batch[];
};

/**
 * The first panel's editor removes the users table and its replica saves, the
 * author peer standing in for both, since the replica holds what the editor
 * holds and hands the host its value and runtime value together.
 */
async function removeUsersAndSave(): Promise<Removed> {
  const harness = createDocumentHarness();
  const file = fileWithUsers();
  const first = await harness.openReady(PATH, file);
  const author = createPeer('author', file);
  const batches: Batch[] = [];
  author.subscribe(actions => batches.push(structuredClone(actions)));

  author.dispatch([tableActions$.removeTableAction$(USERS)], {
    label: 'removeTable',
  });
  await settle();
  batches.forEach(batch => harness.relay(first, batch));
  batches.length = 0;
  await harness.saveValue(first, author.value, true, author.runtimeValue);

  return { harness, first, author, batches };
}

/** The users table as a store holds it, its name and its columns' names. */
function usersOf({ state }: PeerStore) {
  const { tableEntities, tableColumnEntities } = state.collections;
  const users = tableEntities[USERS];
  return {
    listed: state.doc.tableIds.includes(USERS),
    name: users?.name,
    columns: users?.columnIds.map(id => tableColumnEntities[id]?.name),
  };
}

beforeEach(() => {
  resetVscodeMock();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  peers.splice(0).forEach(peer => peer.destroy());
  vi.restoreAllMocks();
});

describe('a removal saved, then a second view and a joining agent seeded from the host', () => {
  it('hands both the runtime value, which holds the removed table, while the bytes lack it', async () => {
    const { harness, first, author } = await removeUsersAndSave();

    const second = await harness.resolveView(first.document);
    harness.ready(second);
    const joined = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );

    const seed = harness.initialValueOf(second);
    expect(seed).toBe(author.runtimeValue);
    expect(joined.initialValue).toBe(author.runtimeValue);
    const held = JSON.parse(seed!);
    expect(held.doc.tableIds).not.toContain(USERS);
    expect(held.collections.tableEntities[USERS]).toMatchObject({
      name: 'users',
      columnIds: [USER_ID, USER_NAME],
    });
    expect(held.collections.tableColumnEntities[USER_NAME].name).toBe('name');

    const saved = JSON.parse(new TextDecoder().decode(first.document.content));
    expect(saved.collections.tableEntities).not.toHaveProperty(USERS);
    expect(saved.collections.tableColumnEntities).not.toHaveProperty(USER_NAME);
  });

  it('brings the table back with its name and columns on both when the author undoes', async () => {
    const { harness, first, author, batches } = await removeUsersAndSave();
    const second = await harness.resolveView(first.document);
    harness.ready(second);
    const joined = await harness.run(
      harness.handler.join({ path: PATH }, createConnection())
    );
    const viewer = createPeer('viewer', harness.initialValueOf(second));
    const agent = createPeer('agent', joined.initialValue);
    await settle();

    expect(author.undo().entries).toBe(1);
    await settle();
    expect(batches.length).toBeGreaterThan(0);
    batches.forEach(batch => {
      viewer.receive(structuredClone(batch));
      agent.receive(structuredClone(batch));
    });
    await settle();

    const restored = { listed: true, name: 'users', columns: ['id', 'name'] };
    expect(usersOf(author)).toEqual(restored);
    expect(usersOf(viewer)).toEqual(restored);
    expect(usersOf(agent)).toEqual(restored);
  });
});

describe('the runtime value on the way out', () => {
  it('never reaches save, save as, a backup or the file on disk, which take the bytes alone', async () => {
    const { harness, first, author } = await removeUsersAndSave();
    const { io, provider } = harness;
    const copy = Uri.file('/ws/copy.erd');
    const backup = Uri.file('/backups/shop.erd');

    await provider.saveCustomDocument(first.document);
    await provider.saveCustomDocumentAs(first.document, copy as any);
    await provider.backupCustomDocument(first.document, {
      destination: backup,
    } as any);

    const written = [PATH, copy.fsPath, backup.fsPath].map(
      path => io.files.get(io.resolve(path))?.data
    );
    expect(written).toEqual([author.value, author.value, author.value]);
    expect(author.runtimeValue).not.toBe(author.value);
    expect(
      JSON.parse(written[0]!).collections.tableEntities
    ).not.toHaveProperty(USERS);
  });
});
