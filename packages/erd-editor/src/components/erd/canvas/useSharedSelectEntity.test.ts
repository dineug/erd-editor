import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useSharedSelectEntity } from '@/components/erd/canvas/useSharedSelectEntity';
import { sharedSelectionTrackerAction } from '@/engine/modules/editor/atom.actions';
import { Tag } from '@/engine/tag';
import { toSharedColor } from '@/utils/sharedColor';

type SharedSelectApi = ReturnType<typeof useSharedSelectEntity>;

type HostProps = {
  entityId: string;
  capture: (api: SharedSelectApi) => void;
};

const Host: FC<HostProps> = (props, ctx) => {
  const api = useSharedSelectEntity(ctx, props.entityId);
  props.capture(api);
  return () =>
    html`<div class="host">${api.sharedSelectColor() ?? 'none'}</div>`;
};

let mounted: Mounted | null = null;
const apps = new Set<AppContext>();

afterEach(() => {
  mounted?.unmount();
  mounted = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedSelectionTrackerMap
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

const track = (app: AppContext, editorId: string, selectedIds: string[]) =>
  app.store.dispatchSync({
    ...sharedSelectionTrackerAction({ selectedIds }),
    tags: Tag.shared,
    meta: { editorId },
  });

const hostTexts = () =>
  Array.from(mounted!.container.querySelectorAll<HTMLElement>('.host')).map(
    el => el.textContent?.trim() ?? ''
  );

type Fixture = {
  app: AppContext;
  tableId: string;
  memoId: string;
  api: SharedSelectApi;
  memoApi: SharedSelectApi;
};

async function setup(): Promise<Fixture> {
  const app = createApp();
  const tableId = 't1';
  const memoId = 'm1';

  let api!: SharedSelectApi;
  let memoApi!: SharedSelectApi;

  mounted = await mountAndFlush(
    html`
      <${Host}
        entityId=${tableId}
        .capture=${(value: SharedSelectApi) => (api = value)}
      />
      <${Host}
        entityId=${memoId}
        .capture=${(value: SharedSelectApi) => (memoApi = value)}
      />
    `,
    app
  );

  return { app, tableId, memoId, api, memoApi };
}

describe('useSharedSelectEntity', () => {
  it('exposes the shared select color accessor', async () => {
    const { api } = await setup();

    expect(Object.keys(api)).toEqual(['sharedSelectColor']);
  });

  it('reports nothing while the tracker map is empty', async () => {
    const { app, api, memoApi } = await setup();

    expect(app.store.state.editor.sharedSelectionTrackerMap).toEqual({});
    expect(api.sharedSelectColor()).toBeNull();
    expect(memoApi.sharedSelectColor()).toBeNull();
  });

  it('returns the peer color for an entity inside its selection', async () => {
    const { app, tableId, api } = await setup();

    track(app, 'remote-1', [tableId]);

    expect(api.sharedSelectColor()).toBe(toSharedColor('remote-1'));
  });

  it('ignores a peer whose selection leaves this entity out', async () => {
    const { app, memoId, api } = await setup();

    track(app, 'remote-1', [memoId, 'other']);

    expect(api.sharedSelectColor()).toBeNull();
  });

  it('lights up a table and a memo from one peer selection', async () => {
    const { app, tableId, memoId, api, memoApi } = await setup();

    track(app, 'remote-1', [memoId, tableId]);

    expect(api.sharedSelectColor()).toBe(toSharedColor('remote-1'));
    expect(memoApi.sharedSelectColor()).toBe(toSharedColor('remote-1'));
  });

  it('lights up each entity with the color of the peer that selected it', async () => {
    const { app, tableId, memoId, api, memoApi } = await setup();

    track(app, 'remote-1', [tableId]);
    track(app, 'remote-2', [memoId]);

    expect(api.sharedSelectColor()).toBe(toSharedColor('remote-1'));
    expect(memoApi.sharedSelectColor()).toBe(toSharedColor('remote-2'));
    expect(toSharedColor('remote-1')).not.toBe(toSharedColor('remote-2'));
  });

  it('re-renders when a peer key is added to the map after the first render', async () => {
    const { app, tableId } = await setup();

    expect(hostTexts()).toEqual(['none', 'none']);

    track(app, 'remote-1', [tableId]);
    await flush();

    expect(hostTexts()).toEqual([toSharedColor('remote-1'), 'none']);
  });

  it('re-renders when the peer moves its selection to the other entity', async () => {
    const { app, tableId, memoId } = await setup();

    track(app, 'remote-1', [tableId]);
    await flush();
    expect(hostTexts()).toEqual([toSharedColor('remote-1'), 'none']);

    track(app, 'remote-1', [memoId]);
    await flush();

    expect(hostTexts()).toEqual(['none', toSharedColor('remote-1')]);
  });

  it('re-renders when the peer entry is deleted by an empty selection', async () => {
    const { app, tableId, api } = await setup();

    track(app, 'remote-1', [tableId]);
    await flush();
    expect(hostTexts()).toEqual([toSharedColor('remote-1'), 'none']);

    track(app, 'remote-1', []);
    await flush();

    expect(app.store.state.editor.sharedSelectionTrackerMap).toEqual({});
    expect(api.sharedSelectColor()).toBeNull();
    expect(hostTexts()).toEqual(['none', 'none']);
  });

  it('leaves a peer update harmless once unmounted', async () => {
    const { app, tableId } = await setup();
    const container = mounted!.container;

    mounted!.unmount();
    mounted = null;

    expect(() => track(app, 'remote-1', [tableId])).not.toThrow();
    await flush();

    expect(container.querySelectorAll('.host')).toHaveLength(0);
  });

  it('keeps a second host reactive after the first one unmounts', async () => {
    const app = createApp();

    const first = await mountAndFlush(
      html`<${Host} entityId=${'t1'} .capture=${() => {}} />`,
      app
    );
    mounted = await mountAndFlush(
      html`<${Host} entityId=${'t1'} .capture=${() => {}} />`,
      app
    );
    expect(hostTexts()).toEqual(['none']);

    first.unmount();

    track(app, 'remote-1', ['t1']);
    await flush();

    expect(hostTexts()).toEqual([toSharedColor('remote-1')]);
  });
});
