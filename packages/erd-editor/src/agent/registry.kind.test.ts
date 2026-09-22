// @vitest-environment node

import { type CompositionAction, compositionActionsFlat } from '@dineug/r-html';
import { afterAll, describe, expect, it } from 'vite-plus/test';

import { createSeedValue, SEED } from '@/__test-utils__/agentSeed';
import { createAgentPeer } from '@/agent/peer';
import { actionTools, toolByName } from '@/agent/registry';
import { RelationshipType } from '@/constants/schema';
import { ChangeActionTypes } from '@/engine/actions';
import { createEngineContext } from '@/engine/context';
import { actions$ as editorActions$ } from '@/engine/modules/editor/generator.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { actions$ as indexActions$ } from '@/engine/modules/index/generator.actions';
import { actions$ as indexColumnActions$ } from '@/engine/modules/index-column/generator.actions';
import { actions$ as memoActions$ } from '@/engine/modules/memo/generator.actions';
import { actions$ as relationshipActions$ } from '@/engine/modules/relationship/generator.actions';
import { actions$ as settingsActions$ } from '@/engine/modules/settings/generator.actions';
import { actions$ as tableActions$ } from '@/engine/modules/table/generator.actions';
import { actions$ as tableColumnActions$ } from '@/engine/modules/table-column/generator.actions';
import { defaultToWidth } from '@/engine/to-width';

const peer = createAgentPeer({ nickname: 'agent', presence: false });
peer.setInitialValue(createSeedValue());
const context = createEngineContext({ toWidth: defaultToWidth });

afterAll(() => peer.destroy());

type Census = Record<string, () => CompositionAction[]>;

/** The modules whose change types the tools emit, each with its generators. */
const MODULES = [
  tableActions$,
  tableColumnActions$,
  relationshipActions$,
  indexActions$,
  indexColumnActions$,
  memoActions$,
  settingsActions$,
];

/**
 * Every generator of the modules above, with arguments that walk each of its
 * branches on the seed. The spec below insists the list is complete, so a new
 * generator must be entered here.
 */
