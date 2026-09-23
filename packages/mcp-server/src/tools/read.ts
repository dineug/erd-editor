import {
  createSchemaSQL,
  type DatabaseVendor,
  DatabaseVendorList,
  DatabaseVendorToDatabase,
  type RootState,
} from '@dineug/erd-editor/peer.js';
import { toJson } from '@dineug/erd-editor-schema';

import { ToolError, ToolErrorCode } from '@/tools/errors';
import {
  type EntityIds,
  toDocumentList,
  toEntityDetails,
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

/**
 * Serializes a document the way an agent asked to read it: the snapshot it
 * edits by, the DDL of a vendor, which defaults to the document's database,
 * or the file's own JSON. A peer reads its live state through it.
 */
export function readDocument(
  state: RootState,
  format: ReadFormat,
  vendor?: string
): string {
  if (!READ_FORMATS.includes(format)) {
    throw refused(
      `format must be one of ${READ_FORMATS.join(', ')}, got ${String(format)}`
    );
  }
  if (vendor !== undefined && format !== 'sql') {
    throw refused(`vendor applies to the sql format only, not ${format}`);
  }

  if (format === 'snapshot') return JSON.stringify(toAgentSnapshot(state));
  if (format === 'json') return toJson(state);

  return createSchemaSQL(
    state,
    vendor === undefined ? undefined : toDatabase(vendor)
  );
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
  vendor?: string
): DocumentReader => ({
  tool: READ_TOOL,
  render: state => readDocument(state, format, vendor),
});

/** erd_list: the settings and every live entity by id, tables with their size. */
export const listReader: DocumentReader = {
  tool: LIST_TOOL,
  render: state => JSON.stringify(toDocumentList(state)),
};

/** erd_get: the entities named, in full. */
export const entityReader = (ids: EntityIds): DocumentReader => ({
  tool: GET_TOOL,
  render: state => JSON.stringify(toEntityDetails(state, ids)),
});
