import { getData } from '@/core/helper';
import {
  Attribute,
  Author,
  Constraints,
  createXMLString,
  Dialect,
  FormatChangeSet,
  FormatColumnOptions,
  FormatIndexOptions,
  formatNames,
  FormatRelationOptions,
  FormatTableDiff,
  FormatTableOptions,
  KeyColumn,
  translate,
  XMLNode,
} from '@/core/parser/helper';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { ExportedStore, Store } from '@@types/engine/store';
import { Database } from '@@types/engine/store/canvas.state';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';

import { parseAddForeignKeyConstraint } from './LiquibaseParser';

/**
 * Creates Liquibase XML file with export (*only supports source dialect 'PostgreSQL' and creates changeSet in 'oracle', 'mssql' and 'postgresql')
 */
export function createLiquibase(
  store: Store,
  snapshot?: ExportedStore,
  database?: Database
): string {
  const currentDatabase = database ? database : store.canvasState.database;

  const author: Author = {
    id: prompt('Please enter the name of changeset', 'unknown') || 'unknown',
    name: prompt('Please enter your name', 'unknown') || 'unknown',
  };

  var changeSets: XMLNode[];

  switch (currentDatabase) {
    case 'PostgreSQL':
      changeSets = createXMLPostgreOracleMSS(store, snapshot, author);
      break;
    default:
      alert(
        `Export from ${currentDatabase} dialect not supported, please use PostgreSQL`
      );
      return '';
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.0.xsd">`,
    createXMLString(changeSets),
    `</databaseChangeLog>`,
  ].join('\n');
}

export const createXMLPostgreOracleMSS = (
  { tableState, relationshipState }: Store,
  snapshot: ExportedStore | undefined,
  author: Author
): XMLNode[] => {
  console.log(snapshot);

  let changeSets: XMLNode[] = [];

  if (snapshot && snapshot.table !== tableState) {
    console.log('Tables were changed, generating diff...');

    tableState.tables[0].name;
    changeSets.push(
      ...createTableDiff({
        tableState,
        relationshipState,
        author,
        snapshotTableState: snapshot.table,
        snapshotRelationshipState: snapshot.relationship,
      })
    );

    console.log('DIFF:', changeSets[changeSets.length - 1]);

    return changeSets;
  }

  return [
    createChangeSet({
      dialect: 'postgresql',
      tableState,
      relationshipState,
      author,
    }),
    createChangeSet({
      dialect: 'oracle',
      tableState,
      relationshipState,
      author,
    }),
    createChangeSet({
      dialect: 'mssql',
      tableState,
      relationshipState,
      author,
    }),
  ];
};

export const generateChangeSetAttr = (
  author: Author,
  dialect: Dialect
): Attribute[] => {
  return [
    { name: 'author', value: author.name },
    { name: 'id', value: `${author.id}-${dialect}` },
    { name: 'dbms', value: dialect },
  ];
};

