import { alterTableAddForeignKeyParser } from '@/parser/alter.table.add.foreignKey';
import { alterTableAddPrimaryKeyParser } from '@/parser/alter.table.add.primaryKey';
import { alterTableAddUniqueParser } from '@/parser/alter.table.add.unique';
import { createIndexParser } from '@/parser/create.index';
import { createTableParser } from '@/parser/create.table';
import {
  isAlterTableAddForeignKey,
  isAlterTableAddPrimaryKey,
  isAlterTableAddUnique,
  isCreateIndex,
  isCreateTable,
} from '@/parser/helper';
import { RefPos, Statement } from '@/parser/statement';
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

    $pos.value++;
  }

  return ast;
}

export const schemaSQLParser = (source: string) => parser(tokenizer(source));
