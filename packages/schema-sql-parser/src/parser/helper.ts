import { DatabricksTypes } from '@/parser/dataType/Databricks';
import { MariaDBTypes } from '@/parser/dataType/MariaDB';
import { MSSQLTypes } from '@/parser/dataType/MSSQL';
import { MySQLTypes } from '@/parser/dataType/MySQL';
import { OracleTypes } from '@/parser/dataType/Oracle';
import { PostgreSQLTypes } from '@/parser/dataType/PostgreSQL';
import { SnowflakeTypes } from '@/parser/dataType/Snowflake';
import { SQLiteTypes } from '@/parser/dataType/SQLite';
import { Token, TokenType } from '@/parser/tokenizer';

const createTypeEqual = (type: string) => (tokens: Token[]) => (pos: number) =>
  tokens[pos] ? tokens[pos].type === type : false;

// A quoted token is always an identifier, never a keyword: key is a column
// named key, KEY is the index definition.
const createValueEqual = (type: string) => {
  const value = type.toUpperCase();
  return (tokens: Token[]) => (pos: number) => {
    const token = tokens[pos];
    return token ? !token.quoted && token.value.toUpperCase() === value : false;
  };
};

export const isStringToken = createTypeEqual(TokenType.string);
export const isEqualToken = createTypeEqual(TokenType.equal);
export const isPeriodToken = createTypeEqual(TokenType.period);
export const isCommaToken = createTypeEqual(TokenType.comma);
export const isSemicolonToken = createTypeEqual(TokenType.semicolon);
export const isLeftParentToken = createTypeEqual(TokenType.leftParent);
export const isRightParentToken = createTypeEqual(TokenType.rightParent);
export const isLeftBracketToken = createTypeEqual(TokenType.leftBracket);
export const isRightBracketToken = createTypeEqual(TokenType.rightBracket);
export const isCreateValue = createValueEqual('CREATE');
export const isAlterValue = createValueEqual('ALTER');
export const isDropValue = createValueEqual('DROP');
export const isUseValue = createValueEqual('USE');
export const isRenameValue = createValueEqual('RENAME');
export const isDeleteValue = createValueEqual('DELETE');
export const isSelectValue = createValueEqual('SELECT');
export const isTableValue = createValueEqual('TABLE');
export const isIndexValue = createValueEqual('INDEX');
export const isUniqueValue = createValueEqual('UNIQUE');
export const isAddValue = createValueEqual('ADD');
export const isPrimaryValue = createValueEqual('PRIMARY');
export const isKeyValue = createValueEqual('KEY');
export const isConstraintValue = createValueEqual('CONSTRAINT');
export const isForeignValue = createValueEqual('FOREIGN');
export const isNotValue = createValueEqual('NOT');
export const isNullValue = createValueEqual('NULL');
export const isDefaultValue = createValueEqual('DEFAULT');
export const isCommentValue = createValueEqual('COMMENT');
export const isReferencesValue = createValueEqual('REFERENCES');
export const isAscValue = createValueEqual('ASC');
export const isDescValue = createValueEqual('DESC');
export const isOnValue = createValueEqual('ON');
export const isAuto_incrementValue = createValueEqual('AUTO_INCREMENT');
export const isAutoincrementValue = createValueEqual('AUTOINCREMENT');
export const isIfValue = createValueEqual('IF');
export const isExistsValue = createValueEqual('EXISTS');
export const isOnlyValue = createValueEqual('ONLY');
export const isIsValue = createValueEqual('IS');
export const isColumnValue = createValueEqual('COLUMN');
export const isCharacterValue = createValueEqual('CHARACTER');
export const isSetValue = createValueEqual('SET');
export const isCollateValue = createValueEqual('COLLATE');
export const isEnforcedValue = createValueEqual('ENFORCED');
export const isRelyValue = createValueEqual('RELY');
export const isNorelyValue = createValueEqual('NORELY');
export const isDeferrableValue = createValueEqual('DEFERRABLE');
export const isInitiallyValue = createValueEqual('INITIALLY');
export const isDeferredValue = createValueEqual('DEFERRED');
export const isImmediateValue = createValueEqual('IMMEDIATE');
export const isIdentityValue = createValueEqual('IDENTITY');
export const isFunctionValue = createValueEqual('FUNCTION');
export const isClusterValue = createValueEqual('CLUSTER');
export const isByValue = createValueEqual('BY');

