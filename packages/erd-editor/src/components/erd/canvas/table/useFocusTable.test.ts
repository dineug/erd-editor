import { FC, html } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createTestAppContext,
  flush,
  mount,
  Mounted,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { useFocusTable } from '@/components/erd/canvas/table/useFocusTable';
import {
  editTableAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType } from '@/engine/modules/editor/state';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';

type FocusApi = ReturnType<typeof useFocusTable>;

type HostProps = {
  tableId: string;
  capture: (api: FocusApi) => void;
};

const Host: FC<HostProps> = (props, ctx) => {
  const api = useFocusTable(ctx, props.tableId);
  props.capture(api);
  return () => html`<div class="host"></div>`;
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

type Fixture = {
  app: AppContext;
  tableId: string;
  otherTableId: string;
  columnIds: string[];
  api: FocusApi;
  otherApi: FocusApi;
};

async function setup(): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(addTableAction$());
  store.dispatchSync(addTableAction$());
  const [tableId, otherTableId] = store.state.doc.tableIds;

  store.dispatchSync(addColumnAction$(tableId));
  store.dispatchSync(addColumnAction$(tableId));
  const columnIds = [
    ...store.state.collections.tableEntities[tableId].columnIds,
  ];

  let api!: FocusApi;
  let otherApi!: FocusApi;

  mounted = mount(
    html`
      <${Host}
        tableId=${tableId}
        .capture=${(value: FocusApi) => (api = value)}
      />
      <${Host}
        tableId=${otherTableId}
        .capture=${(value: FocusApi) => (otherApi = value)}
      />
    `,
    app
  );
  await flush();

  return { app, tableId, otherTableId, columnIds, api, otherApi };
}

describe('useFocusTable', () => {
  it('exposes the three focus predicates', async () => {
    const { api } = await setup();

    expect(Object.keys(api).sort()).toEqual([
      'hasEdit',
      'hasFocus',
      'hasSelectColumn',
    ]);
  });

  it('reports no focus, edit or selection while focusTable is null', async () => {
    const { app, api, columnIds } = await setup();

    app.store.dispatchSync(focusTableEndAction());

    expect(app.store.state.editor.focusTable).toBeNull();
    expect(api.hasFocus(FocusType.tableName)).toBe(false);
    expect(api.hasEdit(FocusType.tableName)).toBe(false);
    expect(api.hasSelectColumn(columnIds[0])).toBe(false);
  });

  it('matches the focused table name and rejects the other focus types', async () => {
    const { app, tableId, api } = await setup();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );

    expect(api.hasFocus(FocusType.tableName)).toBe(true);
    expect(api.hasFocus(FocusType.tableComment)).toBe(false);
  });

  it('scopes focus to its own tableId', async () => {
    const { app, tableId, api, otherApi } = await setup();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableComment })
    );

    expect(api.hasFocus(FocusType.tableComment)).toBe(true);
    expect(otherApi.hasFocus(FocusType.tableComment)).toBe(false);
    expect(otherApi.hasEdit(FocusType.tableComment)).toBe(false);
    expect(otherApi.hasSelectColumn('anything')).toBe(false);
  });

  it('matches a focused column only for that column id', async () => {
    const { app, tableId, columnIds, api } = await setup();

    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    expect(api.hasFocus(FocusType.columnName, columnIds[0])).toBe(true);
    expect(api.hasFocus(FocusType.columnName, columnIds[1])).toBe(false);
    expect(api.hasFocus(FocusType.columnDataType, columnIds[0])).toBe(false);
  });

  it('turns hasEdit on only once editTable is dispatched for the focused cell', async () => {
    const { app, tableId, columnIds, api } = await setup();

    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );
    expect(api.hasEdit(FocusType.columnName, columnIds[0])).toBe(false);

    app.store.dispatchSync(editTableAction());

    expect(api.hasEdit(FocusType.columnName, columnIds[0])).toBe(true);
    expect(api.hasEdit(FocusType.columnName, columnIds[1])).toBe(false);
    expect(api.hasEdit(FocusType.tableName)).toBe(false);
  });

  it('turns hasEdit on for the table name when it is the focused cell', async () => {
    const { app, tableId, api } = await setup();

    app.store.dispatchSync(
      focusTableAction({ tableId, focusType: FocusType.tableName })
    );
    app.store.dispatchSync(editTableAction());

    expect(api.hasEdit(FocusType.tableName)).toBe(true);
    expect(api.hasEdit(FocusType.tableComment)).toBe(false);
  });

  it('follows the selected column ids of the focused table', async () => {
    const { app, tableId, columnIds, api } = await setup();

    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId: columnIds[1],
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      })
    );

    expect(api.hasSelectColumn(columnIds[1])).toBe(true);
    expect(api.hasSelectColumn(columnIds[0])).toBe(false);

    app.store.dispatchSync(
      focusColumnAction({
        tableId,
        columnId: columnIds[0],
        focusType: FocusType.columnName,
        $mod: true,
        shiftKey: false,
      })
    );

    expect(api.hasSelectColumn(columnIds[0])).toBe(true);
    expect(api.hasSelectColumn(columnIds[1])).toBe(true);
  });
});
