import {
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorList,
  DatabaseVendorToDatabase,
  type RootState,
} from '@dineug/erd-editor/peer.js';
import { toJson } from '@dineug/erd-editor-schema';

import { fitsInRead, MAX_READ_CHARS } from '@/tools/budget';
import { ToolError, ToolErrorCode } from '@/tools/errors';
import {
  type EntityIds,
  findTables,
  type ListOptions,
  toDocumentList,
  toEntityDetails,
  toTableNameList,
} from '@/tools/outline';
import { toAgentSnapshot } from '@/tools/snapshot';

export type ReadFormat = 'snapshot' | 'sql' | 'json';

export const READ_FORMATS: readonly ReadFormat[] = Object.freeze([
  'snapshot',
  'sql',
  'json',
]);

/** The vendor names the sql format takes, each the name of one database. */
export const SQL_VENDORS: readonly string[] = DatabaseVendorList;

export const READ_TOOL = 'erd_read';
export const LIST_TOOL = 'erd_list';
export const GET_TOOL = 'erd_get';

const refused = (message: string) =>
  new ToolError(ToolErrorCode.invalidArgs, READ_TOOL, message);

/** The database a vendor name stands for, through the map the element's getSchemaSQL reads. */
function toDatabase(vendor: string): number {
  if (!SQL_VENDORS.includes(vendor)) {
    throw refused(
      `vendor ${String(vendor)} is unknown; use one of ${SQL_VENDORS.join(', ')}`
    );
  }
  return DatabaseVendorToDatabase[vendor as DatabaseVendor];
}

/** The tables erd_read gives the DDL of, by id or by name; the whole document when absent. */
export type TableFilter = Pick<EntityIds, 'tableIds' | 'tableNames'>;

/** What each format tells an agent to do when the document is too large for one read. */
const NARROWER: Readonly<Record<ReadFormat, string>> = {
  sql: 'pass tableIds or tableNames for the tables the task needs, which erd_list with query or namesOnly finds',
  snapshot:
    'find tables with erd_list (query, namesOnly) and read them with erd_get, or the sql format with tableNames',
  json: 'find tables with erd_list (query, namesOnly) and read them with erd_get, or the sql format with tableNames',
};

/**
 * The state with only the tables named, their indexes and the relationships
 * whose child end is one of them: the foreign keys they hold keep the parent
 * tables they reference, so a join path out of the selection still shows.
 */
function selectTables(state: RootState, filter: TableFilter): RootState {
  const { ids, missing } = findTables(state, filter);
  if (missing.length) {
    throw new ToolError(
      ToolErrorCode.notFound,
      READ_TOOL,
      `${missing.join(', ')} ${missing.length === 1 ? 'names' : 'name'} no live table; erd_list lists them`
    );
  }
  if (!ids.length) {
    throw refused('tableIds and tableNames name no table; pass one at least');
  }
  const selected = new Set(ids);
  const { doc, collections } = state;

  return {
    ...state,
    doc: {
      ...doc,
      tableIds: doc.tableIds.filter(id => selected.has(id)),
      relationshipIds: doc.relationshipIds.filter(id =>
        selected.has(collections.relationshipEntities[id]?.end.tableId)
      ),
      indexIds: doc.indexIds.filter(id =>
        selected.has(collections.indexEntities[id]?.tableId)
      ),
    },
  };
}

/**
 * Serializes a document the way an agent asked to read it: the snapshot it
 * edits by, the DDL of a vendor, which defaults to the document's database,
 * or the file's own JSON. A peer reads its live state through it.
 */
export function readDocument(
  state: RootState,
  format: ReadFormat,
  vendor?: string,
  filter?: TableFilter
): string {
  if (!READ_FORMATS.includes(format)) {
    throw refused(
      `format must be one of ${READ_FORMATS.join(', ')}, got ${String(format)}`
    );
  }
  if (vendor !== undefined && format !== 'sql') {
    throw refused(`vendor applies to the sql format only, not ${format}`);
  }
  const filtered =
    filter?.tableIds !== undefined || filter?.tableNames !== undefined
      ? filter
      : undefined;
  if (filtered && format !== 'sql') {
    throw refused(
      `tableIds and tableNames apply to the sql format only, not ${format}; erd_get takes them too`
    );
  }

  const text =
    format === 'snapshot'
      ? JSON.stringify(toAgentSnapshot(state))
      : format === 'json'
        ? toJson(state)
        : createSchemaSQL(
            filtered ? selectTables(state, filtered) : state,
            vendor === undefined ? undefined : toDatabase(vendor)
          );
  if (!fitsInRead(text)) {
    const size = `${text.length.toLocaleString('en-US')} characters, over the ${MAX_READ_CHARS.toLocaleString('en-US')} one read returns`;
    throw new ToolError(
      ToolErrorCode.tooLarge,
      READ_TOOL,
      filtered
        ? `the DDL of the tables asked for is ${size}; ask for fewer tables at a time`
        : `this read is ${size}; ${NARROWER[format]}`
    );
  }
  return text;
}

/**
 * What a read tool renders from a document's state, and the tool's name for a
 * refusal. A session calls it on its peer's state, or on the file's when no
 * session serves the document.
 */
export type DocumentReader = {
  readonly tool: string;
  readonly render: (state: RootState) => string;
};

/** erd_read in one of its formats. */
export const documentReader = (
  format: ReadFormat,
  vendor?: string,
  filter?: TableFilter
): DocumentReader => ({
  tool: READ_TOOL,
  render: state => readDocument(state, format, vendor, filter),
});

/** erd_list: the settings, the counts and a page of tables, or the table names alone. */
export const listReader = (options: ListOptions = {}): DocumentReader => ({
  tool: LIST_TOOL,
  render: state =>
    JSON.stringify(
      options.namesOnly
        ? toTableNameList(state, options)
        : toDocumentList(state, options)
    ),
});

/** erd_get: the entities named, in full. */
export const entityReader = (ids: EntityIds): DocumentReader => ({
  tool: GET_TOOL,
  render: state => JSON.stringify(toEntityDetails(state, ids)),
});
