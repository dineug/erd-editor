/** @jsxHost konva */

import { type DOMTemplateLiterals, type FC, useProvider } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import type { Rect } from 'konva/lib/shapes/Rect';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  createTestTheme,
  flush,
  stepTransitions,
} from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { diffContext } from '@/components/diffContext';
import {
  getColumnCellSlots,
  getHeaderCellSlots,
} from '@/components/erd/canvas/table/cellLayout';
import Table from '@/components/erd/canvas/table/Table';
import { sceneSourceContext } from '@/components/sceneSourceContext';
import { TABLE_BORDER } from '@/constants/layout';
import { NameViewMode, Show } from '@/constants/schema';
import {
  addDictionaryAction,
  removeDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import {
  editTableAction,
  editTableEndAction,
  focusColumnAction,
  focusTableAction,
  sharedFocusTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  FocusType,
  type SharedFocus,
  ShowMode,
  ViewKind,
} from '@/engine/modules/editor/state';
import {
  viewChangeShowModeAction,
  viewOpenAction,
  viewSetLayoutAction,
} from '@/engine/modules/editor/view.actions';
import {
  changeShowAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnDataTypeAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { Tag } from '@/engine/tag';
import { getTableRect, getTableWidths } from '@/konva/scene/metrics';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import { Diff, type DiffMap, type DiffPaths } from '@/utils/diff/diff';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';

type Mode = (typeof NameViewMode)[keyof typeof NameViewMode];

type SetupOptions = {
  mode?: Mode;
  /** The scene the table is drawn in, a Flow card's every row shown for 'flow'. */
  source?: GeometrySource;
  /** Whether a Flow card is lit, which is what draws its type and domain cells. */
  lit?: boolean;
  /** Whether the document holds a word, a term and a domain the first column links. */
  dictionaries?: boolean;
  show?: number;
  diff?: DiffMap;
  prepare?: (app: AppContext) => void;
};

type Fixture = {
  app: AppContext;
  stage: Stage;
  theme: Theme;
};

const TABLE = 't1';
const NAMED = 'c1';
const UNNAMED = 'c2';
const DOMAIN = 'd1';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

type DiffSceneProps = { diffMap: DiffMap; children: DOMTemplateLiterals };

/** A diff pane's scene: the provider is up before the table resolves it. */
const DiffScene: FC<DiffSceneProps> = (props, ctx) => {
  useProvider(ctx, diffContext, props.diffMap);
  return () => props.children;
};

type FlowSceneProps = { children: DOMTemplateLiterals };

/** A Flow view's scene, provided the same way before the table reads it. */
const FlowScene: FC<FlowSceneProps> = (props, ctx) => {
  useProvider(ctx, sceneSourceContext, ViewKind.flow);
  return () => props.children;
};

/** The ticker a lit card fades in on, wound by the cases that light one. */
const transitions = stepTransitions();

const settle = async () => {
  await flush();
  await whenDrawn();
};

/**
 * A table with a logical name over two rows: one with a logical name and an
 * integer type, one with neither name filled in but its physical one. The
 * rows show their names, their type and, under its bit, their domain.
 */
async function setup({
  mode = NameViewMode.physical,
  source = 'document',
  lit,
  dictionaries = false,
  show = 0,
  diff,
  prepare,
}: SetupOptions = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(
    addTableAction({ id: TABLE, ui: { x: 40, y: 40, zIndex: 1 } }),
    changeTableNameAction({ id: TABLE, value: 'member' }),
    changeTableLogicalNameAction({ id: TABLE, value: 'Member' }),
    addColumnAction({ id: NAMED, tableId: TABLE }),
    changeColumnNameAction({ tableId: TABLE, id: NAMED, value: 'member_id' }),
    changeColumnLogicalNameAction({
      tableId: TABLE,
      id: NAMED,
      value: 'Member ID',
    }),
    changeColumnDataTypeAction({ tableId: TABLE, id: NAMED, value: 'INT' }),
    addColumnAction({ id: UNNAMED, tableId: TABLE }),
    changeColumnNameAction({
      tableId: TABLE,
      id: UNNAMED,
      value: 'joined_at',
    }),
    changeColumnDataTypeAction({
      tableId: TABLE,
      id: UNNAMED,
      value: 'DATETIME',
    }),
    // Every row cell but the names, the type and the domain stays hidden.
    changeShowAction({ show: Show.columnNotNull, value: false }),
    changeShowAction({ show: Show.columnDefault, value: false }),
    changeShowAction({ show: Show.columnComment, value: false })
  );

  if (show) {
    store.dispatchSync(changeShowAction({ show, value: true }));
  }

  if (dictionaries) {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'domain',
        id: DOMAIN,
        values: { name: 'Identifier', dataType: 'INT' },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { name: 'Member', abbreviation: 'MBR' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 'term-1',
        values: {
          name: 'Member ID',
          physicalName: 'member_id',
          domainId: DOMAIN,
        },
      }),
      changeColumnDomainAction({ tableId: TABLE, id: NAMED, value: DOMAIN })
    );
  }

  store.dispatchSync(toNameViewModeAction(store.state, mode, false));
  // The view is open and placed but not stood in, so a document edit still
  // lands while its card draws: a view drops every edit it is stood in.
  if (source !== 'document') {
    store.dispatchSync(
      viewOpenAction({ kind: ViewKind.flow }),
      viewChangeShowModeAction({
        value: ShowMode.allFields,
        kind: ViewKind.flow,
      }),
      viewSetLayoutAction({
        kind: ViewKind.flow,
        positions: { [TABLE]: { x: 40, y: 40 } },
      })
    );
  }
  prepare?.(app);

  const container = document.createElement('div');
  document.body.append(container);
  const theme = createTestTheme();
  const table = store.state.collections.tableEntities[TABLE];
  const layer = (
    <k-layer name="scene">
      <Table table={table} lit={lit} />
    </k-layer>
  );

  const rendered = renderScene({
    app,
    container,
    scene: diff ? (
      <DiffScene diffMap={diff}>{layer}</DiffScene>
    ) : source === 'document' ? (
      layer
    ) : (
      <FlowScene>{layer}</FlowScene>
    ),
    width: 900,
    height: 700,
    theme,
  });

  teardowns.push(() => {
    rendered.destroy();
    container.remove();
  });

  await settle();

  return { app, stage: rendered.stage, theme };
}

