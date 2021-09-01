import isEqual from 'lodash/isEqual';

import { getLatestSnapshot } from '@/core/contextmenu/export.menu';
import { Diff } from '@/core/diff';
import { createStoreCopy } from '@/core/file';
import { cloneDeep, getData, uuid } from '@/core/helper';
import { SIZE_MIN_WIDTH } from '@/core/layout';
import { Logger } from '@/core/logger';
import {
  createColumn,
  findByConstraintName,
  findByName,
} from '@/core/parser/ParserToJson';
import { TableModel } from '@/engine/store/models/table.model';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Snapshot } from '@@types/engine/store/snapshot';
import { Column } from '@@types/engine/store/table.state';

export function calculateLatestDiff(context: IERDEditorContext): Diff[] {
  Logger.log('calculateLatestDiff');
  const newest = createStoreCopy(context.store);
  const snapshot = getLatestSnapshot(context);
  if (!snapshot) return [];
  Logger.log('got diff');
  const diffs = calculateDiff(snapshot, { data: newest });
  Logger.log(diffs);

  return diffs;
}

export function calculateDiff(
  { data: oldSnapshot }: Snapshot,
  { data: newSnapshot }: Snapshot
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
        newTable: newTable,
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
            table: newTable,
            newColumn: newColumn,
          });
        // column was modified
        else if (
          oldColumn?.dataType !== newColumn.dataType ||
          oldColumn?.name !== newColumn.name ||
          !isEqual(oldColumn?.option, newColumn.option)
        ) {
          diffs.push({
            type: 'column',
            changes: 'modify',
            table: newTable,
            oldColumn: oldColumn,
            newColumn: newColumn,
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
            table: oldTable,
            oldColumn: oldColumn,
          });
        }
      });

      // if rename table
      if (oldTable && oldTable.name !== newTable.name) {
        diffs.push({
          type: 'table',
          changes: 'modify',
          oldTable: oldTable,
          newTable: newTable,
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
        oldTable: oldTable,
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
            newIndex: newIndex,
            table: newTable,
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
            oldIndex: oldIndex,
            table: oldTable,
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
        if (!table) return;
        diffs.push({
          type: 'relationship',
          changes: 'remove',
          oldRelationship: oldRelationship,
          table: table,
        });
      }
    });

    // add relationship
    newRelationships.forEach(newRelationship => {
      const oldRelationship = getData(oldRelationships, newRelationship.id);
      if (!oldRelationship) {
        const startTable = getData(newTables, newRelationship.start.tableId);
        const endTable = getData(newTables, newRelationship.end.tableId);
        if (!startTable || !endTable) return;

        diffs.push({
          type: 'relationship',
          changes: 'add',
          newRelationship: newRelationship,
          startTable: startTable,
          endTable: endTable,
        });
      }
    });
  }

  return diffs;
}

export function mergeDiffs(...diffs: Diff[][]): Diff[] {
  let currentDiffs: Diff[] = [];

  diffs.reverse().forEach((changes, index) => {
    if (index === 0) {
      currentDiffs = changes;
    } else {
      changes.forEach(diff => {
        // TODO: add more checks
        // deduplication
        //  --  add table ONE -> drop table ONE -> should result to: no change
        //  --  add table ONE -> rename table ONE to TWO -> should result to: add table TWO
        if (diff.type === 'table' && diff.changes === 'remove') {
          currentDiffs = currentDiffs.filter(
            origDiff =>
              !(
                origDiff.type === 'table' &&
                origDiff.changes === 'add' &&
                origDiff.newTable.name === diff.oldTable.name
              )
          );
        } else if (diff.type === 'column' && diff.changes === 'remove') {
          currentDiffs = currentDiffs.filter(
            origDiff =>
              !(
                origDiff.type === 'column' &&
                origDiff.changes === 'add' &&
                origDiff.newColumn.name === diff.oldColumn.name
              )
          );
        } else {
          currentDiffs.push(diff);
        }
      });
    }
  });

  return currentDiffs;
}

