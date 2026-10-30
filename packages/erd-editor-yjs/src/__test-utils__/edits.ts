import {
  type PeerStore,
  tableActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { expect } from 'vite-plus/test';
import type * as Y from 'yjs';

import { sortedValue } from '@/__test-utils__/scenarios';
import { getLog, isLogEntry, type LogEntry } from '@/log';

export const entriesOf = (doc: Y.Doc): LogEntry[] =>
  getLog(doc).toArray().filter(isLogEntry);

/** Adds a table and names it, two batches and so two entries. */
export const addTable = (peer: PeerStore, name: string): string => {
  const [id] = peer.dispatch([tableActions$.addTableAction$()]).createdIds;
  peer.dispatch([tableActions.changeTableNameAction({ id, value: name })]);
  return id;
};

export const rename = (peer: PeerStore, id: string, value: string) =>
  peer.dispatch([tableActions.changeTableNameAction({ id, value })]);

/** The names of the listed tables a value holds, sorted. */
export const namesIn = (value: string): string[] => {
  const { doc, collections } = JSON.parse(value);
  return doc.tableIds
    .map((id: string) => collections.tableEntities[id].name)
    .sort();
};

export const tableNames = (peer: PeerStore): string[] => namesIn(peer.value);

/** Every peer's value is the first one's, the document lists compared sorted. */
export const expectConverged = (peers: PeerStore[]) => {
  const [first, ...rest] = peers;
  for (const peer of rest) {
    expect(sortedValue(peer.value)).toEqual(sortedValue(first.value));
  }
};
