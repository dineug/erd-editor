import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import {
  createPeerStore,
  tableActions,
  tableActions$,
} from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { toDriveFingerprint, toFingerprint } from '@/utils/documentFingerprint';
import { toWidth } from '@/utils/text';

/** A table with a column, as the engine serializes it. */
function documentValue() {
  const store = createReplicationStore({ toWidth });
  store.setInitialValue('');
  store.dispatchSync([
    {
      type: 'table.add',
      payload: {
        id: 'users',
        ui: { x: 0, y: 0, zIndex: 1, widthName: 60, widthComment: 60 },
      },
    },
    { type: 'column.add', payload: { id: 'users.id', tableId: 'users' } },
  ] as any);
  const value = store.value;
  store.destroy();
  return value;
}

const VALUE = documentValue();

function changed(change: (json: any) => void) {
  const json = JSON.parse(VALUE);
  change(json);
  return JSON.stringify(json);
}

const viewChanges: Array<[string, (json: any) => void]> = [
  ['scrollTop', json => (json.settings.scrollTop += 10)],
  ['scrollLeft', json => (json.settings.scrollLeft += 10)],
  ['originX', json => (json.settings.originX += 10)],
  ['originY', json => (json.settings.originY -= 10)],
  ['zoomLevel', json => (json.settings.zoomLevel = 0.5)],
  ['canvasType', json => (json.settings.canvasType = 'settings')],
];

const derivedChanges: Array<[string, (json: any) => void]> = [
  [
    'a table width',
    json => (json.collections.tableEntities.users.ui.widthName = 999),
  ],
  [
    'a column width',
    json =>
      (json.collections.tableColumnEntities['users.id'].ui.widthDataType = 999),
  ],
  [
    'the foreign key bit',
    json => (json.collections.tableColumnEntities['users.id'].ui.keys |= 2),
  ],
];

const documentChanges: Array<[string, (json: any) => void]> = [
  ['the database', json => (json.settings.database += 1)],
  ['what is shown', json => (json.settings.show ^= 1)],
  ['the column order', json => json.settings.columnOrder.reverse()],
  ['the database name', json => (json.settings.databaseName = 'shop')],
  [
    'a table name',
    json => (json.collections.tableEntities.users.name = 'people'),
  ],
  ['a table position', json => (json.collections.tableEntities.users.ui.x = 1)],
];

describe('toFingerprint', () => {
  it.each(viewChanges)('ignores %s', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toFingerprint(changed(change))).toBe(toFingerprint(VALUE));
  });

  it('counts the database name and the document, and no other setting', () => {
    const databaseName = changed(json => (json.settings.databaseName = 'shop'));
    const tableName = changed(
      json => (json.collections.tableEntities.users.name = 'people')
    );
    const database = changed(json => (json.settings.database += 1));

    expect(toFingerprint(databaseName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(tableName)).not.toBe(toFingerprint(VALUE));
    expect(toFingerprint(database)).toBe(toFingerprint(VALUE));
  });
});

describe('toDriveFingerprint', () => {
  it.each(viewChanges)('ignores %s', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).toBe(toDriveFingerprint(VALUE));
  });

  it.each(derivedChanges)('ignores %s the engine derives', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).toBe(toDriveFingerprint(VALUE));
  });

  it.each(documentChanges)('tells %s apart', (_name, change) => {
    expect(toDriveFingerprint(changed(change))).not.toBe(
      toDriveFingerprint(VALUE)
    );
  });

  it('ignores every view setting at once', () => {
    const viewed = changed(json =>
      viewChanges.forEach(([, change]) => change(json))
    );
    expect(toDriveFingerprint(viewed)).toBe(toDriveFingerprint(VALUE));
  });

  describe('across replicas', () => {
    afterEach(() => vi.useRealTimers());

    it('is the same for two replicas of one edit, whose entity meta differs', () => {
      vi.useFakeTimers({ now: Date.UTC(2026, 8, 25) });
      const here = createPeerStore({ nickname: 'here', presence: false });
      const there = createPeerStore({ nickname: 'there', presence: false });
      here.setInitialValue(VALUE);
      there.setInitialValue(VALUE);
      const sent: unknown[][] = [];
      here.subscribe(actions => sent.push(actions));
      there.subscribe(() => {});

      const [id] = here.dispatch([tableActions$.addTableAction$()]).createdIds;
      here.dispatch([tableActions.changeTableNameAction({ id, value: 'x' })]);
      here.flushStreamBuffers();
      // The other tab applies the batches a second later, by its own clock.
      vi.advanceTimersByTime(1000);
      for (const actions of sent) there.receive(actions as any);

      const metaOf = (value: string) =>
        JSON.parse(value).collections.tableEntities[id].meta;
      expect(metaOf(there.value)).not.toEqual(metaOf(here.value));
      expect(toDriveFingerprint(there.value)).toBe(
        toDriveFingerprint(here.value)
      );
      here.destroy();
      there.destroy();
    });
  });
});
