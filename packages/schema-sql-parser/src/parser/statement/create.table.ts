import {
  isAscValue,
  isAutoIncrementValue,
  isCharacterSet,
  isCollateValue,
  isCommaToken,
  isCommentValue,
  isConstraintState,
  isConstraintValue,
  isCreateTableIfNotExists,
  isDefaultValue,
  isDescValue,
  isEqualToken,
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
  isSemicolonToken,
  isStringToken,
  isUniqueValue,
  matchDataType,
  matchNestedDataType,
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
  const isRightParent = isRightParentToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isEqual = isEqualToken(tokens);
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
  let hasColumns = false;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    // The terminator ends the statement: without it the table options loop
    // runs on into whatever follows, and a `COMMENT ON TABLE` right after
    // reads back as the table comment `ON`.
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    if (isLeftParent($pos.value)) {
      $pos.value++;

      // Only the first group is the column list. A later one — `WITH (...)`,
      // or a paren the tokenizer found outside a quote — would otherwise
      // replace everything the table already has.
      if (hasColumns) {
        let depth = 1;

        while (isToken() && depth > 0) {
          if (isLeftParent($pos.value)) {
            depth++;
          } else if (isRightParent($pos.value)) {
            depth--;
          }
          $pos.value++;
        }

        continue;
      }

      const { columns, indexes, foreignKeys } = createTableColumnsParser(
        tokens,
        $pos
      );
      ast.columns = columns;
      ast.indexes = indexes;
      ast.foreignKeys = foreignKeys;
      hasColumns = true;
      continue;
    }

    if (isString($pos.value) && !ast.name) {
      ast.name = token.value;
      $pos.value++;

      // `catalog.schema.table` is Unity Catalog's standard shape, and one
      // period was all this consumed -- the middle segment became the name
      // and the last was left to be read as something else.
      while (isPeriod($pos.value)) {
        if (!isString($pos.value + 1)) {
          // A period with nothing after it: consume it and keep what we have.
          $pos.value++;
          break;
        }

        ast.name = tokens[$pos.value + 1].value;
        $pos.value += 2;
      }

      continue;
    }

    if (isComment($pos.value)) {
      token = tokens[++$pos.value];

      // MySQL writes the table option as `COMMENT='a'`.
      if (isEqual($pos.value)) {
        token = tokens[++$pos.value];
      }

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
  const isEqual = isEqualToken(tokens);
  const characterSet = isCharacterSet(tokens);
  const isCollate = isCollateValue(tokens);
  const constraintState = isConstraintState(tokens);
  const dataType = matchDataType(tokens);
  const nestedDataType = matchNestedDataType(tokens);

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

    const nestedLength = nestedDataType($pos.value);

    if (nestedLength) {
      const end = $pos.value + nestedLength;
      const parts: string[] = [];

      while ($pos.value < end) {
        parts.push(isComma($pos.value) ? ',' : tokens[$pos.value].value);
        $pos.value++;
      }

      column.dataType = parts.reduce(
        (acc, part) => (!acc || part === ',' ? acc + part : `${acc} ${part}`),
        ''
      );
      continue;
    }

    if (
      isString($pos.value) &&
      !column.name &&
      !isConstraint($pos.value) &&
      !isPrimary($pos.value) &&
      !isForeign($pos.value) &&
      !isUnique($pos.value) &&
      !isIndex($pos.value) &&
      !isKey($pos.value) &&
      !isNot($pos.value) &&
      !constraintState($pos.value)
    ) {
      column.name = token.value;
      $pos.value++;
      continue;
    }

    if (isLeftParent($pos.value)) {
      // Depth matters: `GENERATED ALWAYS AS (CAST(ts AS DATE))` closes twice,
      // and stopping at the first `)` left the rest of the column list being
      // read as arguments -- every column after it vanished.
      let depth = 0;

      while (isToken()) {
        if (isLeftParent($pos.value)) {
          depth++;
        } else if (isRightParent($pos.value)) {
          depth--;

          if (depth === 0) {
            $pos.value++;
            break;
          }
        }

        $pos.value++;
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
      } else if (constraintState($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    if (constraintState($pos.value)) {
      $pos.value++;
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

      if (isEqual($pos.value)) {
        token = tokens[++$pos.value];
      }

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

    // `CHARACTER SET x` and `COLLATE y` are column attributes, but CHARACTER,
    // SET and some collation names are data types — left alone they overwrite
    // the one already parsed.
    if (characterSet($pos.value)) {
      $pos.value += 2;

      if (isString($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    if (isCollate($pos.value)) {
      $pos.value++;

      if (isEqual($pos.value)) {
        $pos.value++;
      }

      if (isString($pos.value)) {
        $pos.value++;
      }

      continue;
    }

    const dataTypeLength = dataType($pos.value);

    if (dataTypeLength) {
      const end = $pos.value + dataTypeLength;
      let value = '';
      let depth = 0;

      while ($pos.value < end) {
        token = tokens[$pos.value];

        if (isLeftParent($pos.value)) {
          value += '(';
          depth++;
        } else if (isRightParent($pos.value)) {
          value += ')';
          depth--;
        } else if (depth) {
          value += token.value;
        } else {
          value += value ? ` ${token.value}` : token.value;
        }

        $pos.value++;
      }

      while (depth > 0) {
        value += ')';
        depth--;
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
        $pos.value++;

        // A three-part `REFERENCES` left a period unconsumed, so the column
        // list was never reached: the whole key was dropped and the trailing
        // segment became a column of the table being defined.
        while (isPeriod($pos.value)) {
          if (!isString($pos.value + 1)) {
            $pos.value++;
            break;
          }

          foreignKey.refTableName = tokens[$pos.value + 1].value;
          $pos.value += 2;
        }

        token = tokens[$pos.value];

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
