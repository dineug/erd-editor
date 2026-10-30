// @vitest-environment node

// One compaction of a 500-table document: what it takes and what it sends.
// It reports and judges nothing, and no number fails the run.

import {
  createPeerStore,
  type PeerStore,
  tableActions,
  tableActions$,
  tableColumnActions,
  tableColumnActions$,
} from '@dineug/erd-editor/peer.js';
import { expect, test } from 'vite-plus/test';
import * as Y from 'yjs';

import { createFakeRoom } from '@/__test-utils__/fakeProvider';
import { bindPeerStore } from '@/binding';
import { getLog } from '@/log';
import { getSnapshotMap, readSnapshot } from '@/snapshot';

const TABLES = 500;
const COLUMNS = 8;

/** The entries a writer adds between two folds, as a busy room would. */
const ENTRIES_PER_FOLD = 20;

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const ms = (value: number) => `${value.toFixed(1)} ms`;

/** Adds the tables, each named and with its named columns, one batch per edit. */
function addTables(author: PeerStore): string[] {
  const tableIds: string[] = [];
  for (let table = 0; table < TABLES; table++) {
    const [id] = author.dispatch([tableActions$.addTableAction$()]).createdIds;
    author.dispatch([
      tableActions.changeTableNameAction({ id, value: `table_${table}` }),
    ]);
    for (let column = 0; column < COLUMNS; column++) {
      const [columnId] = author.dispatch([
        tableColumnActions$.addColumnAction$(id),
      ]).createdIds;
      author.dispatch([
        tableColumnActions.changeColumnNameAction({
          tableId: id,
          id: columnId,
          value: `column_${column}`,
        }),
      ]);
    }
    tableIds.push(id);
  }
  return tableIds;
}

test(`one compaction of ${TABLES} tables of ${COLUMNS} columns`, async ({
  bench,
}) => {
  const room = createFakeRoom();
  const author = createPeerStore({ nickname: 'author', presence: false });
  const server = createPeerStore({ nickname: 'server', presence: false });
  const authorBinding = bindPeerStore(author, room.join().doc);
  authorBinding.seed();
  const replica = bindPeerStore(server, room.server);
  const tableIds = addTables(author);

  /** The bytes of the updates the server's Y.Doc sends while run runs. */
  const sentBy = (run: () => void): number => {
    let bytes = 0;
    const onUpdate = (update: Uint8Array) => (bytes += update.byteLength);
    room.server.on('update', onUpdate);
    run();
    room.server.off('update', onUpdate);
    return bytes;
  };
  let renames = 0;
  const renameSome = () => {
    for (let index = 0; index < ENTRIES_PER_FOLD; index++) {
      const id = tableIds[renames % TABLES];
      author.dispatch([
        tableActions.changeTableNameAction({ id, value: `renamed_${renames}` }),
      ]);
      renames++;
    }
  };

  const entries = getLog(room.server).length;
  const stateBefore = Y.encodeStateAsUpdate(room.server).byteLength;
  let firstFold = 0;
  const firstSent = sentBy(() => {
    const started = performance.now();
    expect(replica.compact().compacted).toBe(true);
    firstFold = performance.now() - started;
  });
  const read = readSnapshot(getSnapshotMap(room.server));
  if (read.state !== 'ready') throw new Error('the fold wrote no snapshot');

  const { latency } = await bench(
    `compact() after ${ENTRIES_PER_FOLD} new entries`,
    { beforeEach: renameSome },
    () => {
      replica.compact();
    }
  ).run();
  renameSome();
  const foldSent = sentBy(() => replica.compact());

  console.log(
    [
      `log before the first fold: ${entries} entries, the Y.Doc's state ${kib(stateBefore)}`,
      `first fold: ${ms(firstFold)}, its update ${kib(firstSent)}`,
      `snapshot: runtimeValue ${kib(read.snapshot.runtimeValue.length)}, lww ${kib(JSON.stringify(read.snapshot.lww).length)}`,
      `a fold of ${ENTRIES_PER_FOLD} entries over ${latency.samplesCount} folds: mean ${ms(latency.mean)}, p50 ${ms(latency.p50)}, p99 ${ms(latency.p99)}, max ${ms(latency.max)}; its update ${kib(foldSent)}`,
      `the Y.Doc's state at the end: ${kib(Y.encodeStateAsUpdate(room.server).byteLength)}`,
    ].join('\n')
  );

  replica.destroy();
  authorBinding.destroy();
  author.destroy();
  server.destroy();
  room.destroy();
});
