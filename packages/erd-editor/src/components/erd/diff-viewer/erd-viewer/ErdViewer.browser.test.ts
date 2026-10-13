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
import { seedDiff } from '@/__test-utils__/diffSeed';
import { type AppContext, appContext } from '@/components/appContext';
import { Diff, type DiffMap } from '@/components/erd/diff-viewer/diff';
import ErdViewer from '@/components/erd/diff-viewer/erd-viewer/ErdViewer';
import Erd from '@/components/erd/Erd';
import { themeContext } from '@/components/themeContext';
import { ReferentialAction } from '@/constants/schema';
import { changeViewportAction } from '@/engine/modules/editor/atom.actions';
import { changeZoomLevelAction } from '@/engine/modules/settings/atom.actions';
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
import { diffDocuments } from '@/utils/diff';

const VIEWPORT = { width: 1200, height: 700 };

const theme = createTestTheme();

/** The 2 px a diff outline is drawn at, round the outside of the card. */
const DIFF_OUTLINE_WIDTH = 2;

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

type Mark = { entity: string; cell: string; fill: string };

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
  const { prev, next } = diffDocuments(prevApp.store.state, app.store.state);

  const saved = await mountPane(prevApp, Diff.delete, prev);
  const current = await mountPane(app, Diff.insert, next);

  return { saved, current, app };
}

/** The entity a scene node belongs to, read off the nearest table or column group. */
const entityOf = (node: KonvaNode) =>
  node
    .findAncestor((ancestor: KonvaNode) =>
      /^(table|column)-/.test(ancestor.id())
    )
    .id();

const DIFF_COLORS = () =>
  new Set([
    theme.diffInsertForeground,
    theme.diffDeleteForeground,
    theme.diffModifyForeground,
    theme.diffRenameForeground,
  ]);

/** Every cell whose text the stage draws in a diff colour, as the entity, the cell and the colour. */
const marksOf = (stage: Stage): Mark[] =>
  stage
    .find('.cell-text')
    .filter(node => DIFF_COLORS().has(node.getAttr('fill')))
    .map(node => ({
      entity: entityOf(node),
      cell: node.getParent()!.name().split(' ')[1],
      fill: node.getAttr('fill'),
    }))
    .sort((a, b) =>
      `${a.entity} ${a.cell}`.localeCompare(`${b.entity} ${b.cell}`)
    );

/** Every text cell a row draws, which is what a column added or removed colours. */
const rowCellsOf = (stage: Stage, columnId: string) =>
  stage
    .findOne<Container>(`#column-${columnId}`)!
    .find('.cell-text')
    .map(node => node.getParent()!.name().split(' ')[1]);

const marks = (entity: string, cells: string[], fill: string): Mark[] =>
  cells.map(cell => ({ entity, cell, fill }));

const sorted = (list: Mark[]) =>
  [...list].sort((a, b) =>
    `${a.entity} ${a.cell}`.localeCompare(`${b.entity} ${b.cell}`)
  );

/** Every outline the stage draws round an entity, as the node's name and its colour. */
const outlinesOf = (stage: Stage) =>
  stage
    .find('.table-diff-outline, .memo-diff-outline, .table-group-diff-outline')
    .map(node => ({
      name: node.name(),
      id: node.getParent()!.id(),
      stroke: node.getAttr('stroke'),
    }));

