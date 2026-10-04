import {
  ERDEditorSchemaV3,
  query,
  schemaV3Parser,
  toJson,
} from '@dineug/erd-editor-schema';
import {
  AlterTableAddDefault,
  AlterTableAddForeignKey,
  AlterTableAddPrimaryKey,
  AlterTableAddUnique,
  AlterTableAlterColumnAutoIncrement,
  CommentOnColumn,
  CommentOnTable,
  CreateIndex,
  CreateTable,
  Index,
  Key,
  schemaSQLParser,
  SortType,
  Statement,
  StatementType,
} from '@dineug/schema-sql-parser';

import {
  ColumnOption,
  ColumnUIKey,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import {
  DatabaseVendor,
  DatabaseVendorToDatabase,
} from '@/constants/sql/database';
import { EngineContext } from '@/engine/context';
import { Column, IndexColumn } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { toReferentialAction } from '@/utils/referentialAction';
import { canvasSizeInRange, textInRange } from '@/utils/validation';

import { findByName } from './utils';

type StatementMap = {
  tables: CreateTable[];
  indexes: CreateIndex[];
  primaryKeys: AlterTableAddPrimaryKey[];
  foreignKeys: AlterTableAddForeignKey[];
  uniques: AlterTableAddUnique[];
  defaults: AlterTableAddDefault[];
  autoIncrements: AlterTableAlterColumnAutoIncrement[];
  tableComments: CommentOnTable[];
  columnComments: CommentOnColumn[];
};

/**
 * The SQL as a document. The document's database, when given, names the vendor
 * to the parser: a Databricks one reads string literals by Spark's escapes.
 */
export function schemaSQLParserToSchemaJson(
  sql: string,
  ctx: EngineContext,
  prepare?: (schema: ERDEditorSchemaV3) => ERDEditorSchemaV3,
  database?: number
) {
  const schema = schemaV3Parser({});
  const vendor = Object.values(DatabaseVendor).find(
    value => DatabaseVendorToDatabase[value] === database
  );
  const statements = schemaSQLParser(sql, { database: vendor });
  const statementMap = getStatementMap(statements);
  const tables = mergeTables(statementMap);

  const canvasSize = canvasSizeInRange(tables.length * 100);
  schema.settings.width = canvasSize;
  schema.settings.height = canvasSize;

  tables.forEach(table => convertTable(schema, table, ctx));
  convertRelationship(schema, tables);
  convertIndex(schema, tables);

  return toJson(prepare ? prepare(schema) : schema);
}

function getStatementMap(statements: Statement[]): StatementMap {
  const map: StatementMap = {
    tables: [],
    indexes: [],
    primaryKeys: [],
    foreignKeys: [],
    uniques: [],
    defaults: [],
    autoIncrements: [],
    tableComments: [],
    columnComments: [],
  };

  for (const statement of statements) {
    switch (statement.type) {
      case StatementType.createTable:
        if (statement.name) {
          map.tables.push(statement);
        }
        break;
      case StatementType.createIndex:
        if (statement.tableName && statement.columns.length) {
          map.indexes.push(statement);
        }
        break;
      case StatementType.alterTableAddPrimaryKey:
        if (statement.name && statement.columnNames.length) {
          map.primaryKeys.push(statement);
        }
        break;
      case StatementType.alterTableAddForeignKey:
        if (
          statement.name &&
          statement.columnNames.length &&
          statement.refTableName &&
          (!statement.refColumnNames.length ||
            statement.columnNames.length === statement.refColumnNames.length)
        ) {
          map.foreignKeys.push(statement);
        }
        break;
      case StatementType.alterTableAddUnique:
        if (statement.name && statement.columns.length) {
          map.uniques.push(statement);
        }
        break;
      case StatementType.alterTableAddDefault:
        if (statement.name && statement.columnName && statement.default) {
          map.defaults.push(statement);
        }
        break;
      case StatementType.alterTableAlterColumnAutoIncrement:
        if (statement.name && statement.columnName) {
          map.autoIncrements.push(statement);
        }
        break;
      case StatementType.commentOnTable:
        if (statement.name) {
          map.tableComments.push(statement);
        }
        break;
      case StatementType.commentOnColumn:
        if (statement.tableName && statement.columnName) {
          map.columnComments.push(statement);
        }
        break;
    }
  }

  return map;
}

function mergeTables({
  tables,
  indexes,
  primaryKeys,
  foreignKeys,
  uniques,
  defaults,
  autoIncrements,
  tableComments,
  columnComments,
}: StatementMap): CreateTable[] {
  indexes.forEach(index => {
    const table = findByName(tables, index.tableName);
    if (!table) return;

    // DBMS_METADATA writes the index of each key a table declares inline on its
    // own, under the key's name or, for a key with none, Oracle's SYS_C...: it
    // is that key again, a second index of it or one beside its flags.
    const created = keyOf(index);
    const sameIndex = table.indexes.find(
      other => mayRepeat(table, other) && isKeyIndex(keyOf(other), created)
    );

    if (sameIndex) {
      sameIndex.name ||= index.name;
      sameIndex.unique ||= index.unique;
      return;
    }

    if (table.keys.some(key => isKeyIndex(key, created))) return;

    table.indexes.push({
      name: index.name,
      unique: index.unique,
      columns: index.columns,
    });
  });

  // Every CREATE INDEX merges before any ALTER key, wherever the script puts
  // it: DBMS_METADATA's CONSTRAINTS_AS_ALTER output, then the table's
  // dependent index DDL, writes each ALTER before the SYS_C index of its key.
  primaryKeys.forEach(primaryKey => {
    const table = findByName(tables, primaryKey.name);
    if (!table) return;

    // The flags are the key, and the index Oracle exported for it is theirs.
    const keyIndex = findKeyIndex(table, {
      name: primaryKey.usingIndexName || primaryKey.constraintName,
      columnNames: primaryKey.columnNames,
    });

    if (keyIndex) {
      table.indexes.splice(table.indexes.indexOf(keyIndex), 1);
    }

    primaryKey.columnNames.forEach(columnName => {
      const column = findByName(table.columns, columnName);
      if (!column) return;

      column.primaryKey = true;
    });
  });

  uniques.forEach(unique => {
    const table = findByName(tables, unique.name);
    if (!table) return;

    // A composite key is the index Oracle exported for it, made unique. One
    // column gives that index up to the flag the rule below sets.
    const keyIndex = findKeyIndex(table, {
      name: unique.usingIndexName || unique.constraintName,
      columnNames: namesOf(unique.columns),
    });

    if (keyIndex && unique.columns.length > 1) {
      keyIndex.unique = true;
      return;
    }

    if (keyIndex) {
      table.indexes.splice(table.indexes.indexOf(keyIndex), 1);
    }

    // Several columns are one composite key, which a unique flag on each of
    // them would make stricter. One column keeps the flag it always set, and
    // with it the UQ_<table>_<column> the export writes comes back unchanged.
    if (unique.columns.length > 1) {
      table.indexes.push({
        name: unique.constraintName,
        unique: true,
        columns: unique.columns,
      });
      return;
    }

    unique.columns.forEach(({ name }) => {
      const column = findByName(table.columns, name);
      if (!column) return;

      column.unique = true;
    });
  });

  foreignKeys.forEach(foreignKey => {
    const table = findByName(tables, foreignKey.name);
    if (!table) return;

    table.foreignKeys.push({
      columnNames: foreignKey.columnNames,
      refTableName: foreignKey.refTableName,
      refColumnNames: foreignKey.refColumnNames,
      onDelete: foreignKey.onDelete,
      onUpdate: foreignKey.onUpdate,
    });
  });

  // SSMS scripts each default as ALTER TABLE ... ADD DEFAULT ... FOR column
  // after the table, and the constraint's name has no place in the document.
  defaults.forEach(({ name, columnName, default: value }) => {
    const table = findByName(tables, name);
    if (!table) return;

    const column = findByName(table.columns, columnName);
    if (!column) return;

    column.default = value;
  });

  // pg_dump sets a serial column's nextval('s') default and adds an identity
  // column's identity after its table: either is the auto increment flag, and
  // leaves no default, as an inline nextval('s') does.
  autoIncrements.forEach(({ name, columnName }) => {
    const table = findByName(tables, name);
    if (!table) return;

    const column = findByName(table.columns, columnName);
    if (!column) return;

    column.autoIncrement = true;
    column.default = '';
  });

  // PostgreSQL and Oracle carry comments as their own statement, and SQL Server
  // as its MS_Description extended property, rather than as a table option.
  tableComments.forEach(({ name, comment }) => {
    const table = findCommentTable(tables, name);
    if (!table) return;

    table.comment = comment;
  });

  columnComments.forEach(({ tableName, columnName, comment }) => {
    const table = findCommentTable(tables, tableName);
    if (!table) return;

    const column = findByName(table.columns, columnName);
    if (!column) return;

    column.comment = comment;
  });

  return tables;
}

/**
 * The table a comment names, else the one its last part names: older MSSQL
 * exports wrote dbo.users whole at level 1, which SQL Server refuses, beside
 * an unquoted CREATE TABLE dbo.users that reads back as users.
 */
function findCommentTable(tables: CreateTable[], name: string) {
  return (
    findByName(tables, name) ??
    findByName(tables, name.slice(name.lastIndexOf('.') + 1))
  );
}

/**
 * Whether a later CREATE INDEX may repeat an index of the table: a named one,
 * or one with no name only as a key Oracle's USING INDEX follows, as keys say;
 * an unnamed CREATE INDEX or a bare inline UNIQUE stays an index of its own.
 */
function mayRepeat(table: CreateTable, index: Index) {
  return (
    index.name !== '' || table.keys.some(key => isKeyIndex(key, keyOf(index)))
  );
}

// The index Oracle exports on its own for a key, named by the key or by its
// USING INDEX: kept beside the key, it indexes one column list twice.
function findKeyIndex(table: CreateTable, key: Key) {
  return table.indexes.find(index => isKeyIndex(key, keyOf(index))) ?? null;
}

/**
 * Whether an index is the one a key owns: under the key's name over the same
 * columns, or, for a key with no name, as Oracle's system-named keys have,
 * over its columns in their order.
 */
function isKeyIndex(key: Key, index: Key) {
  return key.name
    ? isSameName(key.name, index.name) &&
        hasSameColumns(key.columnNames, index.columnNames)
    : hasColumnsInOrder(key.columnNames, index.columnNames);
}

const keyOf = ({
  name,
  columns,
}: {
  name: string;
  columns: ReadonlyArray<{ name: string }>;
}): Key => ({ name, columnNames: namesOf(columns) });

const namesOf = (columns: ReadonlyArray<{ name: string }>) =>
  columns.map(({ name }) => name);

const isSameName = (a: string, b: string) =>
  a.toUpperCase() === b.toUpperCase();

// Whether two key lists name the same columns, in any order: a unique key over
// them is the same constraint either way.
function hasSameColumns(a: string[], b: string[]) {
  const names = new Set(a.map(name => name.toUpperCase()));
  return (
    a.length === b.length && b.every(name => names.has(name.toUpperCase()))
  );
}

// Whether two key lists name the same columns in the same order. Without a key
// name to go by, an index over them in another order is one built for itself.
function hasColumnsInOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((name, i) => isSameName(name, b[i]));
}

