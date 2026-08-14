import { html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import * as cursorStyles from '@/components/erd/canvas/shared-mouse-tracker/shared-mouse-cursor/SharedMouseCursor.styles';
import SharedMouseTracker from '@/components/erd/canvas/shared-mouse-tracker/SharedMouseTracker';
import { sharedMouseTrackerAction } from '@/engine/modules/editor/atom.actions';
import { Tag } from '@/engine/tag';

let mounted: Mounted | null = null;
const apps = new Set<AppContext>();

afterEach(() => {
  mounted?.unmount();
  mounted = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedMouseTrackerMap
    )) {
      clearTimeout(tracker.timeoutId);
    }
  }
  apps.clear();
});

const createApp = () => {
  const app = createTestAppContext();
  apps.add(app);
  return app;
};

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

const cursors = () =>
  Array.from(
    mounted!.container.querySelectorAll<HTMLElement>(
      `.${String(cursorStyles.cursor)}`
    )
  );

describe('SharedMouseTracker', () => {
  it('renders nothing while no remote editor is tracked', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    expect(cursors()).toHaveLength(0);
  });

  it('renders a cursor for a remote editor that starts sharing its mouse', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    track(app, 'remote-1', { x: 12, y: 34, nickname: 'ada' });
    await flush();

    const [cursor] = cursors();
    expect(cursor).toBeTruthy();
    expect(cursor.style.left).toBe('12px');
    expect(cursor.style.top).toBe('34px');
    expect(cursor.querySelector('span')?.textContent).toBe('ada');
  });

  it('renders one cursor per remote editor', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    track(app, 'remote-1', { nickname: 'ada' });
    await flush();
    track(app, 'remote-2', { nickname: 'linus' });
    await flush();

    expect(cursors().map(el => el.querySelector('span')?.textContent)).toEqual([
      'ada',
      'linus',
    ]);
  });

  it('renders trackers that were already present before it mounted', async () => {
    const app = createApp();
    track(app, 'remote-1', { nickname: 'ada' });
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    expect(cursors()).toHaveLength(1);
  });

  it('drops the cursor when the tracker leaves the map', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    track(app, 'remote-1', { nickname: 'ada' });
    track(app, 'remote-2', { nickname: 'linus' });
    await flush();
    expect(cursors()).toHaveLength(2);

    const { sharedMouseTrackerMap } = app.store.state.editor;
    clearTimeout(sharedMouseTrackerMap['remote-1'].timeoutId);
    Reflect.deleteProperty(sharedMouseTrackerMap, 'remote-1');
    await flush();

    expect(cursors().map(el => el.querySelector('span')?.textContent)).toEqual([
      'linus',
    ]);
  });

  it('ignores mouse updates that are not tagged as shared', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    app.store.dispatchSync({
      ...sharedMouseTrackerAction({ x: 1, y: 2 }),
      meta: { editorId: 'remote-1' },
    });
    await flush();

    expect(cursors()).toHaveLength(0);
  });

  it('ignores the local editor id so the local pointer is never drawn twice', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);

    track(app, app.store.state.editor.id, { x: 1, y: 2 });
    await flush();

    expect(cursors()).toHaveLength(0);
  });

  it('stops reacting to the tracker map once unmounted', async () => {
    const app = createApp();
    mounted = await mountAndFlush(html`<${SharedMouseTracker} />`, app);
    const container = mounted.container;

    mounted.unmount();
    mounted = null;

    expect(() => track(app, 'remote-1', { nickname: 'ada' })).not.toThrow();
    await flush();

    expect(
      container.querySelectorAll(`.${String(cursorStyles.cursor)}`)
    ).toHaveLength(0);
  });
});