describe('ErdViewer - what a diff pane marks, in text colour and outlines (AC-D20)', () => {
  it('colours what the saved document lost or changed, and nothing it kept', async () => {
    const { saved } = await mountPanes();
    const changed = theme.diffModifyForeground;

    expect(marksOf(saved)).toEqual(
      sorted([
        ...marks('table-p_users', ['tableComment'], changed),
        ...marks('column-p_id', ['columnNotNull'], changed),
        ...marks('column-p_nick', ['columnDataType'], changed),
        ...marks(
          'column-p_legacy',
          rowCellsOf(saved, 'p_legacy'),
          theme.diffDeleteForeground
        ),
      ])
    );
    expect(rowCellsOf(saved, 'p_legacy')).toContain('columnName');
    expect(outlinesOf(saved)).toEqual([]);
  });

  it('colours what the current document added or changed, a new table outlined with its name alone coloured', async () => {
    const { current } = await mountPanes();
    const changed = theme.diffModifyForeground;
    const added = theme.diffInsertForeground;

    expect(marksOf(current)).toEqual(
      sorted([
        ...marks('table-n_users', ['tableComment'], changed),
        ...marks('table-n_tags', ['tableName'], added),
        ...marks('column-n_id', ['columnNotNull'], changed),
        ...marks('column-n_nick', ['columnDataType'], changed),
        ...marks('column-n_email', rowCellsOf(current, 'n_email'), added),
      ])
    );
    expect(outlinesOf(current)).toEqual([
      { name: 'table-diff-outline', id: 'table-n_tags', stroke: added },
    ]);
  });

  it('outlines round the card outside its border, taking no press, and fills no cell behind its text', async () => {
    const { current } = await mountPanes();
    const outline = current
      .findOne<Container>('#table-n_tags')!
      .findOne('.table-diff-outline')!;

    expect(outline.x()).toBe(-DIFF_OUTLINE_WIDTH / 2);
    expect(outline.getAttr('strokeWidth')).toBe(DIFF_OUTLINE_WIDTH);
    expect(outline.listening()).toBe(false);
    expect(current.find('.cell-diff-background')).toHaveLength(0);
  });

  it('marks a zoomed out table as it marks the full card', async () => {
    const { current, app } = await mountPanes();
    app.store.dispatchSync(changeZoomLevelAction({ value: 0.5 }));
    await settle();

    const tags = current.findOne<Container>('#table-n_tags')!;
    expect(tags.name()).toContain('high-level-table');
    expect(tags.findOne('.table-diff-outline')!.getAttr('stroke')).toBe(
      theme.diffInsertForeground
    );
    expect(tags.findOne('.high-level-table-name')!.getAttr('fill')).toBe(
      theme.diffInsertForeground
    );
  });

  it('colours a memo, a relationship and a group, and renames in their own colour', async () => {
    const tables = [
      { id: 'u', name: 'users', x: 40, columns: [{ id: 'u.id', name: 'id' }] },
      {
        id: 'o',
        name: 'orders',
        x: 400,
        columns: [{ id: 'o.u', name: 'user_id' }],
      },
    ];
    const prevApp = createTestAppContext();
    const app = createTestAppContext();
    for (const each of [prevApp, app]) {
      each.store.dispatchSync(changeViewportAction(VIEWPORT));
    }
    seedDiff(prevApp, {
      tables,
      relationships: [
        { id: 'fk', parent: ['u', ['u.id']], child: ['o', ['o.u']] },
      ],
      memos: [{ id: 'm', value: 'draft', x: 40, y: 400 }],
      groups: [{ id: 'g', name: 'Billing', x: 700, y: 400 }],
    });
    seedDiff(app, {
      tables,
      relationships: [
        {
          id: 'fk',
          parent: ['u', ['u.id']],
          child: ['o', ['o.u']],
          onDelete: ReferentialAction.cascade,
        },
      ],
      memos: [
        { id: 'm', value: 'final', x: 40, y: 400 },
        { id: 'n', value: 'new', x: 300, y: 400 },
      ],
      groups: [{ id: 'g', name: 'Payments', x: 700, y: 400 }],
    });
    const { next } = diffDocuments(prevApp.store.state, app.store.state);

    const stage = await mountPane(app, Diff.insert, next);

    expect(
      stage
        .findOne<Container>('#memo-m')!
        .findOne('.memo-textarea')!
        .getAttr('fill')
    ).toBe(theme.diffModifyForeground);
    expect(outlinesOf(stage)).toEqual([
      {
        name: 'memo-diff-outline',
        id: 'memo-n',
        stroke: theme.diffInsertForeground,
      },
    ]);
    expect(
      stage
        .findOne<Container>('#table-group-g')!
        .findOne('.table-group-name')!
        .getAttr('fill')
    ).toBe(theme.diffRenameForeground);
    expect(stage.findOne('.relationship-route')!.getAttr('stroke')).toBe(
      theme.diffModifyForeground
    );
  });

  it('marks nothing in a pane whose map is empty', async () => {
    const stage = await mountPane(createApp(CURRENT), Diff.insert, new Map());

    expect(stage.find('.column-col').length).toBeGreaterThan(0);
    expect(marksOf(stage)).toEqual([]);
    expect(outlinesOf(stage)).toEqual([]);
  });

  it('marks nothing on the ERD canvas, which no diff viewer provides a map to', async () => {
    const stage = await mountStage(
      html`<${Erd} isDarkMode=${false} mouseTracking=${false} />`,
      createApp(CURRENT)
    );

    expect(stage.find('.column-col').length).toBeGreaterThan(0);
    expect(marksOf(stage)).toEqual([]);
    expect(outlinesOf(stage)).toEqual([]);
  });
});
