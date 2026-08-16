import { query } from '@dineug/erd-editor-schema';
import { watch } from '@dineug/r-html';
import { describe, expect, it } from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';
import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { changeHasHistoryAction } from '@/engine/modules/editor/atom.actions';
import { addIndexAction } from '@/engine/modules/index/atom.actions';
import { addIndexColumnAction } from '@/engine/modules/index-column/atom.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { createStore } from '@/engine/store';

const createContext = (): EngineContext => ({
  toWidth: text => text.length * 10,
  clock: new Clock(),
});

describe('createStore', () => {
  it('seeds an empty v3 document with an editor slice and an empty lww map', () => {
    const context = createContext();
    const store = createStore(context);

    expect(store.context).toBe(context);
    expect(store.state.doc.tableIds).toEqual([]);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.doc.memoIds).toEqual([]);
    expect(store.state.doc.indexIds).toEqual([]);
    expect(store.state.lww).toEqual({});
    expect(store.state.editor.hasUndo).toBe(false);
    expect(store.state.editor.hasRedo).toBe(false);
    expect(store.state.collections.tableEntities).toEqual({});
  });

  it('wires the editor reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(
      changeHasHistoryAction({ hasUndo: true, hasRedo: true })
    );

    expect(store.state.editor.hasUndo).toBe(true);
    expect(store.state.editor.hasRedo).toBe(true);
  });

  it('wires the settings reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));

    expect(store.state.settings.zoomLevel).toBe(0.5);
  });

  it('wires the table and table-column reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(
      addTableAction({ id: 't1', ui: { x: 1, y: 2, zIndex: 3 } })
    );
    store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));

    expect(store.state.doc.tableIds).toEqual(['t1']);
    expect(store.state.collections.tableEntities.t1.columnIds).toEqual(['c1']);
    expect(store.state.collections.tableColumnEntities.c1.tableId).toBe('t1');
  });

  it('wires the memo reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(
      addMemoAction({ id: 'm1', ui: { x: 5, y: 6, zIndex: 1 } })
    );

    expect(store.state.doc.memoIds).toEqual(['m1']);
    expect(store.state.collections.memoEntities.m1.ui.x).toBe(5);
  });

  it('wires the relationship reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(
      addRelationshipAction({
        id: 'r1',
        relationshipType: 4,
        start: { tableId: 't1', columnIds: ['c1'] },
        end: { tableId: 't2', columnIds: ['c2'] },
      })
    );

    expect(store.state.doc.relationshipIds).toEqual(['r1']);
    expect(store.state.collections.relationshipEntities.r1.end.tableId).toBe(
      't2'
    );
  });

  it('wires the index and index-column reducers', () => {
    const store = createStore(createContext());

    store.dispatchSync(addIndexAction({ id: 'i1', tableId: 't1' }));
    store.dispatchSync(
      addIndexColumnAction({
        id: 'ic1',
        indexId: 'i1',
        tableId: 't1',
        columnId: 'c1',
      })
    );

    expect(store.state.doc.indexIds).toEqual(['i1']);
    expect(
      query(store.state.collections)
        .collection('indexEntities')
        .selectById('i1')?.indexColumnIds
    ).toEqual(['ic1']);
  });

  it('makes the state observable by default', async () => {
    const store = createStore(createContext());
    const changed: Array<string | number | symbol> = [];

    watch(store.state.settings).subscribe(propName => {
      changed.push(propName);
    });
    store.dispatchSync(changeZoomLevelAction({ value: 0.75 }));
    await flush();

    expect(changed).toContain('zoomLevel');
  });

  it('leaves the state as a plain object when observability is disabled', async () => {
    const store = createStore(createContext(), false);
    const changed: Array<string | number | symbol> = [];

    watch(store.state.settings).subscribe(propName => {
      changed.push(propName);
    });
    store.dispatchSync(changeZoomLevelAction({ value: 0.75 }));
    await flush();

    expect(store.state.settings.zoomLevel).toBe(0.75);
    expect(changed).toEqual([]);
  });

  it('dispatch defers to a microtask while dispatchSync applies immediately', async () => {
    const store = createStore(createContext());

    store.dispatch(changeZoomLevelAction({ value: 0.25 }));
    expect(store.state.settings.zoomLevel).not.toBe(0.25);

    await Promise.resolve();
    expect(store.state.settings.zoomLevel).toBe(0.25);
  });

  it('destroy detaches the reducer pipeline', () => {
    const store = createStore(createContext());

    store.destroy();
    store.dispatchSync(changeZoomLevelAction({ value: 0.25 }));

    expect(store.state.settings.zoomLevel).not.toBe(0.25);
  });
});
