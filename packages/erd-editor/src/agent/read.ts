import { toJson } from '@dineug/erd-editor-schema';

import { AgentToolError, AgentToolErrorCode } from '@/agent/errors';
import { toAgentSnapshot } from '@/agent/snapshot';
import {
  type DatabaseVendor,
  DatabaseVendorList,
  DatabaseVendorToDatabase,
} from '@/constants/sql/database';
import type { RootState } from '@/engine/state';
import { createSchemaSQL } from '@/utils/schema-sql';
import { hasDatabaseVendor } from '@/utils/validation';

export type ReadFormat = 'snapshot' | 'sql' | 'json';

export const READ_FORMATS: readonly ReadFormat[] = Object.freeze([
  'snapshot',
  'sql',
  'json',
]);

/** The vendor names the sql format takes, each the name of one database. */
export const SQL_VENDORS: readonly string[] = DatabaseVendorList;

const READ_TOOL = 'erd_read';

const refused = (message: string) =>
  new AgentToolError(AgentToolErrorCode.invalidArgs, READ_TOOL, message);

/** The database a vendor name stands for, through the map the element's getSchemaSQL reads. */
function toDatabase(vendor: string): number {
  if (!hasDatabaseVendor(vendor)) {
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
