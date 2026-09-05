import { isNumber, isPlainObject, isString } from 'es-toolkit';
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

export type ClipboardPayload = {
  format: typeof CLIPBOARD_FORMAT;
  version: number;
  copyId: string;
  kind: PayloadKind;
  tables: ClipboardTable[];
  columns: ClipboardColumn[];
  memos: ClipboardMemo[];
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
};

export function createPayload({
  kind,
  copyId = nanoid(),
  tables = [],
  columns = [],
  memos = [],
}: CreatePayloadConfig): ClipboardPayload {
  return {
    format: CLIPBOARD_FORMAT,
    version: CLIPBOARD_VERSION,
    copyId,
    kind,
    tables,
    columns,
    memos,
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

function isSupportedStructure(raw: Record<string, any>): boolean {
  return (
    isString(raw.kind) &&
    hasPayloadKind(raw.kind) &&
    Array.isArray(raw.tables) &&
    Array.isArray(raw.columns) &&
    Array.isArray(raw.memos)
  );
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
