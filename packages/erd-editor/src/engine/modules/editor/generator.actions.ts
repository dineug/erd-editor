import {
  type ERDEditorSchemaV3,
  parser,
  query,
} from '@dineug/erd-editor-schema';
import { uuid25 } from '@dineug/uuid';
import { cloneDeep, isEqual, omit, uniq } from 'es-toolkit';
import { isEmpty, round } from 'es-toolkit/compat';

import { APPEND_GAP, START_ADD, TABLE_SORT_START } from '@/constants/layout';
import { ColumnOption } from '@/constants/schema';
import type { EngineContext } from '@/engine/context';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  changeMemoColorAction,
  moveMemoAction,
} from '@/engine/modules/memo/atom.actions';
import { removeMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { ActionType as TableActionType } from '@/engine/modules/table/actions';
import {
  changeTableColorAction,
  sortTableAction,
  tableReducers,
} from '@/engine/modules/table/atom.actions';
import { removeTableAction$ } from '@/engine/modules/table/generator.actions';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnNameAction,
  changeColumnNotNullAction,
  changeColumnPrimaryKeyAction,
  changeColumnUniqueAction,
  moveColumnAction,
} from '@/engine/modules/table-column/atom.actions';
import {
  addColumnAction$,
  removeColumnAction$,
} from '@/engine/modules/table-column/generator.actions';
import { changeTableGroupColorAction } from '@/engine/modules/table-group/atom.actions';
import {
  removeTableGroupAction$,
  toMoveTableGroupActions,
} from '@/engine/modules/table-group/generator.actions';
import { RootState } from '@/engine/state';
import { attachActionTag, Tag } from '@/engine/tag';
import { Point } from '@/internal-types';
import {
  getContentRect,
  type TableMove,
  unionRect,
} from '@/konva/scene/contentBounds';
import { getMemoRect, getTableRect, type Rect } from '@/konva/scene/metrics';
import { getVisibleIds } from '@/konva/scene/viewLayout';
import { getSceneTransform } from '@/konva/scene/viewport';
import { nextZIndex } from '@/utils';
import { bHas } from '@/utils/bit';
import { calcMemoHeight, calcMemoWidth } from '@/utils/calcMemo';
import { measureTableSize } from '@/utils/calcTable';
import { isOverlapPosition, Rect as DragRect } from '@/utils/dragSelect';
import type { GeometrySource } from '@/utils/draw-relationship/geometrySource';
import { schemaAMLParserToSchemaJson } from '@/utils/schema-aml-parser';
import { schemaDBMLParserToSchemaJson } from '@/utils/schema-dbml-parser';
import { schemaGraphQLParserToSchemaJson } from '@/utils/schema-graphql-parser';
import { schemaSQLParserToSchemaJson } from '@/utils/schema-sql-parser';
import {
  ClipboardMemo,
  ClipboardPayload,
  ClipboardTable,
  PlacementEntity,
  PlacementPoint,
  resolvePlacement,
} from '@/utils/table-clipboard';
import {
  toClipboardIndexes,
  toClipboardRelationships,
} from '@/utils/table-clipboard/copy';
import { nextTableGroupZIndex, padRect } from '@/utils/tableGroup';

import {
  clearAction,
  dragstartColumnAction,
  drawEndRelationshipAction,
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  focusColumnAction,
  focusMoveTableAction,
  focusTableEndAction,
  hoverColumnMapAction,
  hoverRelationshipMapAction,
  initialClearAction,
  initialLoadJsonAction,
  loadJsonAction,
  selectAction,
  unselectAllAction,
} from './atom.actions';
import { FocusType, MoveKey, SelectType } from './state';
import { getColoredSelection, getColorTargets } from './utils/color';
import {
  CreateEntityActions,
  CreateEntityInput,
  CreateEntityTableGroup,
  toCreateEntityActions,
} from './utils/duplicate';
import { findRelationshipColumn } from './utils/findRelationshipColumn';
import {
  isColumns,
  isLastColumn,
  isLastRowColumn,
  isLastTable,
  isTableFocusType,
} from './utils/focus';
import { getSelectTypeIds, SelectTypeIds } from './utils/selection';
import { viewMoveTableAction } from './view.actions';
import { viewActions$ } from './view.generator.actions';

