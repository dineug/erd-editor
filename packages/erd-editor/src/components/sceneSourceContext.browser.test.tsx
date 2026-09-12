/** @jsxHost konva */

// The scene source boundary as a konva leaf meets it: a Stage under a DOM shell
// resolves its source through the shell's provider and draws the view of that
// kind, a sibling with no provider stays on the document, all from one store.

import { createRef, useProvider } from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Layer } from 'konva/lib/Layer';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import CanvasScene from '@/components/erd/canvas/CanvasScene';
import {
  getMinimapLayout,
  getMinimapMarkRect,
} from '@/components/erd/minimap/minimapGeometry';
import MinimapScene from '@/components/erd/minimap/MinimapScene';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { TABLE_BORDER } from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import {
  viewOpenAction,
  viewScrollToAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import {
  sceneScrollToAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

const VIEWPORT = 600;

const DOCUMENT_ORIGIN = { originX: -100, originY: -50 };
const VIEW_ORIGIN = { originX: 250, originY: 125 };
const FLOW_ORIGIN = { originX: 60, originY: 90 };

/** Where the document stands its three tables, all within a screen of its origin. */
const DOCUMENT_POINTS: Record<string, Point> = {
  t1: { x: 300, y: 200 },
  t2: { x: 900, y: 200 },
  t3: { x: 600, y: 500 },
};

/** Where the Focus view on t1 stands the two tables it reaches. */
const FOCUS_POINTS: Record<string, Point> = {
  t1: { x: 40, y: 30 },
  t2: { x: 340, y: 30 },
};

/** Where a Flow layout stands all three, nowhere near the other two placements. */
const FLOW_POINTS: Record<string, Point> = {
  t1: { x: -30, y: -20 },
  t2: { x: 270, y: -20 },
  t3: { x: 570, y: -20 },
};

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * A scene root the way the editor mounts one: a shell of its own with the
 * provider hung on it, and the Stage container inside. A shell with no source
 * is the ERD tab before it says anything, which the context default covers.
 */
function mountStage(
  app: AppContext,
  source: GeometrySource | null,
  scene: (root: HTMLDivElement) => any
): Stage {
  const shell = document.createElement('div');
  const container = document.createElement('div');
  const $root = document.createElement('div');
  shell.append(container);
  document.body.append(shell, $root);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const provider = source
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(shell as any, sceneSourceContext, source)
    : null;
  const rendered = renderScene({
    app,
    container,
    scene: scene($root),
    width: VIEWPORT,
    height: VIEWPORT,
    theme: createTestTheme(),
  });

  teardowns.push(() => {
    rendered.destroy();
    provider?.destroy();
    shell.remove();
    $root.remove();
  });

  return rendered.stage;
}

const mountShell = (app: AppContext, source: GeometrySource | null) =>
  mountStage(app, source, $root => (
    <CanvasScene root={createRef<HTMLDivElement>($root)} />
  ));

const mountMinimap = (app: AppContext, source: GeometrySource | null) =>
  mountStage(app, source, () => <MinimapScene />);

/**
 * One store: three tables and a memo placed in the document, a key on the
 * first two, one connector, and a Focus view open on t1 at a placement of its own.
 */
function createApp(): AppContext {
  const app = createTestAppContext();
  app.store.dispatchSync(
    changeViewportAction({ width: VIEWPORT, height: VIEWPORT }),
    ...Object.entries(DOCUMENT_POINTS).map(([id, { x, y }], index) =>
      addTableAction({ id, ui: { x, y, zIndex: index + 1 } })
    ),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    addColumnAction({ id: 'c3', tableId: 't2' }),
    addColumnAction({ id: 'c4', tableId: 't2' }),
    changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 't2', id: 'c3', value: true }),
    addRelationshipAction({
      id: 'r12',
      relationshipType: 1,
      start: { tableId: 't1', columnIds: ['c1'] },
      end: { tableId: 't2', columnIds: ['c3'] },
    }),
    addMemoAction({ id: 'm1', ui: { x: 100, y: 400, zIndex: 9 } })
  );
  app.store.dispatchSync(scrollToAction(DOCUMENT_ORIGIN));
  app.store.dispatchSync(
    viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1'] }),
    viewSetLayoutAction({ kind: ViewKind.focus, positions: FOCUS_POINTS })
  );
  app.store.dispatchSync(viewScrollToAction(VIEW_ORIGIN));

  return app;
}

/**
 * A Flow view beside the Focus one, placed by a layout and scrolled by name:
 * a scroll that names no kind goes to the active view, the Focus one while it
 * is open, so the Flow placement is what only a scene of its kind reads.
 */
