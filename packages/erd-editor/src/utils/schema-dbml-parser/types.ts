/**
 * tokenizer.ts and parser.ts own every DBML syntax concern -- settings are
 * resolved into the flat fields below, so convert.ts never sees a token.
 */

export type DBMLEndpoint = {
  schemaName: string;
  tableName: string;
  columnNames: string[];
};

export type DBMLInlineRef = {
  /** -, <, > or <>, with the ? optionality markers dropped. */
  operator: string;
  target: DBMLEndpoint;
};

export type DBMLColumn = {
  name: string;
  comment: string;
  /** Holds the argument list and any array suffix; never the schema. */
  typeName: string;
  typeSchemaName: string;
  primaryKey: boolean;
  unique: boolean;
  notNull: boolean;
  autoIncrement: boolean;
  default: string;
  inlineRefs: DBMLInlineRef[];
};

export type DBMLIndex = {
  name: string;
  unique: boolean;
  /** [pk], which is DBML's only composite primary key spelling. */
  primaryKey: boolean;
  /** Expression columns are dropped, so these are column names only. */
  columnNames: string[];
};

export type DBMLTable = {
  schemaName: string;
  name: string;
  alias: string;
  comment: string;
  /** headercolor as written when it is #rgb or #rrggbb; '' otherwise. */
  color: string;
  columns: DBMLColumn[];
  indexes: DBMLIndex[];
};

export type DBMLRef = {
  operator: string;
  left: DBMLEndpoint;
  right: DBMLEndpoint;
  /** The delete and update settings as written, set null say; '' if absent. */
  onDelete: string;
  onUpdate: string;
};

export type DBMLTableName = Pick<DBMLEndpoint, 'schemaName' | 'tableName'>;

export type DBMLTableGroup = {
  name: string;
  /** color as written when it is #rgb or #rrggbb; '' otherwise. */
  color: string;
  /** One per member line, as written; resolving them is convert.ts's concern. */
  tables: DBMLTableName[];
};

export type DBMLModel = {
  tables: DBMLTable[];
  refs: DBMLRef[];
  tableGroups: DBMLTableGroup[];
  /** Keyed by the qualified name, so s.status and status stay apart. */
  enums: Record<string, string[]>;
  skipped: string[];
};

export type DBMLParseResult =
  | { ok: true; model: DBMLModel }
  | { ok: false; message: string };