const CENTER_BOX_SIZE = 15;

export const loadJsonAction$ = (value: string): GeneratorAction =>
  function* () {
    yield clearAction();
    yield loadJsonAction({ value });
  };

export const initialLoadJsonAction$ = (value: string): GeneratorAction =>
  function* () {
    yield initialClearAction();
    yield initialLoadJsonAction({ value });
  };

/**
 * Moves the selection by a pointer step the scene's zoom scales, a selected
 * group carrying its members, each table once. From a view scene the step goes
 * to that view's own placement, which holds tables alone, the document's kept.
 */
export const moveAllAction$ = (
  movementX: number,
  movementY: number,
  source: GeometrySource = 'document'
): GeneratorAction =>
  function* (state) {
    const { tableIds, memoIds, tableGroupIds } = getSelectTypeIds(
      state.editor.selectedMap
    );
    const { zoomLevel } = getSceneTransform(state, source);
    const newMovementX = movementX / zoomLevel;
    const newMovementY = movementY / zoomLevel;

    if (source !== 'document') {
      if (tableIds.length) {
        yield attachActionTag(
          Tag.drag,
          viewMoveTableAction({
            ids: tableIds,
            movementX: newMovementX,
            movementY: newMovementY,
            kind: source,
          })
        );
      }
      return;
    }

    yield toMoveTableGroupActions(
      state,
      tableGroupIds,
      tableIds,
      newMovementX,
      newMovementY
    );

    if (memoIds.length) {
      yield attachActionTag(
        Tag.drag,
        moveMemoAction({
          ids: memoIds,
          movementX: newMovementX,
          movementY: newMovementY,
        })
      );
    }
  };

export const removeSelectedAction$ = (): GeneratorAction =>
  function* () {
    yield removeTableAction$();
    yield removeMemoAction$();
    yield removeTableGroupAction$();
  };

export type DuplicateConfig = {
  tableIds?: string[];
  memoIds?: string[];
  offset: Point;
  escapeCollision: boolean;
};

export const pasteEntitiesAction$ = (
  payload: ClipboardPayload,
  pasteRound: number
): GeneratorAction =>
  function* (state) {
    yield* createEntities$(state, {
      input: {
        tables: payload.tables,
        columns: payload.columns,
        memos: payload.memos,
        relationships: payload.relationships ?? [],
        indexes: payload.indexes ?? [],
      },
      offset: { x: START_ADD * pasteRound, y: START_ADD * pasteRound },
      escapeCollision: true,
    });
  };

export const duplicateAction$ = ({
  tableIds,
  memoIds,
  offset,
  escapeCollision,
}: DuplicateConfig): GeneratorAction =>
  function* (state) {
    yield* createEntities$(state, {
      input: toDuplicateInput(state, {
        tableIds: tableIds ?? [],
        memoIds: memoIds ?? [],
      }),
      offset: { x: round(offset.x, 4), y: round(offset.y, 4) },
      escapeCollision,
    });
  };

type CreateEntitiesConfig = {
  input: CreateEntityInput;
  offset: Point;
  escapeCollision: boolean;
};

function* createEntities$(
  state: RootState,
  { input, offset, escapeCollision }: CreateEntitiesConfig
) {
  if (input.tables.length === 0 && input.memos.length === 0) return;

  const {
    settings,
    doc: { tableIds, memoIds },
    collections,
  } = state;

  const tableCollection = query(collections).collection('tableEntities');
  const memoCollection = query(collections).collection('memoEntities');

  const placement = resolvePlacement({
    entities: [
      ...input.tables.map(toPlacementEntity),
      ...input.memos.map(toPlacementEntity),
    ],
    offset,
    escapeCollision,
    settings,
    tables: tableCollection.selectByIds(tableIds),
    memos: memoCollection.selectByIds(memoIds),
    findSource: sourceId =>
      tableCollection.selectById(sourceId) ??
      memoCollection.selectById(sourceId),
  });

  const {
    actions,
    tableIds: newTableIds,
    memoIds: newMemoIds,
  } = toCreateEntityActions(input, roundPlacement(placement));

  yield unselectAllAction$();
  yield actions;
  yield selectAction({
    ...newTableIds.reduce<Record<string, SelectType>>((acc, id) => {
      acc[id] = SelectType.table;
      return acc;
    }, {}),
    ...newMemoIds.reduce<Record<string, SelectType>>((acc, id) => {
      acc[id] = SelectType.memo;
      return acc;
    }, {}),
  });
}

