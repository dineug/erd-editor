import { Statement, Column, IndexColumn } from '@/core/parser/index';
import { Constraints } from '@/core/parser/helper';

export const XMLParser = (input: string): Statement[] => {
  // todo delete
  console.log(input);

  var statements: Statement[] = [];

  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(input, 'text/xml');
  var changeSets = xmlDoc.getElementsByTagName('changeSet');

  // parse entire change set
  for (let i = 0; i < changeSets.length; i++) {
    parseChangeSet(changeSets[i], statements);
  }

  return statements;
};

export const parseChangeSet = (changeSet: Element, statements: Statement[]) => {
  const createTables = changeSet.getElementsByTagName('createTable');
  for (let i = 0; i < createTables.length; i++) {
    parseCreateTable(createTables[i], statements);
  }

  const createIndexes = changeSet.getElementsByTagName('createIndex');
  for (let i = 0; i < createIndexes.length; i++) {
    parseCreateIndex(createIndexes[i], statements);
  }

  const createRelationship = changeSet.getElementsByTagName(
    'addForeignKeyConstraint'
  );
  for (let i = 0; i < createRelationship.length; i++) {
    parseAddForeignKeyConstraint(createRelationship[i], statements);
  }
};

export const parseCreateTable = (
  createTable: Element,
  statements: Statement[]
) => {
  var columns: Column[] = parseColumns(createTable);

  statements.push({
    type: 'create.table',
    name: createTable.getAttribute('tableName') || 'unknown',
    comment: createTable.getAttribute('remarks') || '',
    columns: columns,
    indexes: [],
    foreignKeys: [],
  });
};

const parseColumns = (element: Element): Column[] => {
  var columns: Column[] = [];

  const cols = element.getElementsByTagName('column');
  for (let i = 0; i < cols.length; i++) {
    columns.push(parseSingleColumn(cols[i]));
  }
  return columns;
};

export const parseSingleColumn = (column: Element): Column => {
  const constr = column.getElementsByTagName('constraints');

  var constraints: Constraints;

  if (constr[0]) {
    constraints = {
      primaryKey: constr[0].getAttribute('primaryKey') === 'true',
      nullable: constr[0].getAttribute('nullable') !== 'false',
      unique: constr[0].getAttribute('unique') === 'true',
    };
  } else {
    constraints = {
      primaryKey: false,
      nullable: true,
      unique: false,
    };
  }

  return {
    name: column.getAttribute('name') || '',
    dataType: column.getAttribute('type') || '',
    default: column.getAttribute('defaultValue') || '',
    comment: column.getAttribute('remarks') || '',
    primaryKey: constraints.primaryKey,
    autoIncrement: column.getAttribute('autoIncrement') === 'true',
    unique: constraints.unique,
    nullable: constraints.nullable,
  };
};

export const parseSingleIndexColumn = (column: Element): IndexColumn => {
  return {
    name: column.getAttribute('name') || '',
    sort: column.getAttribute('descending') ? 'DESC' : 'ASC',
  };
};

export const parseCreateIndex = (
  createIndex: Element,
  statements: Statement[]
) => {
  var indexColumns: IndexColumn[] = [];

  const cols = createIndex.getElementsByTagName('column');
  for (let i = 0; i < cols.length; i++) {
    indexColumns.push(parseSingleIndexColumn(cols[i]));
  }

  statements.push({
    type: 'create.index',
    name: createIndex.getAttribute('indexName') || '',
    unique: createIndex.getAttribute('unique') === 'true',
    tableName: createIndex.getAttribute('tableName') || '',
    columns: indexColumns,
  });
};

export const parseAddForeignKeyConstraint = (
  addForeignKey: Element,
  statements: Statement[]
) => {
  var refColumnNames: string[] =
    addForeignKey
      .getAttribute('referencedColumnNames')
      ?.split(',')
      .map(item => item.trim()) || [];
  var columnNames: string[] =
    addForeignKey
      .getAttribute('baseColumnNames')
      ?.split(',')
      .map(item => item.trim()) || [];

  console.log('refColumnNames', refColumnNames);
  console.log('columnNames', columnNames);

  statements.push({
    type: 'alter.table.add.foreignKey',
    name: addForeignKey.getAttribute('baseTableName') || '',
    columnNames: columnNames,
    refTableName: addForeignKey.getAttribute('referencedTableName') || '',
    refColumnNames: refColumnNames,
  });
};