const tableOf = (stage: Stage) => stage.findOne<Group>('.table') as Group;

const rowOf = (stage: Stage, columnId: string) =>
  stage.findOne<Group>(`#column-${columnId}`) as Group;

const textOf = (cell: Group) => cell.findOne<Text>('.cell-text') as Text;

/** The focus type a cell stands for, the second word of its name. */
const focusTypeOf = (cell: Group) => cell.name().split(' ')[1];

/** What a list of cells draws, in order: each one's focus type and text. */
const drawn = (cells: Group[]) =>
  cells.map(cell => [focusTypeOf(cell), textOf(cell).text()]);

const headerCellsOf = (stage: Stage) =>
  tableOf(stage).find<Group>('.input-padding');

/** A row's cells, leaving out the key, which draws no text. */
const rowCellsOf = (stage: Stage, columnId: string) =>
  rowOf(stage, columnId)
    .find<Group>('.column-col')
    .filter(cell => Boolean(cell.findOne('.cell-text')));

const headerCell = (stage: Stage, focusType: FocusType) =>
  tableOf(stage).findOne<Group>(`.${focusType}`) as Group;

const rowCell = (stage: Stage, columnId: string, focusType: FocusType) =>
  rowOf(stage, columnId).findOne<Group>(`.${focusType}`) as Group;