// What a constraint may carry after its key list, from Databricks' NOT
// ENFORCED RELY to ANSI's DEFERRABLE INITIALLY DEFERRED. The column branch runs
// first, so left unclaimed the leading word becomes a column.
export const isConstraintState = (tokens: Token[]) => {
  const isEnforced = isEnforcedValue(tokens);
  const isRely = isRelyValue(tokens);
  const isNorely = isNorelyValue(tokens);
  const isDeferrable = isDeferrableValue(tokens);
  const isInitially = isInitiallyValue(tokens);
  const isDeferred = isDeferredValue(tokens);
  const isImmediate = isImmediateValue(tokens);

  return (pos: number) =>
    isEnforced(pos) ||
    isRely(pos) ||
    isNorely(pos) ||
    isDeferrable(pos) ||
    isInitially(pos) ||
    isDeferred(pos) ||
    isImmediate(pos);
};

// Angle brackets are not break characters, so a nested type arrives glued to
// its neighbours and its commas read as column separators. Breaking them in the
// lexer would shift every fixed-offset matcher, so the span is balanced here.
const NestedDataTypes = ['ARRAY', 'MAP', 'STRUCT'];

export const matchNestedDataType = (tokens: Token[]) => {
  const isString = isStringToken(tokens);

  const angleDepth = (value: string) => {
    let depth = 0;

    for (const char of value) {
      if (char === '<') depth++;
      else if (char === '>') depth--;
    }

    return depth;
  };

  return (pos: number) => {
    const token = tokens[pos];
    if (!token || token.quoted || !isString(pos)) return 0;

    const open = token.value.indexOf('<');
    if (open === -1) return 0;
    if (!NestedDataTypes.includes(token.value.slice(0, open).toUpperCase())) {
      return 0;
    }

    let depth = 0;

    for (let cursor = pos; cursor < tokens.length; cursor++) {
      depth += angleDepth(tokens[cursor].value);
      if (depth <= 0) return cursor - pos + 1;
    }

    // Unterminated: the permissive parser takes what is left as the type.
    return tokens.length - pos;
  };
};

export const isAutoIncrementValue = (tokens: Token[]) => {
  const isAuto_increment = isAuto_incrementValue(tokens);
  const isAutoincrement = isAutoincrementValue(tokens);
  const isIdentity = isIdentityValue(tokens);
  return (pos: number) =>
    isAuto_increment(pos) || isAutoincrement(pos) || isIdentity(pos);
};

export const isClusterBy = (tokens: Token[]) => {
  const isCluster = isClusterValue(tokens);
  const isBy = isByValue(tokens);
  return (pos: number) => isCluster(pos) && isBy(pos + 1);
};

export const isCommentOn = (tokens: Token[]) => {
  const isComment = isCommentValue(tokens);
  const isOn = isOnValue(tokens);
  return (pos: number) => isComment(pos) && isOn(pos + 1);
};

export const isCommentOnTable = (tokens: Token[]) => {
  const commentOn = isCommentOn(tokens);
  const isTable = isTableValue(tokens);
  return (pos: number) => commentOn(pos) && isTable(pos + 2);
};

export const isCommentOnColumn = (tokens: Token[]) => {
  const commentOn = isCommentOn(tokens);
  const isColumn = isColumnValue(tokens);
  return (pos: number) => commentOn(pos) && isColumn(pos + 2);
};

export const isNewStatement = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isAlter = isAlterValue(tokens);
  const isDrop = isDropValue(tokens);
  const isUse = isUseValue(tokens);
  const isRename = isRenameValue(tokens);
  const isDelete = isDeleteValue(tokens);
  const isSelect = isSelectValue(tokens);
  const commentOn = isCommentOn(tokens);
  return (pos: number) =>
    isCreate(pos) ||
    isAlter(pos) ||
    isDrop(pos) ||
    isUse(pos) ||
    isRename(pos) ||
    isDelete(pos) ||
    isSelect(pos) ||
    commentOn(pos);
};

// What may sit between CREATE and TABLE. A whitelist rather than a scan to the
// next TABLE, which would also claim a view whose select reads from a table
// function.
const CreateTableModifiers: ReadonlyArray<string> = [
  'OR',
  'REPLACE',
  'TRANSIENT',
  'TEMPORARY',
  'TEMP',
  'LOCAL',
  'GLOBAL',
  'VOLATILE',
  'UNLOGGED',
  'HYBRID',
  'ICEBERG',
  'DYNAMIC',
  'EXTERNAL',
];

