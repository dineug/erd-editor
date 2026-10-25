import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';
import { uuid25 } from '@dineug/uuid';

import { ColumnOption, ColumnType } from '@/constants/schema';
import { GeneratorAction } from '@/engine/generator.actions';
import { toColumnNameWrites } from '@/engine/modules/dictionary/derivedNames';
import { toDomainUnlinkActions } from '@/engine/modules/dictionary/domainTypes';
import { toPastedDomainId } from '@/engine/modules/dictionary/membership';
import {
  drawEndRelationshipAction,
  focusColumnAction,
  focusTableAction,
  focusTableEndAction,
  selectAction,
  unselectAllAction,
} from '@/engine/modules/editor/atom.actions';
import { drawStartAddRelationshipAction$ } from '@/engine/modules/editor/generator.actions';
import { SelectType } from '@/engine/modules/editor/state';
import { isTableFocusType } from '@/engine/modules/editor/utils/focus';
import { isDomainInTypeCell } from '@/engine/modules/editor/utils/nameView';
import { removeIndexAction } from '@/engine/modules/index/atom.actions';
import {
  addRelationshipAction,
  removeRelationshipAction,
} from '@/engine/modules/relationship/atom.actions';
import {
  getStartKeyColumns,
  toForeignKeyActions,
} from '@/engine/modules/relationship/fkColumns';
import {
  addColumnAction,
  changeColumnAutoIncrementAction,
  changeColumnCommentAction,
  changeColumnDataTypeAction,
  changeColumnDefaultAction,
  changeColumnDomainAction,
  changeColumnLogicalNameAction,
  changeColumnNameAction,
  changeColumnNameDerivedAction,
  changeColumnNotNullAction,
  changeColumnUniqueAction,
} from '@/engine/modules/table-column/atom.actions';
import { resizeTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';
import { nextPoint, nextZIndex } from '@/utils';
import { arrayHas } from '@/utils/arrayHas';
import { bHas } from '@/utils/bit';
import { getShowColumnOrder } from '@/utils/table-clipboard';
import { getTableGroupId } from '@/utils/tableGroup';

import { ActionType } from './actions';
import {
  addTableAction,
  changeTableNameAction,
  changeTableNameDerivedAction,
  changeZIndexAction,
  moveToTableAction,
  removeTableAction,
  tableReducers,
} from './atom.actions';

export const addTableAction$ = (): GeneratorAction =>
  function* ({ settings, doc: { tableIds, memoIds }, collections }) {
    const tables = query(collections)
      .collection('tableEntities')
      .selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);
    const point = nextPoint(settings, tables, memos);
    const id = uuid25();

    yield unselectAllAction();
    yield addTableAction({
      id,
      ui: {
        ...point,
        zIndex: nextZIndex(tables, memos),
      },
    });
    yield selectAction({ [id]: SelectType.table });
    yield focusTableAction({ tableId: id });
  };

export const removeTableAction$ = (id?: string): GeneratorAction =>
  function* ({
    doc: { tableIds, relationshipIds, indexIds },
    editor: { selectedMap },
    collections,
  }) {
    const relationships = query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds);
    const indexes = query(collections)
      .collection('indexEntities')
      .selectByIds(indexIds);

    if (id) {
      const removeRelationships = relationships.filter(
        ({ start, end }) => start.tableId === id || end.tableId === id
      );
      const removeIndexes = indexes.filter(({ tableId }) => tableId === id);

      for (const { id } of removeIndexes) {
        yield removeIndexAction({ id });
      }
      for (const { id } of removeRelationships) {
        yield removeRelationshipAction({ id });
      }
      yield removeTableAction({ id });

      return;
    }

    // A table a peer, an agent or an undo removes stays selected, and its
    // removal recorded again would make an undo that brings it back.
    const isInDoc = arrayHas(tableIds);
    const selectedTableIds = Object.entries(selectedMap)
      .filter(([id, type]) => type === SelectType.table && isInDoc(id))
      .map(([id]) => id);
    const hasTableIds = arrayHas(selectedTableIds);
    const removeRelationships = relationships.filter(
      ({ start, end }) => hasTableIds(start.tableId) || hasTableIds(end.tableId)
    );
    const removeIndexes = indexes.filter(({ tableId }) => hasTableIds(tableId));

    for (const { id } of removeIndexes) {
      yield removeIndexAction({ id });
    }
    for (const { id } of removeRelationships) {
      yield removeRelationshipAction({ id });
    }
    for (const id of selectedTableIds) {
      yield removeTableAction({ id });
    }
  };