describe.each([
  ['with empty dictionaries', false, 'INT'],
  ['with filled dictionaries', true, 'Identifier'],
])('a table in each name view %s', (_label, dictionaries, typeCell) => {
  it('draws the names and the type where the physical view always did', async () => {
    const { stage } = await setup({ dictionaries });

    expect(drawn(headerCellsOf(stage))).toEqual([
      [FocusType.tableName, 'member'],
      [FocusType.tableComment, 'comment'],
    ]);
    expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
      [FocusType.columnName, 'member_id'],
      [FocusType.columnDataType, 'INT'],
    ]);
    expect(drawn(rowCellsOf(stage, UNNAMED))).toEqual([
      [FocusType.columnName, 'joined_at'],
      [FocusType.columnDataType, 'DATETIME'],
    ]);
  });

  it('draws each logical name in the place of its name, the name standing in for a blank one, and the domain in the type cell', async () => {
    const { stage } = await setup({
      dictionaries,
      mode: NameViewMode.logical,
    });

    expect(drawn(headerCellsOf(stage))).toEqual([
      [FocusType.tableLogicalName, 'Member'],
      [FocusType.tableComment, 'comment'],
    ]);
    expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
      [FocusType.columnLogicalName, 'Member ID'],
      [FocusType.columnDomain, typeCell],
    ]);
    expect(drawn(rowCellsOf(stage, UNNAMED))).toEqual([
      [FocusType.columnLogicalName, 'joined_at'],
      [FocusType.columnDomain, 'DATETIME'],
    ]);
  });

  it('sets the logical names before the names in the view of both, the type kept', async () => {
    const { stage } = await setup({ dictionaries, mode: NameViewMode.both });

    expect(drawn(headerCellsOf(stage))).toEqual([
      [FocusType.tableLogicalName, 'Member'],
      [FocusType.tableName, 'member'],
      [FocusType.tableComment, 'comment'],
    ]);
    expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
      [FocusType.columnLogicalName, 'Member ID'],
      [FocusType.columnName, 'member_id'],
      [FocusType.columnDataType, 'INT'],
    ]);
    expect(drawn(rowCellsOf(stage, UNNAMED))).toEqual([
      [FocusType.columnLogicalName, 'logical'],
      [FocusType.columnName, 'joined_at'],
      [FocusType.columnDataType, 'DATETIME'],
    ]);
  });

  it.each([NameViewMode.physical, NameViewMode.logical, NameViewMode.both])(
    'gives the domain a cell of its own under its bit in the %s view, its placeholder for a row linking none',
    async mode => {
      const { stage } = await setup({
        dictionaries,
        mode,
        show: Show.columnDomain,
      });
      const domainName = dictionaries ? 'Identifier' : 'domain';

      expect(drawn(rowCellsOf(stage, NAMED)).slice(-2)).toEqual([
        [FocusType.columnDataType, 'INT'],
        [FocusType.columnDomain, domainName],
      ]);
      expect(drawn(rowCellsOf(stage, UNNAMED)).slice(-2)).toEqual([
        [FocusType.columnDataType, 'DATETIME'],
        [FocusType.columnDomain, 'domain'],
      ]);
    }
  );

  it.each([NameViewMode.physical, NameViewMode.logical, NameViewMode.both])(
    'draws each cell of the %s view on the slot the layout gives it',
    async mode => {
      const { app, stage } = await setup({
        dictionaries,
        mode,
        show: Show.columnDomain,
      });
      const { state } = app.store;
      const table = state.collections.tableEntities[TABLE];
      const placed = (cells: Group[]) =>
        cells.map(cell => [focusTypeOf(cell), cell.x(), textOf(cell).width()]);

      expect(placed(headerCellsOf(stage))).toEqual(
        getHeaderCellSlots(state, table).map(slot => [
          slot.focusType,
          slot.x,
          slot.width,
        ])
      );
      expect(placed(rowCellsOf(stage, NAMED))).toEqual(
        getColumnCellSlots(state, getTableWidths(state, table)).map(slot => [
          slot.focusType,
          slot.x,
          slot.width,
        ])
      );
    }
  );
});

