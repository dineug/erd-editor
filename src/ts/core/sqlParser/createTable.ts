import {
  Token,
  StatementType,
  SortType,
  isDataType,
  isNot,
  isNull,
  isDefault,
  isAutoIncrement,
  isComment,
  isPrimary,
  isKey,
  isUnique,
  isConstraint,
  isIndex,
  isForeign,
  isReferences,
  isDESC,
} from "./SQLParserHelper";

export interface CreateTable {
  type: StatementType;
  name: string;
  comment: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

interface Column {
  name: string;
  dataType: string;
  default: string;
  comment: string;
  primaryKey: boolean;
  autoIncrement: boolean;
  unique: boolean;
  nullable: boolean;
}

interface Index {
  name: string;
  columns: IndexColumn[];
}

interface IndexColumn {
  name: string;
  sort: SortType;
}

interface ForeignKey {
  foreignKeyNames: string[];
  referencesTableName: string;
  referencesColumnNames: string[];
}

export function createTable(tokens: Token[]): CreateTable {
  const current = { value: 0 };

  const ast: CreateTable = {
    type: "create.table",
    name: "",
    comment: "",
    columns: [],
    indexes: [],
    foreignKeys: [],
  };

  while (current.value < tokens.length) {
    let token = tokens[current.value];

    if (token.type === "leftParen") {
      current.value++;
      const { columns, indexes, foreignKeys } = createTableColumns(
        tokens,
        current
      );
      ast.columns = columns;
      ast.indexes = indexes;
      ast.foreignKeys = foreignKeys;
      continue;
    }

    if (token.type === "string" && ast.name === "") {
      ast.name = token.value;

      token = tokens[++current.value];

      if (token && token.type === "period") {
        token = tokens[++current.value];

        if (token && token.type === "string") {
          ast.name = token.value;
          current.value++;
        }
      }

      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (token && token.type === "string") {
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
  current: { value: number }
): {
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
} {
  const columns: Column[] = [];
  const indexes: Index[] = [];
  const foreignKeys: ForeignKey[] = [];
  const primaryKeyNames: string[] = [];
  const uniqueNames: string[] = [];

  let column = {
    name: "",
    dataType: "",
    default: "",
    comment: "",
    primaryKey: false,
    autoIncrement: false,
    unique: false,
    nullable: true,
  };

  while (current.value < tokens.length) {
    let token = tokens[current.value];

    if (token.type === "string" && column.name === "") {
      column.name = token.value;
      current.value++;
      continue;
    }

    if (token.type === "leftParen") {
      token = tokens[++current.value];

      while (current.value < tokens.length && token.type !== "rightParen") {
        token = tokens[++current.value];
      }

      current.value++;
      continue;
    }

    if (isConstraint(token)) {
      token = tokens[++current.value];

      if (token.type === "string") {
        current.value++;
      }

      continue;
    }

    if (isPrimary(token)) {
      token = tokens[++current.value];

      if (token && isKey(token)) {
        token = tokens[++current.value];

        if (token && token.type === "leftParen") {
          token = tokens[++current.value];

          while (current.value < tokens.length && token.type !== "rightParen") {
            if (token.type === "string") {
              primaryKeyNames.push(token.value.toUpperCase());
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
      token = tokens[++current.value];

      if (token && isKey(token)) {
        token = tokens[++current.value];

        const foreignKey: ForeignKey = {
          foreignKeyNames: [],
          referencesTableName: "",
          referencesColumnNames: [],
        };

        if (token && token.type === "leftParen") {
          token = tokens[++current.value];

          while (current.value < tokens.length && token.type !== "rightParen") {
            if (token.type === "string") {
              foreignKey.foreignKeyNames.push(token.value);
            }
            token = tokens[++current.value];
          }

          token = tokens[++current.value];
        }

        if (token && isReferences(token)) {
          token = tokens[++current.value];

          if (token.type === "string") {
            foreignKey.referencesTableName = token.value;

            token = tokens[++current.value];

            if (token && token.type === "period") {
              token = tokens[++current.value];

              if (token && token.type === "string") {
                foreignKey.referencesTableName = token.value;
                token = tokens[++current.value];
              }
            }

            if (token && token.type === "leftParen") {
              token = tokens[++current.value];

              while (
                current.value < tokens.length &&
                token.type !== "rightParen"
              ) {
                if (token.type === "string") {
                  foreignKey.referencesColumnNames.push(token.value);
                }
                token = tokens[++current.value];
              }

              token = tokens[++current.value];
            }
          }
        }

        if (
          foreignKey.foreignKeyNames.length &&
          foreignKey.foreignKeyNames.length ===
            foreignKey.referencesColumnNames.length
        ) {
          foreignKeys.push(foreignKey);
        }
      }

      continue;
    }

    if (isIndex(token)) {
      token = tokens[++current.value];

      if (token && token.type === "string") {
        const name = token.value;
        const indexColumns: IndexColumn[] = [];
        token = tokens[++current.value];

        if (token && token.type === "leftParen") {
          token = tokens[++current.value];
          let indexColumn: IndexColumn = {
            name: "",
            sort: "ASC",
          };

          while (current.value < tokens.length && token.type !== "rightParen") {
            if (token.type === "string") {
              indexColumn.name = token.value;
            }
            if (isDESC(token)) {
              indexColumn.sort = "DESC";
            }
            if (token.type === "comma") {
              indexColumns.push(indexColumn);
              indexColumn = {
                name: "",
                sort: "ASC",
              };
            }
            token = tokens[++current.value];
          }

          if (!indexColumns.includes(indexColumn) && indexColumn.name !== "") {
            indexColumns.push(indexColumn);
          }

          if (indexColumns.length) {
            indexes.push({
              name,
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

      if (token && token.type === "leftParen") {
        token = tokens[++current.value];

        while (current.value < tokens.length && token.type !== "rightParen") {
          if (token.type === "string") {
            uniqueNames.push(token.value.toUpperCase());
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

      if (token && isNull(token)) {
        column.nullable = false;
        current.value++;
      }

      continue;
    }

    if (isDefault(token)) {
      token = tokens[++current.value];

      if (token && (token.type === "string" || token.type === "keyword")) {
        column.default = token.value;
        current.value++;
      }

      continue;
    }

    if (isComment(token)) {
      token = tokens[++current.value];

      if (token && token.type === "string") {
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

      if (token && token.type === "leftParen") {
        value += "(";
        token = tokens[++current.value];

        while (current.value < tokens.length && token.type !== "rightParen") {
          value += token.value;
          token = tokens[++current.value];
        }

        value += ")";
        current.value++;
      }

      column.dataType = value;
      continue;
    }

    if (token.type === "comma") {
      if (column.name !== "" || column.dataType !== "") {
        columns.push(column);
      }
      column = {
        name: "",
        dataType: "",
        default: "",
        comment: "",
        primaryKey: false,
        autoIncrement: false,
        unique: false,
        nullable: true,
      };
      current.value++;
      continue;
    }

    if (token.type === "rightParen") {
      current.value++;
      break;
    }

    current.value++;
  }

  if (
    !columns.includes(column) &&
    (column.name !== "" || column.dataType !== "")
  ) {
    columns.push(column);
  }

  columns.forEach((column) => {
    if (primaryKeyNames.includes(column.name.toUpperCase())) {
      column.primaryKey = true;
    }

    if (uniqueNames.includes(column.name.toUpperCase())) {
      column.unique = true;
    }
  });

  return {
    columns,
    indexes,
    foreignKeys,
  };
}