const CENSUS: Census = {
  addTableAction$: () => [tableActions$.addTableAction$()],
  removeTableAction$: () => [tableActions$.removeTableAction$(SEED.orders)],
  selectTableAction$: () => [
    tableActions$.selectTableAction$(SEED.orders, false),
    tableActions$.selectTableAction$(SEED.empty, false),
  ],
  pasteTableAction$: () => [
    tableActions$.pasteTableAction$([
      peer.state.collections.tableColumnEntities[SEED.userName],
    ]),
  ],
  sortTablesToMoveAction$: () => [tableActions$.sortTablesToMoveAction$()],
  addColumnAction$: () => [tableColumnActions$.addColumnAction$(SEED.empty)],
  removeColumnAction$: () => [
    tableColumnActions$.removeColumnAction$(SEED.orders, [
      SEED.orderUser,
      SEED.orderNote,
    ]),
  ],
  toggleColumnValueAction$: () =>
    [
      FocusType.columnNotNull,
      FocusType.columnUnique,
      FocusType.columnAutoIncrement,
    ].map(focusType =>
      tableColumnActions$.toggleColumnValueAction$(
        focusType,
        SEED.users,
        SEED.userName
      )
    ),
  changeColumnDataTypeAction$: () => [
    tableColumnActions$.changeColumnDataTypeAction$({
      tableId: SEED.users,
      id: SEED.userName,
      value: 'TEXT',
    }),
  ],
  changeColumnValueAction$: () =>
    [
      FocusType.columnName,
      FocusType.columnDataType,
      FocusType.columnDefault,
      FocusType.columnComment,
    ].map(focusType =>
      tableColumnActions$.changeColumnValueAction$(
        focusType,
        SEED.users,
        SEED.userName,
        'x'
      )
    ),
  changeColumnPrimaryKeyAction$: () => [
    tableColumnActions$.changeColumnPrimaryKeyAction$(
      SEED.users,
      SEED.userName
    ),
  ],
  addRelationshipAction$: () =>
    [
      [SEED.users, SEED.orders],
      [SEED.empty, SEED.users],
      ['gone', SEED.users],
    ].map(([start, end]) =>
      relationshipActions$.addRelationshipAction$(
        start,
        end,
        RelationshipType.OneN
      )
    ),
  addIndexAction$: () => [indexActions$.addIndexAction$(SEED.users)],
  changeIndexUniqueAction$: () =>
    [SEED.index, 'gone'].map(indexActions$.changeIndexUniqueAction$),
  addIndexColumnAction$: () =>
    [SEED.orderId, SEED.orderNote].map(columnId =>
      indexColumnActions$.addIndexColumnAction$(SEED.index, columnId)
    ),
  removeIndexColumnAction$: () => [
    indexColumnActions$.removeIndexColumnAction$(SEED.index, SEED.orderNote),
  ],
  changeIndexColumnOrderTypeAction$: () => [
    indexColumnActions$.changeIndexColumnOrderTypeAction$(SEED.indexColumn),
  ],
  moveIndexColumnAction$: () => [
    indexColumnActions$.moveIndexColumnAction$(
      SEED.userIndexColumn,
      SEED.indexColumn
    ),
  ],
  addMemoAction$: () => [memoActions$.addMemoAction$()],
  removeMemoAction$: () => [
    memoActions$.removeMemoAction$(SEED.memo),
    memoActions$.removeMemoAction$(),
  ],
  selectMemoAction$: () => [memoActions$.selectMemoAction$(SEED.memo, false)],
  changeZoomLevelAction$: () => [settingsActions$.changeZoomLevelAction$(0.5)],
  streamZoomLevelAction$: () => [settingsActions$.streamZoomLevelAction$(0.1)],
};

/**
 * Why no generator of the editor module is an alternative to an atom tool:
 * it is wrapped by a tool, or it acts on the selection, the clipboard, a
 * pointer or a view instead of the entity an agent names.
 */
const EDITOR_GENERATORS: Record<string, string> = {
  loadJsonAction$: 'wrapped by erd_import_json',
  initialLoadJsonAction$:
    'the load a peer reseeds with, which makes no change to replicate',
  moveAllAction$:
    'drags the selection by a pointer step; erd_move_table and erd_move_memo place one',
  removeSelectedAction$:
    'removes the selection; erd_remove_table and erd_remove_memo name theirs',
  pasteEntitiesAction$: 'pastes what the clipboard holds',
  duplicateAction$: 'duplicates the selection',
  dragSelectAction$: 'selects what a drag box covers',
  unselectAllAction$: 'clears the selection',
  focusMoveTableAction$: 'moves the focus by a key',
  drawStartRelationshipAction$:
    'starts a pointer draw; erd_add_relationship relates two named tables',
  drawStartAddRelationshipAction$:
    'starts a pointer draw from a table; erd_add_relationship relates two named tables',
  changeColorAllAction$:
    'colors the selection; erd_change_table_color and erd_change_memo_color color one',
  loadSchemaSQLAction$: 'wrapped by erd_import_sql',
  loadSchemaGraphQLAction$: 'wrapped by erd_import_graphql',
  loadSchemaDBMLAction$: 'wrapped by erd_import_dbml',
  loadSchemaAMLAction$: 'wrapped by erd_import_aml',
  dragstartColumnAction$: 'starts a column drag',
  dragoverColumnAction$:
    'moves the dragged columns under a pointer; erd_move_column names the target',
  columnKeyHoverStartAction$: 'highlights the keys a pointer hovers',
  columnKeyHoverEndAction$: 'ends the key highlight',
  focusFlowTableAction$: 'opens the flow view on tables',
};