const toPlacementEntity = ({
  sourceId,
  ui: { x, y, zIndex },
}: ClipboardTable | ClipboardMemo): PlacementEntity => ({
  sourceId,
  ui: { x, y, zIndex },
});

function roundPlacement(
  placement: Map<string, PlacementPoint>
): Map<string, PlacementPoint> {
  return new Map(
    Array.from(placement, ([sourceId, { x, y, zIndex }]) => [
      sourceId,
      { x: round(x, 4), y: round(y, 4), zIndex },
    ])
  );
}

/**
 * What a duplicate or an append makes new entities from. Only an append names
 * groups, each with the copied tables it holds; a duplicate, like a paste,
 * brings none and no membership.
 */
function toDuplicateInput(
  state: RootState,
  {
    tableIds,
    memoIds,
    tableGroupIds = [],
  }: Pick<SelectTypeIds, 'tableIds' | 'memoIds'> &
    Partial<Pick<SelectTypeIds, 'tableGroupIds'>>
): CreateEntityInput {
  const { collections } = state;
  const tables = query(collections)
    .collection('tableEntities')
    .selectByIds(tableIds);
  const memos = query(collections)
    .collection('memoEntities')
    .selectByIds(memoIds);
  const columns = tables.flatMap(table =>
    query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds)
  );
  const copiedTableIds = tables.map(({ id }) => id);

  return {
    tables: tables.map(table => ({
      sourceId: table.id,
      name: table.name,
      comment: table.comment,
      columnIds: [...table.columnIds],
      ui: {
        x: table.ui.x,
        y: table.ui.y,
        zIndex: table.ui.zIndex,
        widthName: table.ui.widthName,
        widthComment: table.ui.widthComment,
        color: table.ui.color,
      },
    })),
    columns: columns.map(column => ({
      sourceId: column.id,
      tableId: column.tableId,
      name: column.name,
      comment: column.comment,
      dataType: column.dataType,
      default: column.default,
      options: column.options,
      ui: {
        keys: column.ui.keys,
        widthName: column.ui.widthName,
        widthComment: column.ui.widthComment,
        widthDataType: column.ui.widthDataType,
        widthDefault: column.ui.widthDefault,
      },
    })),
    memos: memos.map(memo => ({
      sourceId: memo.id,
      value: memo.value,
      ui: {
        x: memo.ui.x,
        y: memo.ui.y,
        width: memo.ui.width,
        height: memo.ui.height,
        zIndex: memo.ui.zIndex,
        color: memo.ui.color,
      },
    })),
    relationships: toClipboardRelationships(state, copiedTableIds),
    indexes: toClipboardIndexes(state, copiedTableIds),
    tableGroups: query(collections)
      .collection('tableGroupEntities')
      .selectByIds(tableGroupIds)
      .map(group => ({
        sourceId: group.id,
        name: group.name,
        color: group.color,
        tableIds: tables
          .filter(table => table.groupId === group.id)
          .map(({ id }) => id),
        ui: { ...group.ui },
      })),
  };
}

/**
 * Where the tables of a document an append brings take their points from,
 * before the block they make goes under the diagram: as the file has them, as
 * the grid an import lands in has them, or as a placement answered them.
 */
export type AppendLayout = 'file' | 'grid' | ReadonlyArray<TableMove>;

/** What an append adds: its actions, the new ids, and the box they make where they land. */
export type SchemaAppend = CreateEntityActions & { rect: Rect };

/**
 * Each table and memo of the document read in, at the point the layout gives
 * it. The grid is the sort an import lands in, run on the document's own
 * copy, where the parser's canvas size wraps it as it wraps a replace.
 */
