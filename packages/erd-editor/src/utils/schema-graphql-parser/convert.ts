import {
  ERDEditorSchemaV3,
  query,
  schemaV3Parser,
} from '@dineug/erd-editor-schema';
import { lowerFirst, snakeCase } from 'es-toolkit';

import {
  ColumnOption,
  ColumnUIKey,
  OrderType,
  RelationshipType,
} from '@/constants/schema';
import { EngineContext } from '@/engine/context';
import { Collections, Column, IndexColumn, Table } from '@/internal-types';
import { pascalCase } from '@/utils';
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
import { GraphQLField, GraphQLModel, GraphQLTable } from './types';

type TableContext = {
  name: string;
  source: GraphQLTable;
  table: Table;
  columns: Column[];
  referenceFields: GraphQLField[];
};

type ReferenceEdge = {
  source: TableContext;
  target: TableContext;
  field: GraphQLField;
  consumed: boolean;
};

type RelationshipInput = {
  parent: TableContext;
  child: TableContext;
  field: GraphQLField;
  /** The field lives on the child, so @relation(fields:) names child columns. */
  childSide: boolean;
  relationshipType: number;
};

type ConvertState = {
  claimedColumnIds: Set<string>;
  relationshipKeys: Set<string>;
};

export function convertToSchema(
  model: GraphQLModel,
  ctx: EngineContext,
  database: number
): ERDEditorSchemaV3 {
  const schema = schemaV3Parser({});
  const findTable = createNameIndex(model.tables);
  const skipped = new Set(model.skipped);

  // Every table and every scalar column has to exist before a reference field is
  // read, otherwise a relationship can name a table that is not in doc.tableIds.
  const contexts = model.tables.map(source =>
    convertTable(schema, ctx, model, database, source, findTable, skipped)
  );

  convertRelationships(schema, ctx, contexts);
  convertIndexes(schema, contexts);

  return schema;
}

function createNameIndex<T extends { name: string }>(list: T[]) {
  const exact = new Map<string, T>();
  const lower = new Map<string, T>();

  for (const item of list) {
    exact.set(item.name, item);
    const key = item.name.toLowerCase();
    if (!lower.has(key)) {
      lower.set(key, item);
    }
  }

  return (name: string): T | null =>
    exact.get(name) ?? lower.get(name.toLowerCase()) ?? null;
}

function convertTable(
  { doc, collections }: ERDEditorSchemaV3,
  ctx: EngineContext,
  model: GraphQLModel,
  database: number,
  source: GraphQLTable,
  findTable: (name: string) => GraphQLTable | null,
  skipped: Set<string>
): TableContext {
  const { toWidth } = ctx;
  const columnFields: GraphQLField[] = [];
  const referenceFields: GraphQLField[] = [];

  for (const field of source.fields) {
    const { named } = field.typeRef;

    if (skipped.has(named)) continue;

    if (findTable(named)) {
      referenceFields.push(field);
    } else {
      columnFields.push(field);
    }
  }

  const primaryKeyFields = new Set(resolvePrimaryKeyFields(columnFields));
  const name = toSafeString(source.name);
  const comment = toSafeString(source.comment);
  const newTable = createTable({
    name,
    comment,
    ui: {
      widthName: textInRange(toWidth(name)),
      widthComment: textInRange(toWidth(comment)),
    },
  });

  const context: TableContext = {
    name,
    source,
    table: newTable,
    columns: [],
    referenceFields,
  };

  columnFields.forEach(field => {
    appendColumn(
      collections,
      context,
      createFieldColumn(
        ctx,
        model,
        database,
        newTable.id,
        field,
        primaryKeyFields.has(field)
      )
    );
  });

  doc.tableIds.push(newTable.id);
  query(collections).collection('tableEntities').setOne(newTable);

  return context;
}

function resolvePrimaryKeyFields(fields: GraphQLField[]): GraphQLField[] {
  const declared = fields.filter(field => field.primaryKey);
  if (declared.length) return declared;

  const idType = fields.find(
    field => field.typeRef.named === 'ID' && !field.typeRef.isList
  );
  if (idType) return [idType];

  const idName = fields.find(field => field.name.toLowerCase() === 'id');
  return idName ? [idName] : [];
}