// How many tokens the header spans before the table name, 0 when there is no
// CREATE TABLE at pos. The statement parser needs the length, because the name
// sits right after it and the modifiers are not a fixed count.
export const matchCreateTable = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isTable = isTableValue(tokens);
  const isString = isStringToken(tokens);
  const isFunction = isFunctionValue(tokens);
  const isIf = isIfValue(tokens);
  const isNot = isNotValue(tokens);
  const isExists = isExistsValue(tokens);

  return (pos: number) => {
    if (!isCreate(pos)) return 0;

    let cursor = pos + 1;

    while (cursor < tokens.length && !isTable(cursor)) {
      const token = tokens[cursor];

      if (
        !isString(cursor) ||
        token.quoted ||
        !CreateTableModifiers.includes(token.value.toUpperCase())
      ) {
        return 0;
      }

      cursor++;
    }

    if (!isTable(cursor)) return 0;

    // BigQuery spells a table-valued function CREATE OR REPLACE TABLE
    // FUNCTION f(...), which would otherwise take FUNCTION as the name.
    if (isFunction(cursor + 1)) return 0;

    cursor++;

    if (isIf(cursor) && isNot(cursor + 1) && isExists(cursor + 2)) {
      cursor += 3;
    }

    return cursor - pos;
  };
};

export const isCharacterSet = (tokens: Token[]) => {
  const isCharacter = isCharacterValue(tokens);
  const isSet = isSetValue(tokens);
  return (pos: number) => isCharacter(pos) && isSet(pos + 1);
};

export const isCreateTable = (tokens: Token[]) => {
  const createTable = matchCreateTable(tokens);
  return (pos: number) => createTable(pos) > 0;
};

export const isCreateUniqueIndex = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isIndex = isIndexValue(tokens);
  const isUnique = isUniqueValue(tokens);
  return (pos: number) =>
    isCreate(pos) && isUnique(pos + 1) && isIndex(pos + 2);
};

export const isCreateIndex = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isIndex = isIndexValue(tokens);
  const createUniqueIndex = isCreateUniqueIndex(tokens);
  return (pos: number) =>
    (isCreate(pos) && isIndex(pos + 1)) || createUniqueIndex(pos);
};

export const isAlterTable = (tokens: Token[]) => {
  const isAlter = isAlterValue(tokens);
  const isTable = isTableValue(tokens);
  return (pos: number) => isAlter(pos) && isTable(pos + 1);
};

export const isAlterTableOnly = (tokens: Token[]) => {
  const alterTable = isAlterTable(tokens);
  const isOnly = isOnlyValue(tokens);
  return (pos: number) => alterTable(pos) && isOnly(pos + 2);
};

// How many tokens a possibly qualified name spans: t, schema.t and
// Snowflake's db.schema.t are one name each.
export const matchQualifiedName = (tokens: Token[]) => {
  const isString = isStringToken(tokens);
  const isPeriod = isPeriodToken(tokens);

  return (pos: number) => {
    if (!isString(pos)) return 0;

    let cursor = pos + 1;

    while (isPeriod(cursor) && isString(cursor + 1)) {
      cursor += 2;
    }

    return cursor - pos;
  };
};

// How many tokens the ALTER TABLE ADD head spans, 0 when there is none at pos,
// and whether ONLY was read as the keyword rather than the table name. The name
// is measured rather than counted, which lets a three-part name through.
const matchAlterTableAddHead = (tokens: Token[]) => {
  const alterTable = isAlterTable(tokens);
  const isOnly = isOnlyValue(tokens);
  const isAdd = isAddValue(tokens);
  const isConstraint = isConstraintValue(tokens);
  const isString = isStringToken(tokens);
  const qualifiedName = matchQualifiedName(tokens);

  // ONLY is optional, and it is also a legal table name: both readings are
  // tried, the one that reaches ADD wins.
  const fromName = (pos: number, start: number) => {
    let cursor = start;

    const name = qualifiedName(cursor);
    if (!name) return 0;
    cursor += name;

    if (!isAdd(cursor)) return 0;
    cursor++;

    if (isConstraint(cursor) && isString(cursor + 1)) {
      cursor += 2;
    }

    return cursor - pos;
  };

  return (pos: number) => {
    if (!alterTable(pos)) return { length: 0, only: false };

    const start = pos + 2;

    if (isOnly(start)) {
      const length = fromName(pos, start + 1);
      if (length) return { length, only: true };
    }

    return { length: fromName(pos, start), only: false };
  };
};