function toLayoutPoints(
  state: RootState,
  schema: ERDEditorSchemaV3,
  { tables, memos }: CreateEntityInput,
  layout: AppendLayout,
  ctx: EngineContext
): Map<string, Point> {
  const { tableEntities } = schema.collections;

  if (layout === 'grid') {
    tableReducers[TableActionType.sortTable](
      { ...state, ...schema },
      { type: TableActionType.sortTable, payload: undefined },
      ctx
    );
  }

  const answered = new Map(
    typeof layout === 'string'
      ? []
      : layout.map(({ id, x, y }) => [id, { x, y }])
  );

  return new Map([
    ...tables.map(({ sourceId }): [string, Point] => {
      const { x, y } = tableEntities[sourceId].ui;
      return [sourceId, answered.get(sourceId) ?? { x, y }];
    }),
    ...memos.map(({ sourceId, ui: { x, y } }): [string, Point] => [
      sourceId,
      { x, y },
    ]),
  ]);
}

/**
 * Where the block an append brings starts: under every table and memo the
 * diagram holds, a gap below them and in line with their left edge, or where
 * the grid of an import starts in a diagram holding none.
 */
function toAppendOrigin(state: RootState): Point {
  const content = getContentRect(state);

  return content
    ? { x: content.x, y: content.y + content.height + APPEND_GAP }
    : { x: TABLE_SORT_START, y: TABLE_SORT_START };
}

/**
 * A document's tables, relationships, indexes and memos as new entities of this
 * one, made as a paste makes them with no field at its default sent, their block
 * a gap under the diagram. Null for unreadable text or a document holding nothing.
 *
 * @example
 * const append = toSchemaAppend(state, json, 'grid', ctx);
 */
export function toSchemaAppend(
  state: RootState,
  json: string,
  layout: AppendLayout,
  ctx: EngineContext
): SchemaAppend | null {
  let schema: ERDEditorSchemaV3;
  try {
    schema = parser(json);
  } catch {
    return null;
  }

  const { doc, collections } = schema;
  const read: RootState = { ...state, doc, collections };
  const input = toDuplicateInput(read, doc);
  if (!input.tables.length && !input.memos.length) return null;

  const points = toLayoutPoints(state, schema, input, layout, ctx);
  // A file's groups keep their rects, so the block starts at their corners too.
  const groupPoints = layout === 'file' ? (input.tableGroups ?? []) : [];
  let minX = Infinity;
  let minY = Infinity;
  for (const { x, y } of [
    ...points.values(),
    ...groupPoints.map(({ ui }) => ui),
  ]) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
  }

  const origin = toAppendOrigin(state);
  const baseZIndex = nextZIndex(
    query(state.collections)
      .collection('tableEntities')
      .selectByIds(state.doc.tableIds),
    query(state.collections)
      .collection('memoEntities')
      .selectByIds(state.doc.memoIds)
  );
  // A stable sort keeps the document's own order among equal stacks.
  const stacked = [...input.tables, ...input.memos].sort(
    (a, b) => a.ui.zIndex - b.ui.zIndex
  );
  const placement = new Map<string, PlacementPoint>();

  stacked.forEach(({ sourceId }, index) => {
    const point = points.get(sourceId)!;

    placement.set(sourceId, {
      x: round(origin.x + point.x - minX, 4),
      y: round(origin.y + point.y - minY, 4),
      zIndex: baseZIndex + index,
    });
  });

  const tableRects = new Map(
    query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map((table): [string, Rect] => {
        const { x, y } = placement.get(table.id)!;
        return [
          table.id,
          { x, y, ...measureTableSize(table, read, ctx.toWidth) },
        ];
      })
  );
  const memoRects = query(collections)
    .collection('memoEntities')
    .selectByIds(doc.memoIds)
    .map(memo =>
      getMemoRect({ ...memo, ui: { ...memo.ui, ...placement.get(memo.id)! } })
    );

  const tableGroups = toAppendTableGroups(state, input, layout, tableRects, {
    x: origin.x - minX,
    y: origin.y - minY,
  });

  return {
    ...toCreateEntityActions({ ...input, tableGroups }, placement, {
      valuesOnly: true,
    }),
    rect: [
      ...tableRects.values(),
      ...memoRects,
      ...tableGroups.map(({ ui: { x, y, width, height } }) => ({
        x,
        y,
        width,
        height,
      })),
    ].reduce(unionRect),
  };
}

