import {
  AnyAction,
  createRef,
  FC,
  html,
  observable,
  ref,
} from '@dineug/r-html';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import {
  createTestAppContext,
  createTestI18n,
  flush,
  mountAndFlush,
  Mounted,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__/index';
import { seedMapTable } from '@/__test-utils__/mapColumnsSeed';
import { AppContext } from '@/components/appContext';
import DrawTargetButtons, {
  PILL_SIZE,
} from '@/components/erd/draw-target/DrawTargetButtons';
import { getDrawTarget } from '@/components/erd/draw-target/drawTargetState';
import { PILL_MARGIN } from '@/components/erd/draw-target/placePill';
import { Open } from '@/constants/open';
import { CanvasType, RelationshipType } from '@/constants/schema';
import {
  changeHandToolAction,
  changeOpenMapAction,
  changeViewportAction,
  drawEndRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
} from '@/engine/modules/editor/atom.actions';
import { ViewKind } from '@/engine/modules/editor/state';
import { viewOpenAction } from '@/engine/modules/editor/view.actions';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { changeCanvasTypeAction } from '@/engine/modules/settings/atom.actions';
import {
  moveToTableAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import { changeColumnPrimaryKeyAction } from '@/engine/modules/table-column/atom.actions';
import { createI18n } from '@/i18n/translate';
import type { Point } from '@/internal-types';
import { getTableRect } from '@/konva/scene/metrics';
import { getSceneTransform, toScreenPoint } from '@/konva/scene/viewport';

type Harness = {
  app: AppContext;
  root: HTMLDivElement;
  props: { readonly: boolean };
  actions: AnyAction[];
};

let mounted: Mounted | null = null;

// The relationship hooks a table wakes run on a timer that would outlast the file.
afterEach(() => {
  const app = mounted?.app;
  mounted?.unmount();
  mounted = null;
  app?.store.destroy();
  vi.restoreAllMocks();
});

/** The canvas root the editor hands the buttons, with them as its one child. */
async function setup(app = createTestAppContext()): Promise<Harness> {
  const props = observable({ readonly: false });

  const Root: FC = () => {
    const root = createRef<HTMLDivElement>();
    return () =>
      html`<div class="canvas-root" ${ref(root)}>
        <${DrawTargetButtons} .root=${root} .readonly=${props.readonly} />
      </div>`;
  };

  const actions: AnyAction[] = [];
  app.store.subscribe(dispatched => actions.push(...dispatched));
  mounted = await mountAndFlush(html`<${Root} />`, app);

  const root = mounted.container.querySelector(
    '.canvas-root'
  ) as HTMLDivElement;
  return { app, root, props, actions };
}

/** A parent with a key and a child beside it, far enough apart that neither strip reaches the other. */
function seed(app: AppContext) {
  const { store } = app;
  store.dispatchSync(changeViewportAction({ width: 1200, height: 800 }));
  seedMapTable(store, 'users', 'users', [
    { id: 'users.id', name: 'id', primaryKey: true },
  ]);
  seedMapTable(store, 'orders', 'orders', [{ id: 'orders.id', name: 'id' }]);
  store.dispatchSync(
    moveToTableAction({ id: 'users', x: 100, y: 100 }),
    moveToTableAction({ id: 'orders', x: 600, y: 100 })
  );
  return app;
}

const screenRectOf = (app: AppContext, id: string) => {
  const { state } = app.store;
  const rect = getTableRect(state, state.collections.tableEntities[id]);
  const transform = getSceneTransform(state);
  const topLeft = toScreenPoint(transform, rect);
  const bottomRight = toScreenPoint(transform, {
    x: rect.x + rect.width,
    y: rect.y + rect.height,
  });
  return { ...topLeft, right: bottomRight.x, bottom: bottomRight.y };
};

const insideOf = (app: AppContext, id: string, dx = 6, dy = 6): Point => {
  const { x, y } = screenRectOf(app, id);
  return { x: x + dx, y: y + dy };
};

const dispatchMouse = (
  target: EventTarget,
  type: string,
  { x, y }: Point = { x: 0, y: 0 },
  init: MouseEventInit = {}
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

/** Arms a draw and presses the table it starts from, as a pointer does. */
async function startDraw(
  { app, root }: Harness,
  tableId = 'users',
  press = insideOf(app, tableId)
) {
  app.store.dispatchSync(
    drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
  );
  dispatchMouse(root, 'mousedown', press);
  app.store.dispatchSync(drawStartAddRelationshipAction({ tableId }));
  await flush();
}

async function hover(harness: Harness, point: Point, target?: Element) {
  dispatchMouse(target ?? harness.root, 'mousemove', point);
  await flush();
}

const buttonsOf = (root: HTMLElement) =>
  root.querySelector('.draw-target-buttons') as HTMLElement | null;
const mapOf = (root: HTMLElement) =>
  root.querySelector('.draw-target-map') as HTMLButtonElement;
const newOf = (root: HTMLElement) =>
  root.querySelector('.draw-target-new') as HTMLButtonElement;
const gutterOf = (root: HTMLElement) =>
  root.querySelector('.draw-target-gutter') as HTMLElement | null;
const outlineOf = (root: HTMLElement) =>
  root.querySelector('.draw-target-outline') as HTMLElement | null;

const pxOf = (value: string) => Number.parseFloat(value);

describe('DrawTargetButtons', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await setup(seed(createTestAppContext()));
  });

  it('shows nothing while no relationship is drawn', async () => {
    await hover(harness, insideOf(harness.app, 'orders'));

    expect(buttonsOf(harness.root)).toBeNull();
    expect(outlineOf(harness.root)).toBeNull();
  });

  it('shows nothing while the draw has no table to start from', async () => {
    harness.app.store.dispatchSync(
      drawStartRelationshipAction({ relationshipType: RelationshipType.ZeroN })
    );
    await hover(harness, insideOf(harness.app, 'orders'));

    expect(buttonsOf(harness.root)).toBeNull();
  });

  it('stands the two buttons left of the table the pointer is over, outlined', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));

    const buttons = buttonsOf(root)!;
    const card = screenRectOf(app, 'orders');
    const pill = PILL_SIZE;

    expect(buttons.dataset.side).toBe('left');
    expect(pxOf(buttons.style.left)).toBe(card.x - PILL_MARGIN - pill.width);
    expect(pxOf(buttons.style.top)).toBe(card.y);
    expect(pxOf(buttons.style.width)).toBe(pill.width);
    expect(pxOf(buttons.style.height)).toBe(pill.height);

    const outline = outlineOf(root)!;
    expect(pxOf(outline.style.left)).toBe(card.x);
    expect(pxOf(outline.style.top)).toBe(card.y);
    expect(pxOf(outline.style.width)).toBe(card.right - card.x);
    expect(pxOf(outline.style.height)).toBe(card.bottom - card.y);
  });

  it('names the buttons by what they do, with the link and plus glyphs', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));

    const map = mapOf(root);
    const add = newOf(root);
    expect(map.title).toBe('Map to existing columns');
    expect(map.getAttribute('aria-label')).toBe('Map to existing columns');
    expect(add.title).toBe('Create new columns');
    expect(add.getAttribute('aria-disabled')).toBe('false');
    expect(iconNameOf(map)).toBe('link');
    expect(iconNameOf(add)).toBe('plus');
    expect([map.type, add.type]).toEqual(['button', 'button']);
    expect([map.tabIndex, add.tabIndex]).toEqual([-1, -1]);
  });

  it('lays a strip from past the buttons to the table', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));

    const gutter = gutterOf(root)!;
    const buttons = buttonsOf(root)!;
    expect(gutter.classList.contains('draw-target')).toBe(true);
    expect(pxOf(gutter.style.left)).toBe(pxOf(buttons.style.left) - 4);
    expect(pxOf(gutter.style.left) + pxOf(gutter.style.width)).toBe(
      screenRectOf(app, 'orders').x
    );
  });

  it('takes the buttons away once the pointer leaves the table, or the canvas', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));
    await hover(harness, { x: 1100, y: 700 });

    expect(buttonsOf(root)).toBeNull();

    await hover(harness, insideOf(app, 'orders'));
    root.dispatchEvent(new MouseEvent('mouseleave'));
    await flush();

    expect(buttonsOf(root)).toBeNull();
    expect(getDrawTarget(app.store.state).pointer).toBeNull();
  });

  it('takes them away for a pointer over the chrome laid over the canvas', async () => {
    const { app, root } = harness;
    const minimap = document.createElement('div');
    minimap.className = 'minimap';
    root.append(minimap);
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));
    await hover(harness, insideOf(app, 'orders'), minimap);

    expect(buttonsOf(root)).toBeNull();
  });

  it('keeps the table while the pointer is over the buttons or the strip', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));
    const buttons = buttonsOf(root)!;
    const gutter = gutterOf(root)!;

    await hover(
      harness,
      { x: pxOf(buttons.style.left) + 2, y: pxOf(buttons.style.top) + 2 },
      buttons
    );
    expect(buttonsOf(root)).toBeTruthy();

    await hover(
      harness,
      {
        x: pxOf(gutter.style.left) + pxOf(gutter.style.width) - 1,
        y: pxOf(gutter.style.top) + 1,
      },
      gutter
    );
    expect(getDrawTarget(app.store.state).targetId).toBe('orders');
  });

  it('offers no buttons over a memo drawn over the table', async () => {
    const { app, root } = harness;
    app.store.dispatchSync(
      addMemoAction({
        id: 'memo',
        ui: { x: 600, y: 100, width: 40, height: 40, zIndex: 9 },
      })
    );
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));

    expect(buttonsOf(root)).toBeNull();
  });

  describe('on the table the draw starts from', () => {
    it('offers nothing until the pointer travels 24 px from the press, then keeps offering', async () => {
      const { app, root } = harness;
      const press = insideOf(app, 'users', 10, 10);
      await startDraw(harness, 'users', press);

      await hover(harness, { x: press.x + 23, y: press.y });
      expect(buttonsOf(root)).toBeNull();

      await hover(harness, { x: press.x + 24, y: press.y });
      expect(buttonsOf(root)).toBeTruthy();

      await hover(harness, press);
      expect(buttonsOf(root)).toBeTruthy();
    });

    it('arms again from the next press once the notation is picked anew', async () => {
      const { app, root } = harness;
      const press = insideOf(app, 'users', 10, 10);
      await startDraw(harness, 'users', press);
      await hover(harness, { x: press.x + 30, y: press.y });
      expect(getDrawTarget(app.store.state).selfArmed).toBe(true);

      await startDraw(harness, 'users', press);
      await hover(harness, { x: press.x + 5, y: press.y });

      expect(getDrawTarget(app.store.state).selfArmed).toBe(false);
      expect(buttonsOf(root)).toBeNull();
    });

    it('measures from the first pointer when no press came before the draw', async () => {
      const { app } = harness;
      app.store.dispatchSync(
        drawStartRelationshipAction({
          relationshipType: RelationshipType.ZeroN,
        }),
        drawStartAddRelationshipAction({ tableId: 'users' })
      );
      await flush();
      const point = insideOf(app, 'users', 10, 10);
      await hover(harness, point);

      expect(getDrawTarget(app.store.state).pressPoint).toEqual(point);
    });
  });

  describe('hides', () => {
    beforeEach(async () => {
      await startDraw(harness);
      await hover(harness, insideOf(harness.app, 'orders'));
      expect(buttonsOf(harness.root)).toBeTruthy();
    });

    it('in a read-only editor', async () => {
      harness.props.readonly = true;
      await flush();

      expect(buttonsOf(harness.root)).toBeNull();
    });

    it.each([
      ['Table Properties', Open.tableProperties],
      ['Map Columns', Open.mapColumns],
      ['the time travel', Open.timeTravel],
    ])('while %s is open', async (_, key) => {
      harness.app.store.dispatchSync(changeOpenMapAction({ [key]: true }));
      await flush();

      expect(buttonsOf(harness.root)).toBeNull();
    });

    it('while a Flow view is up', async () => {
      harness.app.store.dispatchSync(
        viewOpenAction({ kind: ViewKind.flow, centerIds: ['orders'] }),
        changeCanvasTypeAction({ value: CanvasType.visualization })
      );
      await flush();

      expect(buttonsOf(harness.root)).toBeNull();
    });

    it('once the hand tool is taken up, which ends the draw and forgets it', async () => {
      harness.app.store.dispatchSync(changeHandToolAction({ value: true }));
      await flush();

      expect(buttonsOf(harness.root)).toBeNull();
      expect(getDrawTarget(harness.app.store.state)).toMatchObject({
        pointer: null,
        targetId: null,
      });
    });

    it('on another tab, dropping the pointer and keeping the draw', async () => {
      const { app, root } = harness;
      app.store.dispatchSync(
        changeCanvasTypeAction({ value: CanvasType.schemaSQL })
      );
      await flush();

      expect(buttonsOf(root)).toBeNull();
      expect(getDrawTarget(app.store.state).pointer).toBeNull();
      expect(app.store.state.editor.drawRelationship?.start).toBeTruthy();
    });

    it('once a peer removes the table, and once it moves from under the pointer', async () => {
      const { app, root } = harness;
      app.store.dispatchSync(
        moveToTableAction({ id: 'orders', x: 600, y: 600 })
      );
      await flush();

      expect(buttonsOf(root)).toBeNull();

      app.store.dispatchSync(
        moveToTableAction({ id: 'orders', x: 600, y: 100 })
      );
      await flush();
      expect(buttonsOf(root)).toBeTruthy();

      app.store.dispatchSync(removeTableAction({ id: 'orders' }));
      await flush();
      expect(buttonsOf(root)).toBeNull();
    });
  });

  it('moves to a table a peer moves in under the pointer', async () => {
    const { app } = harness;
    seedMapTable(app.store, 'items', 'items');
    app.store.dispatchSync(moveToTableAction({ id: 'items', x: 600, y: 600 }));
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));

    app.store.dispatchSync(
      moveToTableAction({ id: 'orders', x: 900, y: 600 }),
      moveToTableAction({ id: 'items', x: 600, y: 100 })
    );
    await flush();

    expect(getDrawTarget(app.store.state).targetId).toBe('items');
  });

  describe('presses', () => {
    beforeEach(async () => {
      await startDraw(harness);
      await hover(harness, insideOf(harness.app, 'orders'));
    });

    it('keeps the keyboard where it is on a press on the buttons, which reaches the root', () => {
      const heard = vi.fn();
      harness.root.addEventListener('mousedown', heard);
      const press = dispatchMouse(buttonsOf(harness.root)!, 'mousedown');

      expect(press.defaultPrevented).toBe(true);
      expect(heard).toHaveBeenCalled();
    });

    it('spends a main press on the strip, and lets any other through', () => {
      const heard = vi.fn();
      harness.root.addEventListener('mousedown', heard);
      const gutter = gutterOf(harness.root)!;

      const main = dispatchMouse(gutter, 'mousedown');
      expect(main.defaultPrevented).toBe(true);
      expect(heard).not.toHaveBeenCalled();

      const right = dispatchMouse(gutter, 'mousedown', undefined, {
        button: 2,
      });
      expect(right.defaultPrevented).toBe(false);
      expect(heard).toHaveBeenCalledTimes(1);
    });

    it('opens no canvas menu over the buttons or the strip', () => {
      const heard = vi.fn();
      harness.root.addEventListener('contextmenu', heard);

      for (const target of [
        buttonsOf(harness.root)!,
        gutterOf(harness.root)!,
      ]) {
        const event = dispatchMouse(target, 'contextmenu');
        expect(event.defaultPrevented).toBe(true);
      }
      expect(heard).not.toHaveBeenCalled();
    });

    it('lets a pointer move over the buttons reach the root, where the preview follows it', () => {
      const heard = vi.fn();
      harness.root.addEventListener('mousemove', heard);
      dispatchMouse(buttonsOf(harness.root)!, 'mousemove');

      expect(heard).toHaveBeenCalled();
    });

    it('draws new columns from the plus button, as a press on the table does', async () => {
      const { app, root } = harness;
      newOf(root).click();
      await flush();

      const { relationshipIds, tableIds } = app.store.state.doc;
      const [relationship] = relationshipIds.map(
        id => app.store.state.collections.relationshipEntities[id]
      );
      expect(relationship).toMatchObject({
        relationshipType: RelationshipType.ZeroN,
        start: { tableId: 'users', columnIds: ['users.id'] },
        end: { tableId: 'orders' },
      });
      expect(
        app.store.state.collections.tableEntities.orders.columnIds
      ).toHaveLength(2);
      expect(tableIds).toEqual(['users', 'orders']);
      expect(app.store.state.editor.drawRelationship).toBeNull();
      expect(buttonsOf(root)).toBeNull();
      expect(getDrawTarget(app.store.state).targetId).toBeNull();
    });

    it('opens Map Columns from the link button, ending the draw and writing nothing', async () => {
      const { app, root, actions } = harness;
      const openMapColumns = vi.fn();
      app.emitter.on({ openMapColumns });
      actions.length = 0;

      mapOf(root).click();
      await flush();

      expect(openMapColumns).toHaveBeenCalledWith({
        type: 'openMapColumns',
        payload: {
          mode: 'create',
          startTableId: 'users',
          endTableId: 'orders',
          relationshipType: RelationshipType.ZeroN,
        },
      });
      expect(app.store.state.editor.drawRelationship).toBeNull();
      expect(app.store.state.editor.openMap[Open.mapColumns]).toBe(true);
      expect(actions.map(({ type }) => type)).toEqual([
        'editor.drawEndRelationship',
        'editor.changeOpenMap',
      ]);
    });

    it('ends the draw alone from the link button once either table is gone', async () => {
      const { app, root } = harness;
      const openMapColumns = vi.fn();
      app.emitter.on({ openMapColumns });
      const map = mapOf(root);

      app.store.dispatchSync(removeTableAction({ id: 'orders' }));
      map.click();
      await flush();

      expect(openMapColumns).not.toHaveBeenCalled();
      expect(app.store.state.editor.drawRelationship).toBeNull();
      expect(app.store.state.editor.openMap[Open.mapColumns]).toBeFalsy();
    });

    it('takes no press but the main button', async () => {
      const { app, root } = harness;
      for (const button of [mapOf(root), newOf(root)]) {
        dispatchMouse(button, 'click', undefined, { button: 1 });
      }
      await flush();

      expect(app.store.state.editor.drawRelationship?.start).toBeTruthy();
    });

    it('does nothing for a link press once the draw is gone', async () => {
      const { app, root } = harness;
      const openMapColumns = vi.fn();
      app.emitter.on({ openMapColumns });
      const map = mapOf(root);

      app.store.dispatchSync(drawEndRelationshipAction());
      map.click();
      await flush();

      expect(openMapColumns).not.toHaveBeenCalled();
    });
  });

  describe('with no key on the start table', () => {
    beforeEach(async () => {
      harness.app.store.dispatchSync(
        changeColumnPrimaryKeyAction({
          tableId: 'users',
          id: 'users.id',
          value: false,
        })
      );
      await startDraw(harness);
      await hover(harness, insideOf(harness.app, 'orders'));
    });

    it('dims the plus button and says why', () => {
      const add = newOf(harness.root);

      expect(add.getAttribute('aria-disabled')).toBe('true');
      expect(add.title).toBe('users has no primary key to copy');
    });

    it('ignores a press on it', async () => {
      newOf(harness.root).click();
      await flush();

      expect(harness.app.store.state.doc.relationshipIds).toEqual([]);
      expect(
        harness.app.store.state.editor.drawRelationship?.start
      ).toBeTruthy();
    });
  });

  describe('under touch', () => {
    /**
     * A finger's press as a browser sends it, the pointer event and then the
     * touch, which some pens send as well.
     */
    const pressWith = (pointerType: string, target: EventTarget) => {
      target.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, pointerType })
      );
      target.dispatchEvent(
        new TouchEvent('touchstart', { bubbles: true, cancelable: true })
      );
    };

    const touchDown = (target: EventTarget) => pressWith('touch', target);

    /** A move a mouse, a pen or a finger makes: its pointer event, then the mouse event. */
    const hoverWith = async (pointerType: string, point: Point) => {
      harness.root.dispatchEvent(
        new PointerEvent('pointermove', { bubbles: true, pointerType })
      );
      await hover(harness, point);
    };

    beforeEach(async () => {
      await startDraw(harness);
    });

    it('reads no pointer from the mouse events a browser makes up after a tap', async () => {
      const { app, root } = harness;
      touchDown(root);
      await hover(harness, insideOf(app, 'orders'));

      expect(getDrawTarget(app.store.state).pointer).toBeNull();
      expect(buttonsOf(root)).toBeNull();
      expect(outlineOf(root)).toBeNull();
    });

    it('reads none from a finger moving over the canvas either', async () => {
      const { app, root } = harness;
      await hoverWith('touch', insideOf(app, 'orders'));

      expect(getDrawTarget(app.store.state).pointer).toBeNull();
      expect(buttonsOf(root)).toBeNull();
    });

    it('lets go of the pointer a mouse left once a finger touches the canvas', async () => {
      const { app, root } = harness;
      await hover(harness, insideOf(app, 'orders'));
      expect(buttonsOf(root)).toBeTruthy();

      touchDown(root);
      await flush();

      expect(getDrawTarget(app.store.state).pointer).toBeNull();
      expect(buttonsOf(root)).toBeNull();
      expect(gutterOf(root)).toBeNull();
      expect(outlineOf(root)).toBeNull();
    });

    it('shows nothing on a table a pan brings under the point a tap left', async () => {
      const { app, root } = harness;
      const empty = { x: 1000, y: 600 };
      touchDown(root);
      await hover(harness, empty);

      const card = screenRectOf(app, 'orders');
      app.store.dispatchSync(
        moveToTableAction({
          id: 'orders',
          x: 600 + empty.x - card.x - 6,
          y: 100 + empty.y - card.y - 6,
        })
      );
      await flush();

      expect(insideOf(app, 'orders')).toEqual(empty);
      expect(getDrawTarget(app.store.state).targetId).toBeNull();
      expect(buttonsOf(root)).toBeNull();
      expect(gutterOf(root)).toBeNull();
      expect(outlineOf(root)).toBeNull();
    });

    it('reads the pointer again once a mouse or a pen moves', async () => {
      const { app, root } = harness;
      touchDown(root);
      await hoverWith('mouse', insideOf(app, 'orders'));
      expect(buttonsOf(root)).toBeTruthy();

      touchDown(root);
      await flush();
      expect(buttonsOf(root)).toBeNull();

      await hoverWith('pen', insideOf(app, 'orders'));
      expect(buttonsOf(root)).toBeTruthy();
    });

    it('keeps the buttons under a pen that sends touch events as it presses them', async () => {
      const { app, root } = harness;
      const openMapColumns = vi.fn();
      app.emitter.on({ openMapColumns });
      await hoverWith('pen', insideOf(app, 'orders'));
      const pointer = getDrawTarget(app.store.state).pointer;

      pressWith('pen', mapOf(root));
      await flush();

      expect(getDrawTarget(app.store.state).pointer).toEqual(pointer);
      expect(buttonsOf(root)).toBeTruthy();

      mapOf(root).click();
      await flush();

      expect(openMapColumns).toHaveBeenCalledOnce();
      expect(app.store.state.editor.drawRelationship).toBeNull();
    });
  });

  it('stands no buttons beside a table past the edge of a canvas that shrank under the pointer', async () => {
    const { app, root } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));
    expect(buttonsOf(root)).toBeTruthy();

    app.store.dispatchSync(changeViewportAction({ width: 500, height: 800 }));
    await flush();

    expect(getDrawTarget(app.store.state).targetId).toBe('orders');
    expect(buttonsOf(root)).toBeNull();
    expect(outlineOf(root)).toBeNull();
  });

  it('forgets the draw it followed when it unmounts', async () => {
    const { app } = harness;
    await startDraw(harness);
    await hover(harness, insideOf(app, 'orders'));
    expect(getDrawTarget(app.store.state).targetId).toBe('orders');

    mounted?.unmount();
    mounted = null;

    expect(getDrawTarget(app.store.state).targetId).toBeNull();
    app.store.destroy();
  });
});

