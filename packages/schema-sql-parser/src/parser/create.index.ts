import {
  isAscValue,
  isCommaToken,
  isCreateUniqueIndex,
  isDescValue,
  isIndexValue,
  isLeftParentToken,
  isNewStatement,
  isOnValue,
  isRightParentToken,
  isStringToken,
  isUniqueValue,
} from '@/parser/helper';
import {
  CreateIndex,
  IndexColumn,
  RefPos,
  SortType,
  StatementType,
} from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

export function createIndexParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isUnique = isUniqueValue(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isComma = isCommaToken(tokens);
  const isIndex = isIndexValue(tokens);
  const isOn = isOnValue(tokens);
  const isDesc = isDescValue(tokens);
  const isAsc = isAscValue(tokens);
  const createUniqueIndex = isCreateUniqueIndex(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: CreateIndex = {
    type: StatementType.createIndex,
    name: '',
    unique: isUnique($pos.value + 1),
    tableName: '',
    columns: [],
  };

  $pos.value += createUniqueIndex($pos.value) ? 2 : 1;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    if (isIndex($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        ast.name = token.value;
      }

      continue;
    }

    if (isOn($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        ast.tableName = token.value;
        token = tokens[++$pos.value];

        if (isLeftParent($pos.value)) {
          token = tokens[++$pos.value];
          let indexColumn: IndexColumn = {
            name: '',
            sort: SortType.asc,
          };

          while (isToken() && !isRightParent($pos.value)) {
            if (
              isString($pos.value) &&
              !isDesc($pos.value) &&
              !isAsc($pos.value)
            ) {
              indexColumn.name = token.value;
            }
            if (isDesc($pos.value)) {
              indexColumn.sort = SortType.desc;
            }
            if (isComma($pos.value)) {
              ast.columns.push(indexColumn);
              indexColumn = {
                name: '',
                sort: SortType.asc,
              };
            }
            token = tokens[++$pos.value];
          }

          if (!ast.columns.includes(indexColumn) && indexColumn.name !== '') {
            ast.columns.push(indexColumn);
          }

          $pos.value++;
        }
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}
