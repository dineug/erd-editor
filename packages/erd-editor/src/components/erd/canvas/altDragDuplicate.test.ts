import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import { tryStartAltDragDuplicate } from '@/components/erd/canvas/altDragDuplicate';
import {
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';

function setup() {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(addTableAction$());
  store.dispatchSync(addTableAction$());
  store.dispatchSync(addMemoAction$());
  store.dispatchSync(unselectAllAction());

  const [tableId, otherTableId] = store.state.doc.tableIds;
  const [memoId] = store.state.doc.memoIds;

  const duplicateDragStart = vi.fn();
  app.emitter.on({ duplicateDragStart });

  return { app, store, tableId, otherTableId, memoId, duplicateDragStart };
}

const mousedown = (init: MouseEventInit = {}) =>
  new MouseEvent('mousedown', { cancelable: true, altKey: true, ...init });

describe('tryStartAltDragDuplicate', () => {
  it('takes over the gesture on an Alt+primary mousedown', () => {
    const { app, tableId, duplicateDragStart } = setup();
    const event = mousedown();

    const started = tryStartAltDragDuplicate(
      app,
      event,
      tableId,
      SelectType.table
    );

    expect(started).toBe(true);
    expect(duplicateDragStart).toHaveBeenCalledOnce();
    expect(duplicateDragStart).toHaveBeenCalledWith({
      type: 'duplicateDragStart',
      payload: undefined,
    });
  });

  it('prevents the default so the browser starts no text selection', () => {
    const { app, tableId } = setup();
    const event = mousedown();

    tryStartAltDragDuplicate(app, event, tableId, SelectType.table);

    expect(event.defaultPrevented).toBe(true);
  });

  it('declines a mousedown without the Alt key', () => {
    const { app, tableId, duplicateDragStart } = setup();
    const event = mousedown({ altKey: false });

    const started = tryStartAltDragDuplicate(
      app,
      event,
      tableId,
      SelectType.table
    );

    expect(started).toBe(false);
    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([[1], [2]])(
    'declines an Alt+mousedown from button %i so the context menu is left alone',
    button => {
      const { app, tableId, duplicateDragStart } = setup();
      const event = mousedown({ button });

      const started = tryStartAltDragDuplicate(
        app,
        event,
        tableId,
        SelectType.table
      );

      expect(started).toBe(false);
      expect(duplicateDragStart).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    }
  );

  it('declines a touch start even when it reports the Alt key', () => {
    const { app, tableId, duplicateDragStart } = setup();
    const event = new TouchEvent('touchstart', {
      cancelable: true,
      altKey: true,
    });

    const started = tryStartAltDragDuplicate(
      app,
      event,
      tableId,
      SelectType.table
    );

    expect(started).toBe(false);
    expect(duplicateDragStart).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('selects an unselected table on its own', () => {
    const { app, store, tableId } = setup();

    tryStartAltDragDuplicate(app, mousedown(), tableId, SelectType.table);

    expect({ ...store.state.editor.selectedMap }).toEqual({
      [tableId]: SelectType.table,
    });
  });

  it('selects an unselected memo on its own', () => {
    const { app, store, memoId } = setup();

    tryStartAltDragDuplicate(app, mousedown(), memoId, SelectType.memo);

    expect({ ...store.state.editor.selectedMap }).toEqual({
      [memoId]: SelectType.memo,
    });
  });

  it('leaves a multi selection alone when the entity is already in it', () => {
    const { app, store, tableId, otherTableId, memoId } = setup();
    const selected = {
      [tableId]: SelectType.table,
      [otherTableId]: SelectType.table,
      [memoId]: SelectType.memo,
    };
    store.dispatchSync(selectAction(selected));

    const started = tryStartAltDragDuplicate(
      app,
      mousedown(),
      tableId,
      SelectType.table
    );

    expect(started).toBe(true);
    expect({ ...store.state.editor.selectedMap }).toEqual(selected);
  });

  it('corrects the selection before the emitter listener runs', () => {
    const { app, store, tableId, otherTableId } = setup();
    store.dispatchSync(selectAction({ [otherTableId]: SelectType.table }));

    let selectedAtEmit: Record<string, SelectType> | null = null;
    app.emitter.on({
      duplicateDragStart: () => {
        selectedAtEmit = { ...store.state.editor.selectedMap };
      },
    });

    tryStartAltDragDuplicate(app, mousedown(), tableId, SelectType.table);

    // a microtask-deferred store.dispatch would leave the old selection here
    expect(selectedAtEmit).toEqual({ [tableId]: SelectType.table });
  });

  it('touches neither the selection nor the emitter when it declines', () => {
    const { app, store, tableId, otherTableId, duplicateDragStart } = setup();
    store.dispatchSync(selectAction({ [otherTableId]: SelectType.table }));

    tryStartAltDragDuplicate(
      app,
      mousedown({ altKey: false }),
      tableId,
      SelectType.table
    );

    expect({ ...store.state.editor.selectedMap }).toEqual({
      [otherTableId]: SelectType.table,
    });
    expect(duplicateDragStart).not.toHaveBeenCalled();
  });
});
