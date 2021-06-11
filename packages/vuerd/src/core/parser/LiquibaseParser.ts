import {
  Constraints,
  Dialect,
  Operation,
  ParserCallback,
  translate,
} from '@/core/parser/helper';
import { Column, IndexColumn, Statement } from '@/core/parser/index';

const dialectTo: Dialect = 'postgresql';
const defaultDialect: Dialect = 'postgresql';

/**
 * Parser for Liquibase XML file
 * @param input Entire XML file
 * @param dialect Dialect that the result will have datataypes in
 * @returns List of Statements to execute
 */
export const LiquibaseParser = (
  input: string,
  dialect: Dialect = defaultDialect
): Statement[] => {
  var statements: Statement[] = [];

  var parser = new DOMParser();
  var xmlDoc = parser.parseFromString(input, 'text/xml');
  var changeSets = xmlDoc.getElementsByTagName('changeSet');

  // parse all changesets
  for (let i = 0; i < changeSets.length; i++) {
    const dbms: string = changeSets[i].getAttribute('dbms') || '';
    if (dbms === '' || dbms == dialect)
      parseChangeSet(changeSets[i], statements, dialect);
  }

  return statements;
};

export const parseChangeSet = (
  changeSet: Element,
  statements: Statement[],
  dialect: Dialect
) => {
  parseElement('createTable', changeSet, statements, parseCreateTable, dialect);
  parseElement('createIndex', changeSet, statements, parseCreateIndex);
  parseElement(
    'addForeignKeyConstraint',
    changeSet,
    statements,
    parseAddForeignKeyConstraint
  );
  parseElement('addPrimaryKey', changeSet, statements, parseAddPrimaryKey);
  parseElement('addColumn', changeSet, statements, parseAddColumn);
};

export const parseElement = (
  type: Operation,
  element: Element,
  statements: Statement[],
  parser: ParserCallback,
  dialect?: Dialect
) => {
  const elements = element.getElementsByTagName(type);
  for (let i = 0; i < elements.length; i++) {
    parser(elements[i], statements, dialect);
  }
};

export const parseCreateTable = (
  createTable: Element,
  statements: Statement[],
  dialect: Dialect = defaultDialect
) => {
  var columns: Column[] = parseColumns(createTable, dialect);

  statements.push({
    type: 'create.table',
    name: createTable.getAttribute('tableName') || '',
    comment: createTable.getAttribute('remarks') || '',
    columns: columns,
    indexes: [],
    foreignKeys: [],
  });
};

const parseColumns = (element: Element, dialect: Dialect): Column[] => {
  var columns: Column[] = [];

  const cols = element.getElementsByTagName('column');
  for (let i = 0; i < cols.length; i++) {
    columns.push(parseSingleColumn(cols[i], dialect));
  }
  return columns;
};

export const parseSingleColumn = (
  column: Element,
  dialect: Dialect
): Column => {
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

  var dataType = translate(
    dialect,
    dialectTo,
    column.getAttribute('type') || ''
  );

  return {
    name: column.getAttribute('name') || '',
    dataType: dataType,
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

  statements.push({
    type: 'alter.table.add.foreignKey',
    name: addForeignKey.getAttribute('baseTableName') || '',
    columnNames: columnNames,
    refTableName: addForeignKey.getAttribute('referencedTableName') || '',
    refColumnNames: refColumnNames,
  });
};

export const parseAddPrimaryKey = (
  addPrimaryKey: Element,
  statements: Statement[]
) => {
  var columnNames: string[] =
    addPrimaryKey
      .getAttribute('columnNames')
      ?.split(',')
      .map(item => item.trim()) || [];

  statements.push({
    type: 'alter.table.add.primaryKey',
    name: addPrimaryKey.getAttribute('tableName') || '',
    columnNames: columnNames,
  });
};

export const parseAddColumn = (
  addColumn: Element,
  statements: Statement[],
  dialect: Dialect = defaultDialect
) => {
  const tableName: string = addColumn.getAttribute('tableName') || '';

  statements.push({
    type: 'alter.table.add.column',
    name: tableName,
    columns: parseColumns(addColumn, dialect),
  });
};
