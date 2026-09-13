// AC-57: one table of behaviours, driven twice — over the whole document and
// narrowed to one center — so a mechanism wired for the wider display set
// alone fails here rather than in a screenshot.

import { useProvider } from '@dineug/r-html';
import type { Group } from 'konva/lib/Group';
import type { Layer } from 'konva/lib/Layer';
import type { Rect } from 'konva/lib/shapes/Rect';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  fireScenePointer,
  flush,
  mount,
  type Mounted,
  releasePointer,
  stepTransitions,
  whenPainted,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { getContentCompass } from '@/components/erd/content-compass/compassGeometry';
import { themeContext } from '@/components/themeContext';
import { PARTICLE_GROUP_NAME } from '@/components/visualization/particles/particleLoop';
import { PARTICLE_COUNT } from '@/components/visualization/particles/particlePath';
import Visualization from '@/components/visualization/Visualization';
import {
  CANVAS_ZOOM_MAX,
  CanvasType,
  RelationshipType,
} from '@/constants/schema';
import { ZOOM_STEP } from '@/constants/zoom';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { ShowMode, ViewKind } from '@/engine/modules/editor/state';
import { viewScrollToAction } from '@/engine/modules/editor/view.actions';
import { addRelationshipAction } from '@/engine/modules/relationship/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnNameAction,
  changeColumnPrimaryKeyAction,
} from '@/engine/modules/table-column/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';
import { getSceneContentRect } from '@/konva/scene/contentBounds';
import { previewZoomLevel } from '@/konva/scene/fitZoom';
import { getHighlightIds, getViewPinnedTable } from '@/konva/scene/viewLayout';
import { toScreenPoint } from '@/konva/scene/viewport';

const hoisted = vi.hoisted(() => ({
  requests: [] as Array<{ placement: string; nodes: any[]; edges: any[] }>,
}));

/**
 * ELK answers from a shared worker no spec waits on, so the one call across
 * that boundary is stood in for by a row: a request is something a case can
 * count and the landing something it can predict.
 */
vi.mock('@/services/elk-layout', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/elk-layout')>();
  const flatten = (nodes: any[]): any[] =>
    nodes.flatMap(node =>
      node.children?.length ? flatten(node.children) : [node]
    );

  return {
    ...actual,
    createElkLayout: (request: any) => {
      hoisted.requests.push(request);

      return Promise.resolve(
        flatten(request.nodes).map((node, index) => ({
          id: node.id,
          x: index * 400,
          y: (index % 2) * 200,
        }))
      );
    },
  };
});

const VIEWPORT = { width: 1000, height: 600 };

const teardowns: Array<() => void> = [];

afterEach(async () => {
  releasePointer();
  teardowns.splice(0).forEach(teardown => teardown());
  hoisted.requests.splice(0);
  await whenDrawn();
});

const transitions = stepTransitions();

/** Two rounds: the layout lands in a microtask after the first, and the fit after it. */
const settle = async () => {
  await flush();
  await whenDrawn();
  await flush();
  await whenDrawn();
  transitions.settle();
  await flush();
  await whenDrawn();
};

const link = (id: string, start: string, end: string) =>
  addRelationshipAction({
    id,
    relationshipType: RelationshipType.ZeroN,
    start: { tableId: start, columnIds: [] },
    end: { tableId: end, columnIds: [] },
  });

/**
 * A triangle t1 - t2 - t3 with a table t4 nothing reaches. Standing on t1 the
 * view shows the triangle and drops t4, so the two display sets really differ,
 * and t2 is a neighbour whose hover lights a connector the rest of the view does not.
 */
