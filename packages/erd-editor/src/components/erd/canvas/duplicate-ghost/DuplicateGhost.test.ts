import { createRef, html } from '@dineug/r-html';
import { config as rxjsConfig } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import Canvas from '@/components/erd/canvas/Canvas';
import DuplicateGhost from '@/components/erd/canvas/duplicate-ghost/DuplicateGhost';
import { selectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { duplicateDragStartAction } from '@/utils/emitter';

let mounted: Mounted | null = null;

/**
 * `DuplicateGhost` holds a live `drag$` subscription for the length of a
 * gesture, and only a global mouseup completes it. Ending the drag before
 * unmounting keeps a subscription — and the module-global movement bookkeeping
 * in `globalEventObservable` — from leaking into the next test.
 */
const endGesture = () => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
};

const teardown = () => {
  endGesture();
  mounted?.unmount();
  mounted = null;
};

afterEach(teardown);

const dispatchMouse = (
  target: EventTarget,
  type: string,
  init: MouseEventInit = {}
) => {
  target.dispatchEvent(
    new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  );
};

const ghostsIn = (root: ParentNode) =>
  Array.from(
    root.querySelectorAll('[data-testid="duplicate-ghost"]')
  ) as HTMLElement[];

const layerIn = (root: ParentNode) =>
  root.querySelector(
    '[data-testid="duplicate-ghost-layer"]'
  ) as HTMLElement | null;

/**
 * Where a ghost actually lands.
 *
 * The position is split across two elements on purpose: the entity draws itself
 * at the coordinates it was frozen with at mousedown and never re-renders, and
 * the layer above it carries the whole drag delta in one `transform`. Composing
 * them here is what the user sees, and it fails if either half is wrong.
 */
const ghostPosition = (root: ParentNode, index = 0) => {
  const entity = ghostsIn(root)[index]?.querySelector(
    '.table, .memo'
  ) as HTMLElement;
  const translate = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(
    layerIn(root)?.style.transform ?? ''
  );

  return {
    x: parseFloat(entity.style.left) + Number(translate?.[1] ?? 0),
    y: parseFloat(entity.style.top) + Number(translate?.[2] ?? 0),
  };
};

async function mountGhost(app: AppContext = createTestAppContext()) {
  mounted = await mountAndFlush(html`<${DuplicateGhost} />`, app);
  return { app, container: mounted.container };
}

async function mountCanvas(app: AppContext = createTestAppContext()) {
  const $root = document.createElement('div');
  document.body.append($root);
  const root = createRef<HTMLDivElement>($root);
  const canvas = createRef<HTMLDivElement>();

  mounted = await mountAndFlush(
    html`<${Canvas} root=${root} canvas=${canvas} />`,
    app
  );
  return { app, container: mounted.container };
}

const seedTable = (app: AppContext, id: string, x: number, y: number) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
  return id;
};

const seedMemo = (app: AppContext, id: string, x: number, y: number) => {
  app.store.dispatchSync(addMemoAction({ id, ui: { x, y, zIndex: 2 } }));
  return id;
};

const select = (app: AppContext, selectedMap: Record<string, SelectType>) => {
  app.store.dispatchSync(selectAction(selectedMap));
};

const setViewport = (app: AppContext, zoomLevel: number, scroll = 0) => {
  app.store.dispatchSync(changeZoomLevelAction({ value: zoomLevel }));
  app.store.dispatchSync(
    scrollToAction({ scrollLeft: scroll, scrollTop: scroll })
  );
};

/**
 * Starts a gesture the way the canvas does: a real mousedown (which is what
 * resets the shared `prevX`/`prevY` the movement deltas are measured from),
 * then the emitter action `tryStartAltDragDuplicate` fires.
 */
const startGesture = async (app: AppContext, x = 0, y = 0) => {
  dispatchMouse(window, 'mousedown', { clientX: x, clientY: y });
  app.emitter.emit(duplicateDragStartAction());
  await flush();
};

/** Walks the pointer through absolute screen positions. */
const movePointer = async (points: Array<[number, number]>) => {
  for (const [clientX, clientY] of points) {
    dispatchMouse(window, 'mousemove', { clientX, clientY });
  }
  await flush();
};

const dropAndSettle = async () => {
  endGesture();
  await flush();
};

const tableOf = (app: AppContext, id: string) =>
  app.store.state.collections.tableEntities[id];

/** The entity created by the commit — always appended to the document. */
const lastTable = (app: AppContext) => {
  const { tableIds } = app.store.state.doc;
  return tableOf(app, tableIds[tableIds.length - 1]);
};

const decimalsOf = (value: number) => String(value).split('.')[1]?.length ?? 0;

