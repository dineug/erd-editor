import { getLatestSnapshot } from '@/core/contextmenu/export.menu';
import { createStoreCopy } from '@/core/file';
import {
  Constraints,
  Dialect,
  Operation,
  ParserCallback,
  translate,
} from '@/core/parser/helper';
import { Column, IndexColumn, Statement } from '@/core/parser/index';
import { createJson } from '@/core/parser/ParserToJson';
import { loadJson$ } from '@/engine/command/editor.cmd.helper.gen';
import { ERDEditorContext } from '@@types/core/ERDEditorContext';
import { LiquibaseFile } from '@@types/core/liquibaseParser';

const dialectTo: Dialect = 'postgresql';
const defaultDialect: Dialect = 'postgresql';

/**
 * Parser for Liquibase XML file
 * @param input Entire XML file
 * @param dialect Dialect that the result will have datataypes in
 * @returns List of Statements to execute
 */
export const LiquibaseParser = (
  context: ERDEditorContext,
  files: LiquibaseFile[],
  dialect: Dialect = defaultDialect,
  rootFile?: LiquibaseFile
) => {
  console.log('PARSING...', files);

  function parseFile(file: LiquibaseFile) {
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(file.value, 'text/xml');

    const databaseChangeLog = xmlDoc.querySelector('databaseChangeLog');
    if (!databaseChangeLog) return;
    console.log(file.path, databaseChangeLog.children);

    Array.from(databaseChangeLog.children).forEach(element => {
      if (element.tagName === 'changeSet') {
        handleChangeSetParsing(element);
      } else if (element.tagName === 'include') {
        handleImportParsing(element, file);
      }
    });
  }

  function handleImportParsing(include: Element, file: LiquibaseFile) {
    const fileName = include.getAttribute('file');

    var myDirectory = file.path.split('/').slice(0, -1).join('/');
    if (myDirectory) myDirectory += '/';
    const dstDirectory = `${myDirectory}${fileName}`;

    const dstFile = files.find(file => file.path === dstDirectory);
    if (dstFile) parseFile(dstFile);
  }

  function handleChangeSetParsing(element: Element) {
    const dbms: string = element.getAttribute('dbms') || '';
    if (dbms === '' || dbms == dialect) {
      var statements: Statement[] = [];
      parseChangeSet(element, statements, dialect);
      applyStatements(context, statements);
    }
  }

  if (rootFile) {
    parseFile(rootFile);
  } else {
    files.forEach(file => parseFile(file));
  }
};

export const applyStatements = (
  context: ERDEditorContext,
  statements: Statement[]
) => {
  var { snapshots, store, helper } = context;
  snapshots.push(createStoreCopy(store));

  const json = createJson(
    statements,
    helper,
    store.canvasState.database,
    getLatestSnapshot(snapshots)
  );
  store.dispatchSync(loadJson$(json));
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
  parseElement('dropColumn', changeSet, statements, parseDropColumn);
  parseElement('dropTable', changeSet, statements, parseDropTable);
  parseElement(
    'dropForeignKeyConstraint',
    changeSet,
    statements,
    parseDropForeignKeyConstraint
  );
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
  const constr = column.getElementsByTagName('constraints')[0];

  var constraints: Constraints;

  if (constr) {
    constraints = {
      primaryKey: constr.getAttribute('primaryKey') === 'true',
      nullable: !(constr.getAttribute('nullable') === 'true'),
      unique: constr.getAttribute('unique') === 'true',
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
    constraintName: addForeignKey.getAttribute('constraintName') || '',
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

export const parseDropColumn = (
  dropColumn: Element,
  statements: Statement[],
  dialect: Dialect = defaultDialect
) => {
  const tableName: string = dropColumn.getAttribute('tableName') || '';
  const column: Column = {
    name: dropColumn.getAttribute('columnName') || '',
    dataType: '',
    default: '',
    comment: '',
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    nullable: false,
  };

  statements.push({
    type: 'alter.table.drop.column',
    name: tableName,
    columns: [column, ...parseColumns(dropColumn, dialect)],
  });
};

export const parseDropTable = (dropTable: Element, statements: Statement[]) => {
  const tableName: string = dropTable.getAttribute('tableName') || '';

  statements.push({
    type: 'drop.table',
    name: tableName,
  });
};

export const parseDropForeignKeyConstraint = (
  dropFk: Element,
  statements: Statement[]
) => {
  statements.push({
    type: 'alter.table.drop.foreignKey',
    name: dropFk.getAttribute('constraintName') || '',
    baseTableName: dropFk.getAttribute('baseTableName') || '',
  });
};
