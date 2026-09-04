/** @jsxHost konva */

import type { Group } from 'konva/lib/Group';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import { AppContext } from '@/components/appContext';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import { sharedMouseTrackerAction } from '@/engine/modules/editor/atom.actions';
import { Tag } from '@/engine/tag';
import { whenDrawn } from '@/konva/batchDraw';
import { renderScene } from '@/konva/scene/renderScene';

let stage: Stage | null = null;
let destroy: (() => void) | null = null;
const apps = new Set<AppContext>();

afterEach(async () => {
  destroy?.();
  destroy = null;
  stage = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedMouseTrackerMap
    )) {
      clearTimeout(tracker.timeoutId);
    }
  }
  apps.clear();
  await whenDrawn();
});

const createApp = () => {
  const app = createTestAppContext();
  apps.add(app);
  return app;
};

async function mountTracker(app: AppContext) {
  const container = document.createElement('div');
  document.body.append(container);

  const rendered = renderScene({
    app,
    container,
    width: 400,
    height: 300,
    scene: (
      <k-layer name="presence">
        <SharedMouseTracker />
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

const track = (
  app: AppContext,
  editorId: string,
  { x = 0, y = 0, nickname }: { x?: number; y?: number; nickname?: string } = {}
) =>
  app.store.dispatchSync({
    ...sharedMouseTrackerAction({ x, y }),
    tags: Tag.shared,
    meta: { editorId, nickname },
  });

const cursors = () => stage?.find<Group>('.shared-mouse-cursor') ?? [];

const nicknameOf = (cursor: Group) =>
  cursor.findOne<Text>('.shared-mouse-cursor-nickname')?.text();

describe('SharedMouseTracker', () => {
  it('renders nothing while no remote editor is tracked', async () => {
    const app = createApp();
    await mountTracker(app);

    expect(cursors()).toHaveLength(0);
  });

  it('renders a cursor for a remote editor that starts sharing its mouse', async () => {
    const app = createApp();
    await mountTracker(app);

    track(app, 'remote-1', { x: 12, y: 34, nickname: 'ada' });
    await flush();
    await whenDrawn();

    const [cursor] = cursors();
    expect(cursor).toBeTruthy();
    expect(cursor.id()).toBe('shared-mouse-cursor-remote-1');
    expect([cursor.x(), cursor.y()]).toEqual([12, 34]);
    expect(nicknameOf(cursor)).toBe('ada');
  });

  it('renders one cursor per remote editor', async () => {
    const app = createApp();
    await mountTracker(app);

    track(app, 'remote-1', { nickname: 'ada' });
    await flush();
    track(app, 'remote-2', { nickname: 'linus' });
    await flush();
    await whenDrawn();

    expect(cursors().map(nicknameOf)).toEqual(['ada', 'linus']);
  });

  it('renders trackers that were already present before it mounted', async () => {
    const app = createApp();
    track(app, 'remote-1', { nickname: 'ada' });
    await mountTracker(app);

    expect(cursors()).toHaveLength(1);
  });

  it('drops the cursor when the tracker leaves the map', async () => {
    const app = createApp();
    await mountTracker(app);

    track(app, 'remote-1', { nickname: 'ada' });
    track(app, 'remote-2', { nickname: 'linus' });
    await flush();
    await whenDrawn();
    expect(cursors()).toHaveLength(2);

    const { sharedMouseTrackerMap } = app.store.state.editor;
    clearTimeout(sharedMouseTrackerMap['remote-1'].timeoutId);
    Reflect.deleteProperty(sharedMouseTrackerMap, 'remote-1');
    await flush();
    await whenDrawn();

    expect(cursors().map(nicknameOf)).toEqual(['linus']);
  });

  it('ignores mouse updates that are not tagged as shared', async () => {
    const app = createApp();
    await mountTracker(app);

    app.store.dispatchSync({
      ...sharedMouseTrackerAction({ x: 1, y: 2 }),
      meta: { editorId: 'remote-1' },
    });
    await flush();
    await whenDrawn();

    expect(cursors()).toHaveLength(0);
  });

  it('ignores the local editor id so the local pointer is never drawn twice', async () => {
    const app = createApp();
    await mountTracker(app);

    track(app, app.store.state.editor.id, { x: 1, y: 2 });
    await flush();
    await whenDrawn();

    expect(cursors()).toHaveLength(0);
  });

  it('stops reacting to the tracker map once unmounted', async () => {
    const app = createApp();
    await mountTracker(app);
    const mountedStage = stage!;

    destroy?.();
    destroy = null;

    expect(() => track(app, 'remote-1', { nickname: 'ada' })).not.toThrow();
    await flush();

    expect(mountedStage.find('.shared-mouse-cursor')).toHaveLength(0);
  });
});
