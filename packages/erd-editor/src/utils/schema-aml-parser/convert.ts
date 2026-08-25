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
import {
  Collections,
  Column,
  Index,
  IndexColumn,
  Table,
} from '@/internal-types';
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
import {
  AMLAttribute,
  AMLEndpoint,
  AMLEntity,
  AMLModel,
  AMLNamespace,
  EMPTY_NAMESPACE,
} from './types';

const DEFAULT_NAMESPACE_KEY = namespaceKeyOf(EMPTY_NAMESPACE);

type TableContext = {
  source: AMLEntity;
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

type IndexGroup = {
  index: Index;
  indexColumns: IndexColumn[];
};

export function convertToSchema(
  model: AMLModel,
  ctx: EngineContext,
  database: number
): ERDEditorSchemaV3 {
  const schema = schemaV3Parser({});
  const qualify = createQualifier(model.entities);
  const contexts = model.entities.map(source =>
    convertEntity(schema, ctx, model, database, source, qualify(source))
  );
  const findContext = createTableIndex(model.entities, contexts);

  convertRelationships(schema, ctx, contexts, model, findContext);
  convertIndexes(schema, contexts);

  return schema;
}

/**
 * The document has one flat entity list, so a namespace only survives as a
 * prefix, and only where dropping it would fold two entities together.
 */
function createQualifier(entities: AMLEntity[]): (entity: AMLEntity) => string {
  const namespaceKeys = new Set(
    entities.map(entity => namespaceKeyOf(entity.namespace))
  );

  return entity => {
    const key = namespaceKeyOf(entity.namespace);

    return namespaceKeys.size > 1 && key !== DEFAULT_NAMESPACE_KEY
      ? `${namespacePrefixOf(entity.namespace)}_${entity.name}`
      : entity.name;
  };
}

/**
 * Keeps the empty slots, so the `identity...profiles` database and the
 * `identity.profiles` schema stay two namespaces rather than one.
 */
function namespaceKeyOf({ database, catalog, schema }: AMLNamespace): string {
  return `${database}.${catalog}.${schema}`;
}

function namespacePrefixOf({
  database,
  catalog,
  schema,
}: AMLNamespace): string {
  return [database, catalog, schema]
    .filter(segment => segment !== '')
    .join('_');
}

/**
 * A ref names an entity by its namespace-qualified name or by its alias, and
 * the namespace is optional even where the entity declared one.
 */
function createTableIndex(
  sources: AMLEntity[],
  contexts: TableContext[]
): (endpoint: AMLEndpoint) => TableContext | null {
  const byKey = new Map<string, TableContext>();

  const set = (key: string, context: TableContext) => {
    const lowered = key.toLowerCase();
    if (!byKey.has(lowered)) {
      byKey.set(lowered, context);
    }
  };

  sources.forEach((source, index) => {
    const context = contexts[index];
    const key = namespaceKeyOf(source.namespace);

    set(`${key}.${source.name}`, context);
    set(source.name, context);

    if (source.alias) {
      set(source.alias, context);
      set(`${key}.${source.alias}`, context);
    }
  });

  return endpoint => {
    const key = namespaceKeyOf(endpoint.namespace);

    return (
      byKey.get(`${key}.${endpoint.entityName}`.toLowerCase()) ??
      (key === DEFAULT_NAMESPACE_KEY
        ? (byKey.get(endpoint.entityName.toLowerCase()) ?? null)
        : null)
    );
  };
}

function convertEntity(
  { doc, collections }: ERDEditorSchemaV3,
  ctx: EngineContext,
  model: AMLModel,
  database: number,
  source: AMLEntity,
  entityName: string
): TableContext {
  const { toWidth } = ctx;
  const name = toSafeString(entityName);
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

  source.attributes.forEach(attribute => {
    const columnName = toSafeString(attribute.path);
    const dataType = resolveDataType(
      attribute.typeName,
      database,
      model,
      attribute.enumValues
    );
    const columnComment =
      `${toSafeString(attribute.comment)}${enumCommentSuffix(
        attribute.typeName,
        model,
        database,
        attribute.enumValues
      )}`.trim();
    const defaultValue = toSafeString(attribute.default);

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
          (attribute.autoIncrement ? ColumnOption.autoIncrement : 0) |
          (attribute.primaryKey ? ColumnOption.primaryKey : 0) |
          (hasColumnUnique(attribute) ? ColumnOption.unique : 0) |
          (attribute.notNull ? ColumnOption.notNull : 0),
        ui: {
          widthName: textInRange(toWidth(columnName)),
          widthComment: textInRange(toWidth(columnComment)),
          widthDataType: textInRange(toWidth(dataType)),
          widthDefault: textInRange(toWidth(defaultValue)),
          // Only the foreign key bit is recomputed on load, so the primary key
          // one has to be written here as well as into `options`.
          keys: attribute.primaryKey ? ColumnUIKey.primaryKey : 0,
        },
      })
    );
  });

  doc.tableIds.push(newTable.id);
  query(collections).collection('tableEntities').setOne(newTable);

  return context;
}