/**
 * The state a relationship draw leaves between its two clicks, which is the
 * only state in which selectTableAction$ writes columns and keys.
 */
function drawingState(startTableId: string | null) {
  return {
    ...peer.state,
    editor: {
      ...peer.state.editor,
      selectedMap: { [SEED.users]: SelectType.table },
      drawRelationship: {
        relationshipType: 1,
        start: startTableId ? { tableId: startTableId, x: 0, y: 0 } : null,
        end: { x: 0, y: 0 },
      },
    },
  };
}

/** The change types a generator emits over the states that open its branches. */
function emittedBy(name: string): Set<string> {
  const types = new Set<string>();
  const states = [
    peer.state,
    drawingState(SEED.users),
    drawingState(SEED.empty),
    drawingState(null),
  ];

  for (const state of states) {
    for (const action of compositionActionsFlat(
      state,
      context,
      CENSUS[name]()
    )) {
      if (ChangeActionTypes.includes(action.type as never)) {
        types.add(action.type);
      }
    }
  }

  return types;
}

describe('generator or atom (AC-E4)', () => {
  it('gives every atom tool a reason, and no generator tool one', () => {
    for (const tool of actionTools) {
      if (tool.kind === 'atom') {
        expect(tool.atomReason?.trim().length, tool.name).toBeGreaterThan(20);
      } else {
        expect(tool.atomReason, tool.name).toBeUndefined();
      }
    }
  });

  it('holds a census of every generator the modules export', () => {
    expect(Object.keys(CENSUS).sort()).toEqual(
      MODULES.flatMap(actions$ => Object.keys(actions$)).sort()
    );
  });

  it('accounts for every editor generator, naming only tools that exist', () => {
    expect(Object.keys(EDITOR_GENERATORS).sort()).toEqual(
      Object.keys(editorActions$).sort()
    );
    for (const reason of Object.values(EDITOR_GENERATORS)) {
      for (const [name] of reason.matchAll(/erd_[a-z_]+/g)) {
        expect(toolByName.has(name), name).toBe(true);
      }
    }
  });

  it('keeps each import tool on the editor generator it is said to wrap', () => {
    const wrapped = Object.entries(EDITOR_GENERATORS).filter(([, reason]) =>
      reason.startsWith('wrapped by')
    );

    expect(wrapped).toHaveLength(5);
    for (const [name, reason] of wrapped) {
      const tool = toolByName.get(reason.replace('wrapped by ', ''))!;
      const generator = editorActions$[name as keyof typeof editorActions$];
      // An empty object is a document, and a schema text that yields no table.
      const emit = (actions: CompositionAction[]) =>
        compositionActionsFlat(peer.state, context, actions);

      expect(tool.kind, name).toBe('generator');
      expect(emit([...tool.toActions({ value: '{}' })]), name).toEqual(
        emit([(generator as (value: string) => CompositionAction)('{}')])
      );
    }
  });

  it('names, in the atom tool’s reason, every generator that emits its type', () => {
    const declined: string[] = [];

    for (const tool of actionTools.filter(({ kind }) => kind === 'atom')) {
      for (const name of Object.keys(CENSUS)) {
        const overlaps = tool.actionTypes.some(type =>
          emittedBy(name).has(type)
        );
        if (overlaps && !tool.atomReason?.includes(name)) {
          declined.push(`${tool.name} ignores ${name}`);
        }
      }
    }

    expect(declined).toEqual([]);
  });

  it('finds the toggles the flag tools decline in the census', () => {
    expect([...emittedBy('changeColumnPrimaryKeyAction$')]).toEqual([
      'column.changePrimaryKey',
    ]);
    expect(emittedBy('toggleColumnValueAction$')).toEqual(
      new Set([
        'column.changeNotNull',
        'column.changeUnique',
        'column.changeAutoIncrement',
      ])
    );
    expect(emittedBy('selectTableAction$').has('column.changePrimaryKey')).toBe(
      true
    );
  });
});
