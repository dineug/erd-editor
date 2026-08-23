import { MariaDBTypes } from '@/parser/dataType/MariaDB';
import { MSSQLTypes } from '@/parser/dataType/MSSQL';
import { MySQLTypes } from '@/parser/dataType/MySQL';
import { OracleTypes } from '@/parser/dataType/Oracle';
import { PostgreSQLTypes } from '@/parser/dataType/PostgreSQL';
import { SQLiteTypes } from '@/parser/dataType/SQLite';
import { Token, TokenType } from '@/parser/tokenizer';

const createTypeEqual = (type: string) => (tokens: Token[]) => (pos: number) =>
  tokens[pos] ? tokens[pos].type === type : false;

// A quoted token is always an identifier, never a keyword: `key` is a column
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

export const isAutoIncrementValue = (tokens: Token[]) => {
  const isAuto_increment = isAuto_incrementValue(tokens);
  const isAutoincrement = isAutoincrementValue(tokens);
  return (pos: number) => isAuto_increment(pos) || isAutoincrement(pos);
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

export const isCreateTableIfNotExists = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isTable = isTableValue(tokens);
  const isIf = isIfValue(tokens);
  const isNot = isNotValue(tokens);
  const isExists = isExistsValue(tokens);
  return (pos: number) =>
    isCreate(pos) &&
    isTable(pos + 1) &&
    isIf(pos + 2) &&
    isNot(pos + 3) &&
    isExists(pos + 4);
};

export const isCharacterSet = (tokens: Token[]) => {
  const isCharacter = isCharacterValue(tokens);
  const isSet = isSetValue(tokens);
  return (pos: number) => isCharacter(pos) && isSet(pos + 1);
};

export const isCreateTable = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isTable = isTableValue(tokens);
  return (pos: number) => isCreate(pos) && isTable(pos + 1);
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

export const isAlterTableOnlyAddPrimaryKey = (tokens: Token[]) => {
  const alterTableOnly = isAlterTableOnly(tokens);
  const isAdd = isAddValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isKey = isKeyValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 4) &&
    isPrimary(pos + 5) &&
    isKey(pos + 6);

  const expression2 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 4) &&
    isConstraint(pos + 5) &&
    isPrimary(pos + 7) &&
    isKey(pos + 8);

  const expression3 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 6) &&
    isPrimary(pos + 7) &&
    isKey(pos + 8);

  const expression4 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 6) &&
    isConstraint(pos + 7) &&
    isPrimary(pos + 9) &&
    isKey(pos + 10);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos);
};

export const isAlterTableAddPrimaryKey = (tokens: Token[]) => {
  const alterTableOnlyAddPrimaryKey = isAlterTableOnlyAddPrimaryKey(tokens);
  const alterTable = isAlterTable(tokens);
  const isAdd = isAddValue(tokens);
  const isPrimary = isPrimaryValue(tokens);
  const isKey = isKeyValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 3) && isPrimary(pos + 4) && isKey(pos + 5);

  const expression2 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 3) &&
    isConstraint(pos + 4) &&
    isPrimary(pos + 6) &&
    isKey(pos + 7);

  const expression3 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 5) && isPrimary(pos + 6) && isKey(pos + 7);

  const expression4 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 5) &&
    isConstraint(pos + 6) &&
    isPrimary(pos + 8) &&
    isKey(pos + 9);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos) ||
    alterTableOnlyAddPrimaryKey(pos);
};

export const isAlterTableOnlyAddForeignKey = (tokens: Token[]) => {
  const alterTableOnly = isAlterTableOnly(tokens);
  const isAdd = isAddValue(tokens);
  const isForeign = isForeignValue(tokens);
  const isKey = isKeyValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 4) &&
    isForeign(pos + 5) &&
    isKey(pos + 6);

  const expression2 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 4) &&
    isConstraint(pos + 5) &&
    isForeign(pos + 7) &&
    isKey(pos + 8);

  const expression3 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 6) &&
    isForeign(pos + 7) &&
    isKey(pos + 8);

  const expression4 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 6) &&
    isConstraint(pos + 7) &&
    isForeign(pos + 9) &&
    isKey(pos + 10);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos);
};

export const isAlterTableAddForeignKey = (tokens: Token[]) => {
  const alterTableOnlyAddForeignKey = isAlterTableOnlyAddForeignKey(tokens);
  const alterTable = isAlterTable(tokens);
  const isAdd = isAddValue(tokens);
  const isForeign = isForeignValue(tokens);
  const isKey = isKeyValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 3) && isForeign(pos + 4) && isKey(pos + 5);

  const expression2 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 3) &&
    isConstraint(pos + 4) &&
    isForeign(pos + 6) &&
    isKey(pos + 7);

  const expression3 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 5) && isForeign(pos + 6) && isKey(pos + 7);

  const expression4 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 5) &&
    isConstraint(pos + 6) &&
    isForeign(pos + 8) &&
    isKey(pos + 9);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos) ||
    alterTableOnlyAddForeignKey(pos);
};

export const isAlterTableOnlyAddUnique = (tokens: Token[]) => {
  const alterTableOnly = isAlterTableOnly(tokens);
  const isAdd = isAddValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTableOnly(pos) && isAdd(pos + 4) && isUnique(pos + 5);

  const expression2 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 4) &&
    isConstraint(pos + 5) &&
    isUnique(pos + 7);

  const expression3 = (pos: number) =>
    alterTableOnly(pos) && isAdd(pos + 6) && isUnique(pos + 7);

  const expression4 = (pos: number) =>
    alterTableOnly(pos) &&
    isAdd(pos + 6) &&
    isConstraint(pos + 7) &&
    isUnique(pos + 9);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos);
};

export const isAlterTableAddUnique = (tokens: Token[]) => {
  const alterTableOnlyAddUnique = isAlterTableOnlyAddUnique(tokens);
  const alterTable = isAlterTable(tokens);
  const isAdd = isAddValue(tokens);
  const isUnique = isUniqueValue(tokens);
  const isConstraint = isConstraintValue(tokens);

  const expression1 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 3) && isUnique(pos + 4);

  const expression2 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 3) &&
    isConstraint(pos + 4) &&
    isUnique(pos + 6);

  const expression3 = (pos: number) =>
    alterTable(pos) && isAdd(pos + 5) && isUnique(pos + 6);

  const expression4 = (pos: number) =>
    alterTable(pos) &&
    isAdd(pos + 5) &&
    isConstraint(pos + 6) &&
    isUnique(pos + 8);

  return (pos: number) =>
    expression1(pos) ||
    expression2(pos) ||
    expression3(pos) ||
    expression4(pos) ||
    alterTableOnlyAddUnique(pos);
};

const DataTypes: ReadonlyArray<string> = Array.from(
  new Set(
    [
      ...MariaDBTypes,
      ...MSSQLTypes,
      ...MySQLTypes,
      ...OracleTypes,
      ...PostgreSQLTypes,
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

// How many tokens the data type at `pos` spans, 0 when there is none. The
// argument list is part of the span, and it can sit on any word of a
// multi-word name -- `TIMESTAMP(3) WITH TIME ZONE`.
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
      // Only the first word may be quoted: `[int]` is how T-SQL writes a type,
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