export const selectTableAction$ = (
  id: string,
  $mod: boolean
): GeneratorAction =>
  function* ({
    doc: { tableIds, memoIds, domainIds },
    collections,
    editor: { drawRelationship },
    settings: { database },
  }) {
    const tableCollection = query(collections).collection('tableEntities');
    const tables = tableCollection.selectByIds(tableIds);
    const memos = query(collections)
      .collection('memoEntities')
      .selectByIds(memoIds);

    if (!$mod) {
      yield unselectAllAction();
    }

    yield selectAction({ [id]: SelectType.table });
    yield changeZIndexAction({ id, zIndex: nextZIndex(tables, memos) });
    yield focusTableAction({ tableId: id });

    if (!drawRelationship) return;

    if (drawRelationship.start) {
      const startTable = tableCollection.selectById(
        drawRelationship.start.tableId
      );
      const endTable = tableCollection.selectById(id);
      // A draw left armed with no table or key to start from would hold the
      // pointer in draw mode until Escape, so a press it cannot close ends it.
      if (!startTable || !endTable) {
        yield drawEndRelationshipAction();
        return;
      }

      const columnCollection = query(collections).collection(
        'tableColumnEntities'
      );
      const startColumns = getStartKeyColumns(collections, startTable);
      if (!startColumns.length) {
        yield drawEndRelationshipAction();
        return;
      }

      const endColumnIds = startColumns.map(() => uuid25());

      yield toForeignKeyActions(startColumns, endTable.id, endColumnIds, {
        startTableName: startTable.name,
        endColumnNames: columnCollection
          .selectByIds(endTable.columnIds)
          .map(({ name }) => name),
        database,
        domainIds,
      });
      yield addRelationshipAction({
        id: uuid25(),
        relationshipType: drawRelationship.relationshipType,
        start: {
          tableId: startTable.id,
          columnIds: startColumns.map(({ id }) => id),
        },
        end: {
          tableId: endTable.id,
          columnIds: endColumnIds,
        },
      });
      yield drawEndRelationshipAction();
    } else {
      yield drawStartAddRelationshipAction$(id);
    }
  };

/** Which of a column's names, type and domain a pasted row writes. */
type PastedCells = {
  name: boolean;
  logicalName: boolean;
  dataType: boolean;
  domain: boolean;
};

/** A row a paste adds as a new column writes every field it carries. */
const EVERY_CELL: PastedCells = {
  name: true,
  logicalName: true,
  dataType: true,
  domain: true,
};

/**
 * The names, type and domain the cells of a row write. The logical view's
 * type cell writes the type and the domain it draws, as a domain cell beside
 * a type cell does.
 */
function toPastedCells(
  settings: RootState['settings'],
  showColumnOrder: number[]
): PastedCells {
  const dataType = showColumnOrder.includes(ColumnType.columnDataType);

  return {
    name: showColumnOrder.includes(ColumnType.columnName),
    logicalName: showColumnOrder.includes(ColumnType.columnLogicalName),
    dataType,
    domain:
      showColumnOrder.includes(ColumnType.columnDomain) ||
      (dataType && isDomainInTypeCell(settings)),
  };
}

/** The writes of the pasted cells that are no name, type or domain. */
function toPastedValueActions(
  payload: { tableId: string; id: string },
  column: Column,
  showColumnOrder: number[]
): AnyAction[] {
  return showColumnOrder.flatMap<AnyAction>(columnType => {
    switch (columnType) {
      case ColumnType.columnDefault:
        return [
          changeColumnDefaultAction({ ...payload, value: column.default }),
        ];
      case ColumnType.columnComment:
        return [
          changeColumnCommentAction({ ...payload, value: column.comment }),
        ];
      case ColumnType.columnAutoIncrement:
        return [
          changeColumnAutoIncrementAction({
            ...payload,
            value: bHas(column.options, ColumnOption.autoIncrement),
          }),
        ];
      case ColumnType.columnUnique:
        return [
          changeColumnUniqueAction({
            ...payload,
            value: bHas(column.options, ColumnOption.unique),
          }),
        ];
      case ColumnType.columnNotNull:
        return [
          changeColumnNotNullAction({
            ...payload,
            value: bHas(column.options, ColumnOption.notNull),
          }),
        ];
      default:
        return [];
    }
  });
}