export const createTableDiff = ({
  tableState,
  relationshipState,
  author,
  snapshotTableState,
  snapshotRelationshipState,
}: FormatTableDiff): XMLNode[] => {
  var changeSets: XMLNode[] = [];

  var changeSetModifyPG: XMLNode = new XMLNode('changeSet');
  var changeSetModifyOracle: XMLNode = new XMLNode('changeSet');
  var changeSetModifyMssql: XMLNode = new XMLNode('changeSet');
  var changeSetCommon: XMLNode = new XMLNode('changeSet');

  const newTables = orderByNameASC(tableState.tables);
  const oldTables = orderByNameASC(snapshotTableState.tables);

  const newRelationships = relationshipState.relationships;
  const oldRelationships = snapshotRelationshipState.relationships;

  changeSetModifyPG.addAttribute(
    ...generateChangeSetAttr(author, 'postgresql')
  );
  changeSetModifyOracle.addAttribute(
    ...generateChangeSetAttr(author, 'oracle')
  );
  changeSetModifyMssql.addAttribute(...generateChangeSetAttr(author, 'mssql'));

  changeSetCommon.addAttribute(
    { name: 'author', value: author.name },
    { name: 'id', value: `${author.id}-common` }
  );

  // TABLES
  newTables.forEach(newTable => {
    var oldTable: Table | undefined = getData(oldTables, newTable.id);

    // new table was added
    if (oldTable === undefined) {
      changeSetModifyPG.addChildren(
        createTable({ table: newTable, dialect: 'postgresql' })
      );
      changeSetModifyOracle.addChildren(
        createTable({ table: newTable, dialect: 'oracle' })
      );
      changeSetModifyMssql.addChildren(
        createTable({ table: newTable, dialect: 'mssql' })
      );
    }

    // table was modified
    if (oldTable != newTable) {
      var columnsToAdd: Column[] = [];

      // check columns
      newTable.columns.forEach(newColumn => {
        var oldColumn = getData(
          oldTable ? oldTable?.columns : [],
          newColumn.id
        );

        // column is new
        if (oldColumn === undefined) {
          columnsToAdd.push(newColumn);
        }

        // column was modified
        else if (oldColumn != newColumn) {
          // datatype was changed
          if (oldColumn?.dataType !== newColumn.dataType) {
            changeSetModifyPG.addChildren(
              modifyDataType(newTable, newColumn, 'postgresql')
            );
            changeSetModifyOracle.addChildren(
              modifyDataType(newTable, newColumn, 'oracle')
            );
            changeSetModifyMssql.addChildren(
              modifyDataType(newTable, newColumn, 'mssql')
            );
          }

          // name was changed
          if (oldColumn?.name !== newColumn.name) {
            changeSetCommon.addChildren(
              renameColumn(newTable, newColumn, oldColumn)
            );
          }
        }
      });

      // if found new columns
      if (columnsToAdd.length) {
        changeSetModifyPG.addChildren(
          addColumn(newTable, columnsToAdd, 'postgresql')
        );
        changeSetModifyOracle.addChildren(
          addColumn(newTable, columnsToAdd, 'oracle')
        );
        changeSetModifyMssql.addChildren(
          addColumn(newTable, columnsToAdd, 'mssql')
        );
      }

      // check for drop column
      oldTable?.columns.forEach(oldColumn => {
        var newColumn = getData(newTable.columns, oldColumn.id);

        // if drop column
        if (!newColumn) {
          changeSetCommon.addChildren(dropColumn(newTable, oldColumn));
        }
      });

      // if rename table
      if (oldTable && oldTable.name !== newTable.name) {
        changeSetCommon.addChildren(renameTable(oldTable, newTable));
      }
    }
  });

  // check for drop table
  oldTables.forEach(oldTable => {
    var newTable = getData(newTables, oldTable.id);

    // old table was dropped
    if (!newTable) {
      changeSetCommon.addChildren(dropTable(oldTable));
    }
  });

  // INDEXES
  if (tableState.indexes != snapshotTableState.indexes) {
    // check for new index
    tableState.indexes.forEach(newIndex => {
      const oldIndex: Index | undefined = getData(
        snapshotTableState.indexes,
        newIndex.id
      );

      // if new index
      if (oldIndex === undefined) {
        var newTable: Table | undefined = getData(newTables, newIndex.tableId);

        if (newTable) {
          changeSetCommon.addChildren(
            createIndex({ table: newTable, index: newIndex })
          );
        }
      }
    });

    // check for drop index
    snapshotTableState.indexes.forEach(oldIndex => {
      const newIndex: Index | undefined = getData(
        tableState.indexes,
        oldIndex.id
      );

      // if new index
      if (newIndex === undefined) {
        const oldTable: Table | undefined = getData(
          oldTables,
          oldIndex.tableId
        );

        if (oldTable) {
          changeSetCommon.addChildren(dropIndex(oldTable, oldIndex));
        }
      }
    });
  }

  // RELATIONSHIP
  if (newRelationships != oldRelationships) {
    // relationship drop
    oldRelationships.forEach(oldRelationship => {
      const newRelationship = getData(newRelationships, oldRelationship.id);
      const oldTable = getData(oldTables, oldRelationship.end.tableId);

      if (newRelationship === undefined) {
        changeSetCommon.addChildren(
          dropForeignKeyConstraint(oldTable, oldRelationship)
        );
      }
    });

    // add relationship
    newRelationships.forEach(newRelationship => {
      const oldRelationship = getData(oldRelationships, newRelationship.id);

      if (oldRelationship === undefined) {
        changeSetCommon.addChildren(
          addForeignKeyConstraint({
            tables: newTables,
            relationship: newRelationship,
          })
        );
      }
    });
  }

  // if modification
  if (changeSetModifyPG.children.length) {
    changeSets.push(changeSetModifyPG);
    changeSets.push(changeSetModifyOracle);
    changeSets.push(changeSetModifyMssql);
  }

  // if common
  if (changeSetCommon.children.length) {
    changeSets.push(changeSetCommon);
  }

  return changeSets;
};