describe('DuplicateGhost - rendering', () => {
  it('renders nothing until a duplicate drag starts', async () => {
    const { container } = await mountGhost();

    expect(ghostsIn(container)).toHaveLength(0);
  });

  it('renders one ghost per selected entity', async () => {
    const { app, container } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    seedMemo(app, 'm1', 300, 400);
    select(app, { t1: SelectType.table, m1: SelectType.memo });

    await startGesture(app);

    const ghosts = ghostsIn(container);
    expect(ghosts.map(el => el.getAttribute('data-id'))).toEqual(['t1', 'm1']);
    expect(ghosts.map(el => el.getAttribute('data-select-type'))).toEqual([
      'table',
      'memo',
    ]);
  });

  it.each([
    [1, true],
    [0.7, false],
  ])(
    'renders the same table component the canvas does at zoom %s',
    async (zoomLevel, expectColumns) => {
      const app = createTestAppContext();
      seedTable(app, 't1', 100, 200);
      app.store.dispatchSync(addColumnAction({ id: 'c1', tableId: 't1' }));
      select(app, { t1: SelectType.table });
      setViewport(app, zoomLevel);

      const { container } = await mountCanvas(app);
      await startGesture(app);

      // `isHighLevelTable` is `zoomLevel <= 0.7`, and the high-level render
      // draws the name alone — no column rows. A ghost stuck on one component
      // would look nothing like the entity it stands for on the other side of
      // that threshold.
      const [ghost] = ghostsIn(container);
      expect(ghost.querySelectorAll('.column-row').length > 0).toBe(
        expectColumns
      );
    }
  );

  it('renders no ghost when nothing is selected', async () => {
    const { app, container } = await mountGhost();
    seedTable(app, 't1', 100, 200);

    await startGesture(app);

    expect(ghostsIn(container)).toHaveLength(0);
  });

  it('drops the ghosts once the gesture ends', async () => {
    const { app, container } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    expect(ghostsIn(container)).toHaveLength(1);

    await dropAndSettle();
    expect(ghostsIn(container)).toHaveLength(0);
  });

  it('leaves the document alone while the ghost follows the pointer', async () => {
    const { app } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    await movePointer([
      [40, 40],
      [80, 80],
    ]);

    expect(app.store.state.doc.tableIds).toEqual(['t1']);
    expect(tableOf(app, 't1').ui).toMatchObject({ x: 100, y: 200 });
  });
});

describe('DuplicateGhost - coordinate space (AC-36)', () => {
  it('renders the ghost inside the canvas transform', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });
    setViewport(app, 0.5, -120);

    const { container } = await mountCanvas(app);
    await startGesture(app);

    const [ghost] = ghostsIn(container);
    expect(ghost).toBeTruthy();
    // The controller above the canvas carries
    // `translate(scrollLeft, scrollTop) scale(zoomLevel)`. A ghost rendered as a
    // sibling of `<Canvas>` instead would sit outside it and be off by the
    // scroll offset and wrong by a factor of the zoom — while still looking
    // right at the default zoom 1 / scroll 0.
    expect(ghost.closest('[data-testid="erd-canvas"]')).not.toBeNull();
  });

  it('positions the ghost in canvas units, not screen pixels', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });
    setViewport(app, 0.5, -120);

    const { container } = await mountCanvas(app);
    await startGesture(app);
    // 10 x 20 screen pixels at zoom 0.5 is 20 x 40 canvas units.
    await movePointer([[10, 20]]);

    expect(ghostPosition(container)).toEqual({ x: 120, y: 240 });
  });

  it('commits the copy at the same coordinates the ghost showed', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });
    setViewport(app, 0.5, -120);

    const { container } = await mountCanvas(app);
    await startGesture(app);
    await movePointer([[10, 20]]);

    const shown = ghostPosition(container);

    await dropAndSettle();

    const copy = lastTable(app);
    expect(copy.id).not.toBe('t1');
    expect({ x: copy.ui.x, y: copy.ui.y }).toEqual(shown);
  });

  it('keeps the ghost correct when the zoom changes mid-drag', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });
    setViewport(app, 1);

    const { container } = await mountCanvas(app);
    await startGesture(app);
    await movePointer([[10, 10]]);

    setViewport(app, 0.5);
    await movePointer([[20, 20]]);

    // 10 screen px at zoom 1, then another 10 at zoom 0.5: 10 + 20 canvas units.
    expect(ghostPosition(container)).toEqual({ x: 130, y: 230 });

    await dropAndSettle();
    expect(lastTable(app).ui).toMatchObject({ x: 130, y: 230 });
  });
});

