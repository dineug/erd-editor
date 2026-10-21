/** @jsxHost konva */

import { type DOMTemplateLiterals, type FC, useProvider } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import type { Group } from 'konva/lib/Group';
import type { Text } from 'konva/lib/shapes/Text';
import type { Stage } from 'konva/lib/Stage';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, createTestTheme, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import {
  dictionaryMarkFill,
  readableMarkFill,
} from '@/components/erd/canvas/table/dictionaryMarks';
import Table from '@/components/erd/canvas/table/Table';
import { diffContext } from '@/components/erd/diff-viewer/diffContext';
import { NameViewMode, Show } from '@/constants/schema';
import {
  addDictionaryAction,
  updateDictionaryAction,
} from '@/engine/modules/dictionary/atom.actions';
import { DictionaryCheckLevel } from '@/engine/modules/dictionary/checks';
import { FocusType } from '@/engine/modules/editor/state';
import {
  changeShowAction,
  toNameViewModeAction,
} from '@/engine/modules/settings/atom.actions';
import {
  addTableAction,
  changeTableGroupAction,
  changeTableLogicalNameAction,
  changeTableNameAction,
} from '@/engine/modules/table/atom.actions';
import {
  addColumnAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { renderScene } from '@/konva/scene/renderScene';
import type { Theme } from '@/themes/tokens';
import {
  CONTRAST_BLACK,
  CONTRAST_WHITE,
  contrastRatio,
  relativeLuminance,
} from '@/utils/contrastText';

type Mode = (typeof NameViewMode)[keyof typeof NameViewMode];

type SetupOptions = {
  mode?: Mode;
  /** Whether the document holds the words and the term the names are checked against. */
  dictionaries?: boolean;
  /** Draws the table inside a diff pane, which provides a diff map. */
  diffPane?: boolean;
  checkMarks?: boolean;
  /** Draws a second table of the same logical name beside the first. */
  twin?: boolean;
  /** The colour of a group the first table joins, whose header it then wears. */
  groupColor?: string;
};

type Fixture = {
  app: AppContext;
  stage: Stage;
  theme: Theme;
};

const TABLE = 't1';
const TWIN = 't2';
/** Matches the term, under a physical name other than the one it gives. */
const MISMATCHED = 'c1';
/** Uses a synonym and a word the sheet lacks. */
const UNREGISTERED = 'c2';
/** Uses one standard word, and nothing the checks find. */
const STANDARD = 'c3';
/** Matches the term with no physical name, so its name cell shows the placeholder. */
const BLANK = 'c4';

const teardowns: Array<() => void> = [];

afterEach(async () => {
  teardowns.splice(0).forEach(teardown => teardown());
  await whenDrawn();
});

/** A diff pane's scene: the provider is up before the table resolves it. */
const DiffScene: FC<{ children: DOMTemplateLiterals }> = (props, ctx) => {
  useProvider(ctx, diffContext, new Map());
  return () => props.children;
};

const settle = async () => {
  await flush();
  await whenDrawn();
};

const column = (id: string, name: string, logicalName: string) => [
  addColumnAction({ id, tableId: TABLE }),
  changeColumnNameAction({ tableId: TABLE, id, value: name }),
  changeColumnLogicalNameAction({ tableId: TABLE, id, value: logicalName }),
];

/**
 * A table whose logical name is a forbidden word, over four rows: one under a
 * physical name other than its term's, one using a synonym and a word the
 * sheet lacks, one of a standard word, one of the term with no name at all.
 */
async function setup({
  mode = NameViewMode.physical,
  dictionaries = true,
  diffPane = false,
  checkMarks,
  twin = false,
  groupColor,
}: SetupOptions = {}): Promise<Fixture> {
  const app = createTestAppContext();
  const { store } = app;

  store.dispatchSync(
    addTableAction({ id: TABLE, ui: { x: 40, y: 40, zIndex: 1 } }),
    changeTableNameAction({ id: TABLE, value: 'member' }),
    changeTableLogicalNameAction({ id: TABLE, value: 'Client' }),
    ...column(MISMATCHED, 'member_id', 'Member ID'),
    ...column(UNREGISTERED, 'cust_cd', 'Customer Code'),
    ...column(STANDARD, 'mbr', 'Member'),
    ...column(BLANK, '', 'Member ID'),
    // Only the names and the type are drawn.
    changeShowAction({ show: Show.columnNotNull, value: false }),
    changeShowAction({ show: Show.columnDefault, value: false }),
    changeShowAction({ show: Show.columnComment, value: false })
  );

  if (groupColor) {
    store.dispatchSync(
      addTableGroupAction({
        id: 'g1',
        color: groupColor,
        ui: { x: 0, y: 0, width: 100, height: 100, zIndex: 0 },
      }),
      changeTableGroupAction({ id: TABLE, value: 'g1' })
    );
  }

  if (twin) {
    store.dispatchSync(
      addTableAction({ id: TWIN, ui: { x: 440, y: 40, zIndex: 2 } }),
      changeTableNameAction({ id: TWIN, value: 'client' }),
      changeTableLogicalNameAction({ id: TWIN, value: 'Client' })
    );
  }

  if (dictionaries) {
    store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: {
          name: 'Member',
          abbreviation: 'MBR',
          synonyms: 'Customer',
          forbiddenWords: 'Client',
        },
      }),
      addDictionaryAction({
        kind: 'word',
        id: 'w2',
        values: { name: 'ID', abbreviation: 'ID' },
      }),
      addDictionaryAction({
        kind: 'term',
        id: 'term-1',
        values: { name: 'Member ID', physicalName: 'MBR_ID' },
      })
    );
  }

  store.dispatchSync(toNameViewModeAction(store.state, mode, false));

  const container = document.createElement('div');
  document.body.append(container);
  const theme = createTestTheme();
  const { tableEntities } = store.state.collections;
  const layer = (
    <k-layer name="scene">
      <Table table={tableEntities[TABLE]} checkMarks={checkMarks} />
      {twin ? <Table table={tableEntities[TWIN]} /> : null}
    </k-layer>
  );

  const rendered = renderScene({
    app,
    container,
    scene: diffPane ? <DiffScene>{layer}</DiffScene> : layer,
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

const tableOf = (stage: Stage, id = TABLE) =>
  stage.findOne<Group>(`#table-${id}`) as Group;

const textOf = (cell: Group) => cell.findOne<Text>('.cell-text') as Text;

const contrastOf = (text: string, fill: string) =>
  contrastRatio(relativeLuminance(text)!, relativeLuminance(fill)!);

const headerFill = (stage: Stage, focusType: FocusType, id = TABLE) =>
  textOf(tableOf(stage, id).findOne<Group>(`.${focusType}`) as Group).fill();

const rowFill = (stage: Stage, columnId: string, focusType: FocusType) =>
  textOf(
    stage
      .findOne<Group>(`#column-${columnId}`)
      ?.findOne<Group>(`.${focusType}`) as Group
  ).fill();

/** Every cell text the table draws, by fill. */
const fillsOf = (stage: Stage) =>
  tableOf(stage)
    .find<Text>('.cell-text')
    .map(text => text.fill());

describe('the check marks with empty dictionaries', () => {
  it.each([NameViewMode.physical, NameViewMode.logical, NameViewMode.both])(
    'writes no cell in a mark colour in the %s view',
    async mode => {
      const { stage, theme } = await setup({ mode, dictionaries: false });

      expect(new Set(fillsOf(stage))).toEqual(
        new Set([theme.active, theme.placeholder])
      );
    }
  );
});

describe('the check marks with filled dictionaries', () => {
  it('writes a physical name other than its term gives in the warning colour, in the physical view', async () => {
    const { stage, theme } = await setup();

    expect(headerFill(stage, FocusType.tableName)).toBe(theme.active);
    expect(rowFill(stage, MISMATCHED, FocusType.columnName)).toBe(
      theme.dictionaryWarningForeground
    );
    expect(rowFill(stage, UNREGISTERED, FocusType.columnName)).toBe(
      theme.active
    );
    expect(rowFill(stage, STANDARD, FocusType.columnName)).toBe(theme.active);
  });

  it('writes a forbidden word in the error colour, a synonym or a word the sheet lacks in the warning colour, in the logical view', async () => {
    const { stage, theme } = await setup({ mode: NameViewMode.logical });

    expect(headerFill(stage, FocusType.tableLogicalName)).toBe(
      theme.dictionaryErrorForeground
    );
    expect(rowFill(stage, MISMATCHED, FocusType.columnLogicalName)).toBe(
      theme.active
    );
    expect(rowFill(stage, UNREGISTERED, FocusType.columnLogicalName)).toBe(
      theme.dictionaryWarningForeground
    );
    expect(rowFill(stage, STANDARD, FocusType.columnLogicalName)).toBe(
      theme.active
    );
  });

  it('marks each name cell by what it draws in the view of both', async () => {
    const { stage, theme } = await setup({ mode: NameViewMode.both });

    expect(headerFill(stage, FocusType.tableLogicalName)).toBe(
      theme.dictionaryErrorForeground
    );
    expect(headerFill(stage, FocusType.tableName)).toBe(theme.active);
    expect(rowFill(stage, MISMATCHED, FocusType.columnLogicalName)).toBe(
      theme.active
    );
    expect(rowFill(stage, MISMATCHED, FocusType.columnName)).toBe(
      theme.dictionaryWarningForeground
    );
    expect(rowFill(stage, UNREGISTERED, FocusType.columnLogicalName)).toBe(
      theme.dictionaryWarningForeground
    );
    expect(rowFill(stage, UNREGISTERED, FocusType.columnName)).toBe(
      theme.active
    );
  });

  it('keeps a blank name cell in the placeholder colour, though its term gives another name', async () => {
    const { stage, theme } = await setup();

    expect(rowFill(stage, BLANK, FocusType.columnName)).toBe(theme.placeholder);
  });

  it('redraws the mark of every table once a word is changed in place', async () => {
    const { app, stage, theme } = await setup({
      mode: NameViewMode.logical,
      twin: true,
    });
    const logicalNameFills = () =>
      [TABLE, TWIN].map(id =>
        headerFill(stage, FocusType.tableLogicalName, id)
      );
    expect(logicalNameFills()).toEqual([
      theme.dictionaryErrorForeground,
      theme.dictionaryErrorForeground,
    ]);

    app.store.dispatchSync(
      updateDictionaryAction({
        kind: 'word',
        id: 'w1',
        values: { forbiddenWords: '' },
      })
    );
    await settle();

    // No longer forbidden, Client is now a word the sheet lacks.
    expect(logicalNameFills()).toEqual([
      theme.dictionaryWarningForeground,
      theme.dictionaryWarningForeground,
    ]);

    app.store.dispatchSync(
      addDictionaryAction({
        kind: 'word',
        id: 'w3',
        values: { name: 'Client', abbreviation: 'CLNT' },
      })
    );
    await settle();

    expect(logicalNameFills()).toEqual([theme.active, theme.active]);
  });

  it("writes a mark over a coloured group's header text while it reads there at 4.5:1", async () => {
    const { stage, theme } = await setup({
      mode: NameViewMode.both,
      groupColor: '#fef3c7',
    });

    expect(
      contrastOf(theme.dictionaryErrorForeground, '#fef3c7')
    ).toBeGreaterThanOrEqual(4.5);
    expect(headerFill(stage, FocusType.tableLogicalName)).toBe(
      theme.dictionaryErrorForeground
    );
    expect(headerFill(stage, FocusType.tableName)).toBe(CONTRAST_BLACK);
  });

  it("writes a name in the header's own black or white where its mark would read under 4.5:1 on the group's colour", async () => {
    const { stage, theme } = await setup({
      mode: NameViewMode.both,
      groupColor: '#1e3a8a',
    });

    expect(contrastOf(theme.dictionaryErrorForeground, '#1e3a8a')).toBeLessThan(
      4.5
    );
    expect(headerFill(stage, FocusType.tableLogicalName)).toBe(CONTRAST_WHITE);
    expect(headerFill(stage, FocusType.tableName)).toBe(CONTRAST_WHITE);
  });

  it('writes no mark in a diff pane, whose changes take colours a mark would share', async () => {
    const { stage, theme } = await setup({
      mode: NameViewMode.both,
      diffPane: true,
    });

    expect(fillsOf(stage)).not.toContain(theme.dictionaryErrorForeground);
    expect(fillsOf(stage)).not.toContain(theme.dictionaryWarningForeground);
  });

  it('writes no mark once the scene turns them off, as an export does', async () => {
    const { stage, theme } = await setup({
      mode: NameViewMode.both,
      checkMarks: false,
    });

    expect(fillsOf(stage)).not.toContain(theme.dictionaryErrorForeground);
    expect(fillsOf(stage)).not.toContain(theme.dictionaryWarningForeground);
  });
});

describe('readableMarkFill', () => {
  it('keeps a mark at 4.5:1 or more on the fill, and gives none under it or for none', () => {
    expect(readableMarkFill('#ffffff', '#000000')).toBe('#ffffff');
    expect(readableMarkFill('#ff0000', '#dc2626')).toBeNull();
    expect(readableMarkFill(null, '#000000')).toBeNull();
  });

  it('keeps a mark whose colour or fill it cannot read', () => {
    expect(readableMarkFill('#ff0000', 'transparent')).toBe('#ff0000');
    expect(readableMarkFill('currentColor', '#000000')).toBe('currentColor');
  });
});

describe('dictionaryMarkFill', () => {
  it('writes an error in the error colour, a warning in the warning colour, and nothing for none', () => {
    const theme = createTestTheme();

    expect(dictionaryMarkFill(theme, DictionaryCheckLevel.error)).toBe(
      theme.dictionaryErrorForeground
    );
    expect(dictionaryMarkFill(theme, DictionaryCheckLevel.warning)).toBe(
      theme.dictionaryWarningForeground
    );
    expect(dictionaryMarkFill(theme, null)).toBeNull();
  });
});
