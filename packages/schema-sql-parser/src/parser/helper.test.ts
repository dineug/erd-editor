import { describe, expect, it } from 'vite-plus/test';

import {
  isAddValue,
  isAlterTable,
  isAlterTableAddForeignKey,
  isAlterTableAddPrimaryKey,
  isAlterTableAddUnique,
  isAlterTableOnly,
  isAlterTableOnlyAddForeignKey,
  isAlterTableOnlyAddPrimaryKey,
  isAlterTableOnlyAddUnique,
  isAlterValue,
  isAscValue,
  isAuto_incrementValue,
  isAutoIncrementValue,
  isAutoincrementValue,
  isCommaToken,
  isCommentValue,
  isConstraintValue,
  isCreateIndex,
  isCreateTable,
  isCreateTableIfNotExists,
  isCreateUniqueIndex,
  isCreateValue,
  isDataType,
  isDefaultValue,
  isDeleteValue,
  isDescValue,
  isDropValue,
  isEqualToken,
  isExistsValue,
  isForeignValue,
  isIfValue,
  isIndexValue,
  isKeyValue,
  isLeftBracketToken,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isNullValue,
  isOnlyValue,
  isOnValue,
  isPeriodToken,
  isPrimaryValue,
  isReferencesValue,
  isRenameValue,
  isRightBracketToken,
  isRightParentToken,
  isSelectValue,
  isSemicolonToken,
  isStringToken,
  isTableValue,
  isUniqueValue,
  isUseValue,
} from '@/parser/helper';
import { Token, TokenType } from '@/parser/tokenizer';

const str = (value: string): Token => ({ type: TokenType.string, value });
const words = (...values: string[]): Token[] => values.map(str);
const period: Token = { type: TokenType.period, value: '.' };

describe('token type predicates', () => {
  const cases: Array<
    [string, (tokens: Token[]) => (pos: number) => boolean, TokenType]
  > = [
    ['isStringToken', isStringToken, TokenType.string],
    ['isEqualToken', isEqualToken, TokenType.equal],
    ['isPeriodToken', isPeriodToken, TokenType.period],
    ['isCommaToken', isCommaToken, TokenType.comma],
    ['isSemicolonToken', isSemicolonToken, TokenType.semicolon],
    ['isLeftParentToken', isLeftParentToken, TokenType.leftParent],
    ['isRightParentToken', isRightParentToken, TokenType.rightParent],
    ['isLeftBracketToken', isLeftBracketToken, TokenType.leftBracket],
    ['isRightBracketToken', isRightBracketToken, TokenType.rightBracket],
  ];

  it.each(cases)(
    '%s matches only its own token type',
    (_name, predicate, type) => {
      const tokens: Token[] = [{ type, value: 'x' }, str('other')];
      const test = predicate(tokens);

      expect(test(0)).toBe(true);
      expect(test(1)).toBe(type === TokenType.string);
    }
  );

  it.each(cases)(
    '%s returns false past the end of the token list',
    (_name, predicate) => {
      const test = predicate([str('a')]);

      expect(test(1)).toBe(false);
      expect(test(99)).toBe(false);
    }
  );

  it('returns false for a negative position', () => {
    expect(isStringToken([str('a')])(-1)).toBe(false);
  });
});

