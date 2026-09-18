import {
  type DOMTemplateLiterals,
  html,
  render,
  useProvider,
} from '@dineug/r-html';
import type { Container } from 'konva/lib/Container';
import type { Node as KonvaNode } from 'konva/lib/Node';
import { type Stage, stages } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import { type AppContext, appContext } from '@/components/appContext';
import {
  Diff,
  type DiffMap,
  diffState,
} from '@/components/erd/diff-viewer/diff';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import Erd from '@/components/erd/Erd';
import { themeContext } from '@/components/themeContext';
import {
  COLUMN_HEIGHT,
  INPUT_MARGIN_RIGHT,
  TABLE_HEADER_INPUT_HEIGHT,
} from '@/constants/layout';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import {
  addTableAction,
  changeTableCommentAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
} from '@/engine/modules/table-column/atom.actions';
import { whenDrawn } from '@/konva/batchDraw';

const VIEWPORT = { width: 1200, height: 700 };

const theme = createTestTheme();

type ColumnSeed = {
  id: string;
  name: string;
  dataType: string;
  notNull?: boolean;
};

type TableSeed = {
  id: string;
  name: string;
  comment?: string;
  x: number;
  columns: ColumnSeed[];
};

type Tint = { entity: string; cell: string; fill: string };

const teardowns: Array<() => void> = [];

