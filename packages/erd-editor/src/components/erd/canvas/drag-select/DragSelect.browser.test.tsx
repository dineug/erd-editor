/** @jsxHost konva */

import { createRef, useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Rect } from 'konva/lib/shapes/Rect';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import DragSelect from '@/components/erd/canvas/drag-select/DragSelect';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { dragSelectRectAction } from '@/engine/modules/editor/atom.actions';
import { SelectType, ViewKind } from '@/engine/modules/editor/state';
import {
  viewChangeZoomLevelAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import {
  changeZoomLevelAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import { type Rect as DragRect } from '@/utils/dragSelect';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { dragSelectStartAction } from '@/utils/emitter';

const THEME = createTestTheme();

const teardowns: Array<() => void> = [];

afterEach(async () => {
  window.dispatchEvent(new MouseEvent('mouseup'));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type Mounted = {
  app: AppContext;
  stage: ReturnType<typeof renderScene>['stage'];
  root: HTMLDivElement;
  begin: (x: number, y: number) => Promise<void>;
};

const createFixedDiv = () => {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.left = '0px';
  el.style.top = '0px';
  el.style.width = '400px';
  el.style.height = '300px';
  document.body.append(el);
  return el;
};

/**
 * The marquee in a Stage, under a shell that provides the scene source when
 * one is given, the way a view overlay hangs its own over the canvas it mounts.
 */
async function mountMarquee(
  app: AppContext = createTestAppContext(),
  source: GeometrySource | null = null
): Promise<Mounted> {
  const shell = createFixedDiv();
  const container = createFixedDiv();
  const $root = createFixedDiv();
  const root = createRef<HTMLDivElement>($root);
  shell.append(container);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  const provider = source
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(shell as any, sceneSourceContext, source)
    : null;

  const rendered = renderScene({
    app,
    container,
    width: 400,
    height: 300,
    theme: THEME,
    scene: (
      <k-layer name="overlay-marquee">
        <DragSelect root={root} />
      </k-layer>
    ),
  });

  teardowns.push(() => {
    rendered.destroy();
    provider?.destroy();
    container.remove();
    shell.remove();
    $root.remove();
  });

  await flush();
  await whenDrawn();

  return {
    app,
    stage: rendered.stage,
    root: $root,
    begin: async (x: number, y: number) => {
      app.emitter.emit(
        dragSelectStartAction({ x, y, source: source ?? 'document' })
      );
      await flush();
      await whenDrawn();
    },
  };
}

/** A marquee already open at the origin, which is what every drag case needs. */
async function openMarquee(x = 10, y = 20, app?: AppContext): Promise<Mounted> {
  const mounted = await mountMarquee(app ?? createTestAppContext());
  await mounted.begin(x, y);
  return mounted;
}

const marqueeOf = (mounted: Mounted) =>
  mounted.stage.findOne<Group>('.drag-select') ?? null;

const rectsOf = (mounted: Mounted) =>
  (marqueeOf(mounted) as Group).getChildren() as Rect[];

const moveTo = async (
  $root: HTMLDivElement,
  clientX: number,
  clientY: number
) => {
  $root.dispatchEvent(
    new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
    })
  );
  await flush();
  await whenDrawn();
};

// An empty table renders 365x56, so its 15x15 center box sits at (167.5, 13).
const seedTable = (app: AppContext, id: string, x = 0, y = 0) => {
  app.store.dispatchSync(addTableAction({ id, ui: { x, y, zIndex: 2 } }));
};

const recordDragSelectRects = (app: AppContext) => {
  const rects: Array<DragRect | null> = [];
  const unsubscribe = app.store.subscribe(actions => {
    actions.forEach(action => {
      action.type === dragSelectRectAction.type &&
        rects.push(action.payload.rect);
    });
  });
  return { rects, unsubscribe };
};

describe('DragSelect - node structure', () => {
  it('draws a translucent body under a solid dashed outline', async () => {
    const mounted = await openMarquee();
    const marquee = marqueeOf(mounted) as Group;
    const [background, border] = rectsOf(mounted);

    expect(marquee.getClassName()).toBe('Group');
    expect(marquee.getAttr('kind')).toBe('drag-select');
    expect(marquee.listening()).toBe(false);

    expect(background.getClassName()).toBe('Rect');
    expect(background.name()).toBe('drag-select-background');
    expect(background.fill()).toBe(THEME.dragSelectBackground);
    expect(background.opacity()).toBe(0.3);
    expect(background.stroke()).toBeUndefined();

    expect(border.getClassName()).toBe('Rect');
    expect(border.name()).toBe('drag-select-border');
    expect(border.stroke()).toBe(THEME.dragSelectBorder);
    expect(border.strokeWidth()).toBe(1);
    expect(border.dash()).toEqual([3, 3]);
    expect(border.fill()).toBeUndefined();
  });

  it('starts empty, before any pointer movement has sized it', async () => {
    const mounted = await openMarquee();
    const [background] = rectsOf(mounted);

    expect(background.width()).toBe(0);
    expect(background.height()).toBe(0);
  });

  it('draws nothing at all until a gesture opens it', async () => {
    const mounted = await mountMarquee();

    expect(marqueeOf(mounted)).toBeNull();
  });
});

describe('DragSelect - screen space', () => {
  it('positions the group at the corner and sizes both rects to the drag', async () => {
    const mounted = await openMarquee(10, 20);

    await moveTo(mounted.root, 110, 120);

    const marquee = marqueeOf(mounted) as Group;
    const [background, border] = rectsOf(mounted);

    expect(marquee.x()).toBe(10);
    expect(marquee.y()).toBe(20);
    expect([background.width(), background.height()]).toEqual([100, 100]);
    expect([border.width(), border.height()]).toEqual([100, 100]);
  });

  it('takes the smaller corner when the pointer travels back past the origin', async () => {
    const mounted = await openMarquee(200, 150);

    await moveTo(mounted.root, 50, 30);

    const marquee = marqueeOf(mounted) as Group;
    const [background] = rectsOf(mounted);

    expect([marquee.x(), marquee.y()]).toEqual([50, 30]);
    expect([background.width(), background.height()]).toEqual([150, 120]);
  });

  it('collapses to zero when the pointer sits exactly on the anchor', async () => {
    const mounted = await openMarquee(120, 90);

    await moveTo(mounted.root, 120, 90);

    const [background] = rectsOf(mounted);
    expect([background.width(), background.height()]).toEqual([0, 0]);
  });

  it('tracks a second move instead of accumulating the first one', async () => {
    const mounted = await openMarquee(0, 0);

    await moveTo(mounted.root, 300, 300);
    await moveTo(mounted.root, 120, 90);

    const [background] = rectsOf(mounted);
    expect([background.width(), background.height()]).toEqual([120, 90]);
  });
});

describe('DragSelect - store', () => {
  it('publishes the dragged rect in schema coordinates', async () => {
    const mounted = await openMarquee(10, 20);

    await moveTo(mounted.root, 110, 120);

    expect(mounted.app.store.state.editor.dragSelect).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 100,
    });
  });

  it('clears the published rect when it goes away', async () => {
    const mounted = await openMarquee(10, 20);

    await moveTo(mounted.root, 110, 120);
    teardowns.splice(0).forEach(teardown => teardown());
    await flush();

    expect(mounted.app.store.state.editor.dragSelect).toBeNull();
  });

  it('ends the gesture on a global mouseup', async () => {
    const mounted = await openMarquee(10, 20);

    await moveTo(mounted.root, 110, 120);
    window.dispatchEvent(new MouseEvent('mouseup'));
    await flush();
    await whenDrawn();

    expect(marqueeOf(mounted)).toBeNull();
    expect(mounted.app.store.state.editor.dragSelect).toBeNull();
  });

  it('stops tracking the pointer once the gesture has ended', async () => {
    const mounted = await openMarquee(0, 0);

    await moveTo(mounted.root, 300, 300);
    window.dispatchEvent(new MouseEvent('mouseup'));
    await flush();

    const { rects, unsubscribe } = recordDragSelectRects(mounted.app);
    await moveTo(mounted.root, 50, 50);
    unsubscribe();

    expect(rects).toEqual([]);
  });

  it('selects the tables whose center overlaps the dragged rect', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 0, 0);
    seedTable(app, 't2', 5000, 5000);
    const mounted = await openMarquee(0, 0, app);

    await moveTo(mounted.root, 300, 300);

    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t1: SelectType.table,
    });
  });

  it('shifts the dragged rect by the current canvas origin', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 0, 0);
    seedTable(app, 't2', 0, 100);
    app.store.dispatchSync(scrollToAction({ originX: -100, originY: -100 }));
    const mounted = await openMarquee(0, 0, app);

    await moveTo(mounted.root, 300, 300);

    // With the origin at zero both tables overlap; the -100 shift drops t1.
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });
  });

  it('maps the rect into canvas space using the zoom level', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 0, 0);
    seedTable(app, 't2', 400, 400);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const mounted = await openMarquee(0, 0, app);

    await moveTo(mounted.root, 300, 300);

    // At 50% zoom and an origin of zero the 0..300 screen rect maps to 0..600
    // on the canvas, which reaches t2 where the same rect at zoom 1 would not.
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t1: SelectType.table,
      t2: SelectType.table,
    });
  });

  it('unselects everything when the dragged rect covers nothing', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 5000, 5000);
    const mounted = await openMarquee(0, 0, app);

    await moveTo(mounted.root, 10, 10);

    expect({ ...app.store.state.editor.selectedMap }).toEqual({});
  });

  it('shares the dragged rect on every move', async () => {
    const mounted = await openMarquee(0, 0);
    const { rects, unsubscribe } = recordDragSelectRects(mounted.app);

    await moveTo(mounted.root, 300, 300);
    await moveTo(mounted.root, 120, 90);
    unsubscribe();

    expect(rects).toEqual([
      { x: 0, y: 0, w: 300, h: 300 },
      { x: 0, y: 0, w: 120, h: 90 },
    ]);
  });

  it('shares the same absolute rect the selection was computed from', async () => {
    const app = createTestAppContext();
    seedTable(app, 't1', 0, 0);
    seedTable(app, 't2', 400, 400);
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    const mounted = await openMarquee(0, 0, app);
    const { rects, unsubscribe } = recordDragSelectRects(app);

    await moveTo(mounted.root, 300, 300);
    unsubscribe();

    // The same 0..600 canvas rect the selection above is derived from, not the
    // 0..300 screen box the marquee is drawn with.
    const shared = { x: 0, y: 0, w: 600, h: 600 };
    expect(rects).toEqual([shared]);
    expect(app.store.state.editor.dragSelect).toEqual(shared);
  });

  it('shares the rect shifted by the canvas origin', async () => {
    const app = createTestAppContext();
    app.store.dispatchSync(scrollToAction({ originX: -100, originY: -100 }));
    const mounted = await openMarquee(0, 0, app);
    const { rects, unsubscribe } = recordDragSelectRects(app);

    await moveTo(mounted.root, 300, 300);
    unsubscribe();

    expect(rects).toEqual([{ x: 100, y: 100, w: 300, h: 300 }]);
  });
});

