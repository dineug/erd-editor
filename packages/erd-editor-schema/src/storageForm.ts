import {
  DictionaryFields,
  type DictionaryKey,
  DictionaryRows,
  stringifyDocument,
  toDictionaryRows,
} from '@/dictionaryRows';
import { NormalizedSettings, normalizeSettings } from '@/normalizeSettings';
import { compareByOrder } from '@/orderKey';
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

type DocumentTable = Pick<Table, 'id' | 'columnIds'> & {
  name?: string;
  logicalName?: string;
  comment?: string;
  groupId?: string;
  nameDerived?: boolean;
  ui: Pick<TableUI, 'x' | 'y'> & { color?: string };
};

type DocumentColumn = Pick<Column, 'id' | 'tableId' | 'options'> & {
  name?: string;
  comment?: string;
  dataType?: string;
  default?: string;
  logicalName?: string;
  domainId?: string;
};

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

type DocumentIndex = Omit<Index, 'name' | 'seqIndexColumnIds'> & {
  name?: string;
};

type DocumentMemo = Pick<Memo, 'id'> & {
  value?: string;
  ui: Omit<MemoUI, 'zIndex' | 'color'> & { color?: string };
};

type DocumentTableGroup = Pick<TableGroup, 'id'> & {
  name?: string;
  color?: string;
  ui: Omit<TableGroupUI, 'zIndex'>;
};

/** A v3 document in the storage form a file holds. */
export type ERDEditorDocumentV3 = Pick<
  ERDEditorSchemaV3,
  '$schema' | 'version'
