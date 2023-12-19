import { ValuesType } from '@/internal-types';

export type Statement =
  | CreateTable
  | CreateIndex
  | AlterTableAddUnique
  | AlterTableAddPrimaryKey
  | AlterTableAddForeignKey;

export const StatementType = {
  createTable: 'create.table',
  createIndex: 'create.index',
  alterTableAddUnique: 'alter.table.add.unique',
  alterTableAddPrimaryKey: 'alter.table.add.primaryKey',
  alterTableAddForeignKey: 'alter.table.add.foreignKey',
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

export type ForeignKey = {
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
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
};
