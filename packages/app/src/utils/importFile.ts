import { isPlainObject } from 'es-toolkit';

import type { NewSchemaEntity } from '@/services/indexeddb/modules/schema';
import { isBackup, parseBackup } from '@/utils/backup';

export type SourceType = 'sql' | 'dbml' | 'aml' | 'graphql';

/** A text only the editor can parse, into the document the schema is stored as. */
export type SourceImport = {
  type: SourceType;
  value: string;
};

export type ImportItem =
  | { kind: 'backup'; schemas: NewSchemaEntity[]; skipped: number }
  | { kind: 'schema'; schema: NewSchemaEntity }
  | { kind: 'source'; name: string; source: SourceImport }
  | { kind: 'invalid'; fileName: string }
  | { kind: 'oversized'; fileName: string };

export type ImportResult = {
  imported: number;
  skippedFiles: number;
  skippedSchemas: number;
  oversizedFiles: number;
};

/**
 * The largest file an import reads. A document takes about 600 bytes a column,
 * so 1,000 tables come to some 14 MB and a backup of several fits; past this a
 * file is rarely a schema, and reading it whole could take the tab down.
 */
export const MAX_IMPORT_FILE_SIZE = 64 * 1024 * 1024;

const SOURCE_TYPES = new Map<string, SourceType>([
  ['sql', 'sql'],
  ['dbml', 'dbml'],
  ['aml', 'aml'],
  ['graphql', 'graphql'],
  ['gql', 'graphql'],
  ['graphqls', 'graphql'],
]);

export const IMPORT_ACCEPT = [
  '.json',
  '.erd',
  '.vuerd',
  ...Array.from(SOURCE_TYPES.keys(), extension => `.${extension}`),
].join(',');

function splitFileName(fileName: string) {
  const index = fileName.lastIndexOf('.');
  if (index <= 0) return { name: fileName, extension: '' };

  return {
    name: fileName.slice(0, index),
    extension: fileName.slice(index + 1).toLowerCase(),
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Whether JSON is a document the editor opens: the version 3 shape it saves,
 * with its doc, or the version 2 shape of .vuerd files, with canvas and table.
 * The editor's parser takes any object at all and makes an empty schema of it.
 */
export function isEditorDocument(json: unknown): boolean {
  if (!isPlainObject(json)) return false;

  const { version, doc, canvas, table } = json as Record<string, unknown>;
  return version === '3.0.0'
    ? isPlainObject(doc)
    : isPlainObject(canvas) && isPlainObject(table);
}

/**
 * What a file holds: a SQL, DBML, AML or GraphQL source by its extension, and
 * anything else by its content, a backup whatever its name, else an editor
 * document. Backup times later than now are taken as now.
 */
export function classifyImportFile(
  fileName: string,
  text: string,
  now: number
): ImportItem {
  const { name, extension } = splitFileName(fileName);
  const invalid: ImportItem = { kind: 'invalid', fileName };
  const sourceType = SOURCE_TYPES.get(extension);

  if (sourceType) {
    return text.trim()
      ? { kind: 'source', name, source: { type: sourceType, value: text } }
      : invalid;
  }

  const json = parseJson(text);

  if (isBackup(json)) {
    const backup = parseBackup(json, now);
    return backup ? { kind: 'backup', ...backup } : invalid;
  }

  return isEditorDocument(json)
    ? { kind: 'schema', schema: { name, value: text } }
    : invalid;
}

/** Reads and classifies a file, leaving one over the size limit unread. */
export async function readImportFile(
  file: File,
  now: number
): Promise<ImportItem> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    return { kind: 'oversized', fileName: file.name };
  }

  try {
    return classifyImportFile(file.name, await file.text(), now);
  } catch {
    return { kind: 'invalid', fileName: file.name };
  }
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** The one line the import notice shows, in the order things were counted. */
export function describeImportResult(result: ImportResult) {
  const parts = [
    result.imported ? `Imported ${plural(result.imported, 'schema')}` : '',
    result.skippedFiles
      ? `Skipped ${plural(result.skippedFiles, 'invalid file')}`
      : '',
    result.skippedSchemas
      ? `Skipped ${plural(result.skippedSchemas, 'invalid schema')}`
      : '',
    result.oversizedFiles
      ? `Skipped ${plural(result.oversizedFiles, 'file')} over ${MAX_IMPORT_FILE_SIZE / 1024 / 1024} MB`
      : '',
  ].filter(Boolean);

  return parts.length ? parts.join(' · ') : 'Nothing to import';
}
