import { query } from '@dineug/erd-editor-schema';

import {
  isSerialType,
  toReferenceDataType,
} from '@/engine/modules/relationship/referenceType';
import { ChangeColumnValuePayload } from '@/engine/modules/table-column/actions';
import { RootState } from '@/engine/state';

type DataTypeSyncEnd = { tableId: string; columnIds: string[] };

/** The two ends of a relationship, all the data type sync reads of one. */
export type DataTypeSyncRelationship = {
  start: DataTypeSyncEnd;
  end: DataTypeSyncEnd;
};

/** One column a change steps to over a relationship, and which way it goes. */
type SyncStep = { id: string; tableId: string; toForeignKey: boolean };

/**
 * Each column's steps, in the order of the relationships: a key's to the
 * foreign key at its first position, a foreign key's back to its key. On both
 * sides of one relationship a column steps only as its key.
 */
function toSyncSteps(
  relationships: DataTypeSyncRelationship[]
): Map<string, SyncStep[]> {
  const steps = new Map<string, SyncStep[]>();
  const add = (from: string, step: SyncStep) => {
    const list = steps.get(from);
    if (list) list.push(step);
    else steps.set(from, [step]);
  };

  for (const { start, end } of relationships) {
    const startIds = [...start.columnIds];
    const endIds = [...end.columnIds];
    const seen = new Set<string>();

    startIds.forEach((from, index) => {
      if (seen.has(from)) return;
      seen.add(from);
      const id = endIds[index];
      if (id !== undefined) {
        add(from, { id, tableId: end.tableId, toForeignKey: true });
      }
    });
    endIds.forEach((from, index) => {
      if (seen.has(from)) return;
      seen.add(from);
      const id = startIds[index];
      if (id !== undefined) {
        add(from, { id, tableId: start.tableId, toForeignKey: false });
      }
    });
  }

  return steps;
}

/**
 * Drains the stack, listing each column its relationships reach once: a key
 * sends its foreign keys toReferenceDataType of its value, a foreign key sends
 * its key its value, unless the key is serial, which keeps it and stops there.
 *
 * @param relationships The relationships to follow, the document's by default;
 * a caller about to change one hands the list as it will stand.
 * @param settledIds The columns the batch writes a type of their own, which the
 * walk starts from and never writes again, so no stack order decides them.
 */
export function getDataTypeSyncColumns(
  stack: ChangeColumnValuePayload[],
  state: RootState,
  payloads: ChangeColumnValuePayload[] = [],
  relationships: DataTypeSyncRelationship[] = query(state.collections)
    .collection('relationshipEntities')
    .selectByIds(state.doc.relationshipIds),
  settledIds: ReadonlySet<string> = new Set()
): ChangeColumnValuePayload[] {
  const {
    collections,
    settings: { database },
  } = state;
  const columns = query(collections).collection('tableColumnEntities');
  // A domain's type starts the walk from every column linking it, so the
  // relationships are read once here rather than once per column popped.
  const steps = toSyncSteps(relationships);
  const listed = new Set(payloads.map(({ id }) => id));

  for (let target = stack.pop(); target; target = stack.pop()) {
    const { id: targetId, value } = target;
    if (listed.has(targetId)) continue;

    payloads.push(target);
    listed.add(targetId);
    const foreignKeyValue = toReferenceDataType(value, database);

    for (const { id, tableId, toForeignKey } of steps.get(targetId) ?? []) {
      if (settledIds.has(id)) continue;

      if (toForeignKey) {
        stack.push({ id, tableId, value: foreignKeyValue });
        continue;
      }

      const column = columns.selectById(id);
      if (column && isSerialType(column.dataType)) continue;

      stack.push({ id, tableId, value });
    }
  }

  return payloads;
}
