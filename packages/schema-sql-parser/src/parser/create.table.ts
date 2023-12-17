import {
  isAscValue,
  isAutoIncrementValue,
  isCommaToken,
  isCommentValue,
  isConstraintValue,
  isCreateTableIfNotExists,
  isDataType,
  isDefaultValue,
  isDescValue,
  isForeignValue,
  isIndexValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isNullValue,
  isPeriodToken,
  isPrimaryValue,
  isReferencesValue,
  isRightParentToken,
  isStringToken,
  isUniqueValue,
} from '@/parser/helper';
import {
  Column,
  CreateTable,
  CreateTableColumns,
  ForeignKey,
  Index,
  IndexColumn,
  RefPos,
  SortType,
  StatementType,
} from '@/parser/statement';
import { Token } from '@/parser/tokenizer';

export function createTableParser(tokens: Token[], $pos: RefPos) {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isComment = isCommentValue(tokens);
  const createTableIfNotExists = isCreateTableIfNotExists(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: CreateTable = {
    type: StatementType.createTable,
    name: '',
    comment: '',
    columns: [],
    indexes: [],
    foreignKeys: [],
  };

  $pos.value += createTableIfNotExists($pos.value) ? 5 : 2;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    if (isLeftParent($pos.value)) {
      $pos.value++;
      const { columns, indexes, foreignKeys } = createTableColumnsParser(
        tokens,
        $pos
      );
      ast.columns = columns;
      ast.indexes = indexes;
      ast.foreignKeys = foreignKeys;
      continue;
    }

    if (isString($pos.value) && !ast.name) {
      ast.name = token.value;

      token = tokens[++$pos.value];

      if (isPeriod($pos.value)) {
        token = tokens[++$pos.value];

        if (isString($pos.value)) {
          ast.name = token.value;
          $pos.value++;
        }
      }

      continue;
    }

    if (isComment($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        ast.comment = token.value;
        $pos.value++;
      }

      continue;
    }

    $pos.value++;
  }

  return ast;
}

