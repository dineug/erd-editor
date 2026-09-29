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

export const ReferentialAction = {
  noAction: 'NO ACTION',
  restrict: 'RESTRICT',
  cascade: 'CASCADE',
  setNull: 'SET NULL',
  setDefault: 'SET DEFAULT',
} as const;
export type ReferentialAction = ValuesType<typeof ReferentialAction>;

export type CreateTable = {
  type: typeof StatementType.createTable;
  name: string;
  comment: string;
  columns: Column[];
  indexes: Index[];
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
 * A REFERENCES without a column list leaves refColumnNames empty: it names the
 * referenced table's primary key. An absent ON DELETE or ON UPDATE clause is ''.
 */
export type ForeignKey = {
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
  onDelete: ReferentialAction | '';
  onUpdate: ReferentialAction | '';
};

export type CreateTableColumns = {
  columns: Column[];
  indexes: Index[];
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
  columnNames: string[];
};

export type AlterTableAddPrimaryKey = {
  type: typeof StatementType.alterTableAddPrimaryKey;
  name: string;
  columnNames: string[];
};

export type AlterTableAddForeignKey = {
  type: typeof StatementType.alterTableAddForeignKey;
  name: string;
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
  onDelete: ReferentialAction | '';
  onUpdate: ReferentialAction | '';
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