function createFieldColumn(
  { toWidth }: EngineContext,
  model: GraphQLModel,
  database: number,
  tableId: string,
  field: GraphQLField,
  primaryKey: boolean
): Column {
  const { named, nonNull } = field.typeRef;
  const name = toSafeString(field.name);
  const override = toSafeString(field.dataType);
  const dataType = override
    ? override
    : resolveDataType(named, database, model);
  const defaultValue = toSafeString(field.default);
  const comment = toColumnComment(field, model, database);

  return createColumn({
    tableId,
    name,
    comment,
    dataType,
    default: defaultValue,
    options:
      (field.autoIncrement ? ColumnOption.autoIncrement : 0) |
      (primaryKey ? ColumnOption.primaryKey : 0) |
      (field.unique ? ColumnOption.unique : 0) |
      (nonNull ? ColumnOption.notNull : 0),
    ui: {
      widthName: textInRange(toWidth(name)),
      widthComment: textInRange(toWidth(comment)),
      widthDataType: textInRange(toWidth(dataType)),
      widthDefault: textInRange(toWidth(defaultValue)),
      // Only the foreign key bit is recomputed on load, so the primary key one
      // has to be written here as well as into options.
      keys: primaryKey ? ColumnUIKey.primaryKey : 0,
    },
  });
}

function toColumnComment(
  field: GraphQLField,
  model: GraphQLModel,
  database: number
): string {
  const { named, isList } = field.typeRef;
  const parts: string[] = [];
  const comment = toSafeString(field.comment);

  if (comment) {
    parts.push(comment);
  }
  if (isList) {
    parts.push(`list of ${named}`);
  }

  return `${parts.join(' ')}${enumCommentSuffix(named, model, database)}`.trim();
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
  contexts: TableContext[]
) {
  const findContext = createNameIndex(contexts);
  const edges: ReferenceEdge[] = [];

  contexts.forEach(source => {
    source.referenceFields.forEach(field => {
      const target = findContext(field.typeRef.named);
      if (!target) return;

      edges.push({ source, target, field, consumed: false });
    });
  });

  const state: ConvertState = {
    claimedColumnIds: new Set(),
    relationshipKeys: new Set(),
  };
  const singularEdges = edges.filter(edge => !edge.field.typeRef.isList);

  // @relation(fields:) marks the side that owns the foreign key, so those edges
  // claim their reciprocal before an unannotated one can.
  [
    ...singularEdges.filter(edge => edge.field.relationFields.length),
    ...singularEdges.filter(edge => !edge.field.relationFields.length),
  ].forEach(edge => {
    if (edge.consumed) return;

    const reciprocal = findReciprocalEdge(edges, edge);
    edge.consumed = true;
    if (reciprocal) {
      reciprocal.consumed = true;
    }

    const toMany = Boolean(reciprocal?.field.typeRef.isList);
    appendRelationship(schema, ctx, state, {
      parent: edge.target,
      child: edge.source,
      field: edge.field,
      childSide: true,
      relationshipType: edge.field.typeRef.nonNull
        ? toMany
          ? RelationshipType.OneN
          : RelationshipType.OneOnly
        : toMany
          ? RelationshipType.ZeroN
          : RelationshipType.ZeroOne,
    });
  });

  edges
    .filter(edge => edge.field.typeRef.isList)
    .forEach(edge => {
      if (edge.consumed) return;

      const pair = findManyToManyEdge(edges, edge);
      edge.consumed = true;

      if (pair) {
        pair.consumed = true;
        appendJunctionTable(schema, ctx, contexts, edge);
        return;
      }

      appendRelationship(schema, ctx, state, {
        parent: edge.source,
        child: edge.target,
        field: edge.field,
        childSide: false,
        relationshipType: edge.field.typeRef.nonNull
          ? RelationshipType.OneN
          : RelationshipType.ZeroN,
      });
    });
}