function seed(app: AppContext) {
  app.store.dispatchSync(
    changeViewportAction(VIEWPORT),
    addTableAction({ id: 't1', ui: { x: 100, y: 100, zIndex: 1 } }),
    addTableAction({ id: 't2', ui: { x: 700, y: 100, zIndex: 2 } }),
    addTableAction({ id: 't3', ui: { x: 400, y: 400, zIndex: 3 } }),
    addTableAction({ id: 't4', ui: { x: 1300, y: 100, zIndex: 4 } }),
    changeTableNameAction({ id: 't1', value: 'users' }),
    changeTableNameAction({ id: 't2', value: 'orders' }),
    changeTableNameAction({ id: 't3', value: 'items' }),
    changeTableNameAction({ id: 't4', value: 'logs' }),
    addColumnAction({ id: 'c1', tableId: 't1' }),
    addColumnAction({ id: 'c2', tableId: 't1' }),
    addColumnAction({ id: 'c3', tableId: 't2' }),
    addColumnAction({ id: 'c4', tableId: 't3' }),
    addColumnAction({ id: 'c5', tableId: 't4' }),
    changeColumnNameAction({ tableId: 't1', id: 'c1', value: 'id' }),
    changeColumnNameAction({ tableId: 't1', id: 'c2', value: 'name' }),
    changeColumnPrimaryKeyAction({ tableId: 't1', id: 'c1', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 't2', id: 'c3', value: true }),
    changeColumnPrimaryKeyAction({ tableId: 't3', id: 'c4', value: true }),
    link('r12', 't1', 't2'),
    link('r13', 't1', 't3'),
    link('r23', 't2', 't3')
  );
}

const stageRegistry = (): Record<string, Stage> =>
  Reflect.get(globalThis, '__erdStages') ?? {};

const flowStage = () => stageRegistry().canvas;

const tableOf = (id: string) =>
  flowStage().findOne<Group>(`#table-${id}`) as Group;

const bodyOf = (id: string) => tableOf(id).findOne<Rect>('.table-body') as Rect;

const rowCountOf = (id: string) => tableOf(id).find('.column-row').length;

const buttonOf = (id: string, name: string) =>
  tableOf(id).findOne<Group>(`.${name}`) ?? null;

/**
 * The shape a press on a header button lands on. Konva names the press for the
 * shape under the pointer and bubbles it from there, so a case firing at the
 * icon group would hand the card a press with no target and prove nothing.
 */
const buttonHitOf = (id: string, name: string) =>
  buttonOf(id, name)?.getChildren()[0] ?? null;

const particleLayer = () =>
  flowStage().findOne<Layer>('.view-particles') as Layer;

/** The connectors carrying particles, by the id each group of six is named with. */
const particleIdsOf = () =>
  particleLayer()
    .find<Group>(`.${PARTICLE_GROUP_NAME}`)
    .map(group => group.name().replace(`${PARTICLE_GROUP_NAME} `, ''))
    .sort();

/** The connectors the view lights, sorted, read off the state the scene renders from. */
const litRelationshipIds = (app: AppContext) =>
  [...getHighlightIds(app.store.state, ViewKind.flow).relationshipIds].sort();

/** The tables the view lights, sorted, off the same state. */
const litTableIds = (app: AppContext) =>
  [...getHighlightIds(app.store.state, ViewKind.flow).tableIds].sort();

/** The one card the view holds lit with no pointer on it, or null while it holds none. */
const pinnedTableOf = (app: AppContext) =>
  getViewPinnedTable(app.store.state, ViewKind.flow);

const menuOf = (mounted: Mounted, title: string) =>
  mounted.container.querySelector<HTMLElement>(
    `.visualization-toolbar [title="${title}"]`
  );

const click = (el: Element | null) =>
  el?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

const showModeTriggerOf = (mounted: Mounted) =>
  mounted.container.querySelector<HTMLElement>(
    '.visualization-toolbar [title^="Row display"]'
  );

/** One option of the row display menu, named by what it prints. */
const showModeOptionOf = (mounted: Mounted, title: string) =>
  Array.from(
    mounted.container.querySelectorAll<HTMLElement>(
      '.visualization-show-mode-menu .context-menu-content > div'
    )
  ).find(option => option.textContent?.trim() === title) ?? null;

/** Opens the row display menu from its trigger and picks one of the three. */
async function chooseShowMode(mounted: Mounted, title: string) {
  click(showModeTriggerOf(mounted));
  await settle();
  const option = showModeOptionOf(mounted, title);
  // A press on nothing reads exactly like a pick that changed nothing, so a
  // menu that never opened would leave the cases below asserting the default.
  expect(option).not.toBeNull();
  click(option);
  await settle();
}