/**
 * The groups an append brings, stacked over the groups already there: a file
 * keeps each rect where the block moves it, while a layout that moved the
 * tables gives a group with members their bounds and the padding instead.
 */
function toAppendTableGroups(
  state: RootState,
  { tableGroups = [] }: CreateEntityInput,
  layout: AppendLayout,
  tableRects: Map<string, Rect>,
  offset: Point
): CreateEntityTableGroup[] {
  const baseZIndex = nextTableGroupZIndex(
    query(state.collections)
      .collection('tableGroupEntities')
      .selectByIds(state.doc.tableGroupIds)
  );

  return [...tableGroups]
    .sort((a, b) => a.ui.zIndex - b.ui.zIndex)
    .map((group, index) => {
      const members = group.tableIds
        .map(id => tableRects.get(id))
        .filter((rect): rect is Rect => Boolean(rect));
      const { x, y, width, height } =
        layout === 'file' || !members.length
          ? {
              ...group.ui,
              x: round(group.ui.x + offset.x, 4),
              y: round(group.ui.y + offset.y, 4),
            }
          : padRect(members.reduce(unionRect));

      return {
        ...group,
        ui: { x, y, width, height, zIndex: baseZIndex + index },
      };
    });
}

/**
 * Adds a document read from a file below the diagram as new entities in one undo
 * step, leaving the tables already there and every setting as they are; unreadable
 * text, or a document holding nothing, adds nothing.
 *
 * @example
 * store.dispatch(appendSchemaJsonAction$(json, 'file'));
 */
export const appendSchemaJsonAction$ = (
  json: string,
  layout: AppendLayout = 'file'
): GeneratorAction =>
  function* (state, ctx) {
    const append = toSchemaAppend(state, json, layout, ctx);
    if (append) yield append.actions;
  };

/**
 * Adds a schema read from SQL, GraphQL, DBML or AML to this document, its
 * tables laid out in the grid below the diagram, as appendSchemaJsonAction$
 * adds a document.
 *
 * @example
 * store.dispatch(appendSchemaAction$('sql', value));
 */
export const appendSchemaAction$ = (
  type: SchemaImportType,
  value: string
): GeneratorAction =>
  function* (state, ctx) {
    yield appendSchemaJsonAction$(
      toSchemaImportJson(type, value, state, ctx),
      'grid'
    );
  };

/**
 * Selects what the rect covers among what the source shows, each entity read
 * at the point and the size that source draws it: a view places its tables
 * and shows no memo, so a marquee drawn over it picks by the view, not the document.
 */
export const dragSelectAction$ = (
  dragRect: DragRect,
  source: GeometrySource = 'document'
): GeneratorAction =>
  function* (state) {
    const { collections } = state;
    const { tableIds, memoIds } = getVisibleIds(state, source);

    const selectedMap: Record<string, SelectType> = {
      ...query(collections)
        .collection('tableEntities')
        .selectByIds(tableIds)
        .reduce<Record<string, SelectType>>((acc, table) => {
          const rect = getTableRect(state, table, source);
          const x = rect.x + rect.width / 2 - CENTER_BOX_SIZE;
          const y = rect.y + rect.height / 2 - CENTER_BOX_SIZE;

          if (
            isOverlapPosition(dragRect, {
              x,
              y,
              w: CENTER_BOX_SIZE,
              h: CENTER_BOX_SIZE,
            })
          ) {
            acc[table.id] = SelectType.table;
          }

          return acc;
        }, {}),
      ...query(collections)
        .collection('memoEntities')
        .selectByIds(memoIds)
        .reduce<Record<string, SelectType>>((acc, memo) => {
          const width = calcMemoWidth(memo);
          const height = calcMemoHeight(memo);
          const x = memo.ui.x + width / 2 - CENTER_BOX_SIZE;
          const y = memo.ui.y + height / 2 - CENTER_BOX_SIZE;

          if (
            isOverlapPosition(dragRect, {
              x,
              y,
              w: CENTER_BOX_SIZE,
              h: CENTER_BOX_SIZE,
            })
          ) {
            acc[memo.id] = SelectType.memo;
          }

          return acc;
        }, {}),
    };

    yield unselectAllAction$();

    if (!isEmpty(selectedMap)) {
      yield selectAction(selectedMap);
    }
  };

