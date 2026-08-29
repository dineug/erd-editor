import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  mountAndFlush,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useSharedFocusTable } from '@/components/erd/canvas/table/useSharedFocusTable';
import { sharedFocusTrackerAction } from '@/engine/modules/editor/atom.actions';
import { FocusType, SharedFocus } from '@/engine/modules/editor/state';
import { Tag } from '@/engine/tag';

type SharedFocusApi = ReturnType<typeof useSharedFocusTable>;

type HostProps = {
  tableId: string;
  capture: (api: SharedFocusApi) => void;
};

const Host: FC<HostProps> = (props, ctx) => {
  const api = useSharedFocusTable(ctx, props.tableId);
  props.capture(api);
  return () =>
    html`<div class="host">
      ${api.sharedFocusTableColor() ? 'shared' : 'none'}
    </div>`;
};

let mounted: Mounted | null = null;
const apps = new Set<AppContext>();

afterEach(() => {
  mounted?.unmount();
  mounted = null;

  for (const app of apps) {
    for (const tracker of Object.values(
      app.store.state.editor.sharedFocusTrackerMap
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

const track = (app: AppContext, editorId: string, focus: SharedFocus | null) =>
  app.store.dispatchSync({
    ...sharedFocusTrackerAction({ focus }),
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
  otherTableId: string;
  api: SharedFocusApi;
  otherApi: SharedFocusApi;
};

async function setup(): Promise<Fixture> {
  const app = createApp();
  const tableId = 't1';
  const otherTableId = 't2';

  let api!: SharedFocusApi;
  let otherApi!: SharedFocusApi;

  mounted = await mountAndFlush(
    html`
      <${Host}
        tableId=${tableId}
        .capture=${(value: SharedFocusApi) => (api = value)}
      />
      <${Host}
        tableId=${otherTableId}
        .capture=${(value: SharedFocusApi) => (otherApi = value)}
      />
    `,
    app
  );

  return { app, tableId, otherTableId, api, otherApi };
}

describe('useSharedFocusTable', () => {
  it('exposes the two shared focus predicates', async () => {
    const { api } = await setup();

    expect(Object.keys(api).sort()).toEqual([
      'sharedFocusColor',
      'sharedFocusTableColor',
    ]);
  });

  it('reports nothing while the tracker map is empty', async () => {
    const { app, api } = await setup();

    expect(app.store.state.editor.sharedFocusTrackerMap).toEqual({});
    expect(api.sharedFocusTableColor()).toBeNull();

    for (const focusType of Object.values(FocusType)) {
      expect(api.sharedFocusColor(focusType)).toBeNull();
      expect(api.sharedFocusColor(focusType, 'c1')).toBeNull();
    }
  });

  it('ignores a tracker focused on another table', async () => {
    const { app, otherTableId, api } = await setup();

    track(app, 'remote-1', {
      tableId: otherTableId,
      columnId: 'c1',
      focusType: FocusType.columnName,
    });

    expect(api.sharedFocusTableColor()).toBeNull();
    expect(api.sharedFocusColor(FocusType.columnName, 'c1')).toBeNull();
    expect(api.sharedFocusColor(FocusType.tableName)).toBeNull();
  });

  it('matches a shared column focus only for that column id', async () => {
    const { app, tableId, api } = await setup();

    track(app, 'remote-1', {
      tableId,
      columnId: 'c1',
      focusType: FocusType.columnName,
    });

    expect(api.sharedFocusTableColor()).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.columnName, 'c1')).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.columnName, 'c2')).toBeNull();
    expect(api.sharedFocusColor(FocusType.columnDataType, 'c1')).toBeNull();
  });

  it('matches a shared table focus whatever column id is asked for', async () => {
    const { app, tableId, api } = await setup();

    track(app, 'remote-1', {
      tableId,
      columnId: null,
      focusType: FocusType.tableName,
    });

    expect(api.sharedFocusTableColor()).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.tableName)).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.tableName, 'c1')).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.tableComment)).toBeNull();
  });

  it('lights up each table for the peer that focused it', async () => {
    const { app, tableId, otherTableId, api, otherApi } = await setup();

    track(app, 'remote-1', {
      tableId,
      columnId: 'c1',
      focusType: FocusType.columnName,
    });
    track(app, 'remote-2', {
      tableId: otherTableId,
      columnId: null,
      focusType: FocusType.tableComment,
    });

    expect(api.sharedFocusTableColor()).not.toBeNull();
    expect(otherApi.sharedFocusTableColor()).not.toBeNull();

    expect(api.sharedFocusColor(FocusType.columnName, 'c1')).not.toBeNull();
    expect(api.sharedFocusColor(FocusType.tableComment)).toBeNull();

    expect(otherApi.sharedFocusColor(FocusType.tableComment)).not.toBeNull();
    expect(otherApi.sharedFocusColor(FocusType.columnName, 'c1')).toBeNull();
  });

  it('re-renders when a peer key is added to the map after the first render', async () => {
    const { app, tableId } = await setup();

    expect(hostTexts()).toEqual(['none', 'none']);

    track(app, 'remote-1', {
      tableId,
      columnId: 'c1',
      focusType: FocusType.columnName,
    });
    await flush();

    expect(hostTexts()).toEqual(['shared', 'none']);
  });

  it('re-renders when the peer moves its focus to the other table', async () => {
    const { app, tableId, otherTableId } = await setup();

    track(app, 'remote-1', {
      tableId,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();
    expect(hostTexts()).toEqual(['shared', 'none']);

    track(app, 'remote-1', {
      tableId: otherTableId,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();

    expect(hostTexts()).toEqual(['none', 'shared']);
  });

  it('re-renders when the peer clears its focus', async () => {
    const { app, tableId, api } = await setup();

    track(app, 'remote-1', {
      tableId,
      columnId: 'c1',
      focusType: FocusType.columnName,
    });
    await flush();
    expect(hostTexts()).toEqual(['shared', 'none']);

    track(app, 'remote-1', null);
    await flush();

    expect(api.sharedFocusTableColor()).toBeNull();
    expect(hostTexts()).toEqual(['none', 'none']);
  });

  it('leaves a peer update harmless once unmounted', async () => {
    const { app, tableId } = await setup();
    const container = mounted!.container;

    mounted!.unmount();
    mounted = null;

    expect(() =>
      track(app, 'remote-1', {
        tableId,
        columnId: null,
        focusType: FocusType.tableName,
      })
    ).not.toThrow();
    await flush();

    expect(container.querySelectorAll('.host')).toHaveLength(0);
  });

  it('keeps a second host reactive after the first one unmounts', async () => {
    const app = createApp();

    const first = await mountAndFlush(
      html`<${Host} tableId=${'t1'} .capture=${() => {}} />`,
      app
    );
    mounted = await mountAndFlush(
      html`<${Host} tableId=${'t1'} .capture=${() => {}} />`,
      app
    );
    expect(hostTexts()).toEqual(['none']);

    first.unmount();

    track(app, 'remote-1', {
      tableId: 't1',
      columnId: null,
      focusType: FocusType.tableName,
    });
    await flush();

    expect(hostTexts()).toEqual(['shared']);
  });
});