/**
 * What a pasted row writes of a column's names, type and domain. A name
 * written by hand leaves the dictionaries, a logical name derives the name the
 * row leaves empty or derived, and no write spreads the data type sync.
 */
function toPastedNameDomainActions(
  state: RootState,
  payload: { tableId: string; id: string },
  current: Column | undefined,
  pasted: Column,
  cells: PastedCells
): AnyAction[] {
  const actions: AnyAction[] = [];
  const wasDerived = current
    ? bHas(current.options, ColumnOption.nameDerived)
    : false;
  const domainTypeOf = (id: string) =>
    state.collections.domainEntities[id]?.dataType ?? '';

  if (cells.name) {
    actions.push(changeColumnNameAction({ ...payload, value: pasted.name }));
    if (wasDerived) {
      actions.push(changeColumnNameDerivedAction({ ...payload, value: false }));
    }
  }

  // A domain cell links what it names only while the type the row pastes
  // agrees; '' unlinks, and null leaves the link to the type written.
  let link = cells.domain
    ? toPastedDomainId(state, pasted.domainId, pasted.dataType)
    : null;
  const dataType = cells.dataType ? pasted.dataType : null;

  if (cells.logicalName) {
    actions.push(
      changeColumnLogicalNameAction({ ...payload, value: pasted.logicalName })
    );

    // The derivation reads the name and the flag the row leaves behind.
    const left: Column = {
      ...pasted,
      id: payload.id,
      name: cells.name ? pasted.name : (current?.name ?? ''),
      options: !cells.name && wasDerived ? ColumnOption.nameDerived : 0,
    };
    const writes = toColumnNameWrites(
      state,
      payload.tableId,
      left,
      pasted.logicalName
    );
    const termDomainId = writes.link?.value ?? '';

    actions.push(...writes.actions);
    if (
      termDomainId &&
      !link &&
      (!dataType || domainTypeOf(termDomainId) === dataType)
    ) {
      link = termDomainId;
    }
  }

  if (link) {
    const domainType = domainTypeOf(link);
    if (current?.domainId !== link) {
      actions.push(changeColumnDomainAction({ ...payload, value: link }));
    }
    if (dataType !== null || current?.dataType !== domainType) {
      actions.push(
        changeColumnDataTypeAction({ ...payload, value: domainType })
      );
    }
    return actions;
  }

  if (link === '' && current?.domainId !== '') {
    actions.push(changeColumnDomainAction({ ...payload, value: '' }));
  }
  if (dataType !== null) {
    actions.push(changeColumnDataTypeAction({ ...payload, value: dataType }));
    if (link === null) {
      actions.push(
        ...toDomainUnlinkActions(state, [{ ...payload, value: dataType }])
      );
    }
  }
  return actions;
}

