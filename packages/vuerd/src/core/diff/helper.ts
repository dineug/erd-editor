import _ from 'lodash';

import { getLatestSnapshot } from '@/core/contextmenu/export.menu';
import { Diff } from '@/core/diff';
import { createStoreCopy } from '@/core/file';
import { getData } from '@/core/helper';
import { Logger } from '@/core/logger';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { ExportedStore } from '@@types/engine/store';

export function calculateLatestDiff(context: IERDEditorContext): Diff[] {
  Logger.log('calculateLatestDiff');
  const newest = createStoreCopy(context.store);
  const snapshot = getLatestSnapshot(context)?.data;
  if (!snapshot) return [];
  Logger.log('got diff');
  Logger.log(snapshot);

  return calculateDiff(snapshot, newest);
}

export function calculateDiff(
  oldSnapshot: ExportedStore,
  newSnapshot: ExportedStore
): Diff[] {
  const newTables = newSnapshot.table.tables;
  const oldTables = oldSnapshot.table.tables;
  const newRelationships = newSnapshot.relationship.relationships;
  const oldRelationships = oldSnapshot.relationship.relationships;
  const newIndexes = newSnapshot.table.indexes;
  const oldIndexes = oldSnapshot.table.indexes;

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
              table: newTable,
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
              table: oldTable,
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
      if (!newRelationship) {
        const table = getData(oldTables, oldRelationship.end.tableId);
        diffs.push({
          type: 'relationship',
          changes: 'remove',
          data: {
            oldRelationship: oldRelationship,
            table: table,
          },
        });
      }
    });

    // add relationship
    newRelationships.forEach(newRelationship => {
      const oldRelationship = getData(oldRelationships, newRelationship.id);
      if (!oldRelationship) {
        const startTable = getData(newTables, newRelationship.start.tableId);
        const endTable = getData(newTables, newRelationship.end.tableId);

        diffs.push({
          type: 'relationship',
          changes: 'add',
          data: {
            newRelationship: newRelationship,
            startTable: startTable,
            endTable: endTable,
          },
        });
      }
    });
  }

  return diffs;
}

export function mergeDiffs(diffs1: Diff[], diffs2: Diff[]): Diff[] {
  // todo check for overlaps
  return [...diffs1, ...diffs2];
}