function findReciprocalEdge(
  edges: ReferenceEdge[],
  edge: ReferenceEdge
): ReferenceEdge | null {
  const candidates = edges.filter(
    candidate =>
      candidate !== edge &&
      !candidate.consumed &&
      candidate.source === edge.target &&
      candidate.target === edge.source
  );
  if (!candidates.length) return null;

  const { relationName } = edge.field;
  if (relationName) {
    return (
      candidates.find(
        candidate => candidate.field.relationName === relationName
      ) ?? null
    );
  }

  // A self relationship has one pool of edges rather than one per direction.
  if (edge.source === edge.target) {
    return candidates.length === 1 ? candidates[0] : null;
  }

  const forward = edges.filter(
    candidate =>
      !candidate.consumed &&
      candidate.source === edge.source &&
      candidate.target === edge.target
  );

  return candidates.length === 1 && forward.length === 1 ? candidates[0] : null;
}

function findManyToManyEdge(
  edges: ReferenceEdge[],
  edge: ReferenceEdge
): ReferenceEdge | null {
  const singular = edges.some(
    candidate =>
      !candidate.field.typeRef.isList &&
      ((candidate.source === edge.source && candidate.target === edge.target) ||
        (candidate.source === edge.target && candidate.target === edge.source))
  );
  if (singular) return null;

  const candidates = edges.filter(
    candidate =>
      candidate !== edge &&
      !candidate.consumed &&
      candidate.field.typeRef.isList &&
      candidate.source === edge.target &&
      candidate.target === edge.source
  );
  if (!candidates.length) return null;

  const { relationName } = edge.field;
  if (relationName) {
    return (
      candidates.find(
        candidate => candidate.field.relationName === relationName
      ) ?? null
    );
  }

  return candidates[0];
}

function appendRelationship(
  schema: ERDEditorSchemaV3,
  ctx: EngineContext,
  state: ConvertState,
  input: RelationshipInput
) {
  const { doc, collections } = schema;
  const { parent, child, relationshipType } = input;
  const parentKeys = primaryKeyColumns(parent.columns);
  // An empty end.columnIds still draws a connector, and the data type sync
  // walks the two id lists positionally, so a half-bound pair goes wrong later.
  if (!parentKeys.length) return;

  const { startColumns, endColumns } = resolveForeignKeyColumns(
    schema,
    ctx,
    state,
    input,
    parentKeys
  );
  if (!endColumns.length) return;

  const key = `${parent.table.id}:${child.table.id}:${endColumns
    .map(column => column.id)
    .join(',')}`;
  if (state.relationshipKeys.has(key)) return;
  state.relationshipKeys.add(key);

  endColumns.forEach(column => {
    if (bHas(column.ui.keys, ColumnUIKey.primaryKey)) {
      column.ui.keys |= ColumnUIKey.foreignKey;
    } else {
      column.ui.keys = ColumnUIKey.foreignKey;
    }
    state.claimedColumnIds.add(column.id);
  });

  const newRelationship = createRelationship({
    identification: endColumns.every(
      column =>
        bHas(column.ui.keys, ColumnUIKey.primaryKey) &&
        bHas(column.ui.keys, ColumnUIKey.foreignKey)
    ),
    relationshipType,
    start: {
      tableId: parent.table.id,
      columnIds: startColumns.map(column => column.id),
    },
    end: {
      tableId: child.table.id,
      columnIds: endColumns.map(column => column.id),
    },
  });

  doc.relationshipIds.push(newRelationship.id);
  query(collections).collection('relationshipEntities').setOne(newRelationship);
}