describe('DuplicateGhost - commit', () => {
  it.each([0.25, 0.5, 1])(
    'takes the same branch for a deliberate drag at zoom %s (AC-38)',
    async zoomLevel => {
      const app = createTestAppContext();
      seedTable(app, 't1', 100, 200);
      select(app, { t1: SelectType.table });
      setViewport(app, zoomLevel);

      await mountGhost(app);
      await startGesture(app);
      // 8 screen pixels of travel — twice `DUPLICATE_MIN_MOVE` at every zoom.
      await movePointer([[4, 4]]);
      await dropAndSettle();

      const copy = lastTable(app);
      expect(copy.ui.x).toBe(100 + 4 / zoomLevel);
      expect(copy.ui.y).toBe(200 + 4 / zoomLevel);
    }
  );

  it.each([0.25, 0.5, 1])(
    'takes the same branch for a tremor-sized drag at zoom %s (AC-38)',
    async zoomLevel => {
      const app = createTestAppContext();
      seedTable(app, 't1', 100, 200);
      select(app, { t1: SelectType.table });
      setViewport(app, zoomLevel);

      await mountGhost(app);
      await startGesture(app);
      // 2 screen pixels of travel — below `DUPLICATE_MIN_MOVE` at every zoom.
      await movePointer([[1, 1]]);
      await dropAndSettle();

      expect(lastTable(app).ui).toMatchObject({ x: 150, y: 250 });
    }
  );

  it('offsets an Alt+click that never moved rather than dispatching nothing (AC-34)', async () => {
    const { app } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    await dropAndSettle();

    expect(app.store.state.doc.tableIds).toHaveLength(2);
    expect(lastTable(app).ui).toMatchObject({ x: 150, y: 250 });
  });

  it('escapes a collision below the threshold but never above it (AC-37)', async () => {
    const { app } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    // Already sitting exactly where a `+(50, 50)` copy would land.
    seedTable(app, 't2', 150, 250);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    await dropAndSettle();

    // Below the threshold the copy escapes the occupied point.
    expect(lastTable(app).ui).toMatchObject({ x: 200, y: 300 });

    select(app, { t1: SelectType.table });
    await startGesture(app);
    await movePointer([[50, 50]]);
    await dropAndSettle();

    // A deliberate 50px drag is honoured even though the point is occupied.
    expect(lastTable(app).ui).toMatchObject({ x: 150, y: 250 });
  });

  it('rounds the committed offset to four decimals (AC-39)', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });
    // A zoom the screen delta does not divide evenly by.
    setViewport(app, 0.7);

    await mountGhost(app);
    await startGesture(app);
    await movePointer([
      [10, 10],
      [20, 20],
      [30, 30],
    ]);
    await dropAndSettle();

    const { ui } = lastTable(app);
    expect(decimalsOf(ui.x)).toBeLessThanOrEqual(4);
    expect(decimalsOf(ui.y)).toBeLessThanOrEqual(4);
    expect(ui.x).toBeCloseTo(100 + 30 / 0.7, 3);
  });

  it('duplicates every selected entity and keeps their relative layout', async () => {
    const { app } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    seedTable(app, 't2', 400, 200);
    seedMemo(app, 'm1', 100, 600);
    select(app, {
      t1: SelectType.table,
      t2: SelectType.table,
      m1: SelectType.memo,
    });

    await startGesture(app);
    await movePointer([[60, 30]]);
    await dropAndSettle();

    const { tableIds, memoIds } = app.store.state.doc;
    expect(tableIds).toHaveLength(4);
    expect(memoIds).toHaveLength(2);

    const [copyA, copyB] = tableIds.slice(2).map(id => tableOf(app, id));
    const copyMemo = app.store.state.collections.memoEntities[memoIds[1]];

    expect(copyA.ui).toMatchObject({ x: 160, y: 230 });
    expect(copyB.ui.x - copyA.ui.x).toBe(300);
    expect(copyMemo.ui.y - copyA.ui.y).toBe(400);
  });

  // AC-24: the duplicate never goes near the clipboard — no copy is written on
  // the way in and nothing is read on the way out.
  it('leaves the clipboard alone for the whole gesture', async () => {
    const { app } = await mountGhost();
    const copy = vi.fn();
    const paste = vi.fn();
    app.emitter.on({ copy, paste });
    seedTable(app, 't1', 100, 200);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    await movePointer([
      [40, 40],
      [80, 80],
    ]);
    await dropAndSettle();

    expect(app.store.state.doc.tableIds).toHaveLength(2);
    expect(copy).not.toHaveBeenCalled();
    expect(paste).not.toHaveBeenCalled();
  });

  it('commits the entities the gesture started on, not the current selection', async () => {
    const { app } = await mountGhost();
    seedTable(app, 't1', 100, 200);
    seedTable(app, 't2', 400, 200);
    select(app, { t1: SelectType.table });

    await startGesture(app);
    // Something else claims the selection while the drag is in flight.
    select(app, { t2: SelectType.table });
    await movePointer([[60, 30]]);
    await dropAndSettle();

    expect(app.store.state.doc.tableIds).toHaveLength(3);
    expect(lastTable(app).ui).toMatchObject({ x: 160, y: 230 });
  });

  // Covers the outcome, not the mechanism: unmounting unsubscribes `drag$`
  // (so the completion never arrives) and `commit` re-checks the flag anyway.
  it('does not commit a gesture whose editor was torn down mid-drag', async () => {
    const errors: unknown[] = [];
    const onUnhandledError = rxjsConfig.onUnhandledError;
    rxjsConfig.onUnhandledError = error => errors.push(error);

    try {
      const { app } = await mountGhost();
      seedTable(app, 't1', 100, 200);
      select(app, { t1: SelectType.table });

      await startGesture(app);
      await movePointer([[60, 30]]);

      mounted?.unmount();
      mounted = null;

      await dropAndSettle();
      // rxjs reports subscriber errors on a macrotask, so let one elapse.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(errors).toEqual([]);
      expect(app.store.state.doc.tableIds).toEqual(['t1']);
    } finally {
      rxjsConfig.onUnhandledError = onUnhandledError;
    }
  });
});
