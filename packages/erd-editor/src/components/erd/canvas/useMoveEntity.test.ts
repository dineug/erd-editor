import { FC, html } from '@dineug/r-html';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
  movePointer,
  releasePointer,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { isEntityDragActive } from '@/components/erd/canvas/entityDrag';
import type { ScenePointerEvent } from '@/components/erd/canvas/sceneTokens';
import { useMoveEntity } from '@/components/erd/canvas/useMoveEntity';
import { SelectType } from '@/engine/modules/editor/state';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { getContentRect } from '@/konva/scene/contentBounds';
import {
  getViewContentRect,
  isViewFrozen,
  thawView,
} from '@/konva/scene/viewFreeze';

type Api = ReturnType<typeof useMoveEntity>;

let api: Api;

const Probe: FC<{}> = (props, ctx) => {
  api = useMoveEntity(ctx, {
    entityId: () => 't1',
    selectType: SelectType.table,
    blockedKinds: ['column'],
  });

  return () => html`<div class="probe"></div>`;
};

/** A scene node an ancestor walk finds nothing blocked on. */
const sceneNode = (kind: string | null = null) => ({
  getAttr: (name: string) => (name === 'kind' ? kind : undefined),
  getParent: () => null,
});

/**
 * A press as the stage hands it on. The same mousedown reaches the window,
 * where the move stream anchors its deltas on it, so the first move below is
 * measured from this point and not from wherever the last spec left the pointer.
 */
const press = (kind: string | null = null): ScenePointerEvent => {
  const evt = new MouseEvent('mousedown', {
    bubbles: true,
    button: 0,
    clientX: 0,
    clientY: 0,
  });
  window.dispatchEvent(evt);

  return { target: sceneNode(kind), evt } as unknown as ScenePointerEvent;
};

let mounted: Mounted | null = null;
let app: AppContext;

beforeEach(async () => {
  app = createTestAppContext();
  app.store.dispatchSync(
    addTableAction({ id: 't1', ui: { x: 300, y: 200, zIndex: 2 } })
  );
  mounted = await mountAndFlush(html`<${Probe} />`, app);
});

afterEach(() => {
  releasePointer();
  mounted?.unmount();
  mounted = null;
  thawView(app.store.state);
});

describe('useMoveEntity', () => {
  it('starts with no drag and no view held', () => {
    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('raises the drag flag and holds the content rect on a press', () => {
    const before = getContentRect(app.store.state);

    api.onMoveStart(press());

    expect(isEntityDragActive(app.store.state)).toBe(true);
    expect(isViewFrozen(app.store.state)).toBe(true);
    expect(getViewContentRect(app.store.state)).toEqual(before);
  });

  /**
   * What the freeze is for: the pointer moves the selection, the live content
   * rect follows it, and everything read through the view stands still until
   * the drop, when the two agree again.
   */
  it('serves the rect the drag began with until the drop', async () => {
    const before = getContentRect(app.store.state)!;

    api.onMoveStart(press());
    movePointer(400, 250);
    await flush();

    const live = getContentRect(app.store.state)!;
    expect(live.x).toBe(before.x + 400);
    expect(live.y).toBe(before.y + 250);
    expect(getViewContentRect(app.store.state)).toEqual(before);

    releasePointer();
    await flush();

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
    expect(getViewContentRect(app.store.state)).toEqual(live);
  });

  /**
   * The press raises the entity's z-index and the scene destroys and rebuilds
   * the node it landed on, so the component is gone before the second move; a
   * drag torn down with it would move nothing at all.
   */
  it('holds the drag and the view past an unmount, and lets both go on the drop', async () => {
    api.onMoveStart(press());
    mounted!.unmount();
    mounted = null;

    expect(isEntityDragActive(app.store.state)).toBe(true);
    expect(isViewFrozen(app.store.state)).toBe(true);

    releasePointer();
    await flush();

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });

  it('neither drags nor holds the view from a blocked kind', () => {
    api.onMoveStart(press('column'));

    expect(isEntityDragActive(app.store.state)).toBe(false);
    expect(isViewFrozen(app.store.state)).toBe(false);
  });
});
