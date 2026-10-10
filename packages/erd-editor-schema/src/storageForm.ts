import { NormalizedSettings, normalizeSettings } from '@/normalizeSettings';
import { ERDEditorSchemaV3 } from '@/v3/schema';
import { Doc } from '@/v3/schema/doc';
import { Index } from '@/v3/schema/index.entity';
import { IndexColumn } from '@/v3/schema/indexColumn.entity';
import { Memo, MemoUI } from '@/v3/schema/memo.entity';
import {
  Relationship,
  RelationshipPoint,
} from '@/v3/schema/relationship.entity';
import { Settings } from '@/v3/schema/settings';
import { Table, TableUI } from '@/v3/schema/table.entity';
import { Column } from '@/v3/schema/tableColumn.entity';
import { TableGroup, TableGroupUI } from '@/v3/schema/tableGroup.entity';

const SCHEMA_URL =
  'https://raw.githubusercontent.com/dineug/erd-editor/main/json-schema/schema.json';

type DocumentTable = Pick<Table, 'id' | 'name' | 'comment' | 'columnIds'> & {
  groupId?: string;
  ui: Pick<TableUI, 'x' | 'y' | 'color'>;
};

type DocumentColumn = Omit<Column, 'ui'>;

type DocumentRelationshipPoint = Pick<
  RelationshipPoint,
  'tableId' | 'columnIds'
>;

type DocumentRelationship = Pick<
  Relationship,
  'id' | 'relationshipType' | 'onDelete' | 'onUpdate'
> & {
  start: DocumentRelationshipPoint;
  end: DocumentRelationshipPoint;
};

type DocumentIndex = Omit<Index, 'seqIndexColumnIds'>;

type DocumentMemo = Omit<Memo, 'ui'> & { ui: Omit<MemoUI, 'zIndex'> };

type DocumentTableGroup = Omit<TableGroup, 'ui'> & {
  ui: Omit<TableGroupUI, 'zIndex'>;
};

/** A v3 document in the storage form a file holds. */
export type ERDEditorDocumentV3 = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version'
> & {
  settings: NormalizedSettings;
  doc: Omit<Doc, 'tableGroupIds'> & { tableGroupIds?: string[] };
  collections: {
    tableEntities: Record<string, DocumentTable>;
    tableColumnEntities: Record<string, DocumentColumn>;
    relationshipEntities: Record<string, DocumentRelationship>;
    indexEntities: Record<string, DocumentIndex>;
    indexColumnEntities: Record<string, IndexColumn>;
    memoEntities: Record<string, DocumentMemo>;
    tableGroupEntities?: Record<string, DocumentTableGroup>;
  };
};

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The ids of a list that name an entity, each once, in the order listed. */
const liveIds = (
  ids: ReadonlyArray<string>,
  entities: Record<string, unknown>
): string[] => [...new Set(ids)].filter(id => Object.hasOwn(entities, id));

/**
 * A record keyed by id in code unit order; a key that reads as an array index
 * still comes first, as every object key of that kind does.
 */
const toRecord = <T extends { id: string }>(
  entities: T[],
  order: (a: T, b: T) => number = (a, b) => compare(a.id, b.id)
): Record<string, T> =>
  Object.fromEntries(entities.sort(order).map(entity => [entity.id, entity]));

function toDocumentSettings(settings: Settings): NormalizedSettings {
  const source = normalizeSettings(settings);
  const written: NormalizedSettings = {
    originX: source.originX,
    originY: source.originY,
    zoomLevel: source.zoomLevel,
    show: source.show,
    database: source.database,
    databaseName: source.databaseName,
    canvasType: source.canvasType,
    language: source.language,
    tableNameCase: source.tableNameCase,
    columnNameCase: source.columnNameCase,
    bracketType: source.bracketType,
    relationshipDataTypeSync: source.relationshipDataTypeSync,
    columnOrder: source.columnOrder,
    maxWidthComment: source.maxWidthComment,
    lockSettings: source.lockSettings,
  };

  if (source.ddlScripts) {
    written.ddlScripts = source.ddlScripts;
  }

  return written;
}

/**
 * The storage form of a document as an object: the live entities alone, each
 * collection sorted by id, without the fields an editor derives on load or
 * keeps for one instance.
 */
