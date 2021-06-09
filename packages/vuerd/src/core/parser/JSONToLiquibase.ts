import { Store } from '@@types/engine/store';
import { Database } from '@@types/engine/store/canvas.state';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { getData, uuid, autoName } from '@/core/helper';

import {
  FormatTableOptions,
  FormatColumnOptions,
  Constraints,
  FormatRelationOptions,
  FormatIndexOptions,
  KeyColumn,
  formatNames,
  Author,
  FormatChangeSet,
  translate,
  createXMLString,
  XMLNode,
} from '@/core/parser/helper';

/**
 * Creates Liquibase XML file with export (*only supports source dialect 'PostgreSQL' and creates changeSet in 'oracle', 'mssql' and 'postgresql')
 */
export function createLiquibase(store: Store, database?: Database): string {
  const currentDatabase = database ? database : store.canvasState.database;
  switch (currentDatabase) {
    case 'PostgreSQL':
      return createXMLPostgreOracleMSS(store);
    default:
      alert(
        `Export from ${currentDatabase} dialect not supported, please use PostgreSQL`
      );
      return '';
  }
  return 'database not supported';
}

export const createXMLPostgreOracleMSS = ({
  tableState,
  relationshipState,
}: Store) => {
  const stringBuffer: string[] = [];

  const author: Author = {
    id: prompt('Please enter the name of changeset', 'unknown') || 'unknown',
    name: prompt('Please enter your name', 'unknown') || 'unknown',
  };

  const changeSets: XMLNode[] = [
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

  stringBuffer.push(
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<databaseChangeLog xmlns="http://www.liquibase.org/xml/ns/dbchangelog" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.0.xsd">`,
    createXMLString(changeSets),
    `</databaseChangeLog>`
  );

  return stringBuffer.join('\n');
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
