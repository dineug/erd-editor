import { AnyAction } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import { Clock } from '@/engine/clock';
import { ActionType } from '@/engine/modules/dictionary/actions';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  dictionaryPushUndoHistoryMap,
  reverseDictionaryListings,
} from '@/engine/modules/dictionary/history';
import {
  addColumnAction,
  changeColumnDomainAction,
} from '@/engine/modules/table-column/atom.actions';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';

describe('dictionaryPushUndoHistoryMap', () => {
  let store: Store;
  let undoActions: AnyAction[];

  const pushUndo = (action: AnyAction) =>
    dictionaryPushUndoHistoryMap[
      action.type as keyof typeof dictionaryPushUndoHistoryMap
    ](undoActions, action, store.state);

  beforeEach(() => {
    store = createStore({
      toWidth: text => text.length * 10,
      clock: new Clock(),
    });
    undoActions = [];
  });

  it('undoes an add with a remove of the same row', () => {
    pushUndo(
      addDictionaryAction({ kind: 'word', id: 'w1', values: { name: 'A' } })
    );

    expect(undoActions).toEqual([
      removeDictionaryAction({ kind: 'word', id: 'w1' }),
    ]);
  });

  it('undoes an add landing on a listed row with the values it held, or with nothing', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: 'Member number', physicalName: 'MBR_NO' },
      })
    );

    pushUndo(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { physicalName: 'MEMBER_NO' },
      })
    );
    pushUndo(addDictionaryAction({ kind: 'term', id: 't1' }));

    expect(undoActions).toEqual([
      updateDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { physicalName: 'MBR_NO' },
      }),
    ]);
  });

  it('undoes a remove of a listed row with an add carrying no values', () => {
    store.dispatchSync(
      addDictionaryAction({ kind: 'domain', id: 'd1', values: { name: 'N' } }),
      addDictionaryAction({ kind: 'domain', id: 'd2' }),
      removeDictionaryAction({ kind: 'domain', id: 'd2' })
    );

    pushUndo(removeDictionaryAction({ kind: 'domain', id: 'd1' }));
    pushUndo(removeDictionaryAction({ kind: 'domain', id: 'd2' }));
    pushUndo(removeDictionaryAction({ kind: 'domain', id: 'ghost' }));

    expect(undoActions).toEqual([
      addDictionaryAction({ kind: 'domain', id: 'd1' }),
    ]);
  });

  it('undoes an update with the values the row held in the fields it writes', () => {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: 'Member', abbreviation: 'MBR', synonyms: 'Mbr' },
      })
    );

    pushUndo(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: {
          abbreviation: 'MEM',
          englishName: 'member',
          id: 'x',
        } as never,
      })
    );

    expect(undoActions).toEqual([
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { abbreviation: 'MBR', englishName: '' },
      }),
    ]);
  });

  it('pushes nothing for an update of no row or of no field, or for a kind it does not know', () => {
    store.dispatchSync(addDictionaryAction({ kind: 'word', id: 'w1' }));

    pushUndo(
      updateDictionaryAction({
        kind: 'word',
        id: 'ghost',
        values: { name: 'A' },
      })
    );
    pushUndo(updateDictionaryAction({ kind: 'word', id: 'w1', values: {} }));
    for (const type of Object.values(ActionType)) {
      pushUndo({ type, payload: { kind: 'glossary', id: 'w1' } });
    }

    expect(undoActions).toEqual([]);
  });
});

