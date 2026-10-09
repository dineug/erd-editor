import { Database } from '@/constants/schema';
import { ValuesType } from '@/internal-types';

export const SchemaSQLStatements = {
  create: 'create',
  ifNotExists: 'ifNotExists',
  recreate: 'recreate',
} as const;
export type SchemaSQLStatements = ValuesType<typeof SchemaSQLStatements>;
export const SchemaSQLStatementsList: ReadonlyArray<SchemaSQLStatements> =
  Object.values(SchemaSQLStatements);

export const SchemaSQLHeader = {
  none: 'none',
  use: 'use',
  createAndUse: 'createAndUse',
} as const;
export type SchemaSQLHeader = ValuesType<typeof SchemaSQLHeader>;
export const SchemaSQLHeaderList: ReadonlyArray<SchemaSQLHeader> =
  Object.values(SchemaSQLHeader);

/** What getSchemaSQL, an agent's SQL read and the Schema SQL tab pass: an intent, resolved per vendor. */
export type SchemaSQLOptions = {
  /** create when left out. */
  statements?: SchemaSQLStatements;
  /** none when left out. */
  header?: SchemaSQLHeader;
};

/** The name a header may write: a plain identifier, so no vendor needs it escaped. */
export const HEADER_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export type HeaderName = 'valid' | 'empty' | 'invalid';

export type ResolvedSchemaSQLOptions = {
  /** What the vendor writes for the statements asked for. */
  statements: SchemaSQLStatements;
  /** What the vendor writes for the header asked for, before the name is read. */
  header: SchemaSQLHeader;
  /** Whether settings.databaseName can name that header. */
  headerName: HeaderName;
};

export type SchemaSQLSupport = {
  ifNotExists: boolean;
  headers: ReadonlyArray<Exclude<SchemaSQLHeader, 'none'>>;
};

const BOTH_HEADERS: SchemaSQLSupport['headers'] = [
  SchemaSQLHeader.use,
  SchemaSQLHeader.createAndUse,
];

const SUPPORT: Record<number, SchemaSQLSupport> = {
  [Database.MySQL]: { ifNotExists: true, headers: BOTH_HEADERS },
  [Database.MariaDB]: { ifNotExists: true, headers: BOTH_HEADERS },
  [Database.PostgreSQL]: {
    ifNotExists: true,
    headers: [SchemaSQLHeader.createAndUse],
  },
  [Database.Oracle]: { ifNotExists: false, headers: [SchemaSQLHeader.use] },
  [Database.MSSQL]: { ifNotExists: false, headers: BOTH_HEADERS },
  [Database.SQLite]: { ifNotExists: true, headers: [] },
  [Database.Snowflake]: { ifNotExists: false, headers: BOTH_HEADERS },
  [Database.Databricks]: { ifNotExists: true, headers: BOTH_HEADERS },
};

const NO_SUPPORT: SchemaSQLSupport = { ifNotExists: false, headers: [] };

/**
 * Whether a database writes CREATE ... IF NOT EXISTS and which headers it has;
 * every one of them writes drop and re-create.
 */
export function schemaSQLSupport(database: number): SchemaSQLSupport {
  return SUPPORT[database] ?? NO_SUPPORT;
}

export function isSchemaSQLStatements(
  value: unknown
): value is SchemaSQLStatements {
  return SchemaSQLStatementsList.includes(value as SchemaSQLStatements);
}

export function isSchemaSQLHeader(value: unknown): value is SchemaSQLHeader {
  return SchemaSQLHeaderList.includes(value as SchemaSQLHeader);
}

/**
 * The statements and header a database writes for the ones asked for: one it
 * lacks falls back to the nearest it has, so the choice outlives a change of
 * database; an unknown value reads as create and none.
 */
export function resolveSchemaSQLOptions(
  database: number,
  options: SchemaSQLOptions | undefined,
  databaseName: string
): ResolvedSchemaSQLOptions {
  const support = schemaSQLSupport(database);

  return {
    statements: resolveStatements(support, options?.statements),
    header: resolveHeader(support, options?.header),
    headerName: toHeaderName(databaseName),
  };
}

function resolveStatements(
  { ifNotExists }: SchemaSQLSupport,
  asked: unknown
): SchemaSQLStatements {
  if (!isSchemaSQLStatements(asked)) return SchemaSQLStatements.create;
  if (asked === SchemaSQLStatements.ifNotExists && !ifNotExists) {
    return SchemaSQLStatements.create;
  }

  return asked;
}

function toHeaderName(databaseName: string): HeaderName {
  if (databaseName === '') return 'empty';

  return HEADER_NAME_PATTERN.test(databaseName) ? 'valid' : 'invalid';
}

function resolveHeader(
  { headers }: SchemaSQLSupport,
  asked: unknown
): SchemaSQLHeader {
  if (!isSchemaSQLHeader(asked) || asked === SchemaSQLHeader.none) {
    return SchemaSQLHeader.none;
  }
  if (headers.includes(asked)) return asked;

  return asked === SchemaSQLHeader.createAndUse &&
    headers.includes(SchemaSQLHeader.use)
    ? SchemaSQLHeader.use
    : SchemaSQLHeader.none;
}

// The last line of a script that ends its batch for sqlcmd and SQL Server
// Management Studio, a repeat count included.
const GO_LINE = /^GO(?:\s+\d+)?$/i;

/**
 * A before or after script as the DDL writes it: line breaks as LF, without the
 * blank lines ahead of it or the whitespace after it, and on SQL Server ended
 * with GO; the empty string when nothing is left.
 */
export function formatScript(text: string, database: number): string {
  let script = text
    .replace(/\r\n?/g, '\n')
    .replace(/^(?:[ \t]*\n)+/, '')
    .trimEnd();
  if (script === '') return '';

  if (database === Database.MSSQL) {
    const last = script.slice(script.lastIndexOf('\n') + 1).trim();
    if (!GO_LINE.test(last)) script += '\nGO';
  }

  return script;
}