function openFlow(app: AppContext) {
  app.store.dispatchSync(
    viewOpenAction({ kind: ViewKind.flow }),
    viewSetLayoutAction({ kind: ViewKind.flow, positions: FLOW_POINTS }),
    viewScrollToAction({ ...FLOW_ORIGIN, kind: ViewKind.flow })
  );
}

const settle = async () => {
  await flush();
  await whenDrawn();
};

const sceneOriginOf = (stage: Stage) => {
  const layer = stage.findOne<Layer>('.scene')!;
  return { originX: layer.x(), originY: layer.y() };
};

const tableOf = (stage: Stage, id: string) =>
  stage.findOne<Container>(`#table-${id}`) as Container;

/** The tables the scene draws, in document order, built nodes it hides aside. */
const drawnTableIdsOf = (stage: Stage) =>
  stage
    .find('.table')
    .filter(node => node.visible())
    .map(node => node.id().replace('table-', ''))
    .sort();

const tablePointOf = (stage: Stage, id: string): Point => {
  const node = tableOf(stage, id);
  return { x: node.x(), y: node.y() };
};

const rowCountOf = (stage: Stage, id: string) =>
  tableOf(stage, id).find('.column-row').length;

const memoCountOf = (stage: Stage) => stage.find('.memo').length;

const minimapTableIdsOf = (stage: Stage) =>
  stage
    .find('.minimap-table')
    .map(node => node.getAttr('tableId'))
    .sort();

const minimapTablePointOf = (stage: Stage, id: string): Point => {
  const node = stage
    .find('.minimap-table')
    .find(candidate => candidate.getAttr('tableId') === id)!;
  return { x: node.x(), y: node.y() };
};

const minimapMemoCountOf = (stage: Stage) => stage.find('.minimap-memo').length;

/** Where the minimap stands one table's mark, from the geometry of the source given. */
function expectedMark(app: AppContext, id: string, source: GeometrySource) {
  const { state } = app.store;
  const layout = getMinimapLayout(state, source);
  const rect = getMinimapMarkRect(
    layout.ratio,
    getTableRect(state, state.collections.tableEntities[id], source)
  );
  return { x: rect.x + TABLE_BORDER / 2, y: rect.y + TABLE_BORDER / 2 };
}

describe('the scene source boundary', () => {
  it('places a scene under a view provider at the view, and a sibling Stage at the document', async () => {
    const app = createApp();
    const viewStage = mountShell(app, 'focus');
    const documentStage = mountShell(app, null);
    await settle();

    expect(sceneOriginOf(viewStage)).toEqual(VIEW_ORIGIN);
    expect(sceneOriginOf(documentStage)).toEqual(DOCUMENT_ORIGIN);
  });

  it('moves the view scene alone when the view scrolls', async () => {
    const app = createApp();
    const viewStage = mountShell(app, 'focus');
    const documentStage = mountShell(app, null);
    await settle();

    app.store.dispatchSync(viewScrollToAction({ originX: 40, originY: 60 }));
    await settle();

    expect(sceneOriginOf(viewStage)).toEqual({ originX: 40, originY: 60 });
    expect(sceneOriginOf(documentStage)).toEqual(DOCUMENT_ORIGIN);
  });

  it('keeps a document root opened over the view on the document', async () => {
    const app = createApp();
    const documentStage = mountShell(app, 'document');
    await settle();

    expect(sceneOriginOf(documentStage)).toEqual(DOCUMENT_ORIGIN);
  });
});

/**
 * AC-61 and AC-72 as the leaves show them: what a table node is drawn at, how
 * many rows it has and whether it is drawn at all follow the provider over the
 * Stage, not the document and not the active view, on one store in one frame.
 */