function convertTable(
  { doc, collections }: ERDEditorSchemaV3,
  table: CreateTable,
  { toWidth }: EngineContext
) {
  const newTable = createTable({
    name: table.name,
    comment: table.comment,
    ui: {
      widthName: textInRange(toWidth(table.name)),
      widthComment: textInRange(toWidth(table.comment)),
    },
  });

  table.columns.forEach(column => {
    const newColumn = createColumn({
      tableId: newTable.id,
      name: column.name,
      comment: column.comment,
      dataType: column.dataType,
      default: column.default,
      options:
        (column.autoIncrement ? ColumnOption.autoIncrement : 0) |
        (column.primaryKey ? ColumnOption.primaryKey : 0) |
        (column.unique ? ColumnOption.unique : 0) |
        (column.nullable ? 0 : ColumnOption.notNull),
      ui: {
        widthName: textInRange(toWidth(column.name)),
        widthComment: textInRange(toWidth(column.comment)),
        widthDataType: textInRange(toWidth(column.dataType)),
        widthDefault: textInRange(toWidth(column.default)),
        keys: column.primaryKey ? ColumnUIKey.primaryKey : 0,
      },
    });

    newTable.columnIds.push(newColumn.id);
    newTable.seqColumnIds.push(newColumn.id);
    query(collections).collection('tableColumnEntities').setOne(newColumn);
  });

  doc.tableIds.push(newTable.id);
  query(collections).collection('tableEntities').setOne(newTable);
}