> & {
  settings: NormalizedSettings;
  doc: Partial<Omit<Doc, 'wordIds' | 'termIds' | 'domainIds'>>;
  collections?: {
    tableEntities?: Record<string, DocumentTable>;
    tableColumnEntities?: Record<string, DocumentColumn>;
    relationshipEntities?: Record<string, DocumentRelationship>;
    indexEntities?: Record<string, DocumentIndex>;
    indexColumnEntities?: Record<string, IndexColumn>;
    memoEntities?: Record<string, DocumentMemo>;
    tableGroupEntities?: Record<string, DocumentTableGroup>;
    wordEntities?: DictionaryRows;
    termEntities?: DictionaryRows;
    domainEntities?: DictionaryRows;
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
  if (source.nameViewMode !== undefined) {
    written.nameViewMode = source.nameViewMode;
  }

  return written;
}

/**
 * Whether a dictionary row holds a value past its id, a blank read as none, so
 * a row added and never filled, or emptied, stays out of the file.
 */
const holdsValue = (key: DictionaryKey, entity: object) =>
  DictionaryFields[key].some(field => {
    const value: unknown = Reflect.get(entity, field);
    return field !== 'id' && typeof value === 'string' && value.trim() !== '';
  });

/**
 * A text field as the file holds it, left out while empty, since a parse gives
 * a missing one the '' its entity starts from.
 */
const textField = <K extends string>(
  key: K,
  value: string
): Partial<Record<K, string>> =>
  value === '' ? {} : ({ [key]: value } as Record<K, string>);

/**
 * A logical name as the file holds it: one of only blanks is none, as every
 * view reads it, and raw JSON handed over unparsed may hold none at all.
 */
const logicalNameField = (logicalName: unknown): { logicalName?: string } =>
  typeof logicalName === 'string' && logicalName.trim() !== ''
    ? { logicalName }
    : {};

/** A dictionary's header and rows, none while it holds no row. */
const writtenRows = (key: DictionaryKey, entities: ReadonlyArray<object>) =>
  entities.length !== 0 ? toDictionaryRows(key, entities) : undefined;

const holdsEntries = (value: unknown) =>
  Array.isArray(value)
    ? value.length !== 0
    : value !== undefined && Object.keys(value as object).length !== 0;

/**
 * The fields of an object that hold an entry, an empty list or record left
 * out, since a parse reads a missing one as empty; undefined for none at all.
 */
function withEntries<T extends Record<string, unknown>>(
  fields: T
): Partial<T> | undefined {
  const held = Object.entries(fields).filter(([, value]) =>
    holdsEntries(value)
  );
  return held.length !== 0
    ? (Object.fromEntries(held) as Partial<T>)
    : undefined;
}

/**
 * The storage form of a document as an object: the live entities alone, keyed
 * by id but the dictionaries' rows, no empty text, list or collection but the
 * doc, which readers take a file by, and no field an editor derives or keeps.
 */
export function toDocument(schema: ERDEditorSchemaV3): ERDEditorDocumentV3 {
  // Raw JSON no parser built, this function's own output, say, may leave out
  // each list and collection that holds nothing.
  const doc: Partial<Doc> = schema.doc ?? {};
  const collections: Partial<ERDEditorSchemaV3['collections']> =
    schema.collections ?? {};
  const tableEntities = collections.tableEntities ?? {};
  const tableColumnEntities = collections.tableColumnEntities ?? {};
  const relationshipEntities = collections.relationshipEntities ?? {};
  const indexEntities = collections.indexEntities ?? {};
  const indexColumnEntities = collections.indexColumnEntities ?? {};
  const memoEntities = collections.memoEntities ?? {};
  const tableGroupEntities = collections.tableGroupEntities ?? {};
  const tableGroupIds = liveIds(doc.tableGroupIds ?? [], tableGroupEntities);
  const keptGroups = new Set(tableGroupIds);

  const wordEntities = collections.wordEntities ?? {};
  const termEntities = collections.termEntities ?? {};
  const domainEntities = collections.domainEntities ?? {};
  const domainIds = liveIds(doc.domainIds ?? [], domainEntities).filter(id =>
    holdsValue('domainEntities', domainEntities[id])
  );
  const keptDomains = new Set(domainIds);

  const tableIds = liveIds(doc.tableIds ?? [], tableEntities);
  const keptTables = new Set(tableIds);
  const columnIdsOf = new Map<string, Set<string>>();

  const tables = tableIds.map((id): DocumentTable => {
    const table = tableEntities[id];
    const columnIds = liveIds(table.columnIds, tableColumnEntities);
    columnIdsOf.set(id, new Set(columnIds));

    return {
      id: table.id,
      ...textField('name', table.name),
      ...logicalNameField(table.logicalName),
      ...textField('comment', table.comment),
      columnIds,
      ...(keptGroups.has(table.groupId) ? { groupId: table.groupId } : {}),
      ...(table.nameDerived === true ? { nameDerived: true } : {}),
      ui: {
        x: table.ui.x,
        y: table.ui.y,
        ...textField('color', table.ui.color),
      },
    };
  });

  const columns = [...new Set(tables.flatMap(table => table.columnIds))].map(
    (id): DocumentColumn => {
      const column = tableColumnEntities[id];

      return {
        id: column.id,
        tableId: column.tableId,
        ...textField('name', column.name),
        ...textField('comment', column.comment),
        ...textField('dataType', column.dataType),
        ...textField('default', column.default),
        options: column.options,
        ...logicalNameField(column.logicalName),
        ...(keptDomains.has(column.domainId)
          ? { domainId: column.domainId }
          : {}),
      };
    }
  );

  const relationshipIds = liveIds(
    doc.relationshipIds ?? [],
    relationshipEntities
  ).filter(id => {
    const { start, end } = relationshipEntities[id];
    return keptTables.has(start.tableId) && keptTables.has(end.tableId);
  });

  const relationships = relationshipIds.map((id): DocumentRelationship => {
    const relationship = relationshipEntities[id];
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

  const indexIds = liveIds(doc.indexIds ?? [], indexEntities).filter(id =>
    keptTables.has(indexEntities[id].tableId)
  );

  const indexes = indexIds.map((id): DocumentIndex => {
    const index = indexEntities[id];
    const columnIds = columnIdsOf.get(index.tableId)!;
    const indexColumnIds = liveIds(
      index.indexColumnIds,
      indexColumnEntities
    ).filter(indexColumnId =>
      columnIds.has(indexColumnEntities[indexColumnId].columnId)
    );

    return {
      id: index.id,
      ...textField('name', index.name),
      tableId: index.tableId,
      indexColumnIds,
      unique: index.unique,
    };
  });

  const indexColumns = [
    ...new Set(indexes.flatMap(index => index.indexColumnIds)),
  ].map((id): IndexColumn => {
    const indexColumn = indexColumnEntities[id];

    return {
      id: indexColumn.id,
      indexId: indexColumn.indexId,
      columnId: indexColumn.columnId,
      orderType: indexColumn.orderType,
    };
  });

  const memoIds = liveIds(doc.memoIds ?? [], memoEntities);
  const memos = memoIds.map((id): DocumentMemo => {
    const memo = memoEntities[id];
    const { ui } = memo;

    return {
      id: memo.id,
      ...textField('value', memo.value),
      ui: {
        x: ui.x,
        y: ui.y,
        width: ui.width,
        height: ui.height,
        ...textField('color', ui.color),
      },
    };
  });

  const tableGroups = tableGroupIds.map((id): DocumentTableGroup => {
    const tableGroup = tableGroupEntities[id];
    const { ui } = tableGroup;

    return {
      id: tableGroup.id,
      ...textField('name', tableGroup.name),
      ...textField('color', tableGroup.color),
      ui: { x: ui.x, y: ui.y, width: ui.width, height: ui.height },
    };
  });

  // A file holds a sheet's order in its rows alone, so they go in key order.
  const words = liveIds(doc.wordIds ?? [], wordEntities)
    .map(id => wordEntities[id])
    .filter(word => holdsValue('wordEntities', word))
    .sort(compareByOrder);
  const terms = liveIds(doc.termIds ?? [], termEntities)
    .map(id => termEntities[id])
    .map(term =>
      keptDomains.has(term.domainId) ? term : { ...term, domainId: '' }
    )
    .filter(term => holdsValue('termEntities', term))
    .sort(compareByOrder);
  const domains = domainIds.map(id => domainEntities[id]).sort(compareByOrder);

  const writtenDoc = withEntries({
    tableIds,
    relationshipIds,
    indexIds,
    memoIds,
    tableGroupIds,
  });
  const writtenCollections = withEntries({
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
    tableGroupEntities: toRecord(tableGroups),
    wordEntities: writtenRows('wordEntities', words),
    termEntities: writtenRows('termEntities', terms),
    domainEntities: writtenRows('domainEntities', domains),
  });

  return {
    $schema: SCHEMA_URL,
    version: '3.0.0',
    settings: toDocumentSettings(schema.settings),
    doc: writtenDoc ?? {},
    ...(writtenCollections ? { collections: writtenCollections } : {}),
  };
}

/**
 * The storage form a file holds, as text: what toDocument returns, indented by
 * two spaces, a dictionary row to a line, and ending with a newline, so each
 * save of the same document writes the same bytes.
 */
export function toDocumentJson(schema: ERDEditorSchemaV3): string {
  return `${stringifyDocument(toDocument(schema))}\n`;
}
