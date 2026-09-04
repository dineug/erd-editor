/** @jsxHost konva */

import type { Group } from 'konva/lib/Group';
import type { Rect as KonvaRect } from 'konva/lib/shapes/Rect';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import {
  SHARED_DRAG_SELECT_TRACKER_TIMEOUT,
  sharedDragSelectTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { Tag } from '@/engine/tag';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';
import type { Rect } from '@/utils/dragSelect';
import { SharedColors, toSharedColor } from '@/utils/sharedColor';

let stage: Stage | null = null;
let destroy: (() => void) | null = null;
const apps = new Set<AppContext>();

afterEach(async () => {
  destroy?.();
  destroy = null;
  stage = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedDragSelectTrackerMap
    )) {
      clearTimeout(tracker.timeoutId);
    }
  }
  apps.clear();
  vi.useRealTimers();
  await whenDrawn();
});

const createApp = () => {
  const app = createTestAppContext();
  apps.add(app);
  return app;
};

async function mountShared(app: AppContext) {
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    width: 400,
    height: 300,
    scene: (
      <k-layer name="presence">
        <SharedDragSelect />
      </k-layer>
    ),
  });

  stage = rendered.stage;
  destroy = () => {
    rendered.destroy();
    container.remove();
  };

  await flush();
  await whenDrawn();
}

const track = (app: AppContext, editorId: string, rect: Rect | null) =>
  app.store.dispatchSync({
    ...sharedDragSelectTrackerAction({ rect }),
    tags: Tag.shared,
    meta: { editorId },
  });

const boxes = () => stage?.find<Group>('.shared-drag-select') ?? [];

const rectsOf = (box: Group) => box.getChildren() as KonvaRect[];

describe('SharedDragSelect', () => {
  it('renders nothing while no remote editor is drag selecting', async () => {
    const app = createApp();
    await mountShared(app);

    expect(boxes()).toHaveLength(0);
  });

  it('positions the box at the absolute rect the remote editor is dragging', async () => {
    const app = createApp();
    await mountShared(app);

    track(app, 'remote-1', { x: 120, y: 240, w: 60, h: 30 });
    await flush();
    await whenDrawn();

    const [box] = boxes();
    const [background, border] = rectsOf(box);
    expect(box).toBeTruthy();
    expect([box.x(), box.y()]).toEqual([120, 240]);
    expect([background.width(), background.height()]).toEqual([60, 30]);
    expect([border.width(), border.height()]).toEqual([60, 30]);
  });

  it('paints the box in the color that identifies its editor', async () => {
    const app = createApp();
    await mountShared(app);

    track(app, 'remote-1', { x: 0, y: 0, w: 60, h: 30 });
    await flush();
    await whenDrawn();

    const [background, border] = rectsOf(boxes()[0]);
    expect(SharedColors).toContain(background.fill());
    expect(background.fill()).toBe(toSharedColor('remote-1'));
    expect(border.stroke()).toBe(toSharedColor('remote-1'));
  });

  it('keeps the peer body fainter than the local marquee', async () => {
    const app = createApp();
    await mountShared(app);

    track(app, 'remote-1', { x: 10, y: 20, w: 60, h: 30 });
    await flush();
    await whenDrawn();

    const [box] = boxes();
    const [background, border] = rectsOf(box);
    expect(box.getAttr('kind')).toBe('shared-drag-select');
    expect(box.listening()).toBe(false);
    expect(background.opacity()).toBe(0.08);
    expect(border.dash()).toEqual([3, 3]);
    expect(border.strokeWidth()).toBe(1);
  });

  it('renders one box per remote editor dragging at the same time', async () => {
    const app = createApp();
    await mountShared(app);

    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    await flush();
    track(app, 'remote-2', { x: 100, y: 100, w: 20, h: 20 });
    await flush();
    await whenDrawn();

    const [first, second] = boxes();
    expect(boxes()).toHaveLength(2);
    expect(first.id()).toBe('shared-drag-select-remote-1');
    expect(second.id()).toBe('shared-drag-select-remote-2');
    expect(rectsOf(first)[1].stroke()).not.toBe(rectsOf(second)[1].stroke());
  });

  it('renders trackers that were already present before it mounted', async () => {
    const app = createApp();
    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    await mountShared(app);

    expect(boxes()).toHaveLength(1);
  });

  it('drops the box when the remote editor ends its drag', async () => {
    const app = createApp();
    await mountShared(app);

    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    track(app, 'remote-2', { x: 100, y: 100, w: 20, h: 20 });
    await flush();
    await whenDrawn();
    expect(boxes()).toHaveLength(2);

    track(app, 'remote-1', null);
    await flush();
    await whenDrawn();

    expect(boxes()).toHaveLength(1);
    expect(boxes()[0].id()).toBe('shared-drag-select-remote-2');
  });

  it('drops the box when the drag expires without any closing signal', async () => {
    const app = createApp();
    await mountShared(app);

    vi.useFakeTimers();
    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    await flush();
    expect(boxes()).toHaveLength(1);

    vi.advanceTimersByTime(SHARED_DRAG_SELECT_TRACKER_TIMEOUT + 1);
    await flush();

    expect(boxes()).toHaveLength(0);
  });

  it('stops reacting to the tracker map once unmounted', async () => {
    const app = createApp();
    await mountShared(app);
    const mountedStage = stage!;

    destroy?.();
    destroy = null;

    expect(() =>
      track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 })
    ).not.toThrow();
    await flush();

    expect(mountedStage.find('.shared-drag-select')).toHaveLength(0);
  });
});
