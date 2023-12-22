import {
  calculateDiff,
  mergeDiffs,
  statementsToDiff,
} from '@/core/diff/helper';
import { getPrimitiveType } from '@/core/generator/code/helper';
import { getData } from '@/core/helper';
import { Logger } from '@/core/logger';
import {
  Author,
  changeSetAttributes,
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
  generateSeqName,
  KeyColumn,
  mapppingTranslationsDatabase,
  supportedDialects,
  translate,
  XMLNode,
} from '@/core/parser/helper';
import { orderByNameASC } from '@/engine/store/helper/table.helper';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { Relationship } from '@@types/engine/store/relationship.state';
import { Snapshot } from '@@types/engine/store/snapshot';
import {
  Column,
  Index,
  Table,
  TableState,
} from '@@types/engine/store/table.state';

import { Diff } from '../diff';

const xmlns = 'http://www.liquibase.org/xml/ns/dbchangelog';
const xmlnsxsi = 'http://www.w3.org/2001/XMLSchema-instance';
const xsiSchemaLocation =
  'http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.0.xsd';

/**
 * Creates Liquibase XML file with export (*only supports source dialect `PostgreSQL` and creates changeSet in `oracle`, `mssql` and `postgresql`)
 */
export function createLiquibase(
  context: IERDEditorContext,
  id: string,
  name: string
): string {
  const currentDatabase = context.store.canvasState.database;

  var changeSets: XMLNode[];

  switch (currentDatabase) {
    case 'PostgreSQL':
      const author: Author = {
        id: id.replace(/\.xml$/g, ''),
        name: name,
      };

      changeSets = createXMLPostgreOracleMSS(context, author);
      break;
    default:
      alert(
        `Export from ${currentDatabase} dialect not supported, please use PostgreSQL`
      );
      return '';
  }

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<databaseChangeLog xmlns="${xmlns}" xmlns:xsi="${xmlnsxsi}" xsi:schemaLocation="${xsiSchemaLocation}">`,
    createXMLString(changeSets),
    `</databaseChangeLog>`,
  ].join('\n');
}

export const createXMLPostgreOracleMSS = (
  context: IERDEditorContext,
  author: Author
): XMLNode[] => {
  const { snapshots, store } = context;
  const { tableState, relationshipState } = store;

  // check if no previous snapshots (if size==1 --> first snapshot is the current state)
  if (snapshots.length <= 1) {
    return [
      createSequences(tableState, author),
      ...supportedDialects.map(dbName =>
        createChangeSet({
          dialect: dbName,
          tableState,
          relationshipState,
          author,
        })
      ),
    ];
  }

  Logger.log('Tables were changed, generating diff...');
  Logger.log({ snapshots });

  /**
   * Latest change
   */
  function mostRecentDiff(): Diff[] {
    var oldSnap = snapshots[snapshots.length - 1];
    var newSnap = snapshots[snapshots.length - 1];
    for (let i = snapshots.length - 1; i > 0; i--) {
      if (
        snapshots[i].metadata?.type === 'user' ||
        snapshots[i].metadata?.type === 'before-export'
      ) {
        newSnap = snapshots[i];
        oldSnap = snapshots[i - 1];
        break;
      }
    }
    Logger.log('mostRecentDiff()', calculateDiff(oldSnap, newSnap));

    return calculateDiff(oldSnap, newSnap);
  }

  /**
   * Original file that was imported
   */
  function originalFileImport(): Diff[][] {
    const snapsWithStatements: Snapshot[] = [];

    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (
        snapshots[i].metadata?.type === 'before-import' &&
        snapshots[i].metadata?.filename.replace(/\.xml$/g, '').toLowerCase() ===
          author.id.toLowerCase()
      ) {
        for (let j = i; j >= 0; j--) {
          if (
            snapshots[j].metadata?.filename
              .replace(/\.xml$/g, '')
              .toLowerCase() !== author.id.toLowerCase()
          ) {
            break;
          }
          snapsWithStatements.push(snapshots[j]);
        }
        break;
      }
    }

    const historicalDiffs: Diff[][] = [];

    for (let i = 0; i < snapsWithStatements.length; i++) {
      historicalDiffs.push(statementsToDiff(snapsWithStatements[i], context));
    }

    Logger.log('originalFileImport()', { historicalDiffs });

    return historicalDiffs;
  }

  /**
   * Files that were changed and snapshot changes are only stored in memory
   */
  function updatedFileImport(): Diff[][] {
    const diffs: Diff[][] = [];

    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (
        snapshots[i].metadata?.type === 'before-export' &&
        snapshots[i + 1]?.metadata?.type === 'after-export' &&
        snapshots[i].metadata?.filename.replace(/\.xml$/g, '').toLowerCase() ===
          author.id.toLowerCase()
      ) {
        diffs.push(calculateDiff(snapshots[i - 1], snapshots[i]));
      }
    }

    Logger.log('updatedFileImport()', { diffs });
    return diffs;
  }

  return createTableDiff({
    author,
    diffs: mergeDiffs(
      mostRecentDiff(),
      ...updatedFileImport(),
      ...originalFileImport()
    ),
  });
};

function generateChangeSetSequence(author: Author): XMLNode {
  return new XMLNode(
    'changeSet',
    changeSetAttributes({ author, suffix: 'common-sequences' }),
    [generatePreConditions()]
  );
}

function generatePreConditions(): XMLNode {
  return new XMLNode(
    'preConditions',
    [{ name: 'onFail', value: 'MARK_RAN' }],
    [
      new XMLNode(
        'or',
        [],
        supportedDialects.map(
          dbName => new XMLNode('dbms', [{ name: 'type', value: dbName }])
        )
      ),
    ]
  );
}

export function createSequence(tableName: string, columnName: string): XMLNode {
  return new XMLNode('createSequence', [
    { name: 'sequenceName', value: generateSeqName(tableName, columnName) },
    { name: 'startValue', value: '1' },
  ]);
}

export function dropSequence(tableName: string, columnName: string): XMLNode {
  return new XMLNode('dropSequence', [
    { name: 'sequenceName', value: generateSeqName(tableName, columnName) },
  ]);
}

export function createSequences(
  tableState: TableState,
  author: Author
): XMLNode {
  var changeSet: XMLNode = generateChangeSetSequence(author);

  tableState.tables.forEach(table => {
    table.columns.forEach(column => {
      if (column.option.autoIncrement) {
        changeSet.addChildren(createSequence(table.name, column.name));
      }
    });
  });

  return changeSet;
}

export const createTableDiff = ({
  author,
  diffs,
}: FormatTableDiff): XMLNode[] => {
  Logger.log('Exporting diffs', diffs);
  var changeSets: XMLNode[] = [];

  var changeSetSequences: XMLNode = generateChangeSetSequence(author);
  var changeSetModifyPG: XMLNode = new XMLNode(
    'changeSet',
    changeSetAttributes({ author, dialect: 'postgresql', suffix: 'postgresql' })
  );
  var changeSetModifyOracle: XMLNode = new XMLNode(
    'changeSet',
    changeSetAttributes({ author, dialect: 'oracle', suffix: 'oracle' })
  );
  var changeSetModifyMssql: XMLNode = new XMLNode(
    'changeSet',
    changeSetAttributes({ author, dialect: 'mssql', suffix: 'mssql' })
  );
  var changeSetCommon: XMLNode = new XMLNode(
    'changeSet',
    changeSetAttributes({ author, suffix: 'common' })
  );

  let columnsToAdd: Map<Table, Column[]> = new Map();
  diffs.forEach(diff => {
    // add table
    if (diff.type === 'table' && diff.changes === 'add') {
      const newTable = diff.newTable;
      changeSetSequences.addChildren(
        ...newTable.columns
          .filter(col => col.option.autoIncrement)
          .map(col => createSequence(newTable.name, col.name))
      );

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
    // drop table
    else if (diff.type === 'table' && diff.changes === 'remove') {
      changeSetCommon.addChildren(dropTable(diff.oldTable));
    }
    // rename table
    else if (diff.type === 'table' && diff.changes === 'modify') {
      if (diff.oldTable.name !== diff.newTable.name) {
        changeSetCommon.addChildren(renameTable(diff.oldTable, diff.newTable));
      }
    }
    // add column
    else if (diff.type === 'column' && diff.changes === 'add') {
      const table = diff.table;
      columnsToAdd.set(table, [
        ...(columnsToAdd.get(table) || []),
        diff.newColumn,
      ]);
    }
    // drop column
    else if (diff.type === 'column' && diff.changes === 'remove') {
      changeSetCommon.addChildren(dropColumn(diff.table, diff.oldColumn));
    }
    // add index
    else if (diff.type === 'index' && diff.changes === 'add') {
      changeSetCommon.addChildren(
        createIndex({ table: diff.table, index: diff.newIndex })
      );
    }
    // drop index
    else if (diff.type === 'index' && diff.changes === 'remove') {
      changeSetCommon.addChildren(dropIndex(diff.table, diff.oldIndex));
    }
    // add FK
    else if (diff.type === 'relationship' && diff.changes === 'add') {
      changeSetCommon.addChildren(
        addForeignKeyConstraint({
          startTable: diff.startTable,
          endTable: diff.endTable,
          relationship: diff.newRelationship,
        })
      );
    }
    // drop FK
    else if (diff.type === 'relationship' && diff.changes === 'remove') {
      changeSetCommon.addChildren(
        dropForeignKeyConstraint(diff.table, diff.oldRelationship)
      );
    }

    // modify column
    else if (diff.type === 'column' && diff.changes === 'modify') {
      const { oldColumn, newColumn, table } = diff;
      // name was changed
      if (oldColumn.name !== newColumn.name) {
        changeSetCommon.addChildren(renameColumn(table, newColumn, oldColumn));
      }

      // auto increment changed
      if (oldColumn.option.autoIncrement !== newColumn.option.autoIncrement) {
        if (newColumn.option.autoIncrement === true) {
          changeSetSequences.addChildren(
            createSequence(table.name, newColumn.name)
          );
        } else {
          changeSetSequences.addChildren(
            dropSequence(table.name, newColumn.name)
          );
        }
      }

      // primary key changed
      if (oldColumn.option.primaryKey !== newColumn.option.primaryKey) {
        if (newColumn.option.primaryKey === true) {
          changeSetCommon.addChildren(addPrimaryKey(table, [newColumn]));
        } else {
          changeSetCommon.addChildren(dropPrimaryKey(table));
        }
      }

      // unique changed
      if (oldColumn.option.unique !== newColumn.option.unique) {
        if (newColumn.option.unique === true) {
          changeSetCommon.addChildren(addUniqueConstraint(table, [newColumn]));
        } else {
          changeSetCommon.addChildren(dropUniqueConstraint(table));
        }
      }

      // datatype was changed
      if (oldColumn.dataType !== newColumn.dataType) {
        changeSetModifyPG.addChildren(
          modifyDataType(table, newColumn, 'postgresql')
        );
        changeSetModifyOracle.addChildren(
          modifyDataType(table, newColumn, 'oracle')
        );
        changeSetModifyMssql.addChildren(
          modifyDataType(table, newColumn, 'mssql')
        );
      }
    }
  });

  columnsToAdd.forEach((colums, table) => {
    changeSetModifyPG.addChildren(addColumn(table, colums, 'postgresql'));
    changeSetModifyOracle.addChildren(addColumn(table, colums, 'oracle'));
    changeSetModifyMssql.addChildren(addColumn(table, colums, 'mssql'));
  });

  // sequences - (minus) first child is always preconditions
  if (changeSetSequences.children.length > 1) {
    changeSets.push(changeSetSequences);
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
    ...changeSetAttributes({ author, dialect, suffix: dialect })
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
    const startTable = getData(tables, relationship.start.tableId);
    const endTable = getData(tables, relationship.end.tableId);
    if (startTable && endTable)
      changeSet.addChildren(
        addForeignKeyConstraint({
          startTable,
          endTable,
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
        table,
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
  table,
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

  if (column.option.autoIncrement) {
    const primitive = getPrimitiveType(
      column.dataType,
      mapppingTranslationsDatabase[dialect]
    );

    if (
      dialect === 'postgresql' &&
      (primitive === 'int' || primitive === 'long')
    ) {
      columnXML.addAttribute({
        name: 'defaultValueComputed',
        value: `nextval('${generateSeqName(
          table.name,
          column.name
        )}'::regclass)`,
      });
    } else {
      columnXML.addAttribute({
        name: 'autoIncrement',
        value: column.option.autoIncrement.toString(),
      });
    }
  }

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
  startTable,
  endTable,
  relationship,
}: FormatRelationOptions): XMLNode => {
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
        value: `FK_${startTable.name}_TO_${endTable.name}`.toLowerCase(),
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
    addColumn.addChildren(formatColumn({ table, column, dialect }));
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
  table: Table,
  relationship: Relationship
): XMLNode {
  return new XMLNode('dropForeignKeyConstraint', [
    { name: 'baseTableName', value: table.name },
    { name: 'constraintName', value: relationship.constraintName || '???' },
  ]);
}

function addPrimaryKey(table: Table, columns: Column[]): XMLNode {
  return new XMLNode('addPrimaryKey', [
    { name: 'tableName', value: table.name },
    { name: 'columnNames', value: formatNames(columns) },
  ]);
}

function dropPrimaryKey(table: Table): XMLNode {
  return new XMLNode('dropPrimaryKey', [
    { name: 'tableName', value: table.name },
  ]);
}

function addUniqueConstraint(table: Table, columns: Column[]): XMLNode {
  return new XMLNode('addUniqueConstraint', [
    { name: 'tableName', value: table.name },
    { name: 'columnNames', value: formatNames(columns) },
  ]);
}

function dropUniqueConstraint(table: Table): XMLNode {
  return new XMLNode('dropUniqueConstraint', [
    { name: 'tableName', value: table.name },
    { name: 'constraintName', value: '???' },
  ]);
}
