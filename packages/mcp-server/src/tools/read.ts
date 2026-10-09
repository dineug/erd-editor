import {
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorList,
  DatabaseVendorToDatabase,
  type RootState,
  type SchemaSQLOptions,
} from '@dineug/erd-editor/peer.js';
import { query, toJson } from '@dineug/erd-editor-schema';

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
import {
  toAgentSnapshot,
  toSavedSettings,
  toSnapshotScripts,
  toTableGroupMembers,
} from '@/tools/snapshot';

export type ReadFormat = 'snapshot' | 'sql' | 'json' | 'scripts';

export const READ_FORMATS: readonly ReadFormat[] = Object.freeze([
  'snapshot',
  'sql',
  'json',
  'scripts',
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

/**
 * The tables erd_read gives the DDL of, by id, by name or by the name of the
 * table group they are in, all joined; the whole document when all are absent.
 */
export type TableFilter = Pick<EntityIds, 'tableIds' | 'tableNames'> & {
  readonly groupNames?: readonly string[];
};

/** What each format tells an agent to do when the document is too large for one read. */
const NARROWER: Readonly<Record<ReadFormat, string>> = {
  sql: 'pass tableIds or tableNames for the tables the task needs, which erd_list with query or namesOnly finds',
  snapshot:
    'find tables with erd_list (query, namesOnly) and read them with erd_get, or the sql format with tableNames',
  json: 'find tables with erd_list (query, namesOnly) and read them with erd_get, or the sql format with tableNames',
  scripts:
    "no read gives the scripts in parts, so ask the user to shorten them in the options of the editor's Schema SQL tab",
};

/**
 * The live tables named, which the DDL writes with their indexes and the
 * foreign keys they hold: those keep the parent tables they reference, so a
 * join path out of the selection still shows.
 */
function selectTables(state: RootState, filter: TableFilter): string[] {
  const { ids, missing } = findTables(state, filter);
  if (missing.length) {
    throw new ToolError(
      ToolErrorCode.notFound,
      READ_TOOL,
      `${missing.join(', ')} ${missing.length === 1 ? 'names' : 'name'} no live table; erd_list lists them`
    );
  }
  const grouped = groupTables(state, filter.groupNames ?? []);
  const selected = [...new Set([...ids, ...grouped])];
  if (!selected.length) {
    throw refused(
      'tableIds, tableNames and groupNames name no table; pass one at least'
    );
  }
  return selected;
}

/**
 * The tables of every live group a name matches, in any case, in document
 * order; a name matching no group is refused as a missing table is.
 */
function groupTables(state: RootState, names: readonly string[]): string[] {
  if (!names.length) return [];

  const members = toTableGroupMembers(state);
  const groups = query(state.collections)
    .collection('tableGroupEntities')
    .selectByIds(state.doc.tableGroupIds);
  const wanted = new Set(names.map(name => name.toLowerCase()));
  const matched = groups.filter(({ name }) => wanted.has(name.toLowerCase()));
  const found = new Set(matched.map(({ name }) => name.toLowerCase()));
  const missing = [...new Set(names)].filter(
    name => !found.has(name.toLowerCase())
  );
  if (missing.length) {
    throw new ToolError(
      ToolErrorCode.notFound,
      READ_TOOL,
      `${missing.join(', ')} ${missing.length === 1 ? 'names' : 'name'} no table group; erd_list lists them`
    );
  }
  const grouped = new Set(matched.flatMap(({ id }) => members.get(id) ?? []));
  return state.doc.tableIds.filter(id => grouped.has(id));
}

/** The state with the settings its file saves, the bracket type the DDL quotes with among them. */
const withSavedSettings = (state: RootState): RootState => ({
  ...state,
  settings: toSavedSettings(state.settings),
});

/** How each format but sql, whose DDL takes a vendor, tables and options, writes a document. */
const SERIALIZER: Readonly<
  Record<Exclude<ReadFormat, 'sql'>, (state: RootState) => string>
> = {
  snapshot: state => JSON.stringify(toAgentSnapshot(state)),
  json: state => toJson(state),
  scripts: state => JSON.stringify(toSnapshotScripts(state.settings)),
};

/**
 * Serializes a document as an agent asked: the snapshot it edits by, the DDL of
 * a vendor (the document's by default) with the statements and header asked
 * for, the file's own JSON, or the two Schema SQL scripts alone.
 */
export function readDocument(
  state: RootState,
  format: ReadFormat,
  vendor?: string,
  filter?: TableFilter,
  options?: SchemaSQLOptions
): string {
  if (!READ_FORMATS.includes(format)) {
    throw refused(
      `format must be one of ${READ_FORMATS.join(', ')}, got ${String(format)}`
    );
  }
  if (vendor !== undefined && format !== 'sql') {
    throw refused(`vendor applies to the sql format only, not ${format}`);
  }
  if (
    (options?.statements !== undefined || options?.header !== undefined) &&
    format !== 'sql'
  ) {
    throw refused(
      `statements and header apply to the sql format only, not ${format}`
    );
  }
  const filtered =
    filter?.tableIds !== undefined ||
    filter?.tableNames !== undefined ||
    filter?.groupNames !== undefined
      ? filter
      : undefined;
  if (filtered && format !== 'sql') {
    throw refused(
      `tableIds, tableNames and groupNames apply to the sql format only, not ${format}; erd_get takes tableIds and tableNames too`
    );
  }

  const text =
    format === 'sql'
      ? createSchemaSQL(
          withSavedSettings(state),
          vendor === undefined ? undefined : toDatabase(vendor),
          filtered ? selectTables(state, filtered) : undefined,
          options
        )
      : SERIALIZER[format](state);
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
  filter?: TableFilter,
  options?: SchemaSQLOptions
): DocumentReader => ({
  tool: READ_TOOL,
  render: state => readDocument(state, format, vendor, filter, options),
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
