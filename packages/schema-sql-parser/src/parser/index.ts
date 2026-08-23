import {
  isAlterTableAddForeignKey,
  isAlterTableAddPrimaryKey,
  isAlterTableAddUnique,
  isCommentOnColumn,
  isCommentOnTable,
  isCreateIndex,
  isCreateTable,
} from '@/parser/helper';
import { RefPos, Statement } from '@/parser/statement';
import { alterTableAddForeignKeyParser } from '@/parser/statement/alter.table.add.foreignKey';
import { alterTableAddPrimaryKeyParser } from '@/parser/statement/alter.table.add.primaryKey';
import { alterTableAddUniqueParser } from '@/parser/statement/alter.table.add.unique';
import { commentOnColumnParser } from '@/parser/statement/comment.on.column';
import { commentOnTableParser } from '@/parser/statement/comment.on.table';
import { createIndexParser } from '@/parser/statement/create.index';
import { createTableParser } from '@/parser/statement/create.table';
import { Token, tokenizer } from '@/parser/tokenizer';

function parser(tokens: Token[]) {
  const ast: Statement[] = [];
  const $pos: RefPos = { value: 0 };

  const isToken = () => $pos.value < tokens.length;
  const createTable = isCreateTable(tokens);
  const createIndex = isCreateIndex(tokens);
  const alterTableAddPrimaryKey = isAlterTableAddPrimaryKey(tokens);
  const alterTableAddForeignKey = isAlterTableAddForeignKey(tokens);
  const alterTableAddUnique = isAlterTableAddUnique(tokens);
  const commentOnTable = isCommentOnTable(tokens);
  const commentOnColumn = isCommentOnColumn(tokens);

  while (isToken()) {
    if (createTable($pos.value)) {
      ast.push(createTableParser(tokens, $pos));
      continue;
    }

    if (createIndex($pos.value)) {
      ast.push(createIndexParser(tokens, $pos));
      continue;
    }

    if (alterTableAddPrimaryKey($pos.value)) {
      ast.push(alterTableAddPrimaryKeyParser(tokens, $pos));
      continue;
    }

    if (alterTableAddForeignKey($pos.value)) {
      ast.push(alterTableAddForeignKeyParser(tokens, $pos));
      continue;
    }

    if (alterTableAddUnique($pos.value)) {
      ast.push(alterTableAddUniqueParser(tokens, $pos));
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

    $pos.value++;
  }

  return ast;
}

export const schemaSQLParser = (source: string) => parser(tokenizer(source));