describe('PILL_SIZE', () => {
  it('fits two buttons, the gap between them and their padding', () => {
    expect(PILL_SIZE).toEqual({ width: 36, height: 64 });
  });
});

describe('DrawTargetButtons / language', () => {
  let teardown: (() => void) | null = null;

  afterEach(() => {
    teardown?.();
    teardown = null;
  });

  /** The language the element would provide, English until a spec switches it. */
  function provideLanguage() {
    const i18n = createTestI18n('en');
    const provider = provideI18n(document.body, i18n);
    teardown = () => provider.destroy();

    return async () => {
      Object.assign(i18n, createI18n('ko-KR', pseudoMessages('ko')));
      await flush();
    };
  }

  it('names the buttons in the language the element shows, following a switch', async () => {
    const switchLanguage = provideLanguage();
    const harness = await setup(seed(createTestAppContext()));
    await startDraw(harness);
    await hover(harness, insideOf(harness.app, 'orders'));
    expect(mapOf(harness.root).title).toBe('Map to existing columns');

    await switchLanguage();

    const map = mapOf(harness.root);
    const add = newOf(harness.root);
    expect(map.title).toBe('ko:Map to existing columns');
    expect(map.getAttribute('aria-label')).toBe('ko:Map to existing columns');
    expect(add.title).toBe('ko:Create new columns');
    expect(add.getAttribute('aria-label')).toBe('ko:Create new columns');
  });

  it('says in that language that a start table with no name has no key to copy', async () => {
    const switchLanguage = provideLanguage();
    const app = seed(createTestAppContext());
    seedMapTable(app.store, 'blank', '', [{ id: 'blank.a', name: 'a' }]);
    app.store.dispatchSync(moveToTableAction({ id: 'blank', x: 100, y: 500 }));
    const harness = await setup(app);
    await switchLanguage();
    await startDraw(harness, 'blank');
    await hover(harness, insideOf(app, 'orders'));

    expect(newOf(harness.root).title).toBe(
      'ko:ko:unnamed has no primary key to copy'
    );
  });
});
