import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import SharedDragSelect from '@/components/erd/canvas/shared-drag-select/SharedDragSelect';
import {
  SHARED_DRAG_SELECT_TRACKER_TIMEOUT,
  sharedDragSelectTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import { Tag } from '@/engine/tag';
import type { Rect } from '@/utils/dragSelect';
import { SharedColors, toSharedColor } from '@/utils/sharedColor';

let mounted: Mounted | null = null;
const apps = new Set<AppContext>();

afterEach(() => {
  mounted?.unmount();
  mounted = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedDragSelectTrackerMap
    )) {
      clearTimeout(tracker.timeoutId);
    }
  }
  apps.clear();
  vi.useRealTimers();
});

const createApp = () => {
  const app = createTestAppContext();
  apps.add(app);
  return app;
};

const track = (app: AppContext, editorId: string, rect: Rect | null) =>
  app.store.dispatchSync({
    ...sharedDragSelectTrackerAction({ rect }),
    tags: Tag.shared,
    meta: { editorId },
  });

const boxes = () =>
  Array.from(
    mounted!.container.querySelectorAll<SVGSVGElement>(
      '[data-testid="shared-drag-select"]'
    )
  );

const toHex = (value: string) => {
  if (!value.startsWith('rgb')) return value;

  const channels = value.match(/\d+/g) ?? [];
  return `#${channels
    .slice(0, 3)
    .map(channel => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};

describe('SharedDragSelect', () => {
  it('renders nothing while no remote editor is drag selecting', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    expect(boxes()).toHaveLength(0);
  });

  it('positions the box at the absolute rect the remote editor is dragging', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    track(app, 'remote-1', { x: 120, y: 240, w: 60, h: 30 });
    await flush();

    const [box] = boxes();
    expect(box).toBeTruthy();
    expect(box.style.left).toBe('120px');
    expect(box.style.top).toBe('240px');
    expect(box.style.width).toBe('60px');
    expect(box.style.height).toBe('30px');
  });

  it('paints the box in the color that identifies its editor', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    track(app, 'remote-1', { x: 0, y: 0, w: 60, h: 30 });
    await flush();

    const [box] = boxes();
    expect(box.style.stroke).toBeTruthy();
    expect(SharedColors).toContain(toHex(box.style.stroke));
    expect(toHex(box.style.stroke)).toBe(toSharedColor('remote-1'));
    expect(toHex(box.style.fill)).toBe(toSharedColor('remote-1'));
  });

  it('keeps the dashed outline sized to the rect', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    track(app, 'remote-1', { x: 10, y: 20, w: 60, h: 30 });
    await flush();

    const rect = boxes()[0].querySelector('rect')!;
    expect(rect).toBeTruthy();
    expect(rect.getAttribute('stroke-dasharray')).toBe('3');
    expect(rect.getAttribute('width')).toBe('60');
    expect(rect.getAttribute('height')).toBe('30');
  });

  it('renders one box per remote editor dragging at the same time', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    await flush();
    track(app, 'remote-2', { x: 100, y: 100, w: 20, h: 20 });
    await flush();

    const [first, second] = boxes();
    expect(boxes()).toHaveLength(2);
    expect(toHex(first.style.stroke)).toBe(toSharedColor('remote-1'));
    expect(toHex(second.style.stroke)).toBe(toSharedColor('remote-2'));
    expect(toHex(first.style.stroke)).not.toBe(toHex(second.style.stroke));
  });

  it('renders trackers that were already present before it mounted', async () => {
    const app = createApp();
    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    expect(boxes()).toHaveLength(1);
  });

  it('drops the box when the remote editor ends its drag', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

    track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 });
    track(app, 'remote-2', { x: 100, y: 100, w: 20, h: 20 });
    await flush();
    expect(boxes()).toHaveLength(2);

    track(app, 'remote-1', null);
    await flush();

    const [box] = boxes();
    expect(boxes()).toHaveLength(1);
    expect(toHex(box.style.stroke)).toBe(toSharedColor('remote-2'));
  });

  it('drops the box when the drag expires without any closing signal', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);

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
    mounted = await mountAndFlush(html`<${SharedDragSelect} />`, app);
    const container = mounted.container;

    mounted.unmount();
    mounted = null;

    expect(() =>
      track(app, 'remote-1', { x: 0, y: 0, w: 10, h: 10 })
    ).not.toThrow();
    await flush();

    expect(
      container.querySelectorAll('[data-testid="shared-drag-select"]')
    ).toHaveLength(0);
  });
});