describe('token value predicates', () => {
  const cases: Array<
    [string, (tokens: Token[]) => (pos: number) => boolean, string]
  > = [
    ['isCreateValue', isCreateValue, 'CREATE'],
    ['isAlterValue', isAlterValue, 'ALTER'],
    ['isDropValue', isDropValue, 'DROP'],
    ['isUseValue', isUseValue, 'USE'],
    ['isRenameValue', isRenameValue, 'RENAME'],
    ['isDeleteValue', isDeleteValue, 'DELETE'],
    ['isSelectValue', isSelectValue, 'SELECT'],
    ['isTableValue', isTableValue, 'TABLE'],
    ['isIndexValue', isIndexValue, 'INDEX'],
    ['isUniqueValue', isUniqueValue, 'UNIQUE'],
    ['isAddValue', isAddValue, 'ADD'],
    ['isPrimaryValue', isPrimaryValue, 'PRIMARY'],
    ['isKeyValue', isKeyValue, 'KEY'],
    ['isConstraintValue', isConstraintValue, 'CONSTRAINT'],
    ['isForeignValue', isForeignValue, 'FOREIGN'],
    ['isNotValue', isNotValue, 'NOT'],
    ['isNullValue', isNullValue, 'NULL'],
    ['isDefaultValue', isDefaultValue, 'DEFAULT'],
    ['isCommentValue', isCommentValue, 'COMMENT'],
    ['isReferencesValue', isReferencesValue, 'REFERENCES'],
    ['isAscValue', isAscValue, 'ASC'],
    ['isDescValue', isDescValue, 'DESC'],
    ['isOnValue', isOnValue, 'ON'],
    ['isAuto_incrementValue', isAuto_incrementValue, 'AUTO_INCREMENT'],
    ['isAutoincrementValue', isAutoincrementValue, 'AUTOINCREMENT'],
    ['isIfValue', isIfValue, 'IF'],
    ['isExistsValue', isExistsValue, 'EXISTS'],
    ['isOnlyValue', isOnlyValue, 'ONLY'],
  ];

  it.each(cases)(
    '%s matches its keyword case insensitively',
    (_name, predicate, keyword) => {
      const tokens = words(keyword.toLowerCase(), keyword, 'nope');
      const test = predicate(tokens);

      expect(test(0)).toBe(true);
      expect(test(1)).toBe(true);
      expect(test(2)).toBe(false);
    }
  );

  it.each(cases)(
    '%s returns false past the end of the token list',
    (_name, predicate) => {
      expect(predicate([])(0)).toBe(false);
    }
  );

  it('ignores the token type and only compares the value', () => {
    const tokens: Token[] = [{ type: TokenType.comma, value: 'create' }];

    expect(isCreateValue(tokens)(0)).toBe(true);
  });
});

describe('isAutoIncrementValue', () => {
  it('accepts both the underscored and the plain spelling', () => {
    const tokens = words('AUTO_INCREMENT', 'autoincrement', 'INCREMENT');
    const test = isAutoIncrementValue(tokens);

    expect(test(0)).toBe(true);
    expect(test(1)).toBe(true);
    expect(test(2)).toBe(false);
    expect(test(3)).toBe(false);
  });
});

describe('isNewStatement', () => {
  it.each(['CREATE', 'ALTER', 'DROP', 'USE', 'RENAME', 'DELETE', 'SELECT'])(
    'treats %s as the start of a new statement',
    keyword => {
      expect(isNewStatement(words(keyword))(0)).toBe(true);
      expect(isNewStatement(words(keyword.toLowerCase()))(0)).toBe(true);
    }
  );

  it('rejects any other keyword or a missing token', () => {
    const tokens = words('COMMENT', 'TABLE');
    const test = isNewStatement(tokens);

    expect(test(0)).toBe(false);
    expect(test(1)).toBe(false);
    expect(test(2)).toBe(false);
  });
});

describe('isCreateTable', () => {
  it('matches CREATE TABLE at the given position', () => {
    const tokens = words(';', 'create', 'table', 'user');

    expect(isCreateTable(tokens)(1)).toBe(true);
    expect(isCreateTable(tokens)(0)).toBe(false);
  });

  it('rejects CREATE followed by another keyword', () => {
    expect(isCreateTable(words('CREATE', 'INDEX'))(0)).toBe(false);
  });

  it('rejects a non CREATE token', () => {
    expect(isCreateTable(words('ALTER', 'TABLE'))(0)).toBe(false);
  });
});

describe('isCreateTableIfNotExists', () => {
  it('matches the full CREATE TABLE IF NOT EXISTS prefix', () => {
    const tokens = words('CREATE', 'TABLE', 'IF', 'NOT', 'EXISTS', 'user');

    expect(isCreateTableIfNotExists(tokens)(0)).toBe(true);
  });

  it('is case insensitive', () => {
    const tokens = words('create', 'table', 'if', 'not', 'exists', 'user');

    expect(isCreateTableIfNotExists(tokens)(0)).toBe(true);
  });

  it.each([
    ['ALTER', 'TABLE', 'IF', 'NOT', 'EXISTS'],
    ['CREATE', 'INDEX', 'IF', 'NOT', 'EXISTS'],
    ['CREATE', 'TABLE', 'user', 'NOT', 'EXISTS'],
    ['CREATE', 'TABLE', 'IF', 'user', 'EXISTS'],
    ['CREATE', 'TABLE', 'IF', 'NOT', 'user'],
    ['CREATE', 'TABLE'],
  ])('rejects %s %s %s %s %s', (...values) => {
    expect(isCreateTableIfNotExists(words(...values))(0)).toBe(false);
  });
});