/** What a Flow card draws in each name view: the cells its view names, whatever the show bits say. */
describe.each([
  ['with empty dictionaries', false, 'INT', 'domain'],
  ['with filled dictionaries', true, 'Identifier', 'Identifier'],
])(
  'a Flow card in each name view %s',
  (_label, dictionaries, typeCell, domainCell) => {
    const flow = (mode: Mode, show: number = Show.columnDomain) =>
      setup({ dictionaries, mode, show, source: 'flow' });

    it('draws the physical name and the type, the header name alone, in the physical view', async () => {
      const { stage } = await flow(NameViewMode.physical);

      expect(drawn(headerCellsOf(stage))).toEqual([
        [FocusType.tableName, 'member'],
      ]);
      expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
        [FocusType.columnName, 'member_id'],
        [FocusType.columnDataType, 'INT'],
      ]);
    });

    it('draws the logical names and the domain in the type cell of the logical view, under the Domain bit too', async () => {
      const { stage, theme } = await flow(NameViewMode.logical);

      expect(drawn(headerCellsOf(stage))).toEqual([
        [FocusType.tableLogicalName, 'Member'],
      ]);
      expect(textOf(headerCell(stage, FocusType.tableLogicalName)).fill()).toBe(
        theme.foreground
      );
      expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
        [FocusType.columnLogicalName, 'Member ID'],
        [FocusType.columnDomain, typeCell],
      ]);
      expect(drawn(rowCellsOf(stage, UNNAMED))).toEqual([
        [FocusType.columnLogicalName, 'joined_at'],
        [FocusType.columnDomain, 'DATETIME'],
      ]);
    });

    it('draws the logical name and the name in the header of both, the name muted, and four cells a row', async () => {
      const { stage, theme } = await flow(NameViewMode.both, 0);

      expect(drawn(headerCellsOf(stage))).toEqual([
        [FocusType.tableLogicalName, 'Member'],
        [FocusType.tableName, 'member'],
      ]);
      expect(textOf(headerCell(stage, FocusType.tableLogicalName)).fill()).toBe(
        theme.foreground
      );
      expect(textOf(headerCell(stage, FocusType.tableName)).fill()).toBe(
        theme.placeholder
      );
      expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
        [FocusType.columnLogicalName, 'Member ID'],
        [FocusType.columnName, 'member_id'],
        [FocusType.columnDomain, domainCell],
        [FocusType.columnDataType, 'INT'],
      ]);
      expect(drawn(rowCellsOf(stage, UNNAMED))).toEqual([
        [FocusType.columnLogicalName, 'logical'],
        [FocusType.columnName, 'joined_at'],
        [FocusType.columnDomain, 'domain'],
        [FocusType.columnDataType, 'DATETIME'],
      ]);
    });

    it.each([NameViewMode.physical, NameViewMode.logical, NameViewMode.both])(
      'draws each cell of the %s view on its slot, in a card as wide as the box the scene measures',
      async mode => {
        const { app, stage } = await flow(mode);
        const { state } = app.store;
        const table = state.collections.tableEntities[TABLE];
        const placed = (cells: Group[]) =>
          cells.map(cell => [
            focusTypeOf(cell),
            cell.x(),
            textOf(cell).width(),
          ]);

        expect(placed(headerCellsOf(stage))).toEqual(
          getHeaderCellSlots(state, table, 'flow').map(slot => [
            slot.focusType,
            slot.x,
            slot.width,
          ])
        );
        expect(placed(rowCellsOf(stage, NAMED))).toEqual(
          getColumnCellSlots(
            state,
            getTableWidths(state, table, 'flow'),
            'flow'
          ).map(slot => [slot.focusType, slot.x, slot.width])
        );
        expect(tableOf(stage).findOne<Rect>('.table-body')!.width()).toBe(
          getTableRect(state, table, 'flow').width - TABLE_BORDER
        );
      }
    );
  }
);

describe('a Flow card', () => {
  it('stands the name in, dimmed, for a blank logical name of the logical view', async () => {
    const { app, stage, theme } = await setup({
      mode: NameViewMode.logical,
      source: 'flow',
    });

    const row = textOf(rowCell(stage, UNNAMED, FocusType.columnLogicalName));
    expect([row.text(), row.fill()]).toEqual(['joined_at', theme.placeholder]);

    app.store.dispatchSync(
      changeTableLogicalNameAction({ id: TABLE, value: '  ' })
    );
    await settle();

    const header = textOf(headerCell(stage, FocusType.tableLogicalName));
    expect([header.text(), header.fill()]).toEqual([
      'member',
      theme.placeholder,
    ]);
  });

  it('draws the domain cell of the view of both with the type cell it stands beside, lit or not', async () => {
    const dark = await setup({
      mode: NameViewMode.both,
      source: 'flow',
      dictionaries: true,
    });
    const opacities = (stage: Stage) =>
      [FocusType.columnDomain, FocusType.columnDataType].map(focusType =>
        rowCell(stage, NAMED, focusType).opacity()
      );

    expect(opacities(dark.stage)).toEqual([1, 1]);

    const lit = await setup({
      mode: NameViewMode.both,
      source: 'flow',
      dictionaries: true,
      lit: true,
    });
    transitions.settle();
    await settle();

    expect(opacities(lit.stage)).toEqual([1, 1]);
  });

  it('draws the cells of the view switched to while it is drawn, at the width the switch gives', async () => {
    const { app, stage } = await setup({ dictionaries: true, source: 'flow' });
    const table = app.store.state.collections.tableEntities[TABLE];
    const bodyWidth = () =>
      tableOf(stage).findOne<Rect>('.table-body')!.width();
    const physical = bodyWidth();

    app.store.dispatchSync(
      toNameViewModeAction(app.store.state, NameViewMode.both, false)
    );
    await settle();

    expect(drawn(headerCellsOf(stage))).toEqual([
      [FocusType.tableLogicalName, 'Member'],
      [FocusType.tableName, 'member'],
    ]);
    expect(drawn(rowCellsOf(stage, NAMED)).map(([type]) => type)).toEqual([
      FocusType.columnLogicalName,
      FocusType.columnName,
      FocusType.columnDomain,
      FocusType.columnDataType,
    ]);
    expect(bodyWidth()).toBe(
      getTableRect(app.store.state, table, 'flow').width - TABLE_BORDER
    );
    expect(bodyWidth()).toBeGreaterThan(physical);

    app.store.dispatchSync(
      toNameViewModeAction(app.store.state, NameViewMode.logical, false)
    );
    await settle();

    expect(drawn(rowCellsOf(stage, NAMED))).toEqual([
      [FocusType.columnLogicalName, 'Member ID'],
      [FocusType.columnDomain, 'Identifier'],
    ]);
    expect(bodyWidth()).toBe(
      getTableRect(app.store.state, table, 'flow').width - TABLE_BORDER
    );
  });
});