afterEach(async () => {
  window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/**
 * The saved document: users with three columns, and posts. The current one
 * comments users, drops NOT NULL from id, widens nickname, adds email in place
 * of legacy and adds tags; posts is left exactly as it was.
 */
const SAVED: TableSeed[] = [
  {
    id: 'p_users',
    name: 'users',
    x: 40,
    columns: [
      { id: 'p_id', name: 'id', dataType: 'INT', notNull: true },
      { id: 'p_nick', name: 'nickname', dataType: 'VARCHAR(20)' },
      { id: 'p_legacy', name: 'legacy', dataType: 'INT' },
    ],
  },
  {
    id: 'p_posts',
    name: 'posts',
    x: 600,
    columns: [{ id: 'p_title', name: 'title', dataType: 'TEXT' }],
  },
];

const CURRENT: TableSeed[] = [
  {
    id: 'n_users',
    name: 'users',
    comment: 'members',
    x: 40,
    columns: [
      { id: 'n_id', name: 'id', dataType: 'INT' },
      { id: 'n_nick', name: 'nickname', dataType: 'VARCHAR(40)' },
      { id: 'n_email', name: 'email', dataType: 'TEXT' },
    ],
  },
  {
    id: 'n_posts',
    name: 'posts',
    x: 600,
    columns: [{ id: 'n_title', name: 'title', dataType: 'TEXT' }],
  },
  { id: 'n_tags', name: 'tags', x: 40, columns: [] },
];

function createApp(tables: TableSeed[]): AppContext {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(changeViewportAction(VIEWPORT));
  tables.forEach((table, index) => {
    store.dispatchSync(
      addTableAction({
        id: table.id,
        ui: { x: table.x, y: table.columns.length ? 40 : 360, zIndex: index },
      }),
      changeTableNameAction({ id: table.id, value: table.name })
    );
    if (table.comment) {
      store.dispatchSync(
        changeTableCommentAction({ id: table.id, value: table.comment })
      );
    }
    table.columns.forEach(({ id, name, dataType, notNull }) => {
      store.dispatchSync(
        addColumnAction({ id, tableId: table.id }),
        changeColumnNameAction({ id, tableId: table.id, value: name }),
        changeColumnDataTypeAction({ id, tableId: table.id, value: dataType }),
        changeColumnNotNullAction({
          id,
          tableId: table.id,
          value: Boolean(notNull),
        })
      );
    });
  });

  return app;
}

async function settle() {
  for (let round = 0; round < 3; round++) {
    await flush();
    await whenDrawn();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
}

/**
 * Renders a template under a container that carries the theme, and the app
 * too when the template does not provide its own, then hands back the Stage.
 */
async function mountStage(
  template: DOMTemplateLiterals,
  app: AppContext | null
): Promise<Stage> {
  const container = document.createElement('div');
  document.body.append(container);
  // oxlint-disable-next-line react-hooks/rules-of-hooks
  const themeProvider = useProvider(container as any, themeContext, theme);
  const appProvider = app
    ? // oxlint-disable-next-line react-hooks/rules-of-hooks
      useProvider(container as any, appContext, app)
    : null;

  render(container, template);

  teardowns.push(() => {
    render(container, null);
    appProvider?.destroy();
    themeProvider.destroy();
    container.remove();
  });

  await settle();

  const canvas = container.querySelector('[data-testid="erd-canvas"]');
  return stages.find(candidate => candidate.container() === canvas)!;
}

/** One pane the way DiffViewer mounts it, which provides its own app. */
const mountPane = (app: AppContext, diff: number, diffMap: DiffMap) =>
  mountStage(
    html`<${ErdViewer} app=${app} diff=${diff} diffMap=${diffMap} />`,
    null
  );

async function mountPanes() {
  const prevApp = createApp(SAVED);
  const app = createApp(CURRENT);
  const [prevDiffMap, diffMap] = diffState(
    prevApp.store.state,
    app.store.state
  );

  const saved = await mountPane(prevApp, Diff.delete, prevDiffMap);
  const current = await mountPane(app, Diff.insert, diffMap);

  return { saved, current };
}

/** The entity a scene node belongs to, read off the nearest table or column group. */
const entityOf = (node: KonvaNode) =>
  node
    .findAncestor((ancestor: KonvaNode) =>
      /^(table|column)-/.test(ancestor.id())
    )
    .id();

/** Every tint the stage draws, as the entity, the cell and the fill it takes. */
const tintsOf = (stage: Stage): Tint[] =>
  stage
    .find('.cell-diff-background')
    .map(node => ({
      entity: entityOf(node),
      cell: node.getParent()!.name().split(' ')[1],
      fill: node.getAttr('fill'),
    }))
    .sort((a, b) =>
      `${a.entity} ${a.cell}`.localeCompare(`${b.entity} ${b.cell}`)
    );

/** Every cell a row draws, which is what a column with no counterpart tints. */
const rowCellsOf = (stage: Stage, columnId: string) =>
  stage
    .findOne<Container>(`#column-${columnId}`)!
    .find('.column-col')
    .map(node => node.name().split(' ')[1])
    .filter(cell => cell !== 'column-key');

const tints = (entity: string, cells: string[], fill: string): Tint[] =>
  cells.map(cell => ({ entity, cell, fill }));

const sorted = (list: Tint[]) =>
  [...list].sort((a, b) =>
    `${a.entity} ${a.cell}`.localeCompare(`${b.entity} ${b.cell}`)
  );

describe('ErdViewer - the tint a changed cell sits on', () => {
  it('tints what the saved document lost or changed, and nothing it kept', async () => {
    const { saved } = await mountPanes();
    const fill = theme.diffDeleteBackground;

    expect(tintsOf(saved)).toEqual(
      sorted([
        ...tints('table-p_users', ['tableComment'], fill),
        ...tints('column-p_id', ['columnNotNull'], fill),
        ...tints('column-p_nick', ['columnDataType'], fill),
        ...tints('column-p_legacy', rowCellsOf(saved, 'p_legacy'), fill),
      ])
    );
    expect(rowCellsOf(saved, 'p_legacy')).toContain('columnName');
  });

  it('tints what the current document added or changed, and nothing it kept', async () => {
    const { current } = await mountPanes();
    const fill = theme.diffInsertBackground;

    expect(tintsOf(current)).toEqual(
      sorted([
        ...tints('table-n_users', ['tableComment'], fill),
        ...tints('table-n_tags', ['tableName', 'tableComment'], fill),
        ...tints('column-n_id', ['columnNotNull'], fill),
        ...tints('column-n_nick', ['columnDataType'], fill),
        ...tints('column-n_email', rowCellsOf(current, 'n_email'), fill),
      ])
    );
  });

  it('lays the tint under the text across the padded cell, and takes no press', async () => {
    const { current } = await mountPanes();
    const header = current.findOne<Container>('#table-n_tags')!;
    const nameCell = header.findOne<Container>('.tableName')!;
    const row = current.findOne<Container>('#column-n_nick')!;
    const typeCell = row.findOne<Container>('.columnDataType')!;

    for (const [cell, height] of [
      [nameCell, TABLE_HEADER_INPUT_HEIGHT],
      [typeCell, COLUMN_HEIGHT],
    ] as const) {
      const tint = cell.getChildren()[0];
      const text = cell.findOne('.cell-text')!;

      expect(tint.name()).toBe('cell-diff-background');
      expect(tint.x()).toBe(0);
      expect(tint.y()).toBe(0);
      expect(tint.width()).toBe(text.width() + INPUT_MARGIN_RIGHT);
      expect(tint.height()).toBe(height);
      expect(tint.listening()).toBe(false);
    }
  });

  it('draws no tint in a pane whose map is empty', async () => {
    const stage = await mountPane(createApp(CURRENT), Diff.insert, new Map());

    expect(stage.find('.column-col').length).toBeGreaterThan(0);
    expect(stage.find('.cell-diff-background')).toHaveLength(0);
  });

  it('draws no tint on the ERD canvas, which no diff viewer provides a map to', async () => {
    const stage = await mountStage(
      html`<${Erd} isDarkMode=${false} mouseTracking=${false} />`,
      createApp(CURRENT)
    );

    expect(stage.find('.column-col').length).toBeGreaterThan(0);
    expect(stage.find('.cell-diff-background')).toHaveLength(0);
  });
});