export const unselectAllAction$ = (): GeneratorAction =>
  function* () {
    yield unselectAllAction();
    yield focusTableEndAction();
  };

export const focusMoveTableAction$ = (
  moveKey: MoveKey,
  shiftKey: boolean
): GeneratorAction =>
  function* (state) {
    const {
      editor: { focusTable },
    } = state;
    if (!focusTable) return;

    if (
      moveKey === MoveKey.Tab &&
      !shiftKey &&
      ((isTableFocusType(focusTable.focusType) &&
        isLastTable(state) &&
        !isColumns(state)) ||
        (!isTableFocusType(focusTable.focusType) &&
          isLastColumn(state) &&
          isLastRowColumn(state)))
    ) {
      yield addColumnAction$(focusTable.tableId);
    } else {
      yield focusMoveTableAction({ moveKey, shiftKey });
    }
  };

export const drawStartRelationshipAction$ = (
  relationshipType: number
): GeneratorAction =>
  function* ({ editor }) {
    if (editor.drawRelationship?.relationshipType === relationshipType) {
      yield drawEndRelationshipAction();
    } else {
      yield drawStartRelationshipAction({ relationshipType });
    }
  };

export const drawStartAddRelationshipAction$ = (
  tableId: string
): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections)
      .collection('tableEntities')
      .selectById(tableId);
    if (!table) return;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(table.columnIds);

    if (
      !columns.some(column => bHas(column.options, ColumnOption.primaryKey))
    ) {
      const columnId = uuid25();
      yield addColumnAction({
        tableId,
        id: columnId,
      });
      yield changeColumnPrimaryKeyAction({
        tableId,
        id: columnId,
        value: true,
      });
      yield focusColumnAction({
        tableId,
        columnId,
        focusType: FocusType.columnName,
        $mod: false,
        shiftKey: false,
      });
    }

    yield drawStartAddRelationshipAction({ tableId });
  };

/**
 * Paints every selected table, memo and group the color, sending nothing for
 * one that already is, in any letter case, so a color pressed again adds no
 * undo entry while one an undo took back is painted again; one stream group.
 */
export const changeColorAllAction$ = (color: string): GeneratorAction =>
  function* (state) {
    const { tables, memos, tableGroups } = getColorTargets(state);
    const target = color.toLowerCase();

    yield tables
      .filter(table => table.ui.color.toLowerCase() !== target)
      .map(table =>
        changeTableColorAction({
          id: table.id,
          color,
          prevColor: table.ui.color,
        })
      );
    yield memos
      .filter(memo => memo.ui.color.toLowerCase() !== target)
      .map(memo =>
        changeMemoColorAction({ id: memo.id, color, prevColor: memo.ui.color })
      );
    yield tableGroups
      .filter(group => group.color.toLowerCase() !== target)
      .map(group =>
        changeTableGroupColorAction({
          id: group.id,
          color,
          prevColor: group.color,
        })
      );
  };

/**
 * Clears the color of every selected table, memo and group that has one: one
 * stream group, so one undo entry, and none for a selection that has no color.
 */
export const removeColorAllAction$ = (): GeneratorAction =>
  function* (state) {
    const { tables, memos, tableGroups } = getColoredSelection(state);

    yield tables.map(table =>
      changeTableColorAction({
        id: table.id,
        color: '',
        prevColor: table.ui.color,
      })
    );
    yield memos.map(memo =>
      changeMemoColorAction({
        id: memo.id,
        color: '',
        prevColor: memo.ui.color,
      })
    );
    yield tableGroups.map(group =>
      changeTableGroupColorAction({
        id: group.id,
        color: '',
        prevColor: group.color,
      })
    );
  };

/** The four text formats an import parses into a document of its own. */
export type SchemaImportType = 'sql' | 'graphql' | 'dbml' | 'aml';

/**
 * The settings an import takes from the parser rather than from the document
 * it replaces: the view, the legacy scroll pair, and the canvas size its grid
 * wraps at, which the parser sizes to the tables.
 */