describe('a blank logical name', () => {
  it('stands the name in, dimmed, in the logical view, and the placeholder where the name is blank too', async () => {
    const { app, stage, theme } = await setup({ mode: NameViewMode.logical });

    expect(textOf(headerCell(stage, FocusType.tableLogicalName)).fill()).toBe(
      theme.active
    );
    expect(
      textOf(rowCell(stage, NAMED, FocusType.columnLogicalName)).fill()
    ).toBe(theme.active);
    expect(
      textOf(rowCell(stage, UNNAMED, FocusType.columnLogicalName)).fill()
    ).toBe(theme.placeholder);

    // A logical name of blanks is no logical name.
    app.store.dispatchSync(
      changeTableLogicalNameAction({ id: TABLE, value: '  ' })
    );
    await settle();

    const header = textOf(headerCell(stage, FocusType.tableLogicalName));
    expect([header.text(), header.fill()]).toEqual([
      'member',
      theme.placeholder,
    ]);

    app.store.dispatchSync(
      changeTableNameAction({ id: TABLE, value: '' }),
      changeColumnNameAction({ tableId: TABLE, id: UNNAMED, value: '' })
    );
    await settle();

    expect(textOf(headerCell(stage, FocusType.tableLogicalName)).text()).toBe(
      'table'
    );
    expect(
      textOf(rowCell(stage, UNNAMED, FocusType.columnLogicalName)).text()
    ).toBe('column');
  });

  it('shows the logical name placeholder, dimmed, in the view of both', async () => {
    const { app, stage, theme } = await setup({ mode: NameViewMode.both });

    app.store.dispatchSync(
      changeTableLogicalNameAction({ id: TABLE, value: '' })
    );
    await settle();

    const header = textOf(headerCell(stage, FocusType.tableLogicalName));
    const row = textOf(rowCell(stage, UNNAMED, FocusType.columnLogicalName));

    expect([header.text(), header.fill()]).toEqual([
      'logical',
      theme.placeholder,
    ]);
    expect([row.text(), row.fill()]).toEqual(['logical', theme.placeholder]);
    expect(textOf(headerCell(stage, FocusType.tableName)).fill()).toBe(
      theme.active
    );
  });
});

describe('the domain the type cell of the logical view draws', () => {
  it('follows a rename of the domain and falls back to the type once it is removed', async () => {
    const { app, stage } = await setup({
      dictionaries: true,
      mode: NameViewMode.logical,
    });
    const typeText = () =>
      textOf(rowCell(stage, NAMED, FocusType.columnDomain)).text();

    expect(typeText()).toBe('Identifier');

    app.store.dispatchSync(
      updateDictionaryAction({
        kind: 'domain',
        id: DOMAIN,
        values: { name: 'Key' },
      })
    );
    await settle();
    expect(typeText()).toBe('Key');

    app.store.dispatchSync(
      removeDictionaryAction({ kind: 'domain', id: DOMAIN })
    );
    await settle();
    expect(typeText()).toBe('INT');
  });
});