const matchAlterTableAdd = (tokens: Token[]) => {
  const head = matchAlterTableAddHead(tokens);
  return (pos: number) => head(pos).length;
};

// Whether the head at pos spends a token on the ONLY keyword. only is also
// a legal table name, and the statement parsers have to skip exactly what the
// matcher read.
export const isAlterTableAddOnly = (tokens: Token[]) => {
  const head = matchAlterTableAddHead(tokens);
  return (pos: number) => head(pos).only;
};

export const isAlterTableAddPrimaryKey = (tokens: Token[]) => {
  const alterTableAdd = matchAlterTableAdd(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isKey = isKeyValue(tokens);

  return (pos: number) => {
    const length = alterTableAdd(pos);
    return length > 0 && isPrimary(pos + length) && isKey(pos + length + 1);
  };
};

export const isAlterTableAddForeignKey = (tokens: Token[]) => {
  const alterTableAdd = matchAlterTableAdd(tokens);
  const isForeign = isForeignValue(tokens);
  const isKey = isKeyValue(tokens);

  return (pos: number) => {
    const length = alterTableAdd(pos);
    return length > 0 && isForeign(pos + length) && isKey(pos + length + 1);
  };
};

export const isAlterTableAddUnique = (tokens: Token[]) => {
  const alterTableAdd = matchAlterTableAdd(tokens);
  const isUnique = isUniqueValue(tokens);

  return (pos: number) => {
    const length = alterTableAdd(pos);
    return length > 0 && isUnique(pos + length);
  };
};

const DataTypes: ReadonlyArray<string> = Array.from(
  new Set(
    [
      ...DatabricksTypes,
      ...MariaDBTypes,
      ...MSSQLTypes,
      ...MySQLTypes,
      ...OracleTypes,
      ...PostgreSQLTypes,
      ...SnowflakeTypes,
      ...SQLiteTypes,
    ].map(type => type.toUpperCase())
  )
);

// A multi-word type reaches the parser as one token per word, so it is matched
// word by word. Candidates are grouped by their first word and tried longest
// first: TIMESTAMP WITH TIME ZONE has to win over TIMESTAMP.
const groupByFirstWord = (types: ReadonlyArray<string>) => {
  const groups = new Map<string, string[][]>();

  for (const type of types) {
    const words = type.split(' ');
    const candidates = groups.get(words[0]) ?? [];
    candidates.push(words);
    groups.set(words[0], candidates);
  }

  for (const candidates of groups.values()) {
    candidates.sort((a, b) => b.length - a.length);
  }

  return groups;
};

const DataTypeWords = groupByFirstWord(DataTypes);

// How many tokens the data type at pos spans, 0 when there is none. The
// argument list is part of the span, and it can sit on any word of a
// multi-word name -- TIMESTAMP(3) WITH TIME ZONE.
export const matchDataType = (tokens: Token[]) => {
  const isString = isStringToken(tokens);
  const isLeftParent = isLeftParentToken(tokens);
  const isRightParent = isRightParentToken(tokens);

  const skipArguments = (pos: number) => {
    let depth = 0;

    for (let cursor = pos; cursor < tokens.length; cursor++) {
      if (isLeftParent(cursor)) {
        depth++;
      } else if (isRightParent(cursor)) {
        depth--;
        if (depth === 0) return cursor + 1;
      }
    }

    // Unterminated: the permissive parser takes the rest as the argument list.
    return tokens.length;
  };

  const matchWords = (pos: number, words: string[]) => {
    let cursor = pos;

    for (const [index, word] of words.entries()) {
      const token = tokens[cursor];
      // Only the first word may be quoted: [int] is how T-SQL writes a type,
      // but a quoted continuation word is an identifier, never a keyword.
      if (!token || !isString(cursor) || (index > 0 && token.quoted)) return 0;
      if (token.value.toUpperCase() !== word) return 0;

      cursor++;

      if (isLeftParent(cursor)) {
        cursor = skipArguments(cursor);
      }
    }

    return cursor - pos;
  };

  return (pos: number) => {
    const token = tokens[pos];
    if (!token || !isString(pos)) return 0;

    const value = token.value.toUpperCase();

    for (const words of DataTypeWords.get(value) ?? []) {
      const length = matchWords(pos, words);
      if (length) return length;
    }

    // A whole multi-word name also arrives as one token when it is quoted.
    return DataTypes.includes(value) ? 1 : 0;
  };
};

export const isDataType = (tokens: Token[]) => {
  const matchType = matchDataType(tokens);
  return (pos: number) => matchType(pos) > 0;
};