/** A bare `unique` is the one constraint the column itself can hold. */
function hasColumnUnique(attribute: AMLAttribute): boolean {
  return attribute.indexes.some(entry => entry.unique && entry.name === '');
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
  model: AMLModel,
  findContext: (endpoint: AMLEndpoint) => TableContext | null
) {
  const relationshipKeys = new Set<string>();

  model.relations.forEach(relation => {
    const child = findContext(relation.src);
    const parent = findContext(relation.ref);
    if (!child || !parent) return;

    const childColumns = resolveColumns(child, relation.src);
    const parentColumns = resolveColumns(parent, relation.ref);
    if (
      childColumns.length === 0 ||
      parentColumns.length === 0 ||
      childColumns.length !== parentColumns.length
    ) {
      return;
    }

    if (relation.srcCardinality === 'n' && relation.refCardinality === 'n') {
      appendJunctionTable(schema, ctx, contexts, child, parent);
      return;
    }

    // The referencing attribute is always the child, so a polymorphic relation
    // reaches the diagram as an ordinary edge minus its discriminator.
    appendRelationship(schema, ctx, relationshipKeys, {
      parent,
      parentColumns,
      child,
      childColumns,
      toMany: relation.refCardinality === 'n',
    });
  });
}

function resolveColumns(
  context: TableContext,
  endpoint: AMLEndpoint
): Column[] {
  // An endpoint with no attribute list is AML's natural relation: it names the
  // entity's primary key.
  if (endpoint.attributePaths.length === 0) {
    return primaryKeyColumns(context.columns);
  }

  const columns: Column[] = [];

  for (const path of endpoint.attributePaths) {
    const column = findByName(context.columns, path);
    if (!column) return [];

    columns.push(column);
  }

  return columns;
}

function appendRelationship(
  { doc, collections }: ERDEditorSchemaV3,
  { toWidth }: EngineContext,
  relationshipKeys: Set<string>,
  { parent, parentColumns, child, childColumns, toMany }: RelationshipInput
) {
  const key = `${parent.table.id}:${child.table.id}:${childColumns
    .map(column => column.id)
    .join(',')}`;
  if (relationshipKeys.has(key)) return;
  relationshipKeys.add(key);

  const mandatory = childColumns.every(column =>
    bHas(column.options, ColumnOption.notNull)
  );

  childColumns.forEach((column, index) => {
    // The type slot sits between the name and the relation, so an attribute
    // written as `created_by -> users(id)` reaches here with none.
    if (column.dataType === '') {
      const { dataType } = parentColumns[index];

      column.dataType = dataType;
      column.ui.widthDataType = textInRange(toWidth(dataType));
    }

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
  // entity the importer invented rather than read travels in the diagram.
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
      namespace: EMPTY_NAMESPACE,
      name,
      alias: '',
      comment,
      attributes: [],
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
    const groups = new Map<string, IndexGroup>();

    source.attributes.forEach((attribute, attributeIndex) => {
      const column = columns[attributeIndex];
      if (!column) return;

      attribute.indexes.forEach((entry, entryIndex) => {
        if (entry.unique && entry.name === '') return;

        // Only a name groups members together; an unnamed `index` is its own.
        const key =
          entry.name === ''
            ? `b:${attributeIndex}:${entryIndex}`
            : `n:${entry.name}`;
        const group = groups.get(key) ?? {
          index: createIndex({
            name: toSafeString(entry.name),
            tableId: table.id,
          }),
          indexColumns: [],
        };

        group.index.unique = group.index.unique || entry.unique;
        group.indexColumns.push(
          createIndexColumn({
            indexId: group.index.id,
            columnId: column.id,
            orderType: OrderType.ASC,
          })
        );
        groups.set(key, group);
      });
    });

    groups.forEach(({ index, indexColumns }) => {
      indexColumns.forEach(indexColumn => {
        index.indexColumnIds.push(indexColumn.id);
        index.seqIndexColumnIds.push(indexColumn.id);
        query(collections)
          .collection('indexColumnEntities')
          .setOne(indexColumn);
      });

      doc.indexIds.push(index.id);
      query(collections).collection('indexEntities').setOne(index);
    });
  });
}