const IMPORT_OMIT_SETTINGS = [
  'width',
  'height',
  'originX',
  'originY',
  'scrollTop',
  'scrollLeft',
  'zoomLevel',
] as const;

/**
 * Writes the settings of the document an import replaces over the parser's,
 * all but the view and the canvas size, locks included, the view locked where
 * the parser left it. A placed import writes them again as it lands.
 *
 * @example
 * withImportSettings(schema, store.state.settings);
 */
export function withImportSettings(
  schema: Pick<ERDEditorSchemaV3, 'settings'>,
  settings: RootState['settings']
): void {
  const kept = omit(cloneDeep(settings), IMPORT_OMIT_SETTINGS);
  const { originX, originY, zoomLevel } = schema.settings;

  schema.settings = {
    ...schema.settings,
    ...kept,
    lockedValues: { ...kept.lockedValues, originX, originY, zoomLevel },
  };
}

/**
 * The document an import parses to, carrying the settings of the one it
 * replaces. Its tables still stand where the parser left them: the grid or a
 * placement decides where they go.
 *
 * @example
 * const json = toSchemaImportJson('sql', value, store.state, ctx);
 */
export function toSchemaImportJson(
  type: SchemaImportType,
  value: string,
  { settings }: RootState,
  ctx: EngineContext
): string {
  const prepare = (schema: ERDEditorSchemaV3) => {
    withImportSettings(schema, settings);
    return schema;
  };

  switch (type) {
    case 'sql':
      return schemaSQLParserToSchemaJson(
        value,
        ctx,
        prepare,
        settings.database
      );
    case 'graphql':
      return schemaGraphQLParserToSchemaJson(value, ctx, prepare);
    case 'dbml':
      return schemaDBMLParserToSchemaJson(value, ctx, prepare);
    case 'aml':
      return schemaAMLParserToSchemaJson(value, ctx, prepare);
  }
}

/**
 * The load each of the four text imports runs: the parsed document replaces
 * this one, then its tables are sorted into the grid.
 */
export const loadSchemaAction$ = (
  type: SchemaImportType,
  value: string
): GeneratorAction =>
  function* (state, ctx) {
    yield loadJsonAction$(toSchemaImportJson(type, value, state, ctx));
    yield sortTableAction();
  };

export const loadSchemaSQLAction$ = (value: string): GeneratorAction =>
  loadSchemaAction$('sql', value);

export const loadSchemaGraphQLAction$ = (value: string): GeneratorAction =>
  loadSchemaAction$('graphql', value);

export const loadSchemaDBMLAction$ = (value: string): GeneratorAction =>
  loadSchemaAction$('dbml', value);

export const loadSchemaAMLAction$ = (value: string): GeneratorAction =>
  loadSchemaAction$('aml', value);

export const dragstartColumnAction$ = ($mod: boolean): GeneratorAction =>
  function* ({ editor: { focusTable } }) {
    if (!focusTable || !focusTable.columnId) return;

    yield dragstartColumnAction({
      tableId: focusTable.tableId,
      columnIds: $mod ? [...focusTable.selectColumnIds] : [focusTable.columnId],
    });
  };

type MoveColumnAction = ReturnType<typeof moveColumnAction>;

/**
 * The moves that take the dragged columns to the end of their own table, in the
 * order they are dragged: each goes after whichever column is last by then.
 */
function moveColumnsToEnd(
  tableId: string,
  order: string[],
  columnIds: string[]
): MoveColumnAction[] {
  const ids = [...order];
  const actions: MoveColumnAction[] = [];

  for (const id of columnIds) {
    const index = ids.indexOf(id);
    if (index === -1) return [];

    const targetId = ids[ids.length - 1];
    if (id === targetId) continue;

    ids.splice(index, 1);
    ids.push(id);
    actions.push(moveColumnAction({ tableId, id, targetId }));
  }

  return isEqual(ids, order) ? [] : actions;
}