function resolveForeignKeyColumns(
  schema: ERDEditorSchemaV3,
  ctx: EngineContext,
  state: ConvertState,
  { parent, child, field, childSide }: RelationshipInput,
  parentKeys: Column[]
): { startColumns: Column[]; endColumns: Column[] } {
  if (childSide && field.relationFields.length) {
    const startColumns: Column[] = [];
    const endColumns: Column[] = [];

    field.relationFields.forEach((columnName, index) => {
      const endColumn = findByName(child.columns, columnName);
      const referenceName = field.relationReferences[index];
      const startColumn = referenceName
        ? findByName(parent.columns, referenceName)
        : (parentKeys[index] ?? null);
      if (!endColumn || !startColumn) return;

      startColumns.push(startColumn);
      endColumns.push(endColumn);
    });

    if (endColumns.length) return { startColumns, endColumns };
  }

  // On the list side the field name describes the children, so the child's
  // foreign key can only be named after the parent type.
  const prefix = childSide ? toSafeString(field.name) : lowerFirst(parent.name);
  const taken = new Set<string>();
  const startColumns: Column[] = [];
  const endColumns: Column[] = [];

  parentKeys.forEach(parentKey => {
    const candidates = foreignKeyNames(prefix, parent.name, parentKey.name);
    const found = findUnclaimedColumn(child.columns, candidates, id =>
      taken.has(id) ? true : state.claimedColumnIds.has(id)
    );
    const endColumn =
      found ??
      createForeignKeyColumn(
        schema,
        ctx,
        child,
        field,
        parentKey,
        candidates[0]
      );

    taken.add(endColumn.id);
    startColumns.push(parentKey);
    endColumns.push(endColumn);
  });

  return { startColumns, endColumns };
}

function foreignKeyNames(
  prefix: string,
  typeName: string,
  primaryKeyName: string
): string[] {
  return [
    `${prefix}${pascalCase(primaryKeyName)}`,
    `${snakeCase(prefix)}_${snakeCase(primaryKeyName)}`,
    `${typeName}${pascalCase(primaryKeyName)}`,
    `${snakeCase(typeName)}_${snakeCase(primaryKeyName)}`,
    `${prefix}Id`,
    `${snakeCase(prefix)}_id`,
  ];
}

function findUnclaimedColumn(
  columns: Column[],
  candidates: string[],
  isClaimed: (id: string) => boolean
): Column | null {
  for (const candidate of candidates) {
    const column = findByName(columns, candidate);
    if (column && !isClaimed(column.id)) {
      return column;
    }
  }
  return null;
}

function createForeignKeyColumn(
  { collections }: ERDEditorSchemaV3,
  { toWidth }: EngineContext,
  child: TableContext,
  field: GraphQLField,
  parentKey: Column,
  preferredName: string
): Column {
  const name = autoName(child.columns, '', preferredName);
  const { dataType } = parentKey;
  const newColumn = createColumn({
    tableId: child.table.id,
    name,
    dataType,
    options: field.typeRef.nonNull ? ColumnOption.notNull : 0,
    ui: {
      keys: ColumnUIKey.foreignKey,
      widthName: textInRange(toWidth(name)),
      widthDataType: textInRange(toWidth(dataType)),
    },
  });

  appendColumn(collections, child, newColumn);

  return newColumn;
}

function appendJunctionTable(
  schema: ERDEditorSchemaV3,
  ctx: EngineContext,
  contexts: TableContext[],
  edge: ReferenceEdge
) {
  const { doc, collections } = schema;
  const { toWidth } = ctx;
  const left = edge.source;
  const right = edge.target;
  const leftKeys = primaryKeyColumns(left.columns);
  const rightKeys = primaryKeyColumns(right.columns);
  if (!leftKeys.length || !rightKeys.length) return;

  const name = autoName(
    contexts.map(context => context.table),
    '',
    `${left.name}_${right.name}`
  );
  // convertToSchema has no warning channel, so the note that this is the one
  // table the importer invented rather than read travels in the diagram.
  const comment = `Junction table inferred from ${left.name} <-> ${right.name}`;
  const newTable = createTable({
    name,
    comment,
    ui: {
      widthName: textInRange(toWidth(name)),
      widthComment: textInRange(toWidth(comment)),
    },
  });
  const junction: TableContext = {
    name,
    source: { name, comment, fields: [], indexes: [] },
    table: newTable,
    columns: [],
    referenceFields: [],
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
  const endColumns = parentKeys.map(parentKey => {
    const name = autoName(
      junction.columns,
      '',
      `${lowerFirst(parent.name)}${pascalCase(parentKey.name)}`
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
      columnIds: endColumns.map(column => column.id),
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
      const newIndex = createIndex({
        name: toSafeString(index.name),
        tableId: table.id,
        unique: index.unique,
      });
      const indexColumns: IndexColumn[] = [];

      index.fieldNames.forEach(fieldName => {
        const column = findByName(columns, fieldName);
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