describe('the marks on the cells a name view adds', () => {
  const focusBorderOf = (cell: Group) =>
    cell.findOne<Rect>('.cell-focus-border');

  it('underlines the logical name cell a focus lands on and hands its text to the editor', async () => {
    const { app, stage, theme } = await setup({ mode: NameViewMode.logical });
    const { store } = app;

    store.dispatchSync(
      focusTableAction({ tableId: TABLE, focusType: FocusType.tableName })
    );
    await settle();

    const header = headerCell(stage, FocusType.tableLogicalName);
    expect(focusBorderOf(header)?.fill()).toBe(theme.focus);

    store.dispatchSync(editTableAction());
    await settle();
    expect(
      textOf(headerCell(stage, FocusType.tableLogicalName)).visible()
    ).toBe(false);

    store.dispatchSync(
      focusColumnAction({
        tableId: TABLE,
        columnId: NAMED,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      }),
      editTableAction()
    );
    await settle();

    const name = rowCell(stage, NAMED, FocusType.columnLogicalName);
    expect(focusBorderOf(name)?.fill()).toBe(theme.inputActive);
    expect(textOf(name).visible()).toBe(false);
  });

  it('hands the text of the type cell standing for the domain to the picker a focus put in edit opens', async () => {
    const { app, stage, theme } = await setup({
      dictionaries: true,
      mode: NameViewMode.logical,
    });

    app.store.dispatchSync(
      focusColumnAction({
        tableId: TABLE,
        columnId: NAMED,
        focusType: FocusType.columnDataType,
        $mod: false,
        shiftKey: false,
      }),
      editTableAction()
    );
    await settle();

    const type = rowCell(stage, NAMED, FocusType.columnDomain);
    expect(focusBorderOf(type)?.fill()).toBe(theme.inputActive);
    expect(textOf(type).visible()).toBe(false);
  });

  it('marks the logical name and domain cells of the view of both on their own focus', async () => {
    const { app, stage, theme } = await setup({
      mode: NameViewMode.both,
      show: Show.columnDomain,
    });
    const { store } = app;

    store.dispatchSync(
      focusColumnAction({
        tableId: TABLE,
        columnId: NAMED,
        focusType: FocusType.columnLogicalName,
        $mod: false,
        shiftKey: false,
      }),
      editTableAction()
    );
    await settle();

    const logical = rowCell(stage, NAMED, FocusType.columnLogicalName);
    expect(focusBorderOf(logical)?.fill()).toBe(theme.inputActive);
    expect(textOf(logical).visible()).toBe(false);
    expect(
      focusBorderOf(rowCell(stage, NAMED, FocusType.columnName))
    ).toBeUndefined();

    store.dispatchSync(
      focusColumnAction({
        tableId: TABLE,
        columnId: NAMED,
        focusType: FocusType.columnDomain,
        $mod: false,
        shiftKey: false,
      })
    );
    await settle();

    const domain = rowCell(stage, NAMED, FocusType.columnDomain);
    expect(focusBorderOf(domain)?.fill()).toBe(theme.inputActive);
    expect(textOf(domain).visible()).toBe(false);

    store.dispatchSync(editTableEndAction());
    await settle();

    expect(
      focusBorderOf(rowCell(stage, NAMED, FocusType.columnDomain))?.fill()
    ).toBe(theme.focus);
    expect(
      focusBorderOf(rowCell(stage, NAMED, FocusType.columnLogicalName))
    ).toBeUndefined();
  });

  it('underlines the cells a peer is focused on in the peer colour', async () => {
    const { app, stage } = await setup({
      mode: NameViewMode.both,
      show: Show.columnDomain,
    });
    const peerFocusOf = (cell: Group) =>
      cell.findOne<Rect>('.cell-shared-focus-border')?.fill() ?? null;
    const track = (focus: SharedFocus) => {
      app.store.dispatchSync({
        ...sharedFocusTrackerAction({ focus }),
        tags: Tag.shared,
        meta: { editorId: 'remote-1' },
      });
    };

    track({
      tableId: TABLE,
      columnId: null,
      focusType: FocusType.tableLogicalName,
    });
    await settle();
    const color = peerFocusOf(headerCell(stage, FocusType.tableLogicalName));
    expect(color).not.toBeNull();

    track({
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnLogicalName,
    });
    await settle();
    expect(
      peerFocusOf(rowCell(stage, NAMED, FocusType.columnLogicalName))
    ).toBe(color);

    track({
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnDomain,
    });
    await settle();
    expect(peerFocusOf(rowCell(stage, NAMED, FocusType.columnDomain))).toBe(
      color
    );
  });
});