export function statementsToDiff(
  snapshot: Snapshot,
  context: IERDEditorContext
): Diff[] {
  if (!snapshot.metadata?.statements) return [];

  const { helper } = context;
  const statements = snapshot.metadata.statements;

  const diffs: Diff[] = [];
  const { tables: snapTables, indexes: snapIndexes } = snapshot.data.table;
  const { relationships: snapRelationships } = snapshot.data.relationship;

  statements.forEach(statement => {
    switch (statement.type) {
      case 'create.table':
        const table = statement;
        const originalTable = findByName(snapTables || [], table.name);

        const columns = table.columns.map(column => {
          const newColumn: Column = {
            id: column.id || uuid(),
            name: column.name,
            comment: column.comment,
            dataType: column.dataType,
            default: column.default,
            option: {
              autoIncrement: column.autoIncrement,
              primaryKey: column.primaryKey,
              unique: column.unique,
              notNull: !column.nullable,
            },
            ui: {
              active: false,
              pk: column.primaryKey,
              fk: false,
              pfk: false,
              widthName: SIZE_MIN_WIDTH,
              widthComment: SIZE_MIN_WIDTH,
              widthDataType: SIZE_MIN_WIDTH,
              widthDefault: SIZE_MIN_WIDTH,
            },
          };
          return newColumn;
        });

        const loadTable = {
          id: table.id || uuid(),
          name: table.name,
          comment: table.comment,
          columns: columns,
          ui: originalTable
            ? originalTable.ui
            : {
                active: false,
                top: 0,
                left: 0,
                widthName: SIZE_MIN_WIDTH,
                widthComment: SIZE_MIN_WIDTH,
                zIndex: 2,
              },
        };

        const canvasState = context.store.canvasState;
        const newTable = new TableModel(
          { loadTable: loadTable },
          canvasState.show
        );

        diffs.push({
          type: 'table',
          changes: 'add',
          newTable: newTable,
        });
        break;
      case 'create.index':
        const index = statement;
        const duplicateIndex = findByName(snapIndexes, index.name);
        const targetTable = findByName(snapTables, index.tableName);

        if (duplicateIndex && targetTable) {
          diffs.push({
            type: 'index',
            changes: 'add',
            newIndex: duplicateIndex,
            table: targetTable,
          });
          break;
        }

        if (!targetTable) break;

        const indexColumns: any[] = [];

        index.columns.forEach(column => {
          const targetColumn = findByName(targetTable.columns, column.name);
          if (targetColumn) {
            indexColumns.push({
              id: targetColumn.id,
              orderType: column.sort,
            });
          }
        });

        diffs.push({
          type: 'index',
          changes: 'add',
          newIndex: {
            id: index.id || uuid(),
            name: index.name,
            tableId: targetTable.id,
            columns: indexColumns,
            unique: index.unique,
          },
          table: targetTable,
        });
        break;
      case 'alter.table.add.primaryKey':
        const primaryKey = statement;

        const pkTable = findByName(snapTables, primaryKey.name);
        if (!pkTable) break;

        primaryKey.columnNames.forEach(pkColumnName => {
          const oldPKColumn = findByName(pkTable.columns, pkColumnName);
          if (!oldPKColumn) return;

          const newPKColumn = cloneDeep(oldPKColumn) as Column;
          newPKColumn.option.primaryKey = true;

          diffs.push({
            type: 'column',
            changes: 'modify',
            table: pkTable,
            oldColumn: oldPKColumn,
            newColumn: newPKColumn,
          });
        });

        break;
      case 'alter.table.add.foreignKey':
        const foreignKey = statement;

        const endTable = findByName(snapTables, foreignKey.name);
        const startTable = findByName(snapTables, foreignKey.refTableName);

        if (endTable && startTable) {
          const startColumns: any[] = [];
          const endColumns: any[] = [];

          foreignKey.refColumnNames.forEach(refColumnName => {
            const column = findByName(startTable.columns, refColumnName);
            if (column) {
              startColumns.push(column);
            }
          });

          foreignKey.columnNames.forEach(columnName => {
            const column = findByName(endTable.columns, columnName);
            if (column) {
              endColumns.push(column);
              if (column.ui.pk) {
                column.ui.pk = false;
                column.ui.pfk = true;
              } else {
                column.ui.fk = true;
              }
            }
          });

          if (startTable.visible && endTable.visible) {
            foreignKey.visible = true;
          } else {
            foreignKey.visible = false;
          }

          const newRelationship: Relationship = {
            id: foreignKey.id || uuid(),
            identification: !endColumns.some(column => !column.ui.pfk),
            relationshipType: 'ZeroOneN',
            start: {
              tableId: startTable.id,
              columnIds: startColumns.map(column => column.id),
              x: 0,
              y: 0,
              direction: 'top',
            },
            end: {
              tableId: endTable.id,
              columnIds: endColumns.map(column => column.id),
              x: 0,
              y: 0,
              direction: 'top',
            },
            constraintName: foreignKey.constraintName,
            visible: foreignKey.visible,
          };

          diffs.push({
            type: 'relationship',
            changes: 'add',
            newRelationship: newRelationship,
            startTable: startTable,
            endTable: endTable,
          });
        }

        break;
      case 'alter.table.add.unique':
        const unique = statement;

        const uqTable = findByName(snapTables, unique.name);
        if (!uqTable) break;

        unique.columnNames.forEach(uqColumnName => {
          const oldUQColumn = findByName(uqTable.columns, uqColumnName);
          if (!oldUQColumn) return;

          const newUQColumn = cloneDeep(oldUQColumn) as Column;
          newUQColumn.option.unique = true;

          diffs.push({
            type: 'column',
            changes: 'modify',
            table: uqTable,
            oldColumn: oldUQColumn,
            newColumn: newUQColumn,
          });
        });

        break;
      case 'alter.table.add.column':
        const addColumns = statement;

        const acTable = findByName(snapTables, addColumns.name);
        if (!acTable) break;

        addColumns.columns.forEach(col => {
          const addColumn = createColumn(helper, col);

          diffs.push({
            type: 'column',
            changes: 'add',
            table: acTable,
            newColumn: addColumn,
          });
        });

        break;
      case 'alter.table.drop.column':
        const dropColumns = statement;

        const dcTable = findByName(snapTables, dropColumns.name);

        dcTable?.columns.forEach(col => {
          diffs.push({
            type: 'column',
            changes: 'remove',
            table: dcTable,
            oldColumn: col,
          });
        });

        break;
      case 'drop.table':
        const { name: tableName } = statement;
        const dropTable = findByName(snapTables, tableName);
        if (dropTable) {
          diffs.push({
            type: 'table',
            changes: 'remove',
            oldTable: dropTable,
          });
        }
        break;
      case 'alter.table.drop.foreignKey':
        const dropForeignKey = statement;
        const duplicateDropFK = findByConstraintName(
          snapRelationships,
          dropForeignKey.name
        );

        if (!duplicateDropFK) break;
        const dfkTable = getData(snapTables, duplicateDropFK.end.tableId);

        if (!dfkTable) break;

        diffs.push({
          type: 'relationship',
          changes: 'remove',
          oldRelationship: duplicateDropFK,
          table: dfkTable,
        });

        break;
    }
  });

  return diffs;
}
