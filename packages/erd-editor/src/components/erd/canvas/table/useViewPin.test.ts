import { createRef } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { useViewPin } from '@/components/erd/canvas/table/useViewPin';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewCloseAction,
  viewOpenAction,
} from '@/engine/modules/editor/view.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import type { Table } from '@/internal-types';
import { getViewPinnedTable } from '@/konva/scene/viewLayout';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

const press = (init: MouseEventInit = {}): ScenePointerEvent =>
  ({
    evt: new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    }),
  }) as unknown as ScenePointerEvent;

/** The lift onClickRelease waits for, read off the window like the gesture itself. */
function release(clientX = 0, clientY = 0): void {
  window.dispatchEvent(
    new MouseEvent('mouseup', { bubbles: true, clientX, clientY })
  );
}

afterEach(() => {
  release();
});

type Fixture = {
  app: AppContext;
  table: Table;
  onPress: (event: ScenePointerEvent) => void;
};

function setup(source: GeometrySource): Fixture {
  const app = createTestAppContext();
  app.store.dispatchSync(addTableAction$());
  const tableId = app.store.state.doc.tableIds[0];
  const table = app.store.state.collections.tableEntities[tableId];

  // useViewPin takes its refs directly rather than a component context, so a
  // plain setup function calls it exactly as Table.tsx does.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const { onPress } = useViewPin(
    createRef(app),
    { table },
    createRef<GeometrySource>(source)
  );

  return { app, table, onPress };
}

describe('useViewPin', () => {
  it('never reads a press from the document scene, where no view exists to pin in', () => {
    const { app, onPress } = setup('document');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press());
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });

  it('does nothing for a press in a view scene whose view is not open', () => {
    const { app, onPress } = setup('flow');

    expect(app.store.state.editor.views.flow).toBeNull();

    onPress(press());
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });

  it('pins the pressed table once the click lifts inside the same view', () => {
    const { app, table, onPress } = setup('flow');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press());
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBe(table.id);
  });

  it('lets go of the pin on a second click of the table already pinned', () => {
    const { app, table, onPress } = setup('flow');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press());
    release();
    expect(getViewPinnedTable(app.store.state, 'flow')).toBe(table.id);

    onPress(press());
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });

  it('ignores a press held with the modifier key', () => {
    const { app, onPress } = setup('flow');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press({ ctrlKey: true, metaKey: true }));
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });

  it('drops the pin once the view the press was taken in closes before the release lands', () => {
    const { app, onPress } = setup('flow');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press());
    app.store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });

  it('drops the pin once the view reopens as a new one before the release lands', () => {
    const { app, onPress } = setup('flow');
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));

    onPress(press());
    app.store.dispatchSync(viewCloseAction({ kind: ViewKind.flow }));
    app.store.dispatchSync(viewOpenAction({ kind: ViewKind.flow }));
    release();

    expect(getViewPinnedTable(app.store.state, 'flow')).toBeNull();
  });
});