export function toDocument(schema: ERDEditorSchemaV3): ERDEditorDocumentV3 {
  const { doc, collections } = schema;
  const tableGroupEntities = collections.tableGroupEntities ?? {};
  const tableGroupIds = liveIds(doc.tableGroupIds ?? [], tableGroupEntities);
  const keptGroups = new Set(tableGroupIds);

  const tableIds = liveIds(doc.tableIds, collections.tableEntities);
  const keptTables = new Set(tableIds);
  const columnIdsOf = new Map<string, Set<string>>();

  const tables = tableIds.map((id): DocumentTable => {
    const table = collections.tableEntities[id];
    const columnIds = liveIds(table.columnIds, collections.tableColumnEntities);
    columnIdsOf.set(id, new Set(columnIds));

    return {
      id: table.id,
      name: table.name,
      comment: table.comment,
      columnIds,
      ...(keptGroups.has(table.groupId) ? { groupId: table.groupId } : {}),
      ui: { x: table.ui.x, y: table.ui.y, color: table.ui.color },
    };
  });

  const columns = [...new Set(tables.flatMap(table => table.columnIds))].map(
    (id): DocumentColumn => {
      const column = collections.tableColumnEntities[id];

      return {
        id: column.id,
        tableId: column.tableId,
        name: column.name,
        comment: column.comment,
        dataType: column.dataType,
        default: column.default,
        options: column.options,
      };
    }
  );

  const relationshipIds = liveIds(
    doc.relationshipIds,
    collections.relationshipEntities
  ).filter(id => {
    const { start, end } = collections.relationshipEntities[id];
    return keptTables.has(start.tableId) && keptTables.has(end.tableId);
  });

  const relationships = relationshipIds.map((id): DocumentRelationship => {
    const relationship = collections.relationshipEntities[id];
    const { start, end } = relationship;

    return {
      id: relationship.id,
      relationshipType: relationship.relationshipType,
      onDelete: relationship.onDelete,
      onUpdate: relationship.onUpdate,
      start: { tableId: start.tableId, columnIds: start.columnIds },
      end: { tableId: end.tableId, columnIds: end.columnIds },
    };
  });

  const indexIds = liveIds(doc.indexIds, collections.indexEntities).filter(id =>
    keptTables.has(collections.indexEntities[id].tableId)
  );

  const indexes = indexIds.map((id): DocumentIndex => {
    const index = collections.indexEntities[id];
    const columnIds = columnIdsOf.get(index.tableId)!;
    const indexColumnIds = liveIds(
      index.indexColumnIds,
      collections.indexColumnEntities
    ).filter(indexColumnId =>
      columnIds.has(collections.indexColumnEntities[indexColumnId].columnId)
    );

    return {
      id: index.id,
      name: index.name,
      tableId: index.tableId,
      indexColumnIds,
      unique: index.unique,
    };
  });

  const indexColumns = [
    ...new Set(indexes.flatMap(index => index.indexColumnIds)),
  ].map((id): IndexColumn => {
    const indexColumn = collections.indexColumnEntities[id];

    return {
      id: indexColumn.id,
      indexId: indexColumn.indexId,
      columnId: indexColumn.columnId,
      orderType: indexColumn.orderType,
    };
  });

  const memoIds = liveIds(doc.memoIds, collections.memoEntities);
  const memos = memoIds.map((id): DocumentMemo => {
    const memo = collections.memoEntities[id];
    const { ui } = memo;

    return {
      id: memo.id,
      value: memo.value,
      ui: {
        x: ui.x,
        y: ui.y,
        width: ui.width,
        height: ui.height,
        color: ui.color,
      },
    };
  });

  const tableGroups = tableGroupIds.map((id): DocumentTableGroup => {
    const tableGroup = tableGroupEntities[id];
    const { ui } = tableGroup;

    return {
      id: tableGroup.id,
      name: tableGroup.name,
      color: tableGroup.color,
      ui: { x: ui.x, y: ui.y, width: ui.width, height: ui.height },
    };
  });

  const hasGroups = tableGroups.length !== 0;

  return {
    $schema: SCHEMA_URL,
    version: '3.0.0',
    settings: toDocumentSettings(schema.settings),
    doc: {
      tableIds,
      relationshipIds,
      indexIds,
      memoIds,
      ...(hasGroups ? { tableGroupIds } : {}),
    },
    collections: {
      tableEntities: toRecord(tables),
      tableColumnEntities: toRecord(
        columns,
        (a, b) => compare(a.tableId, b.tableId) || compare(a.id, b.id)
      ),
      relationshipEntities: toRecord(relationships),
      indexEntities: toRecord(indexes),
      indexColumnEntities: toRecord(
        indexColumns,
        (a, b) => compare(a.indexId, b.indexId) || compare(a.id, b.id)
      ),
      memoEntities: toRecord(memos),
      ...(hasGroups ? { tableGroupEntities: toRecord(tableGroups) } : {}),
    },
  };
}

/**
 * The storage form a file holds, as text: what toDocument returns, indented by
 * two spaces and ending with a newline, so each save of the same document
 * writes the same bytes.
 */
export function toDocumentJson(schema: ERDEditorSchemaV3): string {
  return `${JSON.stringify(toDocument(schema), null, 2)}\n`;
}