async function mountVisualization(app: AppContext): Promise<Mounted> {
  app.store.dispatchSync(
    changeCanvasTypeAction({ value: CanvasType.visualization })
  );
  const mounted = mount(<Visualization />, app);
  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    mounted.container as any,
    themeContext,
    createTestTheme()
  );

  await settle();

  const teardown = () => {
    mounted.unmount();
    themeProvider.destroy();
  };
  teardowns.push(teardown);

  return { ...mounted, unmount: teardown };
}

/**
 * Stands the reader in the Flow mode on the display set given: over the whole
 * document, or narrowed the way a reader narrows it, by pressing Related on
 * the one card the centers name. Both are one screen and one slot.
 */
async function enterDisplaySet(centerIds: string[]): Promise<Mounted> {
  const app = createTestAppContext();
  seed(app);
  const mounted = await mountVisualization(app);

  click(menuOf(mounted, 'Flow'));
  await settle();

  // One center and one gesture, since one card's button is what a reader has:
  // the press lands on the card as well as on the button, so an entry that
  // dispatched the action instead would never meet what the press leaves behind.
  const [centerId] = centerIds;
  if (centerId) {
    await hoverTable(centerId);
    await pressRelated(centerId);
    await leaveTable(centerId);
  }

  return mounted;
}

/** A press and a lift on the same point of a card body, the click the scene reads as one. */
async function clickTable(id: string) {
  const at = { clientX: 10, clientY: 10 };

  fireScenePointer(bodyOf(id), 'mousedown', at);
  await settle();
  fireScenePointer(bodyOf(id), 'mouseup', at);
  await settle();
}

async function hoverTable(id: string) {
  fireScenePointer(tableOf(id), 'mouseenter');
  await settle();
}

async function leaveTable(id: string) {
  fireScenePointer(tableOf(id), 'mouseleave');
  await settle();
}

/**
 * The press, the lift and the click a reader lands on the Related button of a
 * hovered card, in the order the stage sends them, so the card sees the press
 * that goes past it on the way.
 */
async function pressRelated(id: string) {
  const at = { clientX: 20, clientY: 20 };
  const shape = buttonHitOf(id, 'table-related');
  // A press on nothing narrows nothing, which reads exactly like a view that
  // was already narrowed, so an unhovered card would pass the cases below.
  expect(shape).not.toBeNull();

  fireScenePointer(shape!, 'mousedown', at);
  await settle();
  fireScenePointer(shape!, 'mouseup', at);
  fireScenePointer(shape!, 'click', at);
  await settle();
}

type DisplaySet = {
  name: string;
  centerIds: string[];
  /** What the view lights with no pointer on it, which is nothing in either display set. */
  restLit: string[];
  /**
   * What it lights with the neighbour t2 under the pointer. A neighbour and
   * never a center: the connector it adds runs between two neighbours, which
   * no display set lights for its own sake.
   */
  hoverLit: string[];
  /**
   * The cards lit before and after that hover, which now match across the two
   * display sets: neither rests lit, and the same three come up under the
   * same pointer, so the cards measure the parity as squarely as the connectors do.
   */
  litCards: { rest: string[]; hover: string[] };
  /** The cards the display set draws, which is the other thing that differs. */
  shown: string[];
};

/**
 * The two states, each with what it lights at rest and under the same hover.
 * Neither rests lit: the centers seed nothing, so a narrowed view opens on the
 * same dark screen the whole document does and the pointer is the whole of the light.
 */
const DISPLAY_SETS: DisplaySet[] = [
  {
    name: 'the whole document',
    centerIds: [],
    restLit: [],
    hoverLit: ['r12', 'r23'],
    litCards: { rest: [], hover: ['t1', 't2', 't3'] },
    shown: ['t1', 't2', 't3', 't4'],
  },
  {
    name: 'one center and its hop',
    centerIds: ['t1'],
    restLit: [],
    hoverLit: ['r12', 'r23'],
    litCards: { rest: [], hover: ['t1', 't2', 't3'] },
    shown: ['t1', 't2', 't3'],
  },
];