describe("a peer's focus from another name view", () => {
  const peerFocusOf = (cell: Group | undefined) =>
    cell?.findOne<Rect>('.cell-shared-focus-border')?.fill() ?? null;
  const track = (app: AppContext, focus: SharedFocus) => {
    app.store.dispatchSync({
      ...sharedFocusTrackerAction({ focus }),
      tags: Tag.shared,
      meta: { editorId: 'remote-1' },
    });
  };

  it("underlines in the logical view the cells drawn in the place of a physical peer's", async () => {
    const { app, stage } = await setup({ mode: NameViewMode.logical });

    track(app, {
      tableId: TABLE,
      columnId: null,
      focusType: FocusType.tableName,
    });
    await settle();
    const color = peerFocusOf(headerCell(stage, FocusType.tableLogicalName));
    expect(color).not.toBeNull();

    track(app, {
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnName,
    });
    await settle();
    expect(
      peerFocusOf(rowCell(stage, NAMED, FocusType.columnLogicalName))
    ).toBe(color);

    track(app, {
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnDataType,
    });
    await settle();
    expect(peerFocusOf(rowCell(stage, NAMED, FocusType.columnDomain))).toBe(
      color
    );
  });

  it("underlines in the physical view the cells drawn in the place of a logical peer's", async () => {
    const { app, stage } = await setup();

    track(app, {
      tableId: TABLE,
      columnId: null,
      focusType: FocusType.tableLogicalName,
    });
    await settle();
    const color = peerFocusOf(headerCell(stage, FocusType.tableName));
    expect(color).not.toBeNull();

    track(app, {
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnLogicalName,
    });
    await settle();
    expect(peerFocusOf(rowCell(stage, NAMED, FocusType.columnName))).toBe(
      color
    );

    track(app, {
      tableId: TABLE,
      columnId: NAMED,
      focusType: FocusType.columnDomain,
    });
    await settle();
    expect(peerFocusOf(rowCell(stage, NAMED, FocusType.columnDataType))).toBe(
      color
    );
  });
});

describe('a diff pane in the logical view', () => {
  it('marks a rename and a hidden comment change on the logical name the header draws', async () => {
    const renamed = await setup({
      mode: NameViewMode.logical,
      diff: new Map([[TABLE, new Map([[FocusType.tableName, Diff.rename]])]]),
    });
    expect(
      textOf(headerCell(renamed.stage, FocusType.tableLogicalName)).fill()
    ).toBe(renamed.theme.diffRenameForeground);

    const commented = await setup({
      mode: NameViewMode.logical,
      diff: new Map([
        [TABLE, new Map([[FocusType.tableComment, Diff.modify]])],
      ]),
      prepare: app => {
        app.store.dispatchSync(
          changeShowAction({ show: Show.tableComment, value: false })
        );
      },
    });
    expect(
      textOf(headerCell(commented.stage, FocusType.tableLogicalName)).fill()
    ).toBe(commented.theme.diffModifyForeground);
  });

  it('marks a type change on the type cell and a rename on the logical name the row draws', async () => {
    const { stage, theme } = await setup({
      mode: NameViewMode.logical,
      diff: new Map<string, DiffPaths>([
        [NAMED, new Map([[FocusType.columnDataType, Diff.modify]])],
        [UNNAMED, new Map([[FocusType.columnName, Diff.rename]])],
      ]),
    });

    expect(textOf(rowCell(stage, NAMED, FocusType.columnDomain)).fill()).toBe(
      theme.diffModifyForeground
    );
    expect(
      textOf(rowCell(stage, NAMED, FocusType.columnLogicalName)).fill()
    ).toBe(theme.active);
    expect(
      textOf(rowCell(stage, UNNAMED, FocusType.columnLogicalName)).fill()
    ).toBe(theme.diffRenameForeground);
  });
});
