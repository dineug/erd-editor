export type SortType = 'ASC' | 'DESC';

export function getDataTypes(): string[];
export function getKeywords(): string[];

export type TokenType =
  | 'leftParen'
  | 'rightParen'
  | 'comma'
  | 'period'
  | 'equal'
  | 'semicolon'
  | 'keyword'
  | 'string'
  | 'doubleQuoteString'
  | 'singleQuoteString'
  | 'backtickString'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
}

export type Statement =
  | CreateTable
  | CreateIndex
  | AlterTableAddPrimaryKey
  | AlterTableAddForeignKey
  | AlterTableAddUnique;

export interface CreateTable {
  type: 'create.table';
  name: string;
  comment: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface Column {
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  nullable: boolean;
}

export interface Index {
  name: string;
  unique: boolean;
  columns: IndexColumn[];
}

export interface ForeignKey {
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
}

export interface CreateTableColumns {
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface CreateIndex {
  type: 'create.index';
  name: string;
  unique: boolean;
  tableName: string;
  columns: IndexColumn[];
}
export interface IndexColumn {
  name: string;
  sort: SortType;
}

export interface AlterTableAddUnique {
  type: 'alter.table.add.unique';
  name: string;
  columnNames: string[];
}

export interface AlterTableAddPrimaryKey {
  type: 'alter.table.add.primaryKey';
  name: string;
  columnNames: string[];
}

export interface AlterTableAddForeignKey {
  type: 'alter.table.add.foreignKey';
  name: string;
  columnNames: string[];
  refTableName: string;
  refColumnNames: string[];
}

export declare function tokenizer(input: string): Token[];
export declare function parser(tokens: Token[]): Statement[];
export declare function DDLParser(input: string): Statement[];