/** A null targetId drops past the last row, which appends. */
export const dragoverColumnAction$ = (
  targetId: string | null,
  targetTableId: string
): GeneratorAction =>
  function* ({ editor: { draggableColumn }, collections }) {
    if (!draggableColumn || draggableColumn.columnIds.length === 0) {
      return;
    }

    const { tableId, columnIds } = draggableColumn;
    const tableCollection = query(collections).collection('tableEntities');
    const table = tableCollection.selectById(tableId);
    if (!table) return;

    if (targetTableId === tableId) {
      const index = table.columnIds.indexOf(columnIds[0]);
      if (index === -1) return;

      if (targetId === null) {
        yield moveColumnsToEnd(tableId, table.columnIds, columnIds);
        return;
      }

      const targetIndex = table.columnIds.indexOf(targetId);
      if (targetIndex === -1) return;

      const actions = columnIds.map(id =>
        moveColumnAction({ tableId, id, targetId })
      );

      if (index < targetIndex) {
        actions.reverse();
      }

      yield actions;
      return;
    }

    const targetTable = tableCollection.selectById(targetTableId);
    if (!targetTable) return;

    const columns = query(collections)
      .collection('tableColumnEntities')
      .selectByIds(columnIds);
    if (columns.length === 0) return;

    yield removeColumnAction$(tableId, columnIds);
    const newColumnIds = columns.map(() => uuid25());

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i];
      const newColumnId = newColumnIds[i];
      const payload = {
        id: newColumnId,
        tableId: targetTableId,
      };

      yield [
        addColumnAction(payload),
        changeColumnNameAction({
          ...payload,
          value: column.name,
        }),
        changeColumnDataTypeAction({
          ...payload,
          value: column.dataType,
        }),
        changeColumnDefaultAction({
          ...payload,
          value: column.default,
        }),
        changeColumnCommentAction({
          ...payload,
          value: column.comment,
        }),
        changeColumnPrimaryKeyAction({
          ...payload,
          value: bHas(column.options, ColumnOption.primaryKey),
        }),
        changeColumnNotNullAction({
          ...payload,
          value: bHas(column.options, ColumnOption.notNull),
        }),
        changeColumnUniqueAction({
          ...payload,
          value: bHas(column.options, ColumnOption.unique),
        }),
        changeColumnAutoIncrementAction({
          ...payload,
          value: bHas(column.options, ColumnOption.autoIncrement),
        }),
        // An append keeps the end of the table, where addColumn put it.
        ...(targetId === null
          ? []
          : [moveColumnAction({ ...payload, targetId })]),
        focusColumnAction({
          tableId: targetTableId,
          columnId: newColumnId,
          focusType: FocusType.columnName,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }

    yield dragstartColumnAction({
      tableId: targetTableId,
      columnIds: newColumnIds,
    });
  };

export const columnKeyHoverStartAction$ = (columnId: string): GeneratorAction =>
  function* (state) {
    const { columnIds, relationshipIds } = findRelationshipColumn(
      [{ columnId, relationshipIds: [] }],
      state
    ).reduce(
      (
        acc: { columnIds: string[]; relationshipIds: string[] },
        { columnId, relationshipIds }
      ) => {
        acc.columnIds.push(columnId);
        acc.relationshipIds.push(...relationshipIds);
        return acc;
      },
      { columnIds: [], relationshipIds: [] }
    );

    yield hoverColumnMapAction({ columnIds: uniq(columnIds) });
    yield hoverRelationshipMapAction({
      relationshipIds: uniq(relationshipIds),
    });
  };

export const columnKeyHoverEndAction$ = (): GeneratorAction =>
  function* () {
    yield hoverColumnMapAction({ columnIds: [] });
    yield hoverRelationshipMapAction({ relationshipIds: [] });
  };

export const actions$ = {
  loadJsonAction$,
  initialLoadJsonAction$,
  moveAllAction$,
  removeSelectedAction$,
  pasteEntitiesAction$,
  duplicateAction$,
  dragSelectAction$,
  unselectAllAction$,
  focusMoveTableAction$,
  drawStartRelationshipAction$,
  drawStartAddRelationshipAction$,
  changeColorAllAction$,
  removeColorAllAction$,
  loadSchemaSQLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaDBMLAction$,
  loadSchemaAMLAction$,
  appendSchemaAction$,
  appendSchemaJsonAction$,
  dragstartColumnAction$,
  dragoverColumnAction$,
  columnKeyHoverStartAction$,
  columnKeyHoverEndAction$,
  ...viewActions$,
};