describe('isCreateUniqueIndex', () => {
  it('matches CREATE UNIQUE INDEX', () => {
    const tokens = words('CREATE', 'UNIQUE', 'INDEX', 'idx');

    expect(isCreateUniqueIndex(tokens)(0)).toBe(true);
  });

  it.each([
    ['CREATE', 'INDEX', 'idx'],
    ['CREATE', 'UNIQUE', 'idx'],
    ['ALTER', 'UNIQUE', 'INDEX'],
  ])('rejects %s %s %s', (...values) => {
    expect(isCreateUniqueIndex(words(...values))(0)).toBe(false);
  });
});

describe('isCreateIndex', () => {
  it('matches CREATE INDEX', () => {
    expect(isCreateIndex(words('CREATE', 'INDEX', 'idx'))(0)).toBe(true);
  });

  it('matches CREATE UNIQUE INDEX through the unique branch', () => {
    expect(isCreateIndex(words('CREATE', 'UNIQUE', 'INDEX', 'idx'))(0)).toBe(
      true
    );
  });

  it('rejects CREATE TABLE', () => {
    expect(isCreateIndex(words('CREATE', 'TABLE', 'user'))(0)).toBe(false);
  });

  it('rejects a non CREATE token', () => {
    expect(isCreateIndex(words('DROP', 'INDEX', 'idx'))(0)).toBe(false);
  });
});

describe('isAlterTable', () => {
  it('matches ALTER TABLE', () => {
    expect(isAlterTable(words('ALTER', 'TABLE', 'user'))(0)).toBe(true);
  });

  it('rejects ALTER followed by another keyword', () => {
    expect(isAlterTable(words('ALTER', 'INDEX'))(0)).toBe(false);
  });

  it('rejects CREATE TABLE', () => {
    expect(isAlterTable(words('CREATE', 'TABLE'))(0)).toBe(false);
  });
});

describe('isAlterTableOnly', () => {
  it('matches ALTER TABLE ONLY', () => {
    expect(isAlterTableOnly(words('ALTER', 'TABLE', 'ONLY', 'user'))(0)).toBe(
      true
    );
  });

  it('rejects ALTER TABLE without ONLY', () => {
    expect(isAlterTableOnly(words('ALTER', 'TABLE', 'user'))(0)).toBe(false);
  });

  it('rejects when the statement is not ALTER TABLE', () => {
    expect(isAlterTableOnly(words('ALTER', 'INDEX', 'ONLY'))(0)).toBe(false);
  });
});

describe('isAlterTableOnlyAddPrimaryKey', () => {
  it('matches ALTER TABLE ONLY name ADD PRIMARY KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE ONLY name ADD CONSTRAINT pk PRIMARY KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'CONSTRAINT',
      'pk_user',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD PRIMARY KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'pk_user', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('rejects ALTER TABLE ONLY name ADD FOREIGN KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'FOREIGN',
      'KEY'
    );

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(false);
  });

  it('rejects when ONLY is missing', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'PRIMARY', 'KEY');

    expect(isAlterTableOnlyAddPrimaryKey(tokens)(0)).toBe(false);
  });
});

describe('isAlterTableAddPrimaryKey', () => {
  it('matches ALTER TABLE name ADD PRIMARY KEY', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'PRIMARY', 'KEY');

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE name ADD CONSTRAINT pk PRIMARY KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'user',
      'ADD',
      'CONSTRAINT',
      'pk_user',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE public.user ADD PRIMARY KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'pk_user', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('falls back to the ONLY variant', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('rejects an ADD UNIQUE statement', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'UNIQUE', 'name');

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(false);
  });

  it('rejects an empty token list', () => {
    expect(isAlterTableAddPrimaryKey([])(0)).toBe(false);
  });
});

describe('isAlterTableOnlyAddForeignKey', () => {
  it('matches ALTER TABLE ONLY name ADD FOREIGN KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'FOREIGN',
      'KEY'
    );

    expect(isAlterTableOnlyAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE ONLY name ADD CONSTRAINT fk FOREIGN KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'CONSTRAINT',
      'fk_user',
      'FOREIGN',
      'KEY'
    );

    expect(isAlterTableOnlyAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD FOREIGN KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableOnlyAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'fk_user', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableOnlyAddForeignKey(tokens)(0)).toBe(true);
  });

  it('rejects the primary key variant', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableOnlyAddForeignKey(tokens)(0)).toBe(false);
  });
});

