import {
  isAddExtendedProperty,
  isAlterTableAdd,
  isAlterTableAddDefault,
  isAlterTableAddForeignKey,
  isAlterTableAddPrimaryKey,
  isAlterTableAlter,
  isCommentOnColumn,
  isCommentOnTable,
  isCreateIndex,
  isCreateTable,
} from '@/parser/helper';
import {
  DatabaseVendor,
  RefPos,
  SchemaSQLParserOptions,
  Statement,
} from '@/parser/statement';
import { addExtendedPropertyParser } from '@/parser/statement/add.extended.property';
import { alterTableAddDefaultParser } from '@/parser/statement/alter.table.add.default';
import { alterTableAddForeignKeyParser } from '@/parser/statement/alter.table.add.foreignKey';
import { alterTableAddPrimaryKeyParser } from '@/parser/statement/alter.table.add.primaryKey';
import { alterTableAddUniqueParser } from '@/parser/statement/alter.table.add.unique';
import { alterTableAlterColumnParser } from '@/parser/statement/alter.table.alter.column';
import { commentOnColumnParser } from '@/parser/statement/comment.on.column';
import { commentOnTableParser } from '@/parser/statement/comment.on.table';
import { createIndexParser } from '@/parser/statement/create.index';
import { createTableParser } from '@/parser/statement/create.table';
import { Token, tokenizer } from '@/parser/tokenizer';

function parser(tokens: Token[], database?: DatabaseVendor) {
  const ast: Statement[] = [];
  const $pos: RefPos = { value: 0 };

  const isToken = () => $pos.value < tokens.length;
  const createTable = isCreateTable(tokens);
  const createIndex = isCreateIndex(tokens);
  const alterTableAddPrimaryKey = isAlterTableAddPrimaryKey(tokens);
  const alterTableAddForeignKey = isAlterTableAddForeignKey(tokens);
  const alterTableAddDefault = isAlterTableAddDefault(tokens);
  const alterTableAdd = isAlterTableAdd(tokens);
  const alterTableAlter = isAlterTableAlter(tokens);
  const commentOnTable = isCommentOnTable(tokens);
  const commentOnColumn = isCommentOnColumn(tokens);
  const addExtendedProperty = isAddExtendedProperty(tokens);

  while (isToken()) {
    if (createTable($pos.value)) {
      ast.push(createTableParser(tokens, $pos, database));
      continue;
    }

    if (createIndex($pos.value)) {
      ast.push(createIndexParser(tokens, $pos));
      continue;
    }

    // One ALTER TABLE can add several keys: phpMyAdmin adds a table's primary
    // key and all its unique keys in one. The unique keys are read out of the
    // same tokens again, whatever the first clause.
    if (alterTableAdd($pos.value)) {
      const start = $pos.value;

      if (alterTableAddPrimaryKey(start)) {
        ast.push(alterTableAddPrimaryKeyParser(tokens, $pos));
      } else if (alterTableAddForeignKey(start)) {
        ast.push(alterTableAddForeignKeyParser(tokens, $pos));
      } else if (alterTableAddDefault(start)) {
        ast.push(alterTableAddDefaultParser(tokens, $pos, database));
      }

      const $unique: RefPos = { value: start };
      ast.push(...alterTableAddUniqueParser(tokens, $unique));
      $pos.value = Math.max($pos.value, $unique.value);
      continue;
    }

    // pg_dump sets a serial column's default and an identity column's
    // identity apart from its table, each in an ALTER COLUMN of its own.
    if (alterTableAlter($pos.value)) {
      ast.push(...alterTableAlterColumnParser(tokens, $pos));
      continue;
    }

    if (commentOnTable($pos.value)) {
      ast.push(commentOnTableParser(tokens, $pos));
      continue;
    }

    if (commentOnColumn($pos.value)) {
      ast.push(commentOnColumnParser(tokens, $pos));
      continue;
    }

    // SQL Server keeps a comment as the MS_Description extended property.
    if (addExtendedProperty($pos.value)) {
      const comment = addExtendedPropertyParser(tokens, $pos);

      if (comment) {
        ast.push(comment);
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}

export const schemaSQLParser = (
  source: string,
  { database }: SchemaSQLParserOptions = {}
) => parser(tokenizer(source, database), database);
