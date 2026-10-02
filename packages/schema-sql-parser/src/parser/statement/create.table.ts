import {
  isArrayDimensionToken,
  isAutoIncrementValue,
  isCharacterSet,
  isClusterBy,
  isCollateValue,
  isCommaToken,
  isCommentValue,
  isConstraintState,
  isConstraintValue,
  isDefaultValue,
  isEqualToken,
  isForeignValue,
  isIndexKind,
  isIndexValue,
  isKeyValue,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isNullFilter,
  isNullValue,
  isPeriodToken,
  isPrimaryValue,
  isReferencesValue,
  isRightParentToken,
  isSemicolonToken,
  isStringToken,
  isTableItemWord,
  isTablespaceValue,
  isUniqueValue,
  isUsingValue,
  isWhereValue,
  matchCreateTable,
  matchDataType,
  matchKeyModifiers,
  matchNestedDataType,
  matchReferentialClause,
  matchUserDataType,
  requote,
  toStringLiteral,
  unquoteTypeName,
} from '@/parser/helper';
import {
  Column,
  CreateTable,
  CreateTableColumns,
  DatabaseVendor,
  ForeignKey,
  Index,
  Key,
  RefPos,
  StatementType,
} from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { Token } from '@/parser/tokenizer';

export function createTableParser(
  tokens: Token[],
  $pos: RefPos,
  database?: DatabaseVendor
) {
  const newStatement = isNewStatement(tokens);
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isEqual = isEqualToken(tokens);
  const isComment = isCommentValue(tokens);
  const clusterBy = isClusterBy(tokens);
  const createTable = matchCreateTable(tokens);

  const isToken = () => $pos.value < tokens.length;

  const ast: CreateTable = {
    type: StatementType.createTable,
    name: '',
    comment: '',
    columns: [],
    indexes: [],
    keys: [],
    foreignKeys: [],
  };

  // The dispatch loop only reaches here where the header matched, but this
  // parser is exported: a zero span would leave $pos on CREATE and spin.
  const header = createTable($pos.value);
  $pos.value += header === 0 ? 2 : header;
  let hasColumns = false;
  // The column list is the group following the table name, optionally across a
  // clustering clause. A later group belongs to a table option, and reading it
  // as columns invents a table out of a definition that declares none.
  let atColumnList = true;

  while (isToken() && !newStatement($pos.value)) {
    let token = tokens[$pos.value];

    // The terminator ends the statement: without it the table options loop
    // runs on into whatever follows, and a COMMENT ON TABLE right after
    // reads back as the table comment ON.
    if (isSemicolon($pos.value)) {
      $pos.value++;
      break;
    }

    // Snowflake writes the clustering key between the table name and the column
    // list -- cluster by LINEAR(L_SHIPDATE)(. Left unclaimed, its key list is
    // read as the column list and every real column is lost.
    if (ast.name && clusterBy($pos.value)) {
      $pos.value += 2;

      // LINEAR( is a clustering function; a bare word is not, and eating it
      // would leave the column list to be read as its argument list.
      if (isString($pos.value) && isLeftParent($pos.value + 1)) {
        $pos.value++;
      }

      if (isLeftParent($pos.value)) {
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
      }

      continue;
    }

    if (isLeftParent($pos.value)) {
      $pos.value++;

      // Only the first group is the column list. A later one — WITH (...),
      // or a paren the tokenizer found outside a quote — would otherwise
      // replace everything the table already has.
      if (hasColumns || !atColumnList) {
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

      const { columns, indexes, keys, foreignKeys } = createTableColumnsParser(
        tokens,
        $pos,
        database
      );
      ast.columns = columns;
      ast.indexes = indexes;
      ast.keys = keys;
      ast.foreignKeys = foreignKeys;
      hasColumns = true;
      continue;
    }

    if (isString($pos.value) && !ast.name) {
      ast.name = token.value;
      atColumnList = true;
      $pos.value++;

      // catalog.schema.table is Unity Catalog's standard shape, and one
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

      // MySQL writes the table option as COMMENT='a'.
      if (isEqual($pos.value)) {
        token = tokens[++$pos.value];
      }

      if (isString($pos.value)) {
        ast.comment = token.value;
        $pos.value++;
      }

      atColumnList = false;
      continue;
    }

    atColumnList = false;
    $pos.value++;
  }

  return ast;
}

function createTableColumnsParser(
  tokens: Token[],
  $pos: RefPos,
  database?: DatabaseVendor
): CreateTableColumns {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isComma = isCommaToken(tokens);
  const isSemicolon = isSemicolonToken(tokens);
  const isPeriod = isPeriodToken(tokens);
  const isArrayDimension = isArrayDimensionToken(tokens);
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
  const isKey = isKeyValue(tokens);
  const isReferences = isReferencesValue(tokens);
  const isEqual = isEqualToken(tokens);
  const characterSet = isCharacterSet(tokens);
  const isCollate = isCollateValue(tokens);
  const isUsing = isUsingValue(tokens);
  const isTablespace = isTablespaceValue(tokens);
  const isWhere = isWhereValue(tokens);
  const nullFilter = isNullFilter(tokens);
  const constraintState = isConstraintState(tokens);
  const dataType = matchDataType(tokens);
  const userDataType = matchUserDataType(tokens);
  const nestedDataType = matchNestedDataType(tokens);
  const referentialClause = matchReferentialClause(tokens);
  const keyModifiers = matchKeyModifiers(tokens);
  const indexKind = isIndexKind(tokens);
  const tableItemWord = isTableItemWord(tokens);

  const isToken = () => $pos.value < tokens.length;

  const opensConstraintItem = (pos: number) =>
    isConstraint(pos) ||
    isPrimary(pos) ||
    isForeign(pos) ||
    isUnique(pos) ||
    isIndex(pos) ||
    isKey(pos) ||
    indexKind(pos) ||
    tableItemWord(pos);

  const columns: Column[] = [];
  const indexes: Index[] = [];
  const keys: Key[] = [];
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
  // Set while the item is a table constraint or index: until its comma no word
  // may become a column name or a data type -- USING BTREE, ON [PRIMARY].
  let constraintItem = false;
  // The name a CONSTRAINT gives the item it opens, which a UNIQUE over several
  // columns keeps unless it names its index itself.
  let constraintName = '';
  // Where that name ends: it names only the constraint right after it, never
  // the PRIMARY KEY of id INT CONSTRAINT nn NOT NULL PRIMARY KEY.
  let constraintEnd = -1;

  // The key with no name the item has read. Oracle's USING INDEX after it
  // reports it too: DBMS_METADATA may export its index on its own, as SYS_C...
  let unnamedKey: Key | null = null;

  // Oracle's USING INDEX, but not PostgreSQL's USING INDEX TABLESPACE, after
  // which a CREATE INDEX over the key is an index of its own: DBMS_METADATA
  // never writes TABLESPACE first, and Oracle refuses a second such index.
  const oracleUsingIndex = (pos: number) =>
    isUsing(pos) && isIndex(pos + 1) && !isTablespace(pos + 2);

  const symbolAt = (pos: number) =>
    pos === constraintEnd ? constraintName : '';

  // The WHERE of the item at pos, -1 where none comes before its end: SQL
  // Server filters INDEX n UNIQUE (...) [INCLUDE (...)] WHERE ... inline too.
  const filterAt = (pos: number) => {
    let depth = 0;

    for (; pos < tokens.length && !isSemicolon(pos); pos++) {
      if (isLeftParent(pos)) {
        depth++;
      } else if (isRightParent(pos)) {
        if (depth-- === 0) return -1;
      } else if (depth === 0 && isComma(pos)) {
        return -1;
      } else if (depth === 0 && isWhere(pos)) {
        return pos;
      }
    }

    return -1;
  };

  const addKey = (name: string, columnNames: string[]) => {
    if (!columnNames.length) return;

    if (name) {
      keys.push({ name, columnNames });
    } else {
      unnamedKey = { name, columnNames };
    }
  };

  // Where the column's type stands, right after its name: the one place a
  // word the vendor lists lack is read as a type rather than an attribute.
  let typePos = -1;

  while (isToken()) {
    let token = tokens[$pos.value];

    if (unnamedKey && oracleUsingIndex($pos.value)) {
      keys.push(unnamedKey);
      unnamedKey = null;
    }

    const nestedLength = nestedDataType($pos.value);

    if (nestedLength) {
      const end = $pos.value + nestedLength;
      const parts: string[] = [];

      while ($pos.value < end) {
        // A field's COMMENT and a backtick name keep their quotes, as a type
        // argument does: STRUCT<name: STRING COMMENT 'x'>.
        parts.push(
          isComma($pos.value) ? ',' : requote(tokens[$pos.value], database)
        );
        $pos.value++;
      }

      // A quoted token ends before the colon or bracket written right after
      // it, so a field name and its colon join back without a space.
      column.dataType = parts.reduce(
        (acc, part) =>
          !acc || /^[,:>]/.test(part) ? acc + part : `${acc} ${part}`,
        ''
      );
      continue;
    }

    const { span: referentialLength } = referentialClause($pos.value);

    if (referentialLength) {
      $pos.value += referentialLength;
      continue;
    }

    // a_id INT REFERENCES a (id) ON DELETE CASCADE keys the column it ends.
    // SQL Server and Snowflake may write FOREIGN KEY before the REFERENCES.
    const inlineForeignKey =
      isForeign($pos.value) &&
      isKey($pos.value + 1) &&
      isReferences($pos.value + 2);

    if (
      column.name &&
      !constraintItem &&
      (isReferences($pos.value) || inlineForeignKey)
    ) {
      if (inlineForeignKey) {
        $pos.value += 2;
      }

      const foreignKey: ForeignKey = {
        columnNames: [column.name],
        refTableName: '',
        refColumnNames: [],
        onDelete: '',
        onUpdate: '',
      };
      referencesParser(tokens, $pos, foreignKey);

      if (foreignKey.refTableName && foreignKey.refColumnNames.length <= 1) {
        foreignKeys.push(foreignKey);
      }

      continue;
    }

    if (!column.name && opensConstraintItem($pos.value)) {
      constraintItem = true;
    }

    if (constraintItem && indexKind($pos.value)) {
      $pos.value++;
      continue;
    }

    if (
      isString($pos.value) &&
      !constraintItem &&
      !column.name &&
      !isNot($pos.value) &&
      !constraintState($pos.value)
    ) {
      column.name = token.value;
      typePos = ++$pos.value;
      continue;
    }

    if (isLeftParent($pos.value)) {
      // Depth matters: GENERATED ALWAYS AS (CAST(ts AS DATE)) closes twice,
      // and stopping at the first ) left the rest of the column list being
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

      // The symbol is optional: CONSTRAINT UNIQUE (a) names nothing.
      if (
        isString($pos.value) &&
        !isUnique($pos.value) &&
        !isPrimary($pos.value) &&
        !isForeign($pos.value)
      ) {
        constraintName = token.value;
        $pos.value++;
      }

      constraintEnd = $pos.value;
      continue;
    }

    if (isPrimary($pos.value)) {
      const name = symbolAt($pos.value);
      token = tokens[++$pos.value];

      if (isKey($pos.value)) {
        token = tokens[++$pos.value];

        // SQL Server names the clustering before the key list.
        if (constraintItem && isString($pos.value)) {
          token = tokens[++$pos.value];
        }

        if (isLeftParent($pos.value)) {
          const columnNames = indexColumnsParser(tokens, $pos).map(
            indexColumn => indexColumn.name
          );

          primaryKeyColumnNames.push(
            ...columnNames.map(columnName => columnName.toUpperCase())
          );
          addKey(name, columnNames);
        } else if (column.name) {
          column.primaryKey = true;
          addKey(name, [column.name]);
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
        token = tokens[++$pos.value];

        // SQL Server's INDEX n UNIQUE (a, b) is a unique key the UNIQUE branch
        // reads, under the index's name.
        if (isUnique($pos.value)) {
          constraintName = name;
          continue;
        }

        if (isLeftParent($pos.value)) {
          const indexColumns = indexColumnsParser(tokens, $pos);

          if (indexColumns.length) {
            indexes.push({
              name,
              unique: false,
              columns: indexColumns,
            });
          }
        }
      }

      continue;
    }

    if (isUnique($pos.value)) {
      const symbol = symbolAt($pos.value);
      token = tokens[++$pos.value];

      if (isKey($pos.value) || isIndex($pos.value)) {
        token = tokens[++$pos.value];
      }

      // A column's own UNIQUE has no name and no key list. What follows is
      // another attribute, or Oracle's USING INDEX (...) the loop skips.
      if (column.name) {
        column.unique = true;
        addKey(symbol, [column.name]);
        continue;
      }

      $pos.value += keyModifiers($pos.value);

      // Only a table constraint names its index.
      let name = constraintName;

      if (isString($pos.value)) {
        name = tokens[$pos.value].value;
        $pos.value++;
        $pos.value += keyModifiers($pos.value);
      }

      if (isLeftParent($pos.value)) {
        const indexColumns = indexColumnsParser(tokens, $pos);
        const columnNames = indexColumns.map(indexColumn => indexColumn.name);
        const filter = filterAt($pos.value);

        // A filter keys only the rows it picks, the rule CREATE UNIQUE INDEX
        // reads its WHERE by: unconditioned that key would be a stricter one.
        if (filter !== -1 && !nullFilter(filter, columnNames)) {
          if (indexColumns.length) {
            indexes.push({ name, unique: false, columns: indexColumns });
          }
        } else if (indexColumns.length > 1) {
          // Several columns under one UNIQUE are one composite key, in whatever
          // spelling; marking each column unique would export a stricter one.
          indexes.push({ name, unique: true, columns: indexColumns });

          // A name finds the index a dump exports for the key on its own; with
          // none, only the USING INDEX that reports it in keys does.
          if (!name) {
            addKey(name, columnNames);
          }
        } else {
          uniqueColumnNames.push(
            ...columnNames.map(columnName => columnName.toUpperCase())
          );
          addKey(name, columnNames);
        }
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

      // The default is a raw SQL expression. The lexer strips the quotes off a
      // string literal, so they go back on -- PENDING would read as a name.
      if (isString($pos.value)) {
        column.default = token.quoted
          ? toStringLiteral(token.value, database)
          : token.value;
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

    // CHARACTER SET x and COLLATE y are column attributes, but CHARACTER,
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

    const knownLength = dataType($pos.value);
    const userLength = $pos.value === typePos ? userDataType($pos.value) : 0;
    // A name the lists lack is still the type in the type's place, mood or
    // hstore, and so is a qualified one even when its schema is a type name.
    const userDefined =
      userLength > 0 && (!knownLength || isPeriod($pos.value + 1));
    const dataTypeLength = userDefined ? userLength : knownLength;

    // A column keeps its first type: the BINARY of VARCHAR(40) BINARY is an
    // attribute, and a constraint item has no type at all.
    if (dataTypeLength && (constraintItem || column.dataType)) {
      $pos.value += dataTypeLength;
      continue;
    }

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
          // A quoted argument goes back into its quotes: ENUM(a,b) is no
          // valid DDL. A structured type spells its fields as words --
          // Snowflake's OBJECT(city VARCHAR). Gluing them loses the field.
          const text = requote(token, database);
          value +=
            isString($pos.value) &&
            (isString($pos.value - 1) || isRightParent($pos.value - 1))
              ? ` ${text}`
              : text;
        } else if (isArrayDimension($pos.value)) {
          value += requote(token);
        } else {
          // A user type keeps its quotes, "MyType" being case sensitive and
          // [dbo].[Order] naming a reserved word; a listed type drops them
          // but for "char" and "bit".
          const text = userDefined ? requote(token) : unquoteTypeName(token);
          value +=
            value && !isPeriod($pos.value) && !isPeriod($pos.value - 1)
              ? ` ${text}`
              : text;
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
      constraintItem = false;
      constraintName = '';
      unnamedKey = null;
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
    keys,
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
  const isKey = isKeyValue(tokens);

  const isToken = () => $pos.value < tokens.length;

  const foreignKey: ForeignKey = {
    columnNames: [],
    refTableName: '',
    refColumnNames: [],
    onDelete: '',
    onUpdate: '',
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

    referencesParser(tokens, $pos, foreignKey);

    // No referenced column list names the referenced table's primary key.
    if (
      foreignKey.columnNames.length &&
      foreignKey.refTableName &&
      (!foreignKey.refColumnNames.length ||
        foreignKey.columnNames.length === foreignKey.refColumnNames.length)
    ) {
      return foreignKey;
    }
  }

  return null;
}

/**
 * Reads REFERENCES t (x, y) and the ON DELETE / ON UPDATE / MATCH clauses right
 * after it into foreignKey, leaving $pos past them; anything else stays put.
 */
function referencesParser(
  tokens: Token[],
  $pos: RefPos,
  foreignKey: ForeignKey
) {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);
  const isReferences = isReferencesValue(tokens);
  const isPeriod = isPeriodToken(tokens);
  const referentialClause = matchReferentialClause(tokens);

  const isToken = () => $pos.value < tokens.length;

  if (!isReferences($pos.value)) return;

  let token = tokens[++$pos.value];

  if (!isString($pos.value)) return;

  foreignKey.refTableName = token.value;
  $pos.value++;

  // A three-part REFERENCES left a period unconsumed, so the column list was
  // never reached: the whole key was dropped and the trailing segment became a
  // column of the table being defined.
  while (isPeriod($pos.value)) {
    if (!isString($pos.value + 1)) {
      $pos.value++;
      break;
    }

    foreignKey.refTableName = tokens[$pos.value + 1].value;
    $pos.value += 2;
  }

  if (isLeftParent($pos.value)) {
    token = tokens[++$pos.value];

    while (isToken() && !isRightParent($pos.value)) {
      if (isString($pos.value)) {
        foreignKey.refColumnNames.push(token.value);
      }
      token = tokens[++$pos.value];
    }

    $pos.value++;
  }

  for (
    let clause = referentialClause($pos.value);
    clause.span;
    clause = referentialClause($pos.value)
  ) {
    if (clause.event === 'DELETE' && clause.action) {
      foreignKey.onDelete = clause.action;
    } else if (clause.event === 'UPDATE' && clause.action) {
      foreignKey.onUpdate = clause.action;
    }

    $pos.value += clause.span;
  }
}
