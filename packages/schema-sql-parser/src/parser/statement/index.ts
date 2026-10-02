import { ValuesType } from '@/internal-types';

export type Statement =
  | CreateTable
  | CreateIndex
  | AlterTableAddUnique
  | AlterTableAddPrimaryKey
  | AlterTableAddForeignKey
  | CommentOnTable
  | CommentOnColumn;

export const StatementType = {
  createTable: 'create.table',
  createIndex: 'create.index',
  alterTableAddUnique: 'alter.table.add.unique',
  alterTableAddPrimaryKey: 'alter.table.add.primaryKey',
  alterTableAddForeignKey: 'alter.table.add.foreignKey',
  commentOnTable: 'comment.on.table',
  commentOnColumn: 'comment.on.column',
} as const;
export type StatementType = ValuesType<typeof StatementType>;

export const SortType = {
  asc: 'ASC',
  desc: 'DESC',
} as const;
export type SortType = ValuesType<typeof SortType>;

export type RefPos = { value: number };

export type CreateTable = {
  type: typeof StatementType.createTable;
  name: string;
  comment: string;
  columns: Column[];
  indexes: Index[];
  keys: Key[];
  foreignKeys: ForeignKey[];
};

export type Column = {
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  nullable: boolean;
};

export type Index = {
  name: string;
  unique: boolean;
  columns: IndexColumn[];
};

/**
 * A primary key or one-column unique key the source names, or any key with no
 * name, composite too, that Oracle's USING INDEX follows, never PostgreSQL's
 * USING INDEX TABLESPACE: a dump may export the key's index on its own.
 */
export type Key = {
  name: string;
  columnNames: string[];
};

export type ForeignKey = {
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
};

export type CreateTableColumns = {
  columns: Column[];
  indexes: Index[];
  keys: Key[];
  foreignKeys: ForeignKey[];
};

export type CreateIndex = {
  type: typeof StatementType.createIndex;
  name: string;
  unique: boolean;
  tableName: string;
  columns: IndexColumn[];
};

export type IndexColumn = {
  name: string;
  sort: SortType;
};

export type AlterTableAddUnique = {
  type: typeof StatementType.alterTableAddUnique;
  name: string;
  /** The key's own name: an index name after UNIQUE KEY, else the CONSTRAINT symbol. */
  constraintName: string;
  /** The existing index Oracle's USING INDEX names to enforce the key, '' for none. */
  usingIndexName: string;
  columns: IndexColumn[];
};

export type AlterTableAddPrimaryKey = {
  type: typeof StatementType.alterTableAddPrimaryKey;
  name: string;
  /** The CONSTRAINT symbol, '' for none. */
  constraintName: string;
  /** The existing index Oracle's USING INDEX names to enforce the key, '' for none. */
  usingIndexName: string;
  columnNames: string[];
};

export type AlterTableAddForeignKey = {
  type: typeof StatementType.alterTableAddForeignKey;
  name: string;
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
};

export type CommentOnTable = {
  type: typeof StatementType.commentOnTable;
  name: string;
  comment: string;
};

export type CommentOnColumn = {
  type: typeof StatementType.commentOnColumn;
  tableName: string;
  columnName: string;
  comment: string;
};