function convertRelationship(
  { doc, collections }: ERDEditorSchemaV3,
  tables: CreateTable[]
) {
  const newTables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);
  const columnCollection = query(collections).collection('tableColumnEntities');

  tables.forEach(table => {
    if (!table.foreignKeys.length) return;

    const endTable = findByName(newTables, table.name);
    if (!endTable) return;

    const eColumns = columnCollection.selectByIds(endTable.columnIds);

    table.foreignKeys.forEach(foreignKey => {
      const startTable = findByName(newTables, foreignKey.refTableName);
      if (!startTable) return;

      const sColumns = columnCollection.selectByIds(startTable.columnIds);
      const startColumns: Column[] = [];
      const endColumns: Column[] = [];

      // A REFERENCES t without a column list names t's primary key, in the
      // order the key declares, which the columns lose: only a one-column key
      // pairs for sure.
      if (foreignKey.refColumnNames.length) {
        foreignKey.refColumnNames.forEach(refColumnName => {
          const column = findByName(sColumns, refColumnName);
          if (!column) return;

          startColumns.push(column);
        });
      } else {
        const primaryKeys = sColumns.filter(column =>
          bHas(column.ui.keys, ColumnUIKey.primaryKey)
        );

        if (primaryKeys.length === 1) {
          startColumns.push(...primaryKeys);
        }
      }

      foreignKey.columnNames.forEach(columnName => {
        const column = findByName(eColumns, columnName);
        if (!column) return;

        endColumns.push(column);
      });

      // A column either table lacks would leave a side short or empty, and the
      // DDL written from it would reference nothing.
      if (!startColumns.length || startColumns.length !== endColumns.length) {
        return;
      }

      endColumns.forEach(column => {
        if (bHas(column.ui.keys, ColumnUIKey.primaryKey)) {
          column.ui.keys |= ColumnUIKey.foreignKey;
        } else {
          column.ui.keys = ColumnUIKey.foreignKey;
        }
      });

      const newRelationship = createRelationship({
        identification: !endColumns.some(
          column =>
            !(
              bHas(column.ui.keys, ColumnUIKey.primaryKey) &&
              bHas(column.ui.keys, ColumnUIKey.foreignKey)
            )
        ),
        relationshipType: RelationshipType.ZeroN,
        onDelete: toReferentialAction(foreignKey.onDelete),
        onUpdate: toReferentialAction(foreignKey.onUpdate),
        start: {
          tableId: startTable.id,
          columnIds: startColumns.map(column => column.id),
        },
        end: {
          tableId: endTable.id,
          columnIds: endColumns.map(column => column.id),
        },
      });

      doc.relationshipIds.push(newRelationship.id);
      query(collections)
        .collection('relationshipEntities')
        .setOne(newRelationship);
    });
  });
}

