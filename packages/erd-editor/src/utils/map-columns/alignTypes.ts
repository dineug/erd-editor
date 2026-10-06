import { query } from '@dineug/erd-editor-schema';
import { AnyAction } from '@dineug/r-html';

import { toReferenceDataType } from '@/engine/modules/relationship/referenceType';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { changeColumnDataTypeAction } from '@/engine/modules/table-column/atom.actions';
import {
  DataTypeSyncRelationship,
  getDataTypeSyncColumns,
} from '@/engine/modules/table-column/utils/dataType';
import { RootState } from '@/engine/state';
import { Column } from '@/internal-types';

type AlignEnd = { tableId: string; columnIds: string[] };

export type AlignTypesInput = {
  /** The relationship whose columns change; a new one has none. */
  relationshipId?: string;
  start: AlignEnd;
  end: AlignEnd;
  /** The child columns the same batch adds, which already take the parent's type. */
  newColumnIds: string[];
};

/**
 * The data type changes that bring each existing child column of the mapping
 * to its parent's, through the data type sync over the relationships as they
 * will stand, while the sync is on; a column already at its value takes none.
 */
export function toAlignTypeActions(
  state: RootState,
  { relationshipId, start, end, newColumnIds }: AlignTypesInput
): AnyAction[] {
  const {
    doc: { relationshipIds },
    collections,
    settings: { relationshipDataTypeSync, database },
  } = state;
  if (!relationshipDataTypeSync) return [];

  const columns = query(collections).collection('tableColumnEntities');
  const isNew = (id: string) => newColumnIds.includes(id);
  const seeds: ChangeColumnValuePayload[] = [];

  start.columnIds.forEach((parentId, index) => {
    const childId = end.columnIds[index];
    const parent = columns.selectById(parentId);
    if (childId === undefined || isNew(childId) || !parent?.dataType.trim()) {
      return;
    }

    seeds.push({
      id: childId,
      tableId: end.tableId,
      value: toReferenceDataType(parent.dataType, database),
    });
  });
  if (!seeds.length) return [];

  const mapping: DataTypeSyncRelationship = { start, end };
  const relationships: DataTypeSyncRelationship[] = [
    ...query(collections)
      .collection('relationshipEntities')
      .selectByIds(relationshipIds)
      .filter(({ id }) => id !== relationshipId),
    mapping,
  ];

  return getDataTypeSyncColumns(seeds.reverse(), state, [], relationships)
    .filter(({ id, value }) => {
      const column = columns.selectById(id);
      return !isNew(id) && !!column && column.dataType !== value;
    })
    .map(payload => changeColumnDataTypeAction(payload));
}

/**
 * What the dialog says under a row whose child column type differs from the
 * one its parent's gives a foreign key: the type confirming writes there while
 * the sync is on and the parent has one, else both types.
 */
export type TypeNote =
  | { kind: 'becomes'; dataType: string }
  | { kind: 'differ'; parentType: string; childType: string };

export function getTypeNote(
  {
    settings: { relationshipDataTypeSync, database },
  }: Pick<RootState, 'settings'>,
  parent: Column,
  child: Column
): TypeNote | null {
  const dataType = toReferenceDataType(parent.dataType, database);
  if (dataType === child.dataType) return null;

  return relationshipDataTypeSync && parent.dataType.trim()
    ? { kind: 'becomes', dataType }
    : {
        kind: 'differ',
        parentType: parent.dataType,
        childType: child.dataType,
      };
}
