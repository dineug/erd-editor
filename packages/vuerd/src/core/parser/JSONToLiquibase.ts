import { autoName, getData, uuid } from '@/core/helper';
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
import { ExportedStore, State, Store } from '@@types/engine/store';
import { Database } from '@@types/engine/store/canvas.state';
import { Column, Index, Table } from '@@types/engine/store/table.state';

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
}: FormatTableDiff): XMLNode[] => {
  var changeSets: XMLNode[] = [];

  var changeSetModifyPG: XMLNode = {
    name: 'changeSet',
    attributes: [],
    children: [],
  };
  var changeSetModifyOracle: XMLNode = {
    name: 'changeSet',
    attributes: [],
    children: [],
  };
  var changeSetModifyMssql: XMLNode = {
    name: 'changeSet',
    attributes: [],
    children: [],
  };
  var changeSetCommon: XMLNode = {
    name: 'changeSet',
    attributes: [],
    children: [],
  };

  const tables = orderByNameASC(tableState.tables);
  // const relationships = relationshipState.relationships;
  // const indexes = tableState.indexes;

  changeSetModifyPG.attributes.push(
    ...generateChangeSetAttr(author, 'postgresql')
  );
  changeSetModifyOracle.attributes.push(
    ...generateChangeSetAttr(author, 'oracle')
  );
  changeSetModifyMssql.attributes.push(
    ...generateChangeSetAttr(author, 'mssql')
  );

  changeSetCommon.attributes.push(
    { name: 'author', value: author.name },
    { name: 'id', value: `${author.id}-common` }
  );

  tables.forEach(newTable => {
    var oldTable: Table | undefined = getData(
      snapshotTableState.tables,
      newTable.id
    );

    // new table was added
    if (oldTable === undefined) {
      changeSetModifyPG.children.push(
        createTable({ table: newTable, dialect: 'postgresql' })
      );
      changeSetModifyOracle.children.push(
        createTable({ table: newTable, dialect: 'oracle' })
      );
      changeSetModifyMssql.children.push(
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
          // todo edit column
          // datatype was changed
          if (oldColumn?.dataType !== newColumn.dataType) {
            changeSetModifyPG.children.push(
              modifyDataType(newTable, newColumn, 'postgresql')
            );
            changeSetModifyOracle.children.push(
              modifyDataType(newTable, newColumn, 'oracle')
            );
            changeSetModifyMssql.children.push(
              modifyDataType(newTable, newColumn, 'mssql')
            );
          }

          // name was changed
          if (oldColumn?.name !== newColumn.name) {
            changeSetCommon.children.push(
              renameColumn(newTable, newColumn, oldColumn)
            );
          }
        }
      });

      // if found new columns
      if (columnsToAdd.length) {
        changeSetModifyPG.children.push(
          addColumn(newTable, columnsToAdd, 'postgresql')
        );
        changeSetModifyOracle.children.push(
          addColumn(newTable, columnsToAdd, 'oracle')
        );
        changeSetModifyMssql.children.push(
          addColumn(newTable, columnsToAdd, 'mssql')
        );
      }

      // check for drop column
      oldTable?.columns.forEach(oldColumn => {
        var newColumn = getData(newTable.columns, oldColumn.id);

        // if drop column
        if (!newColumn) {
          changeSetCommon.children.push(dropColumn(newTable, oldColumn));
        }
      });

      // if rename table
      if (oldTable && oldTable.name !== newTable.name) {
        changeSetCommon.children.push(renameTable(oldTable, newTable));
      }
    }
  });

  // check for drop table
  snapshotTableState.tables.forEach(oldTable => {
    var newTable = getData(tableState.tables, oldTable.id);

    // old table was dropped
    if (!newTable) {
      changeSetCommon.children.push(dropTable(oldTable));
    }
  });

  // if modification
  if (changeSetModifyPG.children.length) {
    changeSets.push(changeSetModifyPG);
    changeSets.push(changeSetModifyOracle);
    changeSets.push(changeSetModifyMssql);
  }

  // if drop
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
  var changeSet: XMLNode = { name: 'changeSet', attributes: [], children: [] };

  const tables = orderByNameASC(tableState.tables);
  const relationships = relationshipState.relationships;
  const indexes = tableState.indexes;

  changeSet.attributes.push(
    { name: 'author', value: author.name },
    { name: 'id', value: `${author.id}-${dialect}` },
    { name: 'dbms', value: dialect }
  );

  tables.forEach(table => {
    changeSet.children.push(
      createTable({
        table,
        dialect,
      })
    );
  });

  relationships.forEach(relationship => {
    changeSet.children.push(
      formatRelation({
        tables,
        relationship,
      })
    );
  });

  indexes.forEach(index => {
    const table = getData(tables, index.tableId);
    if (table)
      changeSet.children.push(
        formatIndex({
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
  var createTable: XMLNode = {
    name: 'createTable',
    attributes: [],
    children: [],
  };

  createTable.attributes.push({ name: 'tableName', value: table.name });

  if (table.comment)
    createTable.attributes.push({ name: 'remarks', value: table.comment });

  table.columns.forEach((column, i) => {
    createTable.children.push(
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
  var columnXML: XMLNode = { name: 'column', attributes: [], children: [] };

  columnXML.attributes.push({ name: 'name', value: column.name });
  columnXML.attributes.push({
    name: 'type',
    value: translate('postgresql', dialect, column.dataType),
  });

  if (column.dataType)
    columnXML.attributes.push({
      name: 'type',
      value: translate('postgresql', dialect, column.dataType),
    });

  if (column.option.autoIncrement)
    columnXML.attributes.push({
      name: 'autoIncrement',
      value: column.option.autoIncrement.toString(),
    });

  if (column.default)
    columnXML.attributes.push({ name: 'defaultValue', value: column.default });

  if (column.comment)
    columnXML.attributes.push({ name: 'remarks', value: column.comment });

  // if constraints
  if (
    column.option.notNull ||
    column.option.primaryKey ||
    column.option.unique
  ) {
    columnXML.children.push(
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
  var constraintsXML: XMLNode = {
    name: 'constraints',
    attributes: [],
    children: [],
  };

  if (constraints.primaryKey)
    constraintsXML.attributes.push({
      name: 'primaryKey',
      value: constraints.primaryKey.toString(),
    });

  if (constraints.nullable === false)
    constraintsXML.attributes.push({
      name: 'nullable',
      value: constraints.nullable.toString(),
    });

  if (constraints.unique)
    constraintsXML.attributes.push({
      name: 'unique',
      value: constraints.unique.toString(),
    });

  return constraintsXML;
};

export const formatRelation = ({
  tables,
  relationship,
}: FormatRelationOptions): XMLNode => {
  const startTable = getData(tables, relationship.start.tableId);
  const endTable = getData(tables, relationship.end.tableId);

  if (startTable && endTable) {
    var relationshipXML: XMLNode = {
      name: 'addForeignKeyConstraint',
      attributes: [],
      children: [],
    };

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

    relationshipXML.attributes.push(
      { name: 'baseColumnNames', value: formatNames(columns.end) },
      { name: 'baseTableName', value: endTable.name },
      {
        name: 'constraintName',
        value: `FK_${endTable.name}_TO_${startTable.name}`,
      },
      { name: 'deferrable', value: 'false' },
      { name: 'initiallyDeferred', value: 'false' },
      { name: 'referencedColumnNames', value: formatNames(columns.start) },
      { name: 'referencedTableName', value: startTable.name }
    );

    return relationshipXML;
  }

  return { name: '', attributes: [], children: [] };
};

/**
 * Creating index
 */
export const formatIndex = ({ table, index }: FormatIndexOptions): XMLNode => {
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
    var indexXML: XMLNode = {
      name: 'createIndex',
      attributes: [],
      children: [],
    };

    let indexName = index.name;
    if (index.name.trim() === '') {
      indexName = `${table.name}`;
    }

    indexXML.attributes.push(
      { name: 'indexName', value: indexName },
      { name: 'tableName', value: table.name }
    );

    if (index.unique)
      indexXML.attributes.push({
        name: 'unique',
        value: index.unique.toString(),
      });

    colsWithIndex.forEach(column => {
      var columnXML = {
        name: 'column',
        attributes: [{ name: 'name', value: column.name }],
        children: [],
      };

      if (column.descending)
        columnXML.attributes.push({
          name: 'descending',
          value: column.descending.toString(),
        });

      indexXML.children.push(columnXML);
    });

    return indexXML;
  }

  return { name: '', attributes: [], children: [] };
};

export const dropTable = (table: Table): XMLNode => {
  var createTable: XMLNode = {
    name: 'dropTable',
    attributes: [],
    children: [],
  };

  createTable.attributes.push({ name: 'tableName', value: table.name });

  return createTable;
};

export const addColumn = (
  table: Table,
  columns: Column[],
  dialect: Dialect
): XMLNode => {
  var addColumn: XMLNode = {
    name: 'addColumn',
    attributes: [],
    children: [],
  };

  addColumn.attributes.push({ name: 'tableName', value: table.name });

  columns.forEach(column => {
    addColumn.children.push(formatColumn({ column, dialect }));
  });

  return addColumn;
};

export const dropColumn = (table: Table, column: Column): XMLNode => {
  var dropColumn: XMLNode = {
    name: 'dropColumn',
    attributes: [],
    children: [],
  };

  dropColumn.attributes.push(
    { name: 'tableName', value: table.name },
    { name: 'columnName', value: column.name }
  );

  return dropColumn;
};

export const modifyDataType = (
  table: Table,
  newColumn: Column,
  dialectTo: Dialect
): XMLNode => {
  var modifyDataType: XMLNode = {
    name: 'modifyDataType',
    attributes: [],
    children: [],
  };

  modifyDataType.attributes.push(
    { name: 'tableName', value: table.name },
    { name: 'columnName', value: newColumn.name },
    {
      name: 'newDataType',
      value: translate('postgresql', dialectTo, newColumn.dataType),
    }
  );

  return modifyDataType;
};

export const renameColumn = (
  table: Table,
  newColumn: Column,
  oldColumn: Column
): XMLNode => {
  var renameColumn: XMLNode = {
    name: 'renameColumn',
    attributes: [],
    children: [],
  };

  renameColumn.attributes.push(
    { name: 'tableName', value: table.name },
    { name: 'newColumnName', value: newColumn.name },
    { name: 'oldColumnName', value: oldColumn.name }
  );

  return renameColumn;
};

export const renameTable = (newTable: Table, oldTable: Table): XMLNode => {
  var renameTable: XMLNode = {
    name: 'renameTable',
    attributes: [],
    children: [],
  };

  renameTable.attributes.push(
    { name: 'newTableName', value: newTable.name },
    { name: 'oldTableName', value: oldTable.name }
  );

  return renameTable;
};