describe('isAlterTableAddForeignKey', () => {
  it('matches ALTER TABLE name ADD FOREIGN KEY', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'FOREIGN', 'KEY');

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE name ADD CONSTRAINT fk FOREIGN KEY', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'user',
      'ADD',
      'CONSTRAINT',
      'fk_user',
      'FOREIGN',
      'KEY'
    );

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE public.user ADD FOREIGN KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'fk_user', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('falls back to the ONLY variant', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'FOREIGN',
      'KEY'
    );

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('rejects an ADD PRIMARY KEY statement', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'PRIMARY', 'KEY');

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(false);
  });
});

describe('isAlterTableOnlyAddUnique', () => {
  it('matches ALTER TABLE ONLY name ADD UNIQUE', () => {
    const tokens = words('ALTER', 'TABLE', 'ONLY', 'user', 'ADD', 'UNIQUE');

    expect(isAlterTableOnlyAddUnique(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE ONLY name ADD CONSTRAINT uq UNIQUE', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'CONSTRAINT',
      'uq_user',
      'UNIQUE'
    );

    expect(isAlterTableOnlyAddUnique(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD UNIQUE', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'UNIQUE'),
    ];

    expect(isAlterTableOnlyAddUnique(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'uq_user', 'UNIQUE'),
    ];

    expect(isAlterTableOnlyAddUnique(tokens)(0)).toBe(true);
  });

  it('rejects the primary key variant', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'ONLY',
      'user',
      'ADD',
      'PRIMARY',
      'KEY'
    );

    expect(isAlterTableOnlyAddUnique(tokens)(0)).toBe(false);
  });
});

describe('isAlterTableAddUnique', () => {
  it('matches ALTER TABLE name ADD UNIQUE', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'UNIQUE');

    expect(isAlterTableAddUnique(tokens)(0)).toBe(true);
  });

  it('matches ALTER TABLE name ADD CONSTRAINT uq UNIQUE', () => {
    const tokens = words(
      'ALTER',
      'TABLE',
      'user',
      'ADD',
      'CONSTRAINT',
      'uq_user',
      'UNIQUE'
    );

    expect(isAlterTableAddUnique(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE public.user ADD UNIQUE', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'UNIQUE'),
    ];

    expect(isAlterTableAddUnique(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'uq_user', 'UNIQUE'),
    ];

    expect(isAlterTableAddUnique(tokens)(0)).toBe(true);
  });

  it('falls back to the ONLY variant', () => {
    const tokens = words('ALTER', 'TABLE', 'ONLY', 'user', 'ADD', 'UNIQUE');

    expect(isAlterTableAddUnique(tokens)(0)).toBe(true);
  });

  it('rejects an ADD PRIMARY KEY statement', () => {
    const tokens = words('ALTER', 'TABLE', 'user', 'ADD', 'PRIMARY', 'KEY');

    expect(isAlterTableAddUnique(tokens)(0)).toBe(false);
  });
});

describe('isDataType', () => {
  it('accepts a known data type regardless of case', () => {
    const tokens = words('INT', 'varchar', 'Boolean');
    const test = isDataType(tokens);

    expect(test(0)).toBe(true);
    expect(test(1)).toBe(true);
    expect(test(2)).toBe(true);
  });

  it('accepts a multi word data type when it arrives as one token', () => {
    expect(isDataType([str('DOUBLE PRECISION')])(0)).toBe(true);
  });

  it('rejects an unknown data type', () => {
    expect(isDataType(words('notatype'))(0)).toBe(false);
  });

  it('rejects a token that is not a string token', () => {
    const tokens: Token[] = [{ type: TokenType.comma, value: 'INT' }];

    expect(isDataType(tokens)(0)).toBe(false);
  });

  it('rejects a position past the end of the token list', () => {
    expect(isDataType(words('INT'))(1)).toBe(false);
    expect(isDataType([])(0)).toBe(false);
  });

  it('merges the vendor type lists so vendor specific types are accepted', () => {
    const test = isDataType(
      words('NVARCHAR', 'VARCHAR2', 'JSONB', 'TEXT', 'MONEY')
    );

    expect([test(0), test(1), test(2), test(3), test(4)]).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });
});
