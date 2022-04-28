import {
  Column,
  CreateTable,
  CreateTableColumns,
  ForeignKey,
  Index,
  IndexColumn,
  Token,
} from '@@types/index';

import {
  Current,
  isAutoIncrement,
  isComma,
  isComment,
  isConstraint,
  isCurrent,
  isDataType,
  isDefault,
  isDESC,
  isForeign,
  isIndex,
  isKey,
  isKeyword,
  isLeftParen,
  isNot,
  isNull,
  isPeriod,
  isPrimary,
  isReferences,
  isRightParen,
  isString,
  isUnique,
} from './SQLParserHelper';

export function createTable(tokens: Token[]): CreateTable {
  const current: Current = { value: 0 };

  const ast: CreateTable = {
    type: 'create.table',
    name: '',
    comment: '',
    columns: [],
    indexes: [],
    foreignKeys: [],
  };

  while (isCurrent(tokens, current.value)) {
    let token = tokens[current.value];

    if (isLeftParen(token)) {
      current.value++;
      const { columns, indexes, foreignKeys } = createTableColumns(
        tokens,
        current
      );
      if (ast.columns.length === 0) {
        ast.columns = columns;
        ast.indexes = indexes;
        ast.foreignKeys = foreignKeys;
      }
      continue;
    }

    if (isString(token) && !ast.name) {
      ast.name = token.value;

      token = tokens[++current.value];

      if (isPeriod(token)) {
        token = tokens[++current.value];

        if (isString(token)) {
          ast.name = token.value;
          current.value++;
        }
      }

      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        ast.comment = token.value;
        current.value++;
      }

      continue;
    }

    current.value++;
  }

  return ast;
}

function createTableColumns(
  tokens: Token[],
  current: Current
): CreateTableColumns {
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

  while (isCurrent(tokens, current.value)) {
    let token = tokens[current.value];

    if (isString(token) && !column.name) {
      column.name = token.value;
      current.value++;
      continue;
    }

    if (isLeftParen(token)) {
      token = tokens[++current.value];

      while (isCurrent(tokens, current.value) && !isRightParen(token)) {
        token = tokens[++current.value];
      }

      current.value++;
      continue;
    }

    if (isConstraint(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        current.value++;
      }

      continue;
    }

    if (isPrimary(token)) {
      token = tokens[++current.value];

      if (isKey(token)) {
        token = tokens[++current.value];

        if (isLeftParen(token)) {
          token = tokens[++current.value];

          while (isCurrent(tokens, current.value) && !isRightParen(token)) {
            if (isString(token)) {
              primaryKeyColumnNames.push(token.value.toUpperCase());
            }
            token = tokens[++current.value];
          }

          current.value++;
        } else {
          column.primaryKey = true;
        }
      }

      continue;
    }

    if (isForeign(token)) {
      const foreignKey = parserForeignKey(tokens, current);

      if (foreignKey) {
        foreignKeys.push(foreignKey);
      }

      continue;
    }

    if (isIndex(token) || isKey(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        const name = token.value;
        const indexColumns: IndexColumn[] = [];
        token = tokens[++current.value];

        if (isLeftParen(token)) {
          token = tokens[++current.value];
          let indexColumn: IndexColumn = {
            name: '',
            sort: 'ASC',
          };

          while (isCurrent(tokens, current.value) && !isRightParen(token)) {
            if (isString(token)) {
              indexColumn.name = token.value;
            }
            if (isDESC(token)) {
              indexColumn.sort = 'DESC';
            }
            if (isComma(token)) {
              indexColumns.push(indexColumn);
              indexColumn = {
                name: '',
                sort: 'ASC',
              };
            }
            token = tokens[++current.value];
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

          current.value++;
        }
      }

      continue;
    }

    if (isUnique(token)) {
      token = tokens[++current.value];

      if (isKey(token)) {
        token = tokens[++current.value];
      }

      if (isString(token)) {
        token = tokens[++current.value];
      }

      if (isLeftParen(token)) {
        token = tokens[++current.value];

        while (isCurrent(tokens, current.value) && !isRightParen(token)) {
          if (isString(token)) {
            uniqueColumnNames.push(token.value.toUpperCase());
          }
          token = tokens[++current.value];
        }

        current.value++;
      } else {
        column.unique = true;
      }

      continue;
    }

    if (isNot(token)) {
      token = tokens[++current.value];

      if (isNull(token)) {
        column.nullable = false;
        current.value++;
      }

      continue;
    }

    if (isDefault(token)) {
      token = tokens[++current.value];

      if (isString(token) || isKeyword(token)) {
        column.default = token.value;
        current.value++;
      }

      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        column.comment = token.value;
        current.value++;
      }

      continue;
    }

    if (isAutoIncrement(token)) {
      column.autoIncrement = true;
      current.value++;
      continue;
    }

    if (isDataType(token)) {
      let value = token.value;
      token = tokens[++current.value];

      if (isLeftParen(token)) {
        value += '(';
        token = tokens[++current.value];

        while (isCurrent(tokens, current.value) && !isRightParen(token)) {
          value += token.value;
          token = tokens[++current.value];
        }

        value += ')';
        current.value++;
      }

      if (column.dataType && !column.name) {
        column.name = column.dataType;
      }
      column.dataType = value;
      continue;
    }

    if (isComma(token)) {
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
      current.value++;
      continue;
    }

    if (isRightParen(token)) {
      current.value++;
      break;
    }

    current.value++;
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

export function parserForeignKey(
  tokens: Token[],
  current: Current
): ForeignKey | null {
  const foreignKey: ForeignKey = {
    columnNames: [],
    refTableName: '',
    refColumnNames: [],
  };

  let token = tokens[++current.value];

  if (isKey(token)) {
    token = tokens[++current.value];

    if (isLeftParen(token)) {
      token = tokens[++current.value];

      while (isCurrent(tokens, current.value) && !isRightParen(token)) {
        if (isString(token)) {
          foreignKey.columnNames.push(token.value);
        }
        token = tokens[++current.value];
      }

      token = tokens[++current.value];
    }

    if (isReferences(token)) {
      token = tokens[++current.value];

      if (isString(token)) {
        foreignKey.refTableName = token.value;

        token = tokens[++current.value];

        if (isPeriod(token)) {
          token = tokens[++current.value];

          if (isString(token)) {
            foreignKey.refTableName = token.value;
            token = tokens[++current.value];
          }
        }

        if (isLeftParen(token)) {
          token = tokens[++current.value];

          while (isCurrent(tokens, current.value) && !isRightParen(token)) {
            if (isString(token)) {
              foreignKey.refColumnNames.push(token.value);
            }
            token = tokens[++current.value];
          }

          token = tokens[++current.value];
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
