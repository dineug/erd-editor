import {
  ERDEditorSchemaV3,
  query,
  schemaV3Parser,
} from '@dineug/erd-editor-schema';

import {
  ColumnOption,
  ColumnUIKey,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { Collections, Column, IndexColumn, Table } from '@/internal-types';
import { bHas } from '@/utils/bit';
import { createIndex } from '@/utils/collection/index.entity';
import { createIndexColumn } from '@/utils/collection/indexColumn.entity';
import { createRelationship } from '@/utils/collection/relationship.entity';
import { createTable } from '@/utils/collection/table.entity';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { autoName, primaryKeyColumns } from '@/utils/schema-sql/utils';
import { findByName } from '@/utils/schema-sql-parser/utils';
import { textInRange, toSafeString } from '@/utils/validation';

import { enumCommentSuffix, resolveDataType } from './dataType';
import { DBMLEndpoint, DBMLModel, DBMLTable } from './types';

const DEFAULT_SCHEMA = 'public';

type TableContext = {
  source: DBMLTable;
  table: Table;
  columns: Column[];
};

type RelationshipInput = {
  parent: TableContext;
  parentColumns: Column[];
  child: TableContext;
  childColumns: Column[];
  toMany: boolean;
};

export function convertToSchema(
  model: DBMLModel,
  ctx: EngineContext,
  database: number
): ERDEditorSchemaV3 {
  const schema = schemaV3Parser({});
  const qualify = createQualifier(model.tables);
  const contexts = model.tables.map(source =>
    convertTable(schema, ctx, model, database, source, qualify(source))
  );
  const findContext = createTableIndex(model.tables, contexts);

  convertRelationships(schema, ctx, contexts, model, findContext);
  convertIndexes(schema, contexts);

  return schema;
}

/**
 * The document has one flat table list, so a schema only survives as a prefix,
 * and only where dropping it would fold two tables together.
 */
function createQualifier(tables: DBMLTable[]): (table: DBMLTable) => string {
  const schemaNames = new Set(
    tables.map(table => schemaKeyOf(table.schemaName))
  );

  return table => {
    const key = schemaKeyOf(table.schemaName);

    return schemaNames.size > 1 && key !== DEFAULT_SCHEMA
      ? `${key}_${table.name}`
      : table.name;
  };
}

function schemaKeyOf(schemaName: string): string {
  return schemaName === '' ? DEFAULT_SCHEMA : schemaName;
}

/**
 * A ref names a table by its schema-qualified name or by its alias, and the
 * schema is optional even where the table declared one.
 */
function createTableIndex(
  sources: DBMLTable[],
  contexts: TableContext[]
): (endpoint: DBMLEndpoint) => TableContext | null {
  const byKey = new Map<string, TableContext>();

  const set = (key: string, context: TableContext) => {
    const lowered = key.toLowerCase();
    if (!byKey.has(lowered)) {
      byKey.set(lowered, context);
    }
  };

  sources.forEach((source, index) => {
    const context = contexts[index];
    const key = schemaKeyOf(source.schemaName);

    set(`${key}.${source.name}`, context);
    set(source.name, context);

    if (source.alias) {
      set(source.alias, context);
      set(`${key}.${source.alias}`, context);
    }
  });

  return endpoint => {
    const key = schemaKeyOf(endpoint.schemaName);

    return (
      byKey.get(`${key}.${endpoint.tableName}`.toLowerCase()) ??
      (endpoint.schemaName === ''
        ? (byKey.get(endpoint.tableName.toLowerCase()) ?? null)
        : null)
    );
  };
}

function convertTable(
  { doc, collections }: ERDEditorSchemaV3,
  ctx: EngineContext,
  model: DBMLModel,
  database: number,
  source: DBMLTable,
  tableName: string
): TableContext {
  const { toWidth } = ctx;
  const name = toSafeString(tableName);
  const comment = toSafeString(source.comment);
  const newTable = createTable({
    name,
    comment,
    ui: {
      widthName: textInRange(toWidth(name)),
      widthComment: textInRange(toWidth(comment)),
    },
  });
  const context: TableContext = { source, table: newTable, columns: [] };
  // `Indexes { (a, b) [pk] }` is DBML's only composite primary key spelling and
  // it leaves the columns themselves unmarked.
  const primaryKeyNames = new Set(
    source.indexes
      .filter(index => index.primaryKey)
      .flatMap(index => index.columnNames)
      .map(columnName => columnName.toUpperCase())
  );

  source.columns.forEach(column => {
    const columnName = toSafeString(column.name);
    const primaryKey =
      column.primaryKey || primaryKeyNames.has(columnName.toUpperCase());
    const dataType = resolveDataType(
      column.typeName,
      column.typeSchemaName,
      database,
      model
    );
    const columnComment = `${toSafeString(column.comment)}${enumCommentSuffix(
      column.typeName,
      column.typeSchemaName,
      model,
      database
    )}`.trim();
    const defaultValue = toSafeString(column.default);

    appendColumn(
      collections,
      context,
      createColumn({
        tableId: newTable.id,
        name: columnName,
        comment: columnComment,
        dataType,
        default: defaultValue,
        options:
          (column.autoIncrement ? ColumnOption.autoIncrement : 0) |
          (primaryKey ? ColumnOption.primaryKey : 0) |
          (column.unique ? ColumnOption.unique : 0) |
          (column.notNull ? ColumnOption.notNull : 0),
        ui: {
          widthName: textInRange(toWidth(columnName)),
          widthComment: textInRange(toWidth(columnComment)),
          widthDataType: textInRange(toWidth(dataType)),
          widthDefault: textInRange(toWidth(defaultValue)),
          // Only the foreign key bit is recomputed on load, so the primary key
          // one has to be written here as well as into `options`.
          keys: primaryKey ? ColumnUIKey.primaryKey : 0,
        },
      })
    );
  });

  doc.tableIds.push(newTable.id);
  query(collections).collection('tableEntities').setOne(newTable);

  return context;
}

function appendColumn(
  collections: Collections,
  context: TableContext,
  column: Column
) {
  context.table.columnIds.push(column.id);
  context.table.seqColumnIds.push(column.id);
  context.columns.push(column);
  query(collections).collection('tableColumnEntities').setOne(column);
}

function convertRelationships(
  schema: ERDEditorSchemaV3,
  ctx: EngineContext,
  contexts: TableContext[],
  model: DBMLModel,
  findContext: (endpoint: DBMLEndpoint) => TableContext | null
) {
  const relationshipKeys = new Set<string>();

  const append = (input: RelationshipInput) =>
    appendRelationship(schema, relationshipKeys, input);

  contexts.forEach(source => {
    source.source.columns.forEach((column, index) => {
      const owner = source.columns[index];
      if (!owner) return;

      column.inlineRefs.forEach(inlineRef => {
        const target = findContext(inlineRef.target);
        if (!target) return;

        const targetColumns = resolveColumns(target, inlineRef.target);
        if (targetColumns.length !== 1) return;

        if (inlineRef.operator === '<>') {
          appendJunctionTable(schema, ctx, contexts, source, target);
          return;
        }

        // `>` is the only spelling where the annotated column is the parent's
        // opposite; `-` puts the foreign key on the column carrying the ref.
        const childIsOwner = inlineRef.operator !== '<';

        append(
          childIsOwner
            ? {
                parent: target,
                parentColumns: targetColumns,
                child: source,
                childColumns: [owner],
                toMany: inlineRef.operator === '>',
              }
            : {
                parent: source,
                parentColumns: [owner],
                child: target,
                childColumns: targetColumns,
                toMany: true,
              }
        );
      });
    });
  });

  model.refs.forEach(ref => {
    const left = findContext(ref.left);
    const right = findContext(ref.right);
    if (!left || !right) return;

    const leftColumns = resolveColumns(left, ref.left);
    const rightColumns = resolveColumns(right, ref.right);
    if (
      leftColumns.length === 0 ||
      leftColumns.length !== ref.left.columnNames.length ||
      rightColumns.length !== ref.right.columnNames.length ||
      leftColumns.length !== rightColumns.length
    ) {
      return;
    }

    if (ref.operator === '<>') {
      appendJunctionTable(schema, ctx, contexts, left, right);
      return;
    }

    const parentIsLeft = ref.operator !== '>';

    append({
      parent: parentIsLeft ? left : right,
      parentColumns: parentIsLeft ? leftColumns : rightColumns,
      child: parentIsLeft ? right : left,
      childColumns: parentIsLeft ? rightColumns : leftColumns,
      toMany: ref.operator !== '-',
    });
  });
}

function resolveColumns(
  context: TableContext,
  endpoint: DBMLEndpoint
): Column[] {
  const columns: Column[] = [];

  for (const columnName of endpoint.columnNames) {
    const column = findByName(context.columns, columnName);
    if (!column) return [];

    columns.push(column);
  }

  return columns;
}

function appendRelationship(
  { doc, collections }: ERDEditorSchemaV3,
  relationshipKeys: Set<string>,
  { parent, parentColumns, child, childColumns, toMany }: RelationshipInput
) {
  if (parentColumns.length === 0 || childColumns.length === 0) return;

  const key = `${parent.table.id}:${child.table.id}:${childColumns
    .map(column => column.id)
    .join(',')}`;
  if (relationshipKeys.has(key)) return;
  relationshipKeys.add(key);

  // DBML's `?` markers state the parent's optionality as often as the child's,
  // and the editor has no slot for the former, so the child columns decide.
  const mandatory = childColumns.every(column =>
    bHas(column.options, ColumnOption.notNull)
  );

  childColumns.forEach(column => {
    column.ui.keys = bHas(column.ui.keys, ColumnUIKey.primaryKey)
      ? column.ui.keys | ColumnUIKey.foreignKey
      : ColumnUIKey.foreignKey;
  });

  const newRelationship = createRelationship({
    identification: childColumns.every(
      column =>
        bHas(column.ui.keys, ColumnUIKey.primaryKey) &&
        bHas(column.ui.keys, ColumnUIKey.foreignKey)
    ),
    relationshipType: toMany
      ? mandatory
        ? RelationshipType.OneN
        : RelationshipType.ZeroN
      : mandatory
        ? RelationshipType.OneOnly
        : RelationshipType.ZeroOne,
    start: {
      tableId: parent.table.id,
      columnIds: parentColumns.map(column => column.id),
    },
    end: {
      tableId: child.table.id,
      columnIds: childColumns.map(column => column.id),
    },
  });

  doc.relationshipIds.push(newRelationship.id);
  query(collections).collection('relationshipEntities').setOne(newRelationship);
}

function appendJunctionTable(
  schema: ERDEditorSchemaV3,
  ctx: EngineContext,
  contexts: TableContext[],
  left: TableContext,
  right: TableContext
) {
  const { doc, collections } = schema;
  const { toWidth } = ctx;
  const leftKeys = primaryKeyColumns(left.columns);
  const rightKeys = primaryKeyColumns(right.columns);
  if (!leftKeys.length || !rightKeys.length) return;

  const name = autoName(
    contexts.map(context => context.table),
    '',
    `${left.table.name}_${right.table.name}`
  );
  // `convertToSchema` has no warning channel, so the note that this is the one
  // table the importer invented rather than read travels in the diagram.
  const comment = `Junction table inferred from ${left.table.name} <-> ${right.table.name}`;
  const newTable = createTable({
    name,
    comment,
    ui: {
      widthName: textInRange(toWidth(name)),
      widthComment: textInRange(toWidth(comment)),
    },
  });
  const junction: TableContext = {
    source: {
      schemaName: '',
      name,
      alias: '',
      comment,
      columns: [],
      indexes: [],
    },
    table: newTable,
    columns: [],
  };

  doc.tableIds.push(newTable.id);
  query(collections).collection('tableEntities').setOne(newTable);
  contexts.push(junction);

  appendJunctionSide(schema, ctx, junction, left, leftKeys);
  appendJunctionSide(schema, ctx, junction, right, rightKeys);
}

function appendJunctionSide(
  schema: ERDEditorSchemaV3,
  { toWidth }: EngineContext,
  junction: TableContext,
  parent: TableContext,
  parentKeys: Column[]
) {
  const { doc, collections } = schema;
  const childColumns = parentKeys.map(parentKey => {
    const name = autoName(
      junction.columns,
      '',
      `${parent.table.name}_${parentKey.name}`
    );
    const { dataType } = parentKey;
    const newColumn = createColumn({
      tableId: junction.table.id,
      name,
      dataType,
      options: ColumnOption.primaryKey | ColumnOption.notNull,
      ui: {
        keys: ColumnUIKey.primaryKey | ColumnUIKey.foreignKey,
        widthName: textInRange(toWidth(name)),
        widthDataType: textInRange(toWidth(dataType)),
      },
    });

    appendColumn(collections, junction, newColumn);

    return newColumn;
  });

  const newRelationship = createRelationship({
    identification: true,
    relationshipType: RelationshipType.ZeroN,
    start: {
      tableId: parent.table.id,
      columnIds: parentKeys.map(column => column.id),
    },
    end: {
      tableId: junction.table.id,
      columnIds: childColumns.map(column => column.id),
    },
  });

  doc.relationshipIds.push(newRelationship.id);
  query(collections).collection('relationshipEntities').setOne(newRelationship);
}

function convertIndexes(
  { doc, collections }: ERDEditorSchemaV3,
  contexts: TableContext[]
) {
  contexts.forEach(({ source, table, columns }) => {
    source.indexes.forEach(index => {
      // A `[pk]` index was already projected onto the columns it names.
      if (index.primaryKey) return;

      const newIndex = createIndex({
        name: toSafeString(index.name),
        tableId: table.id,
        unique: index.unique,
      });
      const indexColumns: IndexColumn[] = [];

      index.columnNames.forEach(columnName => {
        const column = findByName(columns, columnName);
        if (!column) return;

        indexColumns.push(
          createIndexColumn({
            indexId: newIndex.id,
            columnId: column.id,
            orderType: OrderType.ASC,
          })
        );
      });

      if (!indexColumns.length) return;

      indexColumns.forEach(indexColumn => {
        newIndex.indexColumnIds.push(indexColumn.id);
        newIndex.seqIndexColumnIds.push(indexColumn.id);
        query(collections)
          .collection('indexColumnEntities')
          .setOne(indexColumn);
      });

      doc.indexIds.push(newIndex.id);
      query(collections).collection('indexEntities').setOne(newIndex);
    });
  });
}