describe('what each scene draws from its own source', () => {
  it('draws the Focus view under a Focus provider: its tables, at its points, with its key rows, and no memo', async () => {
    const app = createApp();
    const focusStage = mountShell(app, 'focus');
    await settle();

    expect(drawnTableIdsOf(focusStage)).toEqual(['t1', 't2']);
    expect(tablePointOf(focusStage, 't1')).toEqual(FOCUS_POINTS.t1);
    expect(tablePointOf(focusStage, 't2')).toEqual(FOCUS_POINTS.t2);
    expect(rowCountOf(focusStage, 't1')).toBe(1);
    expect(rowCountOf(focusStage, 't2')).toBe(1);
    expect(memoCountOf(focusStage)).toBe(0);
  });

  it('draws the whole document under a document provider in the same frame, at the document points with every row', async () => {
    const app = createApp();
    const focusStage = mountShell(app, 'focus');
    const documentStage = mountShell(app, 'document');
    await settle();

    expect(drawnTableIdsOf(documentStage)).toEqual(['t1', 't2', 't3']);
    expect(tablePointOf(documentStage, 't1')).toEqual(DOCUMENT_POINTS.t1);
    expect(tablePointOf(documentStage, 't3')).toEqual(DOCUMENT_POINTS.t3);
    expect(rowCountOf(documentStage, 't1')).toBe(2);
    expect(rowCountOf(documentStage, 't2')).toBe(2);
    expect(memoCountOf(documentStage)).toBe(1);
    expect(tablePointOf(focusStage, 't1')).toEqual(FOCUS_POINTS.t1);
  });

  /**
   * The defect the split of the view source closed: the Flow scene under a
   * Focus overlay kept drawing from the active view, which is the Focus one.
   */
  it('draws the Flow view under a Flow provider while a Focus view is open over it', async () => {
    const app = createApp();
    openFlow(app);
    const flowStage = mountShell(app, 'flow');
    const focusStage = mountShell(app, 'focus');
    const documentStage = mountShell(app, 'document');
    await settle();

    expect(sceneOriginOf(flowStage)).toEqual(FLOW_ORIGIN);
    expect(drawnTableIdsOf(flowStage)).toEqual(['t1', 't2', 't3']);
    expect(tablePointOf(flowStage, 't1')).toEqual(FLOW_POINTS.t1);
    expect(tablePointOf(flowStage, 't3')).toEqual(FLOW_POINTS.t3);
    expect(rowCountOf(flowStage, 't1')).toBe(0);
    expect(memoCountOf(flowStage)).toBe(0);

    expect(sceneOriginOf(focusStage)).toEqual(VIEW_ORIGIN);
    expect(drawnTableIdsOf(focusStage)).toEqual(['t1', 't2']);
    expect(tablePointOf(focusStage, 't1')).toEqual(FOCUS_POINTS.t1);
    expect(rowCountOf(focusStage, 't1')).toBe(1);

    // A scroll naming no kind goes to the active view, the Focus one, and
    // the Flow scene does not move with it.
    app.store.dispatchSync(viewScrollToAction({ originX: 40, originY: 60 }));
    await settle();

    expect(sceneOriginOf(focusStage)).toEqual({ originX: 40, originY: 60 });
    expect(sceneOriginOf(flowStage)).toEqual(FLOW_ORIGIN);

    // The scroll the Flow scene's own aids dispatch moves the Flow scene
    // alone, the Focus overlay over it standing where it was.
    app.store.dispatchSync(
      sceneScrollToAction('flow', { originX: -5, originY: -15 })
    );
    await settle();

    expect(sceneOriginOf(flowStage)).toEqual({ originX: -5, originY: -15 });
    expect(sceneOriginOf(focusStage)).toEqual({ originX: 40, originY: 60 });
    expect(sceneOriginOf(documentStage)).toEqual(DOCUMENT_ORIGIN);
  });

  it('maps the Focus view under a Focus provider and the document under a document one', async () => {
    const app = createApp();
    const focusMap = mountMinimap(app, 'focus');
    const documentMap = mountMinimap(app, 'document');
    await settle();

    expect(minimapTableIdsOf(focusMap)).toEqual(['t1', 't2']);
    expect(minimapMemoCountOf(focusMap)).toBe(0);
    expect(minimapTablePointOf(focusMap, 't1')).toEqual(
      expectedMark(app, 't1', 'focus')
    );

    expect(minimapTableIdsOf(documentMap)).toEqual(['t1', 't2', 't3']);
    expect(minimapMemoCountOf(documentMap)).toBe(1);
    expect(minimapTablePointOf(documentMap, 't1')).toEqual(
      expectedMark(app, 't1', 'document')
    );
    expect(minimapTablePointOf(documentMap, 't1')).not.toEqual(
      minimapTablePointOf(focusMap, 't1')
    );
  });

  it('maps the Flow view under a Flow provider while a Focus view is open over it', async () => {
    const app = createApp();
    openFlow(app);
    const flowMap = mountMinimap(app, 'flow');
    await settle();

    expect(minimapTableIdsOf(flowMap)).toEqual(['t1', 't2', 't3']);
    expect(minimapMemoCountOf(flowMap)).toBe(0);
    expect(minimapTablePointOf(flowMap, 't3')).toEqual(
      expectedMark(app, 't3', 'flow')
    );
    expect(expectedMark(app, 't3', 'flow')).not.toEqual(
      expectedMark(app, 't3', 'document')
    );
  });
});
