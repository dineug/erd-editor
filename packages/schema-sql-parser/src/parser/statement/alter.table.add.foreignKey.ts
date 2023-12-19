import {
  isConstraintValue,
  isForeignValue,
  isNewStatement,
  isPeriodToken,
  isStringToken,
  isTableValue,
} from '@/parser/helper';
import {
  AlterTableAddForeignKey,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { parserForeignKeyParser } from '@/parser/statement/create.table';
import { Token } from '@/parser/tokenizer';

export function alterTableAddForeignKeyParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isTable = isTableValue(tokens);
  const isForeign = isForeignValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: AlterTableAddForeignKey = {
    type: StatementType.alterTableAddForeignKey,
    name: '',
    columnNames: [],
    refTableName: '',
    refColumnNames: [],
  };

  $pos.value++;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    if (isTable($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        ast.name = token.value;

        token = tokens[++$pos.value];

        if (isPeriod($pos.value)) {
          token = tokens[++$pos.value];

          if (isString($pos.value)) {
            ast.name = token.value;
            $pos.value++;
          }
        }
      }

      continue;
    }

    if (isConstraint($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    if (isForeign($pos.value)) {
      const foreignKey = parserForeignKeyParser(tokens, $pos);

      if (foreignKey) {
        ast.columnNames = foreignKey.columnNames;
        ast.refTableName = foreignKey.refTableName;
        ast.refColumnNames = foreignKey.refColumnNames;
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
