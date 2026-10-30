// @vitest-environment node
import { describe, expect, it } from 'vite-plus/test';
import * as Y from 'yjs';

import {
  createLogReader,
  createLogWriter,
  getLog,
  insertedOf,
  isLogEntry,
  type LogEntry,
  removeEntries,
} from '@/log';

const entry = (by: string, seq: number, lineage = 'seed'): LogEntry => ({
  by,
  seq,
  lineage,
  actions: [{ type: 'table.add', payload: { id: `${by}${seq}` } }],
});

const readerOf = () => {
  const applied: string[] = [];
  const reader = createLogReader(({ by, seq }) => applied.push(`${by}${seq}`));
  return { reader, applied };
};

describe('isLogEntry', () => {
  it('takes only an entry of the shape a writer pushes', () => {
    expect(isLogEntry(entry('a', 1))).toBe(true);
    expect(isLogEntry(null)).toBe(false);
    expect(isLogEntry({ ...entry('a', 1), seq: 0 })).toBe(false);
    expect(isLogEntry({ ...entry('a', 1), seq: 1.5 })).toBe(false);
    expect(isLogEntry({ ...entry('a', 1), actions: {} })).toBe(false);
    expect(isLogEntry({ ...entry('a', 1), lineage: 3 })).toBe(false);
  });
});

describe('createLogReader', () => {
  it('applies each writer in seq order, holding a later entry until its gap fills', () => {
    const { reader, applied } = readerOf();
    reader.offer([entry('a', 2), entry('b', 1), entry('a', 3)], 'seed');
    expect(applied).toEqual(['b1']);
    expect(reader.applied).toEqual({ b: 1 });

    reader.offer([entry('a', 1)], 'seed');
    expect(applied).toEqual(['b1', 'a1', 'a2', 'a3']);
    expect(reader.applied).toEqual({ a: 3, b: 1 });
  });

  it('skips an entry already applied, one of another lineage and one of another shape', () => {
    const { reader, applied } = readerOf();
    reader.reset({ a: 2 });
    reader.offer(
      [
        entry('a', 1),
        entry('a', 2),
        entry('a', 3, 'other'),
        { by: 'a' },
        entry('a', 3),
      ],
      'seed'
    );
    expect(applied).toEqual(['a3']);
  });

  it('forgets what it held once reset, and counts the entries the binding wrote itself', () => {
    const { reader, applied } = readerOf();
    reader.offer([entry('a', 2)], 'seed');
    reader.reset({});
    reader.offer([entry('a', 1)], 'seed');
    expect(applied).toEqual(['a1']);

    reader.note('self', 2);
    reader.note('self', 1);
    expect(reader.applied).toEqual({ a: 1, self: 2 });
  });

  it('keeps an entry the binding wrote past its gap apart, so the gap still applies and the watermark then moves over it', () => {
    const { reader, applied } = readerOf();
    reader.reset({ self: 1 });
    reader.offer([entry('self', 3)], 'seed');
    reader.note('self', 4);
    reader.note('self', 5);
    expect(reader.applied).toEqual({ self: 1 });

    reader.offer([entry('self', 5), entry('self', 2)], 'seed');
    expect(applied).toEqual(['self2', 'self3']);
    expect(reader.applied).toEqual({ self: 5 });
    reader.offer([entry('self', 4), entry('self', 6)], 'seed');
    expect(applied).toEqual(['self2', 'self3', 'self6']);

    reader.note('self', 8);
    reader.reset({ self: 6 });
    reader.offer([entry('self', 7), entry('self', 8)], 'seed');
    expect(applied).toEqual(['self2', 'self3', 'self6', 'self7', 'self8']);
  });
});

describe('createLogWriter', () => {
  it('pushes copies under rising seqs with its origin, and starts again under a new id', () => {
    const doc = new Y.Doc();
    const origin = Symbol('writer');
    const ids = ['first', 'second'];
    const writer = createLogWriter(doc, origin, () => ids.shift()!);
    const origins: unknown[] = [];
    getLog(doc).observe(event => origins.push(event.transaction.origin));

    const actions = [{ type: 'table.add', payload: { id: 't' } }];
    writer.write('seed', actions);
    writer.write('seed', actions);
    actions[0].payload.id = 'changed';
    expect(getLog(doc).toArray()).toEqual([
      {
        ...entry('first', 1),
        actions: [{ type: 'table.add', payload: { id: 't' } }],
      },
      {
        ...entry('first', 2),
        actions: [{ type: 'table.add', payload: { id: 't' } }],
      },
    ]);
    expect(origins).toEqual([origin, origin]);

    writer.restart();
    expect([writer.bindingId, writer.seq]).toEqual(['second', 0]);
    expect(writer.write('seed', actions)).toMatchObject({
      by: 'second',
      seq: 1,
    });
    doc.destroy();
  });
});

describe('log edits', () => {
  it('reads what a change inserted, and deletes in runs from the back', () => {
    const doc = new Y.Doc();
    const log = getLog(doc);
    const inserted: unknown[][] = [];
    log.observe(event => inserted.push(insertedOf(event)));

    log.push([1, 2, 3, 4, 5, 6]);
    doc.transact(() => {
      log.insert(0, [0]);
      log.delete(3, 1);
    });
    expect(inserted).toEqual([[1, 2, 3, 4, 5, 6], [0]]);

    const removed = removeEntries(log, value => value !== 0 && value !== 4);
    expect(removed).toEqual([1, 2, 5, 6]);
    expect(log.toArray()).toEqual([0, 4]);
    expect(inserted[2]).toEqual([]);
    doc.destroy();
  });
});