describe('DragSelect - scene source', () => {
  /**
   * Three tables under two placements that disagree on every number: on screen
   * 0..300 reaches t1 in the scrolled document and t2 in the view, and t3 sits
   * at (400, 400) in the view, outside that box until the view zoom widens it.
   */
  function createViewApp(): AppContext {
    const app = createTestAppContext();
    seedTable(app, 't1', 0, 100);
    seedTable(app, 't2', 5000, 5000);
    seedTable(app, 't3', 5000, 5000);
    app.store.dispatchSync(
      scrollToAction({ originX: -100, originY: -100 }),
      viewOpenAction({ kind: ViewKind.focus, centerIds: ['t1', 't2', 't3'] }),
      viewSetLayoutAction({
        kind: ViewKind.focus,
        positions: {
          t1: { x: 5000, y: 5000 },
          t2: { x: 0, y: 0 },
          t3: { x: 400, y: 400 },
        },
      })
    );
    return app;
  }

  it('maps the rect through the view placement under a view provider', async () => {
    const app = createViewApp();
    const mounted = await mountMarquee(app, 'focus');
    await mounted.begin(0, 0);

    await moveTo(mounted.root, 300, 300);

    // The document places t1 under the same 0..300 screen box, and the view
    // puts t2 there; the selection is the only reading of the mapped rect.
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });
  });

  it('selects the table the view placed under the marquee, by the view box', async () => {
    const app = createViewApp();
    const mounted = await mountMarquee(app, 'focus');
    await mounted.begin(0, 0);

    // Dragged over the box the view source measures for t2, which the document
    // places five thousand units away from that same spot.
    const table = app.store.state.collections.tableEntities.t2;
    const rect = getTableRect(app.store.state, table, 'focus');

    await moveTo(
      mounted.root,
      rect.x + rect.width / 2 + 10,
      rect.y + rect.height / 2 + 10
    );

    expect(getTableRect(app.store.state, table).x).toBe(5000);
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });
  });

  it('scales the rect by the view zoom, not the document zoom', async () => {
    const app = createViewApp();
    app.store.dispatchSync(viewChangeZoomLevelAction({ value: 0.5 }));
    const mounted = await mountMarquee(app, 'focus');
    await mounted.begin(0, 0);

    await moveTo(mounted.root, 300, 300);

    // At the view's 50% the 0..300 screen box is 0..600 in view coordinates,
    // which reaches t3 at (400, 400) where the document zoom of 1 would not.
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
      t3: SelectType.table,
    });
  });

  it('publishes no rect for a peer to draw while the scene is a view', async () => {
    const app = createViewApp();
    const mounted = await mountMarquee(app, 'focus');
    await mounted.begin(0, 0);
    const { rects, unsubscribe } = recordDragSelectRects(app);

    await moveTo(mounted.root, 300, 300);
    window.dispatchEvent(new MouseEvent('mouseup'));
    await flush();
    unsubscribe();

    // editor.dragSelect reaches a peer verbatim and is drawn on their document
    // scene, so a view marquee writes neither its rect nor a clear of it.
    expect(rects).toEqual([]);
    expect(app.store.state.editor.dragSelect).toBeNull();
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t2: SelectType.table,
    });
  });

  it('opens in the scene the gesture names and leaves the other closed', async () => {
    const app = createViewApp();
    const documentScene = await mountMarquee(app);
    const viewScene = await mountMarquee(app, 'focus');

    app.emitter.emit(dragSelectStartAction({ x: 0, y: 0, source: 'document' }));
    await flush();
    await whenDrawn();

    expect(marqueeOf(documentScene)).not.toBeNull();
    expect(marqueeOf(viewScene)).toBeNull();

    window.dispatchEvent(new MouseEvent('mouseup'));
    await flush();
    await whenDrawn();

    app.emitter.emit(dragSelectStartAction({ x: 0, y: 0, source: 'focus' }));
    await flush();
    await whenDrawn();

    expect(marqueeOf(viewScene)).not.toBeNull();
    expect(marqueeOf(documentScene)).toBeNull();
  });

  it('stays on the document placement with no provider over it', async () => {
    const app = createViewApp();
    const mounted = await mountMarquee(app);
    await mounted.begin(0, 0);

    await moveTo(mounted.root, 300, 300);

    expect(app.store.state.editor.dragSelect).toEqual({
      x: 100,
      y: 100,
      w: 300,
      h: 300,
    });
    expect({ ...app.store.state.editor.selectedMap }).toEqual({
      t1: SelectType.table,
    });
  });
});