describe.each(DISPLAY_SETS)(
  'the Flow view over $name',
  ({ centerIds, restLit, hoverLit, litCards, shown }) => {
    it('draws the display set it was opened on', async () => {
      const mounted = await enterDisplaySet(centerIds);

      expect(
        flowStage()
          .find('.table')
          .map(node => node.id().replace('table-', ''))
          .sort()
      ).toEqual(shown);
      expect(mounted.app.store.state.editor.views.flow!.centerIds).toEqual(
        centerIds
      );
    });

    it('lights the connectors at a hovered neighbour and lets them go on the leave', async () => {
      const { app } = await enterDisplaySet(centerIds);

      expect(litRelationshipIds(app)).toEqual(restLit);
      expect(litTableIds(app)).toEqual(litCards.rest);

      await hoverTable('t2');

      // Both display sets rest dark and both light the same two connectors and
      // three cards under the same pointer, which is the parity: the narrowed
      // view runs the mechanism the whole document runs, to the same degree.
      expect(litRelationshipIds(app)).toEqual(hoverLit);
      expect(hoverLit.length).toBeGreaterThan(restLit.length);
      expect(litTableIds(app)).toEqual(litCards.hover);

      await leaveTable('t2');

      expect(litRelationshipIds(app)).toEqual(restLit);
      expect(litTableIds(app)).toEqual(litCards.rest);
    });

    it('leaves the pin to the card body, which the Related press goes past', async () => {
      const { app } = await enterDisplaySet(centerIds);

      expect(pinnedTableOf(app)).toBeNull();

      await hoverTable('t1');
      await pressRelated('t1');
      await leaveTable('t1');

      // The press that narrows the view runs over the card that carries the
      // button, and a pin taken there would light the hub and its one hop,
      // which in the view it just opened is every card on the screen.
      expect(pinnedTableOf(app)).toBeNull();
      expect(litTableIds(app)).toEqual([]);

      await clickTable('t1');
      await leaveTable('t1');

      expect(pinnedTableOf(app)).toBe('t1');
      expect(litTableIds(app)).toEqual(['t1', 't2', 't3']);
    });

    it('pins that same set on a click of the neighbour and unpins it on the next', async () => {
      const { app } = await enterDisplaySet(centerIds);

      await clickTable('t2');
      await leaveTable('t2');

      expect(litRelationshipIds(app)).toEqual(hoverLit);

      await clickTable('t2');
      await leaveTable('t2');

      expect(litRelationshipIds(app)).toEqual(restLit);
    });

    it('walks the three row modes from the bar dropdown', async () => {
      const mounted = await enterDisplaySet(centerIds);
      const { app } = mounted;

      await chooseShowMode(mounted, 'Name only');
      expect(app.store.state.editor.views.flow!.showMode).toBe(
        ShowMode.nameOnly
      );
      expect(showModeTriggerOf(mounted)?.getAttribute('title')).toBe(
        'Row display: Name only'
      );
      expect(rowCountOf('t1')).toBe(0);

      await chooseShowMode(mounted, 'Keys only');
      expect(app.store.state.editor.views.flow!.showMode).toBe(
        ShowMode.keysOnly
      );
      expect(showModeTriggerOf(mounted)?.getAttribute('title')).toBe(
        'Row display: Keys only'
      );
      expect(rowCountOf('t1')).toBe(1);

      await chooseShowMode(mounted, 'All fields');
      expect(app.store.state.editor.views.flow!.showMode).toBe(
        ShowMode.allFields
      );
      expect(showModeTriggerOf(mounted)?.getAttribute('title')).toBe(
        'Row display: All fields'
      );
      expect(rowCountOf('t1')).toBe(2);
    });

    it('carries Related and Go to ERD on the hovered card alone', async () => {
      await enterDisplaySet(centerIds);

      expect(buttonOf('t1', 'table-related')).toBeNull();
      expect(buttonOf('t1', 'table-go-to-erd')).toBeNull();

      await hoverTable('t1');

      expect(buttonOf('t1', 'table-related')).not.toBeNull();
      expect(buttonOf('t1', 'table-go-to-erd')).not.toBeNull();
      expect(buttonOf('t2', 'table-related')).toBeNull();

      await leaveTable('t1');

      expect(buttonOf('t1', 'table-related')).toBeNull();
      expect(buttonOf('t1', 'table-go-to-erd')).toBeNull();
    });

    it('steps the zoom of the view alone from the bar', async () => {
      const mounted = await enterDisplaySet(centerIds);
      const { app } = mounted;
      const fitted = app.store.state.editor.views.flow!.zoomLevel;

      click(menuOf(mounted, 'Zoom in'));
      await settle();
      expect(app.store.state.editor.views.flow!.zoomLevel).toBeCloseTo(
        fitted + ZOOM_STEP,
        5
      );

      click(menuOf(mounted, 'Zoom out'));
      await settle();
      expect(app.store.state.editor.views.flow!.zoomLevel).toBeCloseTo(
        fitted,
        5
      );
      expect(app.store.state.settings).toMatchObject({
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('fits what it shows into the middle of the screen', async () => {
      const mounted = await enterDisplaySet(centerIds);
      const { app } = mounted;

      click(menuOf(mounted, 'Zoom in'));
      await settle();
      click(menuOf(mounted, 'Fit'));
      await settle();

      const view = app.store.state.editor.views.flow!;
      const content = getSceneContentRect(app.store.state, ViewKind.flow)!;
      const centre = toScreenPoint(view, {
        x: content.x + content.width / 2,
        y: content.y + content.height / 2,
      });

      expect(view.zoomLevel).toBe(
        previewZoomLevel(content, VIEWPORT, CANVAS_ZOOM_MAX)
      );
      expect(centre.x).toBeCloseTo(VIEWPORT.width / 2, 3);
      expect(centre.y).toBeCloseTo(VIEWPORT.height / 2, 3);
      expect(app.store.state.settings).toMatchObject({
        originX: 0,
        originY: 0,
        zoomLevel: 1,
      });
    });

    it('places anew on Tidy up, keeping the display set and the rows', async () => {
      const mounted = await enterDisplaySet(centerIds);
      const { app } = mounted;
      const view = app.store.state.editor.views.flow!;
      const before = {
        centerIds: [...view.centerIds],
        showMode: view.showMode,
      };
      const asks = hoisted.requests.length;

      click(menuOf(mounted, 'Tidy Up'));
      await settle();

      expect(hoisted.requests).toHaveLength(asks + 1);
      expect(app.store.state.editor.views.flow).toMatchObject(before);
    });

    it('runs particles on exactly the connectors it lights, at rest and under a hover', async () => {
      const { app } = await enterDisplaySet(centerIds);
      await whenPainted();

      expect(particleIdsOf()).toEqual(restLit);
      expect(particleLayer().find('Circle')).toHaveLength(
        restLit.length * PARTICLE_COUNT
      );

      await hoverTable('t2');
      await whenPainted();

      expect(particleIdsOf()).toEqual(hoverLit);
      expect(particleLayer().find('Circle')).toHaveLength(
        hoverLit.length * PARTICLE_COUNT
      );
    });

    it('offers the compass once the screen holds no card, and brings the cards back', async () => {
      const mounted = await enterDisplaySet(centerIds);
      const { app } = mounted;

      expect(getContentCompass(app.store.state, ViewKind.flow)).toBeNull();
      expect(menuOf(mounted, 'Go to content')).toBeNull();

      app.store.dispatchSync(
        viewScrollToAction({
          originX: -90_000,
          originY: -90_000,
          kind: ViewKind.flow,
        })
      );
      await settle();

      expect(getContentCompass(app.store.state, ViewKind.flow)).not.toBeNull();
      expect(menuOf(mounted, 'Go to content')).not.toBeNull();

      click(menuOf(mounted, 'Go to content'));
      await settle();

      expect(getContentCompass(app.store.state, ViewKind.flow)).toBeNull();
      expect(menuOf(mounted, 'Go to content')).toBeNull();
    });
  }
);
