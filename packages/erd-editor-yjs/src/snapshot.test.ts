// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import * as Y from 'yjs';

import type { Registers } from '@/port';
import {
  checkLineage,
  ERD_YJS_FORMAT,
  getSnapshotMap,
  needsRejoin,
  readSnapshot,
  type Snapshot,
  writeSnapshot,
} from '@/snapshot';

const snapshot = (fields: Partial<Snapshot> = {}): Snapshot => ({
  format: ERD_YJS_FORMAT,
  generation: 0,
  seedId: 'seed',
  compactorId: null,
  runtimeValue: '{}',
  lww: {} as Registers,
  version: 4,
  covers: {},
  ...fields,
});

describe('readSnapshot', () => {
  it('reads none from an empty map and back what a write stored', () => {
    const doc = new Y.Doc();
    const map = getSnapshotMap(doc);
    expect(readSnapshot(map)).toEqual({ state: 'none' });

    writeSnapshot(map, snapshot({ covers: { a: 3 } }));
    expect(readSnapshot(map)).toEqual({
      state: 'ready',
      snapshot: snapshot({ covers: { a: 3 } }),
    });
    doc.destroy();
  });

  it('calls a snapshot of another format, or of another shape, unsupported', () => {
    const doc = new Y.Doc();
    const map = getSnapshotMap(doc);
    writeSnapshot(map, snapshot({ format: 2 }));
    expect(readSnapshot(map)).toEqual({ state: 'unsupported', format: 2 });

    for (const fields of [
      { generation: 0.5 },
      { seedId: 1 },
      { compactorId: 2 },
      { runtimeValue: null },
      { lww: [] },
      { version: '1' },
      { covers: { a: 'x' } },
      { covers: null },
    ]) {
      writeSnapshot(map, snapshot(fields as unknown as Partial<Snapshot>));
      expect(readSnapshot(map).state).toBe('unsupported');
    }
    writeSnapshot(map, snapshot({ compactorId: 'compactor' }));
    expect(readSnapshot(map).state).toBe('ready');
    doc.destroy();
  });

  it('resolves two seeds written at once to one of them whole', () => {
    const left = new Y.Doc();
    const right = new Y.Doc();
    writeSnapshot(
      getSnapshotMap(left),
      snapshot({ seedId: 'left', version: 1 })
    );
    writeSnapshot(
      getSnapshotMap(right),
      snapshot({ seedId: 'right', version: 2 })
    );
    Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    const read = readSnapshot(getSnapshotMap(left));
    expect(read).toEqual(readSnapshot(getSnapshotMap(right)));
    expect(
      read.state === 'ready' && [read.snapshot.seedId, read.snapshot.version]
    ).toSatisfy(
      pair =>
        JSON.stringify(pair) === '["left",1]' ||
        JSON.stringify(pair) === '["right",2]'
    );
    left.destroy();
    right.destroy();
  });
});

describe('needsRejoin', () => {
  it('asks for a rejoin only when the snapshot covers past a watermark', () => {
    expect(needsRejoin({}, {})).toBe(false);
    expect(needsRejoin({ a: 2 }, { a: 2 })).toBe(false);
    expect(needsRejoin({ a: 2 }, { a: 5, b: 1 })).toBe(false);
    expect(needsRejoin({ a: 3 }, { a: 2 })).toBe(true);
    expect(needsRejoin({ b: 1 }, { a: 9 })).toBe(true);
  });
});

describe('checkLineage', () => {
  it('names a loss only for the binding that seeded the lineage it joined', () => {
    expect(checkLineage('x', 'x', 'x')).toBe('same');
    expect(checkLineage('y', 'x', 'x')).toBe('seedLost');
    expect(checkLineage('y', 'x', null)).toBe('snapshot');
    expect(checkLineage('y', 'x', 'z')).toBe('snapshot');
    expect(checkLineage('y', null, null)).toBe('snapshot');
  });
});
