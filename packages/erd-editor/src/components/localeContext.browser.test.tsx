/** @jsxHost konva */

// The language boundary every scene component shares: a Stage under a DOM shell
// reads it through the shell's provider, a switch assigned in place redraws the
// placeholders of empty fields, and a node mounted after the switch reads it too.

import { type DOMTemplateLiterals, useProvider } from '@dineug/r-html';
import type { Text } from 'konva/lib/shapes/Text';
import { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestI18n,
  createTestTheme,
  flush,
  provideI18n,
  pseudoMessages,
} from '@/__test-utils__';
import { type AppContext, appContext } from '@/components/appContext';
import HighLevelTable from '@/components/erd/canvas/high-level-table/HighLevelTable';
import Column from '@/components/erd/canvas/table/column/Column';
import Table from '@/components/erd/canvas/table/Table';
import { themeContext } from '@/components/themeContext';
import { Show } from '@/constants/schema';
import { unselectAllAction } from '@/engine/modules/editor/atom.actions';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction$ } from '@/engine/modules/table/generator.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { createI18n, type I18n } from '@/i18n/translate';
import { whenDrawn } from '@/konva/batchDraw';
import { renderKonva } from '@/konva/host';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

const settle = async () => {
  await flush();
  await whenDrawn();
};

/** Tables of one empty row each, with every field the row can show shown. */
function seedEmptyTables(app: AppContext, count: number) {
  const { store } = app;

  store.dispatchSync(
    changeShowAction({ show: Show.tableComment, value: true }),
    changeShowAction({ show: Show.columnComment, value: true }),
    changeShowAction({ show: Show.columnDataType, value: true }),
    changeShowAction({ show: Show.columnDefault, value: true })
  );
  for (let index = 0; index < count; index++) {
    store.dispatchSync(addTableAction$());
    const tableId = store.state.doc.tableIds[index];
    store.dispatchSync(addColumnAction$(tableId));
  }
  store.dispatchSync(unselectAllAction());

  return store.state.doc.tableIds.map(
    id => store.state.collections.tableEntities[id]
  );
}

/** A Stage hung under a shell that provides the app, the palette and the language, as the editor's root does. */
function mountUnderShell(app: AppContext, i18n: I18n) {
  const shell = document.createElement('div');
  const host = document.createElement('div');
  shell.append(host);
  document.body.append(shell);

  // useProvider takes a bare element at runtime and types only a component
  // context, hence the casts; it is r-html's own, not a React hook.
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const appProvider = useProvider(shell as any, appContext, app);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(
    shell as any,
    themeContext,
    createTestTheme()
  );
  const i18nProvider = provideI18n(shell, i18n);
  const stage = new Stage({ container: host, width: 900, height: 700 });

  teardowns.push(() => {
    renderKonva(stage, null);
    i18nProvider.destroy();
    themeProvider.destroy();
    appProvider.destroy();
    stage.destroy();
    shell.remove();
  });

  return {
    stage,
    render: async (scene: DOMTemplateLiterals) => {
      renderKonva(stage, <k-layer name="scene">{scene}</k-layer>);
      await settle();
    },
  };
}

const textsOf = (stage: Stage) =>
  stage.find<Text>('.cell-text').map(text => text.text());

const PLACEHOLDERS = ['table', 'comment', 'column', 'dataType', 'default'];

const switchTo = async (i18n: I18n, tag: string) => {
  Object.assign(i18n, createI18n('ko-KR', pseudoMessages(tag)));
  await settle();
};

describe('the scene language boundary', () => {
  it('draws the placeholders of an empty table in the language provided above the Stage', async () => {
    const app = createTestAppContext();
    const [table] = seedEmptyTables(app, 1);
    const { stage, render } = mountUnderShell(app, createTestI18n('en'));

    await render(<Table table={table} />);

    expect(textsOf(stage)).toEqual(expect.arrayContaining(PLACEHOLDERS));
  });

  it('redraws them when another language is assigned in place', async () => {
    const app = createTestAppContext();
    const [table] = seedEmptyTables(app, 1);
    const i18n = createTestI18n('en');
    const { stage, render } = mountUnderShell(app, i18n);
    await render(<Table table={table} />);

    await switchTo(i18n, 'ko');

    expect(textsOf(stage)).toEqual(
      expect.arrayContaining(PLACEHOLDERS.map(text => `ko:${text}`))
    );
    for (const text of PLACEHOLDERS) expect(textsOf(stage)).not.toContain(text);
  });

  it('draws a table mounted after the switch in the new language too', async () => {
    const app = createTestAppContext();
    const [first, second] = seedEmptyTables(app, 2);
    const i18n = createTestI18n('en');
    const { stage, render } = mountUnderShell(app, i18n);
    await render(<Table table={first} />);

    await switchTo(i18n, 'ko');
    await render(
      <>
        <Table table={first} />
        <Table table={second} />
      </>
    );

    const names = textsOf(stage).filter(text => text.endsWith('table'));
    expect(names).toEqual(['ko:table', 'ko:table']);
  });

  it('stands in for the name of a simplified table in the language provided, following a switch', async () => {
    const app = createTestAppContext();
    const [table] = seedEmptyTables(app, 1);
    const i18n = createTestI18n('en');
    const { stage, render } = mountUnderShell(app, i18n);
    const nameOf = () => stage.findOne<Text>('.high-level-table-name')?.text();

    await render(<HighLevelTable table={table} />);
    expect(nameOf()).toBe('unnamed');

    await switchTo(i18n, 'ko');

    expect(nameOf()).toBe('ko:unnamed');
  });

  it('draws a row on its own in the language provided, following a switch', async () => {
    const app = createTestAppContext();
    const [table] = seedEmptyTables(app, 1);
    const column =
      app.store.state.collections.tableColumnEntities[table.columnIds[0]];
    const widths = getTableWidths(app.store.state, table);
    const i18n = createTestI18n('en');
    const { stage, render } = mountUnderShell(app, i18n);

    await render(
      <Column
        column={column}
        source="document"
        y={0}
        width={getTableRect(app.store.state, table).width}
        selected={false}
        widthName={widths.name}
        widthDataType={widths.dataType}
        widthDefault={widths.default}
        widthComment={widths.comment}
        focusName={false}
        focusDataType={false}
        focusNotNull={false}
        focusDefault={false}
        focusComment={false}
        focusUnique={false}
        focusAutoIncrement={false}
        sharedFocusName={null}
        sharedFocusDataType={null}
        sharedFocusNotNull={null}
        sharedFocusDefault={null}
        sharedFocusComment={null}
        sharedFocusUnique={null}
        sharedFocusAutoIncrement={null}
        editName={false}
        editDataType={false}
        editDefault={false}
        editComment={false}
      />
    );
    expect(textsOf(stage)).toEqual(
      expect.arrayContaining(['column', 'dataType', 'default', 'comment'])
    );

    await switchTo(i18n, 'ja');

    expect(textsOf(stage)).toEqual(
      expect.arrayContaining([
        'ja:column',
        'ja:dataType',
        'ja:default',
        'ja:comment',
      ])
    );
  });
});