export const pasteTableAction$ = (columns: Column[]): GeneratorAction =>
  function* (state) {
    const {
      editor: { selectedMap, focusTable },
      settings,
      collections,
    } = state;
    const isFit = focusTable && !isTableFocusType(focusTable.focusType);
    const selectedTableIds = Object.entries(selectedMap)
      .filter(([, type]) => type === SelectType.table)
      .map(([id]) => id)
      .filter(id => (isFit ? id !== focusTable?.tableId : true));

    for (const tableId of selectedTableIds) {
      for (const column of columns) {
        const id = uuid25();
        const payload = {
          id,
          tableId,
        };

        yield [
          addColumnAction(payload),
          changeColumnDefaultAction({
            ...payload,
            value: column.default,
          }),
          changeColumnCommentAction({
            ...payload,
            value: column.comment,
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
          // A copy from another document, or one taken before its domain's
          // type changed, keeps no link to a domain off the type it pastes.
          ...toPastedNameDomainActions(
            state,
            payload,
            undefined,
            column,
            EVERY_CELL
          ),
        ];
      }
    }

    if (!focusTable || !isFit) return;

    const table = query(collections)
      .collection('tableEntities')
      .selectById(focusTable.tableId);
    if (!table) return;

    const columnIds = table.columnIds.filter(
      arrayHas(focusTable.selectColumnIds)
    );
    if (columnIds.length === 0) return;

    const additionalColumnIds = table.columnIds.slice(
      table.columnIds.indexOf(columnIds[columnIds.length - 1]) + 1
    );
    const columnIdsRange = [...columnIds, ...additionalColumnIds];
    const showColumnOrder = getShowColumnOrder(
      settings.show,
      settings.columnOrder,
      settings.nameViewMode
    );
    const cells = toPastedCells(settings, showColumnOrder);
    const columnCollection = query(collections).collection(
      'tableColumnEntities'
    );

    yield focusTableEndAction();

    for (let i = 0; i < columnIdsRange.length; i++) {
      const columnId = columnIdsRange[i];
      const column = columns[i];
      if (!column) break;

      const payload = {
        id: columnId,
        tableId: table.id,
      };

      // A paste writes over a column's cells as typing into them does.
      yield [
        ...toPastedValueActions(payload, column, showColumnOrder),
        ...toPastedNameDomainActions(
          state,
          payload,
          columnCollection.selectById(columnId),
          column,
          cells
        ),
        focusColumnAction({
          tableId: table.id,
          columnId: columnId,
          focusType: focusTable.focusType,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }

    const addColumns = columns.slice(columnIdsRange.length);

    for (const column of addColumns) {
      const id = uuid25();
      const payload = {
        id,
        tableId: table.id,
      };

      yield [
        addColumnAction(payload),
        ...toPastedValueActions(payload, column, showColumnOrder),
        ...toPastedNameDomainActions(state, payload, undefined, column, cells),
        focusColumnAction({
          tableId: table.id,
          columnId: id,
          focusType: focusTable.focusType,
          $mod: true,
          shiftKey: false,
        }),
      ];
    }
  };

/**
 * Runs the engine's sort on copies of the live tables and groups, then places
 * each table and each group with members where it found them. A replayed
 * table.sort measures each replica's own text; placed points agree everywhere.
 */
export const sortTablesToMoveAction$ = (): GeneratorAction =>
  function* (state, context) {
    const { doc, collections } = state;
    const copies = query(collections)
      .collection('tableEntities')
      .selectByIds(doc.tableIds)
      .map(table => ({ ...table, ui: { ...table.ui } }));
    const groups = query(collections)
      .collection('tableGroupEntities')
      .selectByIds(doc.tableGroupIds)
      .map(group => ({ ...group, ui: { ...group.ui } }));
    const sorted: RootState = {
      ...state,
      collections: {
        ...collections,
        tableEntities: Object.fromEntries(
          copies.map(table => [table.id, table])
        ),
        tableGroupEntities: Object.fromEntries(
          groups.map(group => [group.id, group])
        ),
      },
    };

    tableReducers[ActionType.sortTable](
      sorted,
      { type: ActionType.sortTable, payload: undefined },
      context
    );

    const placedGroupIds = new Set(
      copies.map(table => getTableGroupId(sorted, table))
    );

    yield copies.map(({ id, ui: { x, y } }) => moveToTableAction({ id, x, y }));
    yield groups
      .filter(({ id }) => placedGroupIds.has(id))
      .map(({ id, ui: { x, y, width, height } }) =>
        resizeTableGroupAction({ id, x, y, width, height })
      );
  };

/**
 * Renames a table as typed by hand, so the dictionaries leave a name that is
 * not empty alone from then on: the derived flag goes off in the same dispatch
 * while it is on.
 */
export const changeTableNameAction$ = (
  id: string,
  value: string
): GeneratorAction =>
  function* ({ collections }) {
    const table = query(collections).collection('tableEntities').selectById(id);

    yield [
      changeTableNameAction({ id, value }),
      ...(table?.nameDerived
        ? [changeTableNameDerivedAction({ id, value: false })]
        : []),
    ];
  };

export const actions$ = {
  addTableAction$,
  removeTableAction$,
  selectTableAction$,
  pasteTableAction$,
  sortTablesToMoveAction$,
  changeTableNameAction$,
};
