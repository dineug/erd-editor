import { MariaDBTypes } from '@/parser/dataType/MariaDB';
import { MSSQLTypes } from '@/parser/dataType/MSSQL';
import { MySQLTypes } from '@/parser/dataType/MySQL';
import { OracleTypes } from '@/parser/dataType/Oracle';
import { PostgreSQLTypes } from '@/parser/dataType/PostgreSQL';
import { SQLiteTypes } from '@/parser/dataType/SQLite';
import { Token, TokenType } from '@/parser/tokenizer';

const createTypeEqual = (type: string) => (tokens: Token[]) => (pos: number) =>
  tokens[pos] ? tokens[pos].type === type : false;

const createValueEqual = (type: string) => {
  const value = type.toUpperCase();
  return (tokens: Token[]) => (pos: number) =>
    tokens[pos] ? tokens[pos].value.toUpperCase() === value : false;
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

export const isAutoIncrementValue = (tokens: Token[]) => {
  const isAuto_increment = isAuto_incrementValue(tokens);
  const isAutoincrement = isAutoincrementValue(tokens);
  return (pos: number) => isAuto_increment(pos) || isAutoincrement(pos);
};

export const isNewStatement = (tokens: Token[]) => {
  const isCreate = isCreateValue(tokens);
  const isAlter = isAlterValue(tokens);
  const isDrop = isDropValue(tokens);
  const isUse = isUseValue(tokens);
  const isRename = isRenameValue(tokens);
  const isDelete = isDeleteValue(tokens);
  const isSelect = isSelectValue(tokens);
  return (pos: number) =>
    isCreate(pos) ||
    isAlter(pos) ||
    isDrop(pos) ||
    isUse(pos) ||
    isRename(pos) ||
    isDelete(pos) ||
    isSelect(pos);
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

export const isDataType = (tokens: Token[]) => {
  const isString = isStringToken(tokens);
  return (pos: number) => {
    const token = tokens[pos];
    return token
      ? isString(pos) && DataTypes.includes(token.value.toUpperCase())
      : false;
  };
};