describe('reverseDictionaryListings', () => {
  it('turns round the adds and removes an undo sends, leaving every other action in its slot', () => {
    const unlink = changeColumnDomainAction({
      id: 'c1',
      tableId: 't1',
      value: '',
    });
    const update = updateDictionaryAction({
      kind: 'word',
      id: 'w9',
      values: { name: 'A' },
    });
    const undoActions: AnyAction[] = [
      removeDictionaryAction({ kind: 'word', id: 'w1' }),
      unlink,
      addDictionaryAction({ kind: 'term', id: 't1' }),
      update,
      removeDictionaryAction({ kind: 'word', id: 'w2' }),
    ];

    reverseDictionaryListings(undoActions);

    expect(undoActions).toEqual([
      removeDictionaryAction({ kind: 'word', id: 'w2' }),
      unlink,
      addDictionaryAction({ kind: 'term', id: 't1' }),
      update,
      removeDictionaryAction({ kind: 'word', id: 'w1' }),
    ]);
  });
});

describe('dictionary undo and redo through the rx store', () => {
  let app: AppContext;

  beforeEach(() => {
    app = createTestAppContext();
  });

  afterEach(() => {
    app.store.destroy();
  });

  /** An edit another peer made, at a version past every local one. */
  const fromPeer = (action: AnyAction) => {
    const { store } = app;
    store.dispatchSync(
      attachActionTag(Tag.shared, {
        ...action,
        version: store.context.clock.getNextVersion(),
      })
    );
  };

  it('brings a removed row back at the end of its sheet with the edit a peer made meanwhile', () => {
    const { store } = app;
    store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: 'Member', abbreviation: 'MBR' },
      }),
      addDictionaryAction({ kind: 'word', id: 'w2', values: { name: 'Num' } })
    );
    store.dispatchSync(removeDictionaryAction({ kind: 'word', id: 'w1' }));
    fromPeer(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { abbreviation: 'MEM' },
      })
    );

    store.undo();

    expect(store.state.doc.wordIds).toEqual(['w2', 'w1']);
    expect(store.state.collections.wordEntities.w1).toMatchObject({
      name: 'Member',
      abbreviation: 'MEM',
    });

    store.redo();
    expect(store.state.doc.wordIds).toEqual(['w2']);
  });

  it('puts rows removed from the end back in their order, and takes added rows off the end', () => {
    const { store } = app;
    const ids = ['w1', 'w2', 'w3'];
    store.dispatchSync(
      ...ids.map(id =>
        addDictionaryAction({ kind: 'word', id, values: { name: id } })
      )
    );
    store.dispatchSync(
      ...[...ids]
        .reverse()
        .map(id => removeDictionaryAction({ kind: 'word', id }))
    );

    store.undo();
    expect(store.state.doc.wordIds).toEqual(ids);

    store.undo();
    expect(store.state.doc.wordIds).toEqual([]);

    store.redo();
    expect(store.state.doc.wordIds).toEqual(ids);
  });

  it('puts an updated row back and forth', () => {
    const { store } = app;
    store.dispatchSync(
      addDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { name: 'Member number', physicalName: 'MBR_NO' },
      })
    );
    store.dispatchSync(
      updateDictionaryAction({
        kind: 'term',
        id: 't1',
        values: { physicalName: 'MEMBER_NO' },
      })
    );

    store.undo();
    expect(store.state.collections.termEntities.t1.physicalName).toBe('MBR_NO');

    store.redo();
    expect(store.state.collections.termEntities.t1.physicalName).toBe(
      'MEMBER_NO'
    );

    store.undo();
    store.undo();
    expect(store.state.doc.termIds).toEqual([]);
  });

  it('measures a linked column again when the undo brings its domain back', () => {
    const { store } = app;
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: 'd1',
        values: { name: 'amount_n15_x' },
      }),
      addColumnAction({ id: 'c1', tableId: 't1' }),
      changeColumnDomainAction({ id: 'c1', tableId: 't1', value: 'd1' })
    );
    store.dispatchSync(removeDictionaryAction({ kind: 'domain', id: 'd1' }));
    const widthDomain = () =>
      store.state.collections.tableColumnEntities.c1.ui.widthDomain;
    expect(widthDomain()).toBe(60);

    store.undo();

    expect(widthDomain()).toBe(120);
  });
});
