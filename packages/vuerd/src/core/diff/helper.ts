import _ from 'lodash';

import { getLatestSnapshot } from '@/core/contextmenu/export.menu';
import { Diff } from '@/core/diff';
import { createStoreCopy } from '@/core/file';
import { getData } from '@/core/helper';
import { ERDEditorContext } from '@@types/index';

export function calculateDiff(context: ERDEditorContext): Diff[] {
  const newest = createStoreCopy(context.store);
  const snapshot = getLatestSnapshot(context.snapshots);
  if (!snapshot) return [];

  const newTables = newest.table.tables;
  const oldTables = snapshot.table.tables;
  const newRelationships = newest.relationship.relationships;
  const oldRelationships = snapshot.relationship.relationships;
  const newIndexes = newest.table.indexes;
  const oldIndexes = snapshot.table.indexes;

  const diffs: Diff[] = [];

  // TABLES
  newTables.forEach(newTable => {
    var oldTable = getData(oldTables, newTable.id);

    if (!oldTable)
      diffs.push({
        type: 'table',
        changes: 'add',
        data: {
          newTable: newTable,
        },
      });
    // table was modified
    else if (oldTable != newTable) {
      // check columns
      newTable.columns.forEach(newColumn => {
        var oldColumn = getData(
          oldTable ? oldTable?.columns : [],
          newColumn.id
        );

        // column is new
        if (!oldColumn)
          diffs.push({
            type: 'column',
            changes: 'add',
            data: {
              table: newTable,
              newColumn: newColumn,
            },
          });
        // column was modified
        else if (
          oldColumn?.dataType !== newColumn.dataType ||
          oldColumn?.name !== newColumn.name ||
          !_.isEqual(oldColumn?.option, newColumn.option)
        ) {
          diffs.push({
            type: 'column',
            changes: 'modify',
            data: {
              table: newTable,
              oldColumn: oldColumn,
              newColumn: newColumn,
            },
          });
        }
      });

      // check for drop column
      oldTable?.columns.forEach(oldColumn => {
        var newColumn = getData(newTable.columns, oldColumn.id);

        // if drop column
        if (!newColumn && oldTable) {
          diffs.push({
            type: 'column',
            changes: 'remove',
            data: {
              table: oldTable,
              oldColumn: oldColumn,
            },
          });
        }
      });

      // if rename table
      if (oldTable && oldTable.name !== newTable.name) {
        diffs.push({
          type: 'table',
          changes: 'modify',
          data: {
            oldTable: oldTable,
            newTable: newTable,
          },
        });
      }
    }
  });

  // check for drop table
  oldTables.forEach(oldTable => {
    var newTable = getData(newTables, oldTable.id);

    // old table was dropped
    if (!newTable)
      diffs.push({
        type: 'table',
        changes: 'remove',
        data: {
          oldTable: oldTable,
        },
      });
  });

  // INDEXES
  if (newIndexes != oldIndexes) {
    // check for new index
    newIndexes.forEach(newIndex => {
      const oldIndex = getData(oldIndexes, newIndex.id);

      // if new index
      if (oldIndex === undefined) {
        var newTable = getData(newTables, newIndex.tableId);

        if (newTable)
          diffs.push({
            type: 'index',
            changes: 'add',
            data: {
              newIndex: newIndex,
            },
          });
      }
    });

    // check for drop index
    oldIndexes.forEach(oldIndex => {
      const newIndex = getData(newIndexes, oldIndex.id);

      // if drop index
      if (newIndex === undefined) {
        const oldTable = getData(oldTables, oldIndex.tableId);

        if (oldTable)
          diffs.push({
            type: 'index',
            changes: 'remove',
            data: {
              oldIndex: oldIndex,
            },
          });
      }
    });
  }

  // RELATIONSHIP
  if (newRelationships != oldRelationships) {
    // relationship drop
    oldRelationships.forEach(oldRelationship => {
      const newRelationship = getData(newRelationships, oldRelationship.id);
      if (!newRelationship)
        diffs.push({
          type: 'relationship',
          changes: 'remove',
          data: {
            oldRelationship: oldRelationship,
          },
        });
    });

    // add relationship
    newRelationships.forEach(newRelationship => {
      const oldRelationship = getData(oldRelationships, newRelationship.id);
      if (!oldRelationship)
        diffs.push({
          type: 'relationship',
          changes: 'remove',
          data: {
            newRelationship: newRelationship,
          },
        });
    });
  }

  return diffs;
}