export const createChangeSet = ({
  dialect,
  tableState,
  relationshipState,
  author,
}: FormatChangeSet): XMLNode => {
  var changeSet: XMLNode = new XMLNode('changeSet');

  const tables = orderByNameASC(tableState.tables);
  const relationships = relationshipState.relationships;
  const indexes = tableState.indexes;

  changeSet.addAttribute(
    { name: 'author', value: author.name },
    { name: 'id', value: `${author.id}-${dialect}` },
    { name: 'dbms', value: dialect }
  );

  tables.forEach(table => {
    changeSet.addChildren(
      createTable({
        table,
        dialect,
      })
    );
  });

  relationships.forEach(relationship => {
    changeSet.addChildren(
      addForeignKeyConstraint({
        tables,
        relationship,
      })
    );
  });

  indexes.forEach(index => {
    const table = getData(tables, index.tableId);
    if (table)
      changeSet.addChildren(
        createIndex({
          table,
          index,
        })
      );
  });

  return changeSet;
};

export const createTable = ({
  table,
  dialect,
}: FormatTableOptions): XMLNode => {
  var createTable: XMLNode = new XMLNode('createTable');

  createTable.addAttribute({ name: 'tableName', value: table.name });

  if (table.comment)
    createTable.addAttribute({ name: 'remarks', value: table.comment });

  table.columns.forEach((column, i) => {
    createTable.addChildren(
      formatColumn({
        column,
        dialect,
      })
    );
  });

  return createTable;
};

/**
 * Formatting of one column
 */
export const formatColumn = ({
  column,
  dialect,
}: FormatColumnOptions): XMLNode => {
  var columnXML: XMLNode = new XMLNode('column', [
    { name: 'name', value: column.name },
    {
      name: 'type',
      value: translate('postgresql', dialect, column.dataType),
    },
  ]);

  if (column.dataType)
    columnXML.addAttribute({
      name: 'type',
      value: translate('postgresql', dialect, column.dataType),
    });

  if (column.option.autoIncrement)
    columnXML.addAttribute({
      name: 'autoIncrement',
      value: column.option.autoIncrement.toString(),
    });

  if (column.default)
    columnXML.addAttribute({ name: 'defaultValue', value: column.default });

  if (column.comment)
    columnXML.addAttribute({ name: 'remarks', value: column.comment });

  // if constraints
  if (
    column.option.notNull ||
    column.option.primaryKey ||
    column.option.unique
  ) {
    columnXML.addChildren(
      formatConstraints({
        primaryKey: column.option.primaryKey,
        nullable: !column.option.notNull,
        unique: column.option.unique,
      })
    );
  }

  return columnXML;
};

/**
 * Formatting constraints inside one column
 */
export const formatConstraints = (constraints: Constraints): XMLNode => {
  var constraintsXML: XMLNode = new XMLNode('constraints');

  if (constraints.primaryKey)
    constraintsXML.addAttribute({
      name: 'primaryKey',
      value: constraints.primaryKey.toString(),
    });

  if (constraints.nullable === false)
    constraintsXML.addAttribute({
      name: 'nullable',
      value: constraints.nullable.toString(),
    });

  if (constraints.unique)
    constraintsXML.addAttribute({
      name: 'unique',
      value: constraints.unique.toString(),
    });

  return constraintsXML;
};