function convertIndex(
  { doc, collections }: ERDEditorSchemaV3,
  tables: CreateTable[]
) {
  const newTables = query(collections)
    .collection('tableEntities')
    .selectByIds(doc.tableIds);

  tables.forEach(table => {
    table.indexes.forEach(index => {
      const targetTable = findByName(newTables, table.name);
      if (!targetTable) return;

      const columns = query(collections)
        .collection('tableColumnEntities')
        .selectByIds(targetTable.columnIds);
      const indexColumns: IndexColumn[] = [];
      const newIndex = createIndex({
        name: index.name,
        tableId: targetTable.id,
        unique: index.unique,
      });

      index.columns.forEach(column => {
        const targetColumn = findByName(columns, column.name);
        if (!targetColumn) return;

        const newIndexColumn = createIndexColumn({
          indexId: newIndex.id,
          columnId: targetColumn.id,
          orderType:
            column.sort === SortType.asc ? OrderType.ASC : OrderType.DESC,
        });
        indexColumns.push(newIndexColumn);
      });

      // A unique key short of a column is a stricter key than the source's, so
      // it goes whole; a plain index keeps the columns that resolve.
      const complete = indexColumns.length === index.columns.length;

      if (indexColumns.length !== 0 && (complete || !index.unique)) {
        indexColumns.forEach(indexColumn => {
          newIndex.indexColumnIds.push(indexColumn.id);
          newIndex.seqIndexColumnIds.push(indexColumn.id);

          query(collections)
            .collection('indexColumnEntities')
            .setOne(indexColumn);
        });

        doc.indexIds.push(newIndex.id);
        query(collections).collection('indexEntities').setOne(newIndex);
      }
    });
  });
}