function createTableColumnsParser(
  tokens: Token[],
  $pos: RefPos
): CreateTableColumns {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isComma = isCommaToken(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isIndex = isIndexValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isForeign = isForeignValue(tokens);
  const isAutoIncrement = isAutoIncrementValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isNull = isNullValue(tokens);
  const isNot = isNotValue(tokens);
  const isDefault = isDefaultValue(tokens);
  const isComment = isCommentValue(tokens);
  const isDesc = isDescValue(tokens);
  const isAsc = isAscValue(tokens);
  const isKey = isKeyValue(tokens);
  const dataType = isDataType(tokens);

  const isToken = () => $pos.value < tokens.length;

  const columns: Column[] = [];
  const indexes: Index[] = [];
  const foreignKeys: ForeignKey[] = [];
  const primaryKeyColumnNames: string[] = [];
  const uniqueColumnNames: string[] = [];

  let column = {
    name: '',
    dataType: '',
    default: '',
    comment: '',
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    nullable: true,
  };

  while (isToken()) {
    let token = tokens[$pos.value];

    if (
      isString($pos.value) &&
      !column.name &&
      !isConstraint($pos.value) &&
      !isPrimary($pos.value) &&
      !isForeign($pos.value) &&
      !isUnique($pos.value) &&
      !isIndex($pos.value) &&
      !isKey($pos.value)
    ) {
      column.name = token.value;
      $pos.value++;
      continue;
    }

    if (isLeftParent($pos.value)) {
      token = tokens[++$pos.value];

      while (isToken() && !isRightParent($pos.value)) {
        token = tokens[++$pos.value];
      }

      $pos.value++;
      continue;
    }

    if (isConstraint($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    if (isPrimary($pos.value)) {
      token = tokens[++$pos.value];

      if (isKey($pos.value)) {
        token = tokens[++$pos.value];

        if (isLeftParent($pos.value)) {
          token = tokens[++$pos.value];

          while (isToken() && !isRightParent($pos.value)) {
            if (isString($pos.value)) {
              primaryKeyColumnNames.push(token.value.toUpperCase());
            }
            token = tokens[++$pos.value];
          }

          $pos.value++;
        } else {
          column.primaryKey = true;
        }
      }

      continue;
    }

    if (isForeign($pos.value)) {
      const foreignKey = parserForeignKeyParser(tokens, $pos);

      if (foreignKey) {
        foreignKeys.push(foreignKey);
      }

      continue;
    }

    if (isIndex($pos.value) || isKey($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        const name = token.value;
        const indexColumns: IndexColumn[] = [];
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
              indexColumns.push(indexColumn);
              indexColumn = {
                name: '',
                sort: SortType.asc,
              };
            }
            token = tokens[++$pos.value];
          }

          if (!indexColumns.includes(indexColumn) && indexColumn.name !== '') {
            indexColumns.push(indexColumn);
          }

          if (indexColumns.length) {
            indexes.push({
              name,
              unique: false,
              columns: indexColumns,
            });
          }

          $pos.value++;
        }
      }

      continue;
    }

    if (isUnique($pos.value)) {
      token = tokens[++$pos.value];

      if (isKey($pos.value)) {
        token = tokens[++$pos.value];
      }

      if (isString($pos.value)) {
        token = tokens[++$pos.value];
      }

      if (isLeftParent($pos.value)) {
        token = tokens[++$pos.value];

        while (isToken() && !isRightParent($pos.value)) {
          if (isString($pos.value)) {
            uniqueColumnNames.push(token.value.toUpperCase());
          }
          token = tokens[++$pos.value];
        }

        $pos.value++;
      } else {
        column.unique = true;
      }

      continue;
    }

    if (isNot($pos.value)) {
      token = tokens[++$pos.value];

      if (isNull($pos.value)) {
        column.nullable = false;
        $pos.value++;
      }

      continue;
    }

    if (isDefault($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        column.default = token.value;
        $pos.value++;
      }

      continue;
    }

    if (isComment($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        column.comment = token.value;
        $pos.value++;
      }

      continue;
    }

    if (isAutoIncrement($pos.value)) {
      column.autoIncrement = true;
      $pos.value++;
      continue;
    }

    if (dataType($pos.value)) {
      let value = token.value;
      token = tokens[++$pos.value];

      if (isLeftParent($pos.value)) {
        value += '(';
        token = tokens[++$pos.value];

        while (isToken() && !isRightParent($pos.value)) {
          value += token.value;
          token = tokens[++$pos.value];
        }

        value += ')';
        $pos.value++;
      }

      column.dataType = value;
      continue;
    }

    if (isComma($pos.value)) {
      if (column.name || column.dataType) {
        columns.push(column);
      }
      column = {
        name: '',
        dataType: '',
        default: '',
        comment: '',
        primaryKey: false,
        autoIncrement: false,
        unique: false,
        nullable: true,
      };
      $pos.value++;
      continue;
    }

    if (isRightParent($pos.value)) {
      $pos.value++;
      break;
    }

    $pos.value++;
  }

  if (!columns.includes(column) && (column.name || column.dataType)) {
    columns.push(column);
  }

  columns.forEach(column => {
    if (primaryKeyColumnNames.includes(column.name.toUpperCase())) {
      column.primaryKey = true;
    }

    if (uniqueColumnNames.includes(column.name.toUpperCase())) {
      column.unique = true;
    }
  });

  return {
    columns,
    indexes,
    foreignKeys,
  };
}

export function parserForeignKeyParser(
  tokens: Token[],
  $pos: RefPos
): ForeignKey | null {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isReferences = isReferencesValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isKey = isKeyValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  const foreignKey: ForeignKey = {
    columnNames: [],
    refTableName: '',
    refColumnNames: [],
  };

  let token = tokens[++$pos.value];

  if (isKey($pos.value)) {
    token = tokens[++$pos.value];

    if (isLeftParent($pos.value)) {
      token = tokens[++$pos.value];

      while (isToken() && !isRightParent($pos.value)) {
        if (isString($pos.value)) {
          foreignKey.columnNames.push(token.value);
        }
        token = tokens[++$pos.value];
      }

      token = tokens[++$pos.value];
    }

    if (isReferences($pos.value)) {
      token = tokens[++$pos.value];

      if (isString($pos.value)) {
        foreignKey.refTableName = token.value;

        token = tokens[++$pos.value];

        if (isPeriod($pos.value)) {
          token = tokens[++$pos.value];

          if (isString($pos.value)) {
            foreignKey.refTableName = token.value;
            token = tokens[++$pos.value];
          }
        }

        if (isLeftParent($pos.value)) {
          token = tokens[++$pos.value];

          while (isToken() && !isRightParent($pos.value)) {
            if (isString($pos.value)) {
              foreignKey.refColumnNames.push(token.value);
            }
            token = tokens[++$pos.value];
          }

          token = tokens[++$pos.value];
        }
      }
    }

    if (
      foreignKey.columnNames.length &&
      foreignKey.columnNames.length === foreignKey.refColumnNames.length
    ) {
      return foreignKey;
    }
  }

  return null;
}
