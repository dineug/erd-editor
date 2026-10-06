// The buttons beside the table a relationship is drawn to, over a real canvas
// and a real layout: what lies under a point is the browser's answer, and a
// press on the canvas is konva's, so the strip and the outline are held to both.

import { addCSSHost, AnyAction, render, useProvider } from '@dineug/r-html';
import { afterEach, beforeAll, describe, expect, it } from 'vite-plus/test';
import { page } from 'vite-plus/test/browser/context';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  provideI18n,
} from '@/__test-utils__';
import { seedMapTable } from '@/__test-utils__/mapColumnsSeed';
import { type AppContext, appContext } from '@/components/appContext';
import { getDrawTarget } from '@/components/erd/draw-target/drawTargetState';
import Erd from '@/components/erd/Erd';
import GlobalStyles from '@/components/global-styles/GlobalStyles';
import { themeContext } from '@/components/themeContext';
import { Open } from '@/constants/open';
import { RelationshipType } from '@/constants/schema';
import {
  changeViewportAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
import {
  moveToTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/table-column/atom.actions';
import { attachActionsTag, Tag } from '@/engine/tag';
import type { LocaleCode } from '@/i18n/locales';
import { messagesOf } from '@/i18n/messages/index';
import type { Point } from '@/internal-types';
import { whenDrawn } from '@/konva/batchDraw';
import { getTableRect } from '@/konva/scene/metrics';
import { getSceneTransform, toScreenPoint } from '@/konva/scene/viewport';

const VIEWPORT = { width: 900, height: 600 };

type Fixture = {
  app: AppContext;
  shadow: ShadowRoot;
  root: HTMLDivElement;
  actions: AnyAction[];
};

const teardowns: Array<() => void> = [];

// The page is narrower than the editor by default, and a point past its edge
// has no element for the browser to find under it.
beforeAll(async () => {
  await page.viewport(VIEWPORT.width + 100, VIEWPORT.height + 100);
});

afterEach(async () => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** Konva draws on an animation frame, and its hit canvas with it. */
const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function settle(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

/**
 * A parent with a key and a child to its right, with room on the child's left,
 * mounted in a shadow root that adopts the editor's stylesheets, as the element
 * does, so the buttons are laid out by their own rules.
 */
async function setup(locale: LocaleCode = 'en'): Promise<Fixture> {
  const app = createTestAppContext();
  const i18n = createTestI18n(locale);
  const host = document.createElement('div');
  host.setAttribute('style', 'position: fixed; top: 0; left: 0;');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  addCSSHost(shadow);

  const globals = document.createElement('div');
  const container = document.createElement('div');
  container.setAttribute(
    'style',
    `width: ${VIEWPORT.width}px; height: ${VIEWPORT.height}px; position: relative;`
  );
  shadow.append(globals, container);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the cast; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(container as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    container as any,
    themeContext,
    createTestTheme()
  );
  const i18nProvider = provideI18n(container, i18n);
  container.dir = i18n.dir;
  render(globals, <GlobalStyles />);
  render(
    container,
    <Erd isDarkMode={false} mouseTracking={false} readonly={false} />
  );

  const { store } = app;
  store.dispatchSync(changeViewportAction(VIEWPORT));
  seedMapTable(store, 'users', 'users', [
    { id: 'u_id', name: 'id', dataType: 'int', primaryKey: true },
  ]);
  seedMapTable(store, 'orders', 'orders', [
    { id: 'o_id', name: 'id', dataType: 'int', primaryKey: true },
    { id: 'o_user', name: 'user_id', dataType: 'int' },
    { id: 'o_note', name: 'note', dataType: 'text' },
    { id: 'o_total', name: 'total', dataType: 'int' },
  ]);
  store.dispatchSync(
    moveToTableAction({ id: 'users', x: 60, y: 300 }),
    moveToTableAction({ id: 'orders', x: 500, y: 100 })
  );

  const actions: AnyAction[] = [];
  store.subscribe(dispatched => actions.push(...dispatched));

  teardowns.push(() => {
    render(container, null);
    render(globals, null);
    appProvider.destroy();
    themeProvider.destroy();
    i18nProvider.destroy();
    host.remove();
    store.destroy();
  });

  await settle();

  const root = container.firstElementChild as HTMLDivElement;
  return { app, shadow, root, actions };
}

/** Where a table's box lands on screen, from the top left of the canvas root. */
const cardOf = (app: AppContext, id: string) => {
  const { state } = app.store;
  const rect = getTableRect(state, state.collections.tableEntities[id]);
  const transform = getSceneTransform(state);
  const topLeft = toScreenPoint(transform, rect);
  const bottomRight = toScreenPoint(transform, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });
  return {
    x: topLeft.x,
    y: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
  };
};

const toClient = ({ root }: Fixture, { x, y }: Point) => {
  const box = root.getBoundingClientRect();
  return { clientX: box.x + x, clientY: box.y + y };
};

/** The element the browser finds under a point, which is what a real pointer would reach. */
const elementAt = (fixture: Fixture, point: Point) => {
  const { clientX, clientY } = toClient(fixture, point);
  const found = fixture.shadow.elementFromPoint(clientX, clientY);
  if (!found) throw new Error(`no element at ${clientX}, ${clientY}`);
  return found;
};

const mouse = (
  fixture: Fixture,
  type: string,
  point: Point,
  init: MouseEventInit = {}
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...toClient(fixture, point),
    ...init,
  });
  elementAt(fixture, point).dispatchEvent(event);
  return event;
};

async function moveTo(fixture: Fixture, point: Point) {
  mouse(fixture, 'mousemove', point);
  await flush();
}

/** A full main click at a point: the press, the lift and the click, where a pointer would land. */
async function clickAt(fixture: Fixture, point: Point) {
  mouse(fixture, 'mousedown', point);
  mouse(fixture, 'mouseup', point);
  mouse(fixture, 'click', point);
  await settle();
}

/** Arms a notation and presses the parent on the canvas, as a pointer starts a draw. */
async function startDraw(fixture: Fixture) {
  fixture.app.store.dispatchSync(
    drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
  );
  const users = cardOf(fixture.app, 'users');
  await clickAt(fixture, { x: users.x + 20, y: users.y + 10 });
  expect(fixture.app.store.state.editor.drawRelationship?.start?.tableId).toBe(
    'users'
  );
}

const buttonsOf = ({ root }: Fixture) =>
  root.querySelector('.draw-target-buttons') as HTMLElement | null;

const centerOf = (fixture: Fixture, selector: string): Point => {
  const box = fixture.root.querySelector(selector)!.getBoundingClientRect();
  const rootBox = fixture.root.getBoundingClientRect();
  return {
    x: box.x - rootBox.x + box.width / 2,
    y: box.y - rootBox.y + box.height / 2,
  };
};

const overOrders = (app: AppContext): Point => {
  const card = cardOf(app, 'orders');
  return { x: card.x + 20, y: card.y + 10 };
};

describe('DrawTargetButtons in a browser', () => {
  it('keep their screen size whatever the zoom', async () => {
    const fixture = await setup();
    await startDraw(fixture);

    const sizes = [];
    for (const value of [0.5, 1.5]) {
      fixture.app.store.dispatchSync(changeZoomLevelAction({ value }));
      await settle();
      await moveTo(fixture, overOrders(fixture.app));

      const box = buttonsOf(fixture)!.getBoundingClientRect();
      sizes.push([box.width, box.height]);
    }

    expect(sizes).toEqual([
      [36, 64],
      [36, 64],
    ]);
  });

  it('stand left of the table under the pointer, which they outline', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));

    const card = cardOf(fixture.app, 'orders');
    const buttons = buttonsOf(fixture)!.getBoundingClientRect();
    const outline = fixture.root
      .querySelector('.draw-target-outline')!
      .getBoundingClientRect();
    const rootBox = fixture.root.getBoundingClientRect();

    expect(buttons.right - rootBox.x).toBe(card.x - 8);
    expect(outline.x - rootBox.x).toBe(card.x);
    expect(outline.width).toBeCloseTo(card.right - card.x, 5);
  });

  it('pan nothing and keep the selection on a press', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));
    const { originX, originY } = fixture.app.store.state.settings;
    const press = centerOf(fixture, '.draw-target-map');

    mouse(fixture, 'mousedown', press);
    mouse(fixture, 'mousemove', { x: press.x + 80, y: press.y + 60 });
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await flush();

    expect(fixture.app.store.state.settings).toMatchObject({
      originX,
      originY,
    });
    expect(Object.keys(fixture.app.store.state.editor.selectedMap)).toEqual([
      'users',
    ]);
  });

  it('open no canvas menu on a right click', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));

    mouse(fixture, 'contextmenu', centerOf(fixture, '.draw-target-new'), {
      button: 2,
    });
    await flush();

    expect(fixture.root.querySelector('.context-menu-content')).toBeNull();
  });

  it('let a pointer move over them reach the canvas root', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));
    const heard: EventTarget[] = [];
    fixture.root.addEventListener('mousemove', event =>
      heard.push(event.target!)
    );

    mouse(fixture, 'mousemove', centerOf(fixture, '.draw-target-map'));

    expect(heard).toHaveLength(1);
    expect((heard[0] as Element).closest('.draw-target-buttons')).toBeTruthy();
  });

  /**
   * A neighbour stands under the strip left of the outlined table, as tables a
   * low zoom packs together do. A press there would draw to the neighbour, so
   * the strip takes it; past the strip the neighbour is what a press draws to.
   */
  it('draw nothing for a press on the strip over a neighbour, and draw to the neighbour past it', async () => {
    const fixture = await setup();
    const { store } = fixture.app;
    seedMapTable(store, 'items', 'items', [
      { id: 'i_id', name: 'id' },
      { id: 'i_sku', name: 'sku' },
      { id: 'i_name', name: 'name' },
      { id: 'i_price', name: 'price' },
    ]);
    const { x, right } = cardOf(fixture.app, 'items');
    store.dispatchSync(
      moveToTableAction({ id: 'items', x: 500 - 2 - (right - x), y: 100 })
    );
    await settle();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));

    const orders = cardOf(fixture.app, 'orders');
    const items = cardOf(fixture.app, 'items');
    const buttons = buttonsOf(fixture)!.getBoundingClientRect();
    const rootBox = fixture.root.getBoundingClientRect();
    // Between the buttons and the table, over the neighbour's right edge.
    const inStrip = {
      x: (buttons.right - rootBox.x + items.right) / 2,
      y: buttons.bottom - rootBox.y + 10,
    };
    expect(inStrip.x).toBeLessThan(items.right);
    expect(inStrip.y).toBeLessThan(Math.min(orders.bottom, items.bottom));
    expect(
      elementAt(fixture, inStrip).closest('.draw-target-gutter')
    ).toBeTruthy();

    await moveTo(fixture, inStrip);
    expect(getDrawTarget(store.state).targetId).toBe('orders');

    await clickAt(fixture, inStrip);
    expect(store.state.doc.relationshipIds).toEqual([]);
    expect(store.state.editor.drawRelationship?.start).toBeTruthy();

    const pastStrip = { x: items.x + 10, y: items.y + 10 };
    await moveTo(fixture, pastStrip);
    expect(getDrawTarget(store.state).targetId).toBe('items');

    await clickAt(fixture, pastStrip);
    const [relationship] = store.state.doc.relationshipIds.map(
      id => store.state.collections.relationshipEntities[id]
    );
    expect(relationship.end.tableId).toBe('items');
  });

  it('draw from the plus button what a press on the table draws', async () => {
    const pressed = await setup();
    await startDraw(pressed);
    pressed.actions.length = 0;
    await clickAt(pressed, overOrders(pressed.app));
    const fromPress = pressed.actions.map(({ type }) => type);
    teardowns.splice(0).forEach(teardown => teardown());

    const viaButton = await setup();
    await startDraw(viaButton);
    await moveTo(viaButton, overOrders(viaButton.app));
    viaButton.actions.length = 0;
    await clickAt(viaButton, centerOf(viaButton, '.draw-target-new'));
    const fromButton = viaButton.actions.map(({ type }) => type);

    expect(fromButton).toEqual(fromPress);
    expect(fromButton).toContain('relationship.add');
    expect(viaButton.app.store.state.editor.drawRelationship).toBeNull();
    expect(buttonsOf(viaButton)).toBeNull();
  });

  it('end the draw and open Map Columns from the link button, writing nothing', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));
    fixture.actions.length = 0;

    await clickAt(fixture, centerOf(fixture, '.draw-target-map'));

    const { editor, doc } = fixture.app.store.state;
    expect(editor.drawRelationship).toBeNull();
    expect(editor.openMap[Open.mapColumns]).toBe(true);
    expect(doc.relationshipIds).toEqual([]);
    expect(fixture.actions.map(({ type }) => type)).toEqual([
      'editor.drawEndRelationship',
      'editor.changeOpenMap',
    ]);
  });

  it('stand left of the table in a right-to-left editor too, named in its language', async () => {
    const fixture = await setup('ar-SA');
    const ar = messagesOf('ar-SA');
    await startDraw(fixture);
    await moveTo(fixture, overOrders(fixture.app));

    expect(getComputedStyle(fixture.root).direction).toBe('rtl');
    const card = cardOf(fixture.app, 'orders');
    const rootBox = fixture.root.getBoundingClientRect();
    expect(buttonsOf(fixture)!.getBoundingClientRect().right - rootBox.x).toBe(
      card.x - 8
    );

    const map = fixture.root.querySelector('.draw-target-map')!;
    const add = fixture.root.querySelector('.draw-target-new')!;
    expect(map.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      add.getBoundingClientRect().top
    );
    expect(map.getAttribute('title')).toBe(ar['mapColumns.mapToExisting']);
    expect(add.getAttribute('aria-label')).toBe(ar['mapColumns.createNew']);
  });

  it('dim the plus button once the start table has no key, and ignore it', async () => {
    const fixture = await setup();
    await startDraw(fixture);
    fixture.app.store.dispatchSync(
      attachActionsTag(Tag.shared, [
        changeColumnPrimaryKeyAction({
          tableId: 'users',
          id: 'u_id',
          value: false,
        }),
      ])
    );
    await moveTo(fixture, overOrders(fixture.app));

    const add = fixture.root.querySelector('.draw-target-new')!;
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(add.getAttribute('title')).toBe('users has no primary key to copy');

    await clickAt(fixture, centerOf(fixture, '.draw-target-new'));
    expect(fixture.app.store.state.doc.relationshipIds).toEqual([]);
  });

  describe('as a peer changes the document', () => {
    it('go once the peer removes the table', async () => {
      const fixture = await setup();
      await startDraw(fixture);
      await moveTo(fixture, overOrders(fixture.app));
      expect(buttonsOf(fixture)).toBeTruthy();

      fixture.app.store.dispatchSync(
        attachActionsTag(Tag.shared, [removeTableAction({ id: 'orders' })])
      );
      await settle();

      expect(buttonsOf(fixture)).toBeNull();
      expect(fixture.root.querySelector('.draw-target-outline')).toBeNull();
    });

    it('go once the peer moves the table from under the pointer, and follow one moved in', async () => {
      const fixture = await setup();
      const { store } = fixture.app;
      seedMapTable(store, 'items', 'items', [{ id: 'i_id', name: 'id' }]);
      store.dispatchSync(moveToTableAction({ id: 'items', x: 60, y: 500 }));
      await startDraw(fixture);
      await moveTo(fixture, overOrders(fixture.app));

      store.dispatchSync(
        attachActionsTag(Tag.shared, [
          moveToTableAction({ id: 'orders', x: 500, y: 450 }),
        ])
      );
      await settle();
      expect(buttonsOf(fixture)).toBeNull();

      store.dispatchSync(
        attachActionsTag(Tag.shared, [
          moveToTableAction({ id: 'items', x: 490, y: 90 }),
        ])
      );
      await settle();
      expect(getDrawTarget(store.state).targetId).toBe('items');
      expect(buttonsOf(fixture)).toBeTruthy();
    });
  });
});