export const addForeignKeyConstraint = ({
  tables,
  relationship,
}: FormatRelationOptions): XMLNode => {
  const startTable = getData(tables, relationship.start.tableId);
  const endTable = getData(tables, relationship.end.tableId);

  if (startTable && endTable) {
    const columns: KeyColumn = {
      start: [],
      end: [],
    };
    relationship.end.columnIds.forEach(columnId => {
      const column = getData(endTable.columns, columnId);
      if (column) {
        columns.end.push(column);
      }
    });
    relationship.start.columnIds.forEach(columnId => {
      const column = getData(startTable.columns, columnId);
      if (column) {
        columns.start.push(column);
      }
    });

    return new XMLNode('addForeignKeyConstraint', [
      { name: 'baseColumnNames', value: formatNames(columns.end) },
      { name: 'baseTableName', value: endTable.name },
      {
        name: 'constraintName',
        value: `FK_${endTable.name}_TO_${startTable.name}`,
      },
      { name: 'deferrable', value: 'false' },
      { name: 'initiallyDeferred', value: 'false' },
      { name: 'referencedColumnNames', value: formatNames(columns.start) },
      { name: 'referencedTableName', value: startTable.name },
    ]);
  }

  return new XMLNode('');
};

/**
 * Creating index
 */
export const createIndex = ({ table, index }: FormatIndexOptions): XMLNode => {
  // gets real columns, using id
  const colsWithIndex = index.columns
    .map(indexColumn => {
      const column = getData(table.columns, indexColumn.id);
      if (column) {
        return {
          name: `${column.name}`,
          descending: indexColumn.orderType === 'DESC',
        };
      }
      return null;
    })
    .filter(columnName => columnName !== null) as {
    name: string;
    descending: boolean;
  }[];

  if (colsWithIndex.length !== 0) {
    var createIndex: XMLNode = new XMLNode('createIndex');

    let indexName = index.name;
    if (index.name.trim() === '') {
      indexName = `${table.name}`;
    }

    createIndex.addAttribute(
      { name: 'indexName', value: indexName },
      { name: 'tableName', value: table.name }
    );

    if (index.unique)
      createIndex.addAttribute({
        name: 'unique',
        value: index.unique.toString(),
      });

    colsWithIndex.forEach(column => {
      var columnXML = new XMLNode('column', [
        { name: 'name', value: column.name },
      ]);

      if (column.descending)
        columnXML.addAttribute({
          name: 'descending',
          value: column.descending.toString(),
        });

      createIndex.addChildren(columnXML);
    });

    return createIndex;
  }

  return new XMLNode('');
};

export const dropTable = (table: Table): XMLNode => {
  return new XMLNode('dropTable', [{ name: 'tableName', value: table.name }]);
};

export const addColumn = (
  table: Table,
  columns: Column[],
  dialect: Dialect
): XMLNode => {
  var addColumn: XMLNode = new XMLNode('addColumn', [
    { name: 'tableName', value: table.name },
  ]);

  columns.forEach(column => {
    addColumn.addChildren(formatColumn({ column, dialect }));
  });

  return addColumn;
};

export const dropColumn = (table: Table, column: Column): XMLNode => {
  return new XMLNode('dropColumn', [
    { name: 'tableName', value: table.name },
    { name: 'columnName', value: column.name },
  ]);
};

export const modifyDataType = (
  table: Table,
  newColumn: Column,
  dialectTo: Dialect
): XMLNode => {
  return new XMLNode('modifyDataType', [
    { name: 'tableName', value: table.name },
    { name: 'columnName', value: newColumn.name },
    {
      name: 'newDataType',
      value: translate('postgresql', dialectTo, newColumn.dataType),
    },
  ]);
};

export const renameColumn = (
  table: Table,
  newColumn: Column,
  oldColumn: Column
): XMLNode => {
  return new XMLNode('renameColumn', [
    { name: 'tableName', value: table.name },
    { name: 'newColumnName', value: newColumn.name },
    { name: 'oldColumnName', value: oldColumn.name },
  ]);
};

export const renameTable = (newTable: Table, oldTable: Table): XMLNode => {
  return new XMLNode('renameTable', [
    { name: 'newTableName', value: newTable.name },
    { name: 'oldTableName', value: oldTable.name },
  ]);
};

export const dropIndex = (table: Table, index: Index): XMLNode => {
  return new XMLNode('dropIndex', [
    { name: 'indexName', value: index.name },
    { name: 'tableName', value: table.name },
  ]);
};

function dropForeignKeyConstraint(
  table: any,
  relationship: Relationship
): XMLNode {
  return new XMLNode('dropForeignKeyConstraint', [
    { name: 'baseTableName', value: table.name },
    { name: 'constraintName', value: relationship.constraintName || '???' },
  ]);
}
