import { isNil, isNumber, isPlainObject, isString } from 'es-toolkit';
import { nanoid } from 'nanoid';

import { ValuesType } from '@/internal-types';
import { arrayHas } from '@/utils/arrayHas';

export const CLIPBOARD_MIME = 'application/x-erd-editor';

export const CLIPBOARD_FORMAT = 'erd-editor-clipboard';

export const CLIPBOARD_VERSION = 1;

export const CLIPBOARD_HTML_ATTR = 'data-erd-editor';

export const CLIPBOARD_HTML_TRUNCATED_ATTR = 'data-erd-editor-truncated';

export const HTML_PAYLOAD_MAX_BYTES = 1_000_000;

export const PayloadKind = {
  tables: 'tables',
  columns: 'columns',
} as const;
export type PayloadKind = ValuesType<typeof PayloadKind>;

const hasPayloadKind = arrayHas<string>(Object.values(PayloadKind));

export type ClipboardTable = {
  sourceId: string;
  name: string;
  comment: string;
  columnIds: string[];
  ui: {
    x: number;
    y: number;
    zIndex: number;
    widthName: number;
    widthComment: number;
    color: string;
  };
};

export type ClipboardColumn = {
  sourceId: string;
  tableId: string;
  name: string;
  comment: string;
  dataType: string;
  default: string;
  options: number;
  ui: {
    keys: number;
    widthName: number;
    widthComment: number;
    widthDataType: number;
    widthDefault: number;
  };
};

export type ClipboardMemo = {
  sourceId: string;
  value: string;
  ui: {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
    color: string;
  };
};

export type ClipboardRelationshipPoint = {
  tableId: string;
  columnIds: string[];
};

export type ClipboardRelationship = {
  relationshipType: number;
  start: ClipboardRelationshipPoint;
  end: ClipboardRelationshipPoint;
};

export type ClipboardIndexColumn = {
  columnId: string;
  orderType: number;
};

/**
 * An index rides with its table and nests its columns in indexColumnIds order,
 * because an index column has no identity outside its index and nothing else
 * ever refers to one.
 */
export type ClipboardIndex = {
  tableId: string;
  name: string;
  unique: boolean;
  indexColumns: ClipboardIndexColumn[];
};

export type ClipboardPayload = {
  format: typeof CLIPBOARD_FORMAT;
  version: number;
  copyId: string;
  kind: PayloadKind;
  tables: ClipboardTable[];
  columns: ClipboardColumn[];
  memos: ClipboardMemo[];
  relationships?: ClipboardRelationship[];
  indexes?: ClipboardIndex[];
};

export type ParseResult =
  | { status: 'ok'; payload: ClipboardPayload }
  | { status: 'foreign' }
  | { status: 'unsupported'; version: number };

type CreatePayloadConfig = {
  kind: PayloadKind;
  copyId?: string;
  tables?: ClipboardTable[];
  columns?: ClipboardColumn[];
  memos?: ClipboardMemo[];
  relationships?: ClipboardRelationship[];
  indexes?: ClipboardIndex[];
};

export function createPayload({
  kind,
  copyId = nanoid(),
  tables = [],
  columns = [],
  memos = [],
  relationships = [],
  indexes = [],
}: CreatePayloadConfig): ClipboardPayload {
  return {
    format: CLIPBOARD_FORMAT,
    version: CLIPBOARD_VERSION,
    copyId,
    kind,
    tables,
    columns,
    memos,
    relationships,
    indexes,
  };
}

export function parsePayload(json: string): ParseResult {
  let raw: unknown;

  try {
    raw = JSON.parse(json);
  } catch {
    return { status: 'foreign' };
  }

  if (!isPlainObject(raw)) return { status: 'foreign' };
  if (raw.format !== CLIPBOARD_FORMAT) return { status: 'foreign' };

  const version = isNumber(raw.version) ? raw.version : Number.NaN;
  if (!Number.isInteger(version)) return { status: 'unsupported', version };
  if (version > CLIPBOARD_VERSION) return { status: 'unsupported', version };
  if (!isSupportedStructure(raw)) return { status: 'unsupported', version };

  return {
    status: 'ok',
    payload: migratePayload(raw as ClipboardPayload),
  };
}

/**
 * The version 1 triple is the only structure a reader may require: a payload
 * written before a later array existed still has to parse, so a newer array is
 * rejected only when it is present and not an array.
 */
function isSupportedStructure(raw: Record<string, any>): boolean {
  return (
    isString(raw.kind) &&
    hasPayloadKind(raw.kind) &&
    Array.isArray(raw.tables) &&
    Array.isArray(raw.columns) &&
    Array.isArray(raw.memos) &&
    isOptionalArray(raw.relationships) &&
    isOptionalArray(raw.indexes)
  );
}

function isOptionalArray(value: unknown): boolean {
  return isNil(value) || Array.isArray(value);
}

export function migratePayload(payload: ClipboardPayload): ClipboardPayload {
  let next = payload;

  // One case per upgrade step; add one whenever CLIPBOARD_VERSION goes up.
  while (next.version < CLIPBOARD_VERSION) {
    const from = next.version;

    switch (from) {
      default:
        break;
    }

    next = { ...next, version: from + 1 };
  }

  return next;
}
