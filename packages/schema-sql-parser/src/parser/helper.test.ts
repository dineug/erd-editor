import { describe, expect, it } from 'vite-plus/test';

import {
  isAddValue,
  isAlterTable,
  isAlterTableAdd,
  isAlterTableAddForeignKey,
  isAlterTableAddOnly,
  isAlterTableAddPrimaryKey,
  isAlterTableOnly,
  isAlterValue,
  isAndValue,
  isArrayDimensionToken,
  isArrayValue,
  isAscValue,
  isAuto_incrementValue,
  isAutoIncrementValue,
  isAutoincrementValue,
  isCharacterSet,
  isCharacterValue,
  isCollateValue,
  isColumnValue,
  isCommaToken,
  isCommentOn,
  isCommentOnColumn,
  isCommentOnTable,
  isCommentValue,
  isConstraintValue,
  isCreateIndex,
  isCreateTable,
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
  isIndexKind,
  isIndexValue,
  isIsValue,
  isKeyValue,
  isLeftBracketToken,
  isLeftParentToken,
  isNewStatement,
  isNotValue,
  isNullFilter,
  isNullValue,
  isOnlyValue,
  isOnValue,
  isOrValue,
  isPeriodToken,
  isPrimaryValue,
  isReferencesValue,
  isRenameValue,
  isRightBracketToken,
  isRightParentToken,
  isSelectValue,
  isSemicolonToken,
  isSetValue,
  isStringToken,
  isTableItemWord,
  isTablespaceValue,
  isTableValue,
  isUniqueValue,
  isUseValue,
  isWhereValue,
  matchCreateIndex,
  matchCreateTable,
  matchDataType,
  matchKeyModifier,
  matchKeyModifiers,
  matchQualifiedName,
  matchReferentialClause,
  matchUserDataType,
  matchUsingIndexName,
  requote,
  toStringLiteral,
  unquoteTypeName,
} from '@/parser/helper';
import { Token, tokenizer, TokenType } from '@/parser/tokenizer';

const str = (value: string): Token => ({ type: TokenType.string, value });
const quoted = (value: string): Token => ({
  type: TokenType.string,
  value,
  quoted: '"',
});
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
    ['isTablespaceValue', isTablespaceValue, 'TABLESPACE'],
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
    ['isIsValue', isIsValue, 'IS'],
    ['isColumnValue', isColumnValue, 'COLUMN'],
    ['isCharacterValue', isCharacterValue, 'CHARACTER'],
    ['isSetValue', isSetValue, 'SET'],
    ['isCollateValue', isCollateValue, 'COLLATE'],
    ['isWhereValue', isWhereValue, 'WHERE'],
    ['isAndValue', isAndValue, 'AND'],
    ['isOrValue', isOrValue, 'OR'],
    ['isArrayValue', isArrayValue, 'ARRAY'],
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

  it.each(cases)(
    '%s never matches a quoted token',
    (_name, predicate, keyword) => {
      expect(predicate([quoted(keyword)])(0)).toBe(false);
    }
  );

  it('ignores the token type and only compares the value', () => {
    const tokens: Token[] = [{ type: TokenType.comma, value: 'create' }];

    expect(isCreateValue(tokens)(0)).toBe(true);
  });

  it('reads a quoted keyword as an identifier, not as the keyword', () => {
    expect(isKeyValue([quoted('key')])(0)).toBe(false);
    expect(isKeyValue(words('key'))(0)).toBe(true);
  });
});

describe('isCommentOn', () => {
  it('matches any COMMENT ON target', () => {
    const test = isCommentOn(words('COMMENT', 'ON', 'SCHEMA'));

    expect(test(0)).toBe(true);
  });

  it('rejects a MySQL table option', () => {
    expect(isCommentOn(words('COMMENT', 'a comment'))(0)).toBe(false);
  });

  it('rejects a quoted comment value that reads ON', () => {
    expect(isCommentOn([str('COMMENT'), quoted('ON'), str('TABLE')])(0)).toBe(
      false
    );
  });
});

describe('isCommentOnTable', () => {
  it('matches the COMMENT ON TABLE prefix', () => {
    expect(isCommentOnTable(words('COMMENT', 'ON', 'TABLE', 'users'))(0)).toBe(
      true
    );
  });

  it('rejects the COMMENT ON COLUMN prefix', () => {
    expect(isCommentOnTable(words('COMMENT', 'ON', 'COLUMN'))(0)).toBe(false);
  });

  it('rejects a MySQL table option', () => {
    expect(isCommentOnTable(words('COMMENT', 'a comment'))(0)).toBe(false);
  });

  it('rejects a position past the end of the token list', () => {
    expect(isCommentOnTable(words('COMMENT', 'ON'))(0)).toBe(false);
  });
});

describe('isCommentOnColumn', () => {
  it('matches the COMMENT ON COLUMN prefix', () => {
    expect(
      isCommentOnColumn(words('COMMENT', 'ON', 'COLUMN', 'users'))(0)
    ).toBe(true);
  });

  it('rejects the COMMENT ON TABLE prefix', () => {
    expect(isCommentOnColumn(words('COMMENT', 'ON', 'TABLE'))(0)).toBe(false);
  });

  it('rejects a position past the end of the token list', () => {
    expect(isCommentOnColumn(words('COMMENT', 'ON'))(0)).toBe(false);
  });
});

describe('isCharacterSet', () => {
  it('matches the CHARACTER SET column attribute', () => {
    expect(isCharacterSet(words('CHARACTER', 'SET', 'utf8mb3'))(0)).toBe(true);
  });

  it('rejects the CHARACTER VARYING data type', () => {
    expect(isCharacterSet(words('CHARACTER', 'VARYING'))(0)).toBe(false);
  });

  it('rejects a position past the end of the token list', () => {
    expect(isCharacterSet(words('CHARACTER'))(0)).toBe(false);
  });
});

describe('matchReferentialClause', () => {
  it('spans ON DELETE or ON UPDATE together with its action', () => {
    const span = (sql: string) => matchReferentialClause(tokenizer(sql))(0);

    expect(span('ON DELETE SET NULL, b INT')).toBe(4);
    expect(span('on update set default')).toBe(4);
    expect(span('ON DELETE NO ACTION')).toBe(4);
    expect(span('ON UPDATE CASCADE')).toBe(3);
    expect(span('ON DELETE RESTRICT')).toBe(3);
    expect(span('MATCH SIMPLE ON DELETE CASCADE')).toBe(2);
  });

  it('leaves a value that is no referential action to the caller', () => {
    const span = (sql: string) => matchReferentialClause(tokenizer(sql))(0);

    expect(span('ON UPDATE CURRENT_TIMESTAMP')).toBe(2);
    expect(span('ON CONFLICT REPLACE')).toBe(0);
    expect(span('MATCH INT')).toBe(0);
  });

  it('rejects a quoted ON, which names a column', () => {
    expect(
      matchReferentialClause([quoted('on'), ...words('DELETE', 'CASCADE')])(0)
    ).toBe(0);
  });
});

describe('matchKeyModifier', () => {
  const span = (sql: string) => matchKeyModifier(tokenizer(sql))(0);

  it('spans what may stand between UNIQUE and its key list', () => {
    expect(span('NONCLUSTERED (a)')).toBe(1);
    expect(span('clustered (a)')).toBe(1);
    expect(span('USING BTREE (a)')).toBe(2);
    expect(span('NULLS DISTINCT (a)')).toBe(2);
    expect(span('nulls not distinct (a)')).toBe(3);
  });

  it('spans a USING whose method is missing by the keyword alone', () => {
    expect(span('USING (a)')).toBe(1);
  });

  it('leaves a name, a list and an incomplete NULLS to the caller', () => {
    expect(span('uq_a (a)')).toBe(0);
    expect(span('(a)')).toBe(0);
    expect(span('NULLS FIRST')).toBe(0);
    expect(span('NULLS NOT NULL')).toBe(0);
    expect(matchKeyModifier([quoted('clustered')])(0)).toBe(0);
  });
});

describe('matchKeyModifiers', () => {
  const span = (sql: string) => matchKeyModifiers(tokenizer(sql))(0);

  it('spans every modifier in a row, up to the first word none claims', () => {
    expect(span('CLUSTERED USING BTREE (a)')).toBe(3);
    expect(span('NULLS NOT DISTINCT uq_a (a)')).toBe(3);
    expect(span('uq_a NONCLUSTERED (a)')).toBe(0);
  });
});

describe('isIndexKind', () => {
  it('matches FULLTEXT or SPATIAL only before INDEX or KEY', () => {
    expect(isIndexKind(words('FULLTEXT', 'INDEX'))(0)).toBe(true);
    expect(isIndexKind(words('spatial', 'key'))(0)).toBe(true);
    expect(isIndexKind(words('spatial', 'GEOMETRY'))(0)).toBe(false);
    expect(isIndexKind([quoted('fulltext'), str('KEY')])(0)).toBe(false);
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

describe('isNewStatement - COMMENT ON', () => {
  it('treats COMMENT ON as the start of a new statement', () => {
    expect(isNewStatement(words('COMMENT', 'ON', 'TABLE'))(0)).toBe(true);
  });

  it('leaves a MySQL COMMENT table option alone', () => {
    expect(isNewStatement(words('COMMENT', 'a comment'))(0)).toBe(false);
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

  it('matches a header carrying OR REPLACE and a table kind', () => {
    expect(isCreateTable(words('CREATE', 'OR', 'REPLACE', 'TABLE'))(0)).toBe(
      true
    );
    expect(
      isCreateTable(words('create', 'or', 'replace', 'transient', 'table'))(0)
    ).toBe(true);
  });
});

describe('matchCreateTable', () => {
  it('spans CREATE TABLE', () => {
    expect(matchCreateTable(words('CREATE', 'TABLE', 'user'))(0)).toBe(2);
  });

  it('spans the IF NOT EXISTS prefix', () => {
    const tokens = words('CREATE', 'TABLE', 'IF', 'NOT', 'EXISTS', 'user');

    expect(matchCreateTable(tokens)(0)).toBe(5);
    expect(
      matchCreateTable(words('create', 'table', 'if', 'not', 'exists'))(0)
    ).toBe(5);
  });

  it('spans every modifier Snowflake writes between CREATE and TABLE', () => {
    expect(matchCreateTable(words('CREATE', 'OR', 'REPLACE', 'TABLE'))(0)).toBe(
      4
    );
    expect(
      matchCreateTable(
        words('create', 'or', 'replace', 'transient', 'table', 't')
      )(0)
    ).toBe(5);
    expect(matchCreateTable(words('CREATE', 'HYBRID', 'TABLE', 't'))(0)).toBe(
      3
    );
    expect(
      matchCreateTable(
        words(
          'CREATE',
          'OR',
          'REPLACE',
          'TEMPORARY',
          'TABLE',
          'IF',
          'NOT',
          'EXISTS'
        )
      )(0)
    ).toBe(8);
  });

  it('refuses a BigQuery table-valued function', () => {
    expect(
      matchCreateTable(tokenizer('CREATE OR REPLACE TABLE FUNCTION f(x INT)'))(
        0
      )
    ).toBe(0);
    expect(matchCreateTable(tokenizer('CREATE TABLE FUNCTION f()'))(0)).toBe(0);
  });

  it('refuses a word that is not a table modifier', () => {
    expect(matchCreateTable(words('CREATE', 'OR', 'REPLACE', 'VIEW'))(0)).toBe(
      0
    );
    expect(matchCreateTable(words('CREATE', 'INDEX'))(0)).toBe(0);
    expect(matchCreateTable(words('ALTER', 'TABLE'))(0)).toBe(0);
    expect(matchCreateTable(words('CREATE'))(0)).toBe(0);
  });

  it('refuses a quoted modifier, which is an identifier', () => {
    const tokens: Token[] = [
      { type: TokenType.string, value: 'CREATE' },
      { type: TokenType.string, value: 'OR', quoted: '"' },
      { type: TokenType.string, value: 'TABLE' },
    ];

    expect(matchCreateTable(tokens)(0)).toBe(0);
  });

  it.each([
    ['CREATE', 'TABLE', 'user', 'NOT', 'EXISTS'],
    ['CREATE', 'TABLE', 'IF', 'user', 'EXISTS'],
    ['CREATE', 'TABLE', 'IF', 'NOT', 'user'],
  ])(
    'stops before an incomplete IF NOT EXISTS: %s %s %s %s %s',
    (...values) => {
      expect(matchCreateTable(words(...values))(0)).toBe(2);
    }
  );
});

describe('matchCreateIndex', () => {
  it.each([
    [['CREATE', 'INDEX', 'idx'], 2],
    [['CREATE', 'UNIQUE', 'INDEX', 'idx'], 3],
    [['CREATE', 'NONCLUSTERED', 'INDEX', 'idx'], 3],
    [['CREATE', 'UNIQUE', 'CLUSTERED', 'INDEX', 'idx'], 4],
    [['CREATE', 'UNIQUE', 'NONCLUSTERED', 'INDEX', 'idx'], 4],
  ])('spans %j through INDEX', (values, span) => {
    expect(matchCreateIndex(words(...values))(0)).toBe(span);
  });

  it.each([
    ['CREATE', 'UNIQUE', 'idx'],
    ['CREATE', 'NONCLUSTERED', 'idx'],
    ['CREATE', 'CLUSTERED', 'UNIQUE', 'INDEX'],
    ['ALTER', 'UNIQUE', 'INDEX'],
  ])('rejects %s %s %s', (...values) => {
    expect(matchCreateIndex(words(...values))(0)).toBe(0);
  });

  it('reads a quoted clustering word as no keyword', () => {
    const tokens = [
      ...words('CREATE'),
      quoted('NONCLUSTERED'),
      ...words('INDEX'),
    ];

    expect(matchCreateIndex(tokens)(0)).toBe(0);
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

describe('matchQualifiedName', () => {
  it('spans one, two and three part names', () => {
    expect(matchQualifiedName(words('t'))(0)).toBe(1);
    expect(matchQualifiedName(tokenizer('schema.t'))(0)).toBe(3);
    expect(matchQualifiedName(tokenizer('db.schema.t'))(0)).toBe(5);
  });

  it('stops at a period with nothing after it', () => {
    expect(matchQualifiedName(tokenizer('db.'))(0)).toBe(1);
  });

  it('reports no name where there is no string token', () => {
    expect(matchQualifiedName(tokenizer('(id)'))(0)).toBe(0);
  });
});

describe('matchUsingIndexName', () => {
  const span = (sql: string) => matchUsingIndexName(tokenizer(sql))(0);

  it('spans USING INDEX and the possibly qualified name after it', () => {
    expect(span('USING INDEX ix ENABLE')).toBe(3);
    expect(span('using index "HR"."UQ_T_AB_IX" ENABLE')).toBe(5);
    expect(span('USING INDEX "TABLESPACE"')).toBe(3);
  });

  it('spans nothing where index properties or a group stand for the name', () => {
    expect(span('USING INDEX TABLESPACE "USERS"')).toBe(0);
    expect(span('USING INDEX pctfree 10 INITRANS 2')).toBe(0);
    expect(span('USING INDEX ENABLE')).toBe(0);
    expect(span('USING INDEX (CREATE INDEX ix ON t (a))')).toBe(0);
    expect(span('USING INDEX')).toBe(0);
    expect(span('USING BTREE')).toBe(0);
    expect(span('INDEX ix')).toBe(0);
  });
});

describe('isNullFilter', () => {
  const filters = (sql: string) => isNullFilter(tokenizer(sql))(0, ['a', 'B']);

  it('accepts key IS NOT NULL over key columns, AND-joined, in any parentheses', () => {
    expect(filters('WHERE a IS NOT NULL')).toBe(true);
    expect(filters('where "A" is not null and b IS NOT NULL;')).toBe(true);
    expect(
      filters(
        'WHERE ([a] IS NOT NULL AND ([b] IS NOT NULL)) WITH (FILLFACTOR = 80)'
      )
    ).toBe(true);
    expect(filters('WHERE (a IS NOT NULL) AND b IS NOT NULL)')).toBe(true);
  });

  it('refuses any other filter, and a position with no WHERE', () => {
    expect(filters('WHERE c IS NOT NULL')).toBe(false);
    expect(filters('WHERE a IS NULL')).toBe(false);
    expect(filters('WHERE (active)')).toBe(false);
    expect(filters('WHERE a IS NOT NULL AND b > 0')).toBe(false);
    expect(filters('WHERE a IS NOT NULL OR b IS NOT NULL')).toBe(false);
    expect(filters('WHERE (a IS NOT NULL) OR (b IS NOT NULL)')).toBe(false);
    expect(filters('WHERE (a IS NOT NULL OR b > 0)')).toBe(false);
    expect(filters('WHERE a IS NOT "NULL"')).toBe(false);
    expect(filters('a IS NOT NULL')).toBe(false);
    expect(filters('WHERE')).toBe(false);
  });
});

describe('a table literally named only', () => {
  it('is read as the name when ONLY leads nowhere', () => {
    const tokens = tokenizer('ALTER TABLE only ADD PRIMARY KEY (id);');

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
    expect(isAlterTableAddOnly(tokens)(0)).toBe(false);
  });

  it('is read as the keyword when a name follows it', () => {
    const tokens = tokenizer('ALTER TABLE ONLY d.s.t ADD PRIMARY KEY (id);');

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
    expect(isAlterTableAddOnly(tokens)(0)).toBe(true);
  });
});

describe('a fully qualified ALTER TABLE target', () => {
  it.each([
    ['ALTER TABLE db.sch.t ADD PRIMARY KEY (id);', isAlterTableAddPrimaryKey],
    [
      'ALTER TABLE db.sch.t ADD FOREIGN KEY (a) REFERENCES db.sch.o (b);',
      isAlterTableAddForeignKey,
    ],
    ['ALTER TABLE db.sch.t ADD UNIQUE (a);', isAlterTableAdd],
    [
      'ALTER TABLE db.sch.t ADD CONSTRAINT pk PRIMARY KEY (id);',
      isAlterTableAddPrimaryKey,
    ],
    [
      'ALTER TABLE ONLY db.sch.t ADD CONSTRAINT pk PRIMARY KEY (id);',
      isAlterTableAddPrimaryKey,
    ],
  ])('matches %s', (sql, matcher) => {
    expect(matcher(tokenizer(sql))(0)).toBe(true);
  });
});

describe('isAlterTableAddPrimaryKey with ONLY', () => {
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

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
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

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD PRIMARY KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'pk_user', 'PRIMARY', 'KEY'),
    ];

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(true);
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

    expect(isAlterTableAddPrimaryKey(tokens)(0)).toBe(false);
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

describe('isAlterTableAddForeignKey with ONLY', () => {
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

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
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

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD FOREIGN KEY', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified variant with a named constraint', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'fk_user', 'FOREIGN', 'KEY'),
    ];

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(true);
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

    expect(isAlterTableAddForeignKey(tokens)(0)).toBe(false);
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

describe('isAlterTableAdd with ONLY', () => {
  it('matches ALTER TABLE ONLY name ADD UNIQUE', () => {
    const tokens = words('ALTER', 'TABLE', 'ONLY', 'user', 'ADD', 'UNIQUE');

    expect(isAlterTableAdd(tokens)(0)).toBe(true);
  });

  it('matches a schema qualified ALTER TABLE ONLY public.user ADD', () => {
    const tokens = [
      ...words('ALTER', 'TABLE', 'ONLY', 'public'),
      period,
      ...words('user', 'ADD', 'CONSTRAINT', 'uq_user', 'UNIQUE'),
    ];

    expect(isAlterTableAdd(tokens)(0)).toBe(true);
  });
});

describe('isAlterTableAdd', () => {
  it.each([
    ['ALTER TABLE user ADD UNIQUE (a);'],
    ['ALTER TABLE user ADD CONSTRAINT uq_user UNIQUE (a);'],
    ['ALTER TABLE public.user ADD UNIQUE (a);'],
    ['ALTER TABLE user ADD PRIMARY KEY (id), ADD UNIQUE KEY uq (a, b);'],
    ['ALTER TABLE user ADD KEY idx (a), ADD UNIQUE KEY uq (a, b);'],
    ['ALTER TABLE user ADD COLUMN a INT;'],
  ])('matches %s', sql => {
    expect(isAlterTableAdd(tokenizer(sql))(0)).toBe(true);
  });

  it.each([
    ['ALTER TABLE user DROP COLUMN a;'],
    ['ALTER INDEX idx RENAME TO idx_2;'],
    ['CREATE TABLE user (a INT);'],
  ])('rejects %s', sql => {
    expect(isAlterTableAdd(tokenizer(sql))(0)).toBe(false);
  });
});

describe('a CONSTRAINT keyword with no symbol', () => {
  it.each([
    [
      'ALTER TABLE t ADD CONSTRAINT PRIMARY KEY (id);',
      isAlterTableAddPrimaryKey,
    ],
    [
      'ALTER TABLE t ADD CONSTRAINT FOREIGN KEY (a) REFERENCES o (b);',
      isAlterTableAddForeignKey,
    ],
  ])('leaves the key it opens to be matched: %s', (sql, matcher) => {
    expect(matcher(tokenizer(sql))(0)).toBe(true);
  });

  it('still reads a quoted symbol spelled like a keyword as the symbol', () => {
    expect(
      isAlterTableAddPrimaryKey(
        tokenizer('ALTER TABLE t ADD CONSTRAINT "UNIQUE" PRIMARY KEY (id);')
      )(0)
    ).toBe(true);
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

  it('accepts a multi word data type spread over one token per word', () => {
    expect(isDataType(tokenizer('DOUBLE PRECISION'))(0)).toBe(true);
    expect(isDataType(tokenizer('TIMESTAMP WITH TIME ZONE'))(0)).toBe(true);
  });

  it('rejects the continuation words of a multi word data type', () => {
    const test = isDataType(tokenizer('TIMESTAMP WITH LOCAL TIME ZONE'));

    expect([test(1), test(2), test(4)]).toEqual([false, false, false]);
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

  it('accepts the names only Databricks brings to the merged list', () => {
    const test = isDataType(
      words('STRING', 'TIMESTAMP_NTZ', 'VARIANT', 'VOID')
    );

    expect([test(0), test(1), test(2), test(3)]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });
});

describe('matchDataType', () => {
  const spanOf = (source: string) => matchDataType(tokenizer(source))(0);

  it('spans one token for a single word type', () => {
    expect(spanOf('INT')).toBe(1);
  });

  it('spans every word of a multi word type', () => {
    expect(spanOf('DOUBLE PRECISION')).toBe(2);
    expect(spanOf('LONG RAW')).toBe(2);
    expect(spanOf('TIMESTAMP WITH TIME ZONE')).toBe(4);
  });

  it('prefers the longest name sharing a first word', () => {
    expect(spanOf('TIMESTAMP WITH LOCAL TIME ZONE')).toBe(5);
    expect(spanOf('TIMESTAMP WITH TIME ZONE')).toBe(4);
    expect(spanOf('TIMESTAMP')).toBe(1);
  });

  it('falls back to the shorter name when the next word does not follow', () => {
    const tokens = tokenizer('DOUBLE, PRECISION INT');

    expect(matchDataType(tokens)(0)).toBe(1);
  });

  it('takes the argument list as part of the span', () => {
    expect(spanOf('VARCHAR(255)')).toBe(4);
    expect(spanOf('DECIMAL(10, 2)')).toBe(6);
  });

  it('takes an argument list sitting on a middle word', () => {
    expect(spanOf('TIMESTAMP(3) WITH TIME ZONE')).toBe(7);
  });

  it('takes the rest of the input when the argument list is unterminated', () => {
    expect(spanOf('VARCHAR(255')).toBe(3);
  });

  it('accepts a quoted first word, the way T-SQL writes [int]', () => {
    expect(matchDataType([quoted('int')])(0)).toBe(1);
  });

  it('rejects a quoted continuation word', () => {
    expect(matchDataType([str('DOUBLE'), quoted('PRECISION')])(0)).toBe(1);
  });

  it('returns zero when there is no data type at the position', () => {
    expect(spanOf('notatype')).toBe(0);
    expect(matchDataType([])(0)).toBe(0);
    expect(matchDataType(tokenizer('INT'))(1)).toBe(0);
  });
  it('takes an array suffix as part of the span', () => {
    expect(spanOf('integer[]')).toBe(2);
    expect(spanOf('text[3][3] NOT NULL')).toBe(3);
    expect(spanOf('VARCHAR(10) []')).toBe(5);
    expect(spanOf('integer ARRAY')).toBe(2);
    expect(spanOf('integer ARRAY[4][2]')).toBe(3);
    expect(spanOf('TIMESTAMP WITH TIME ZONE[]')).toBe(5);
    expect(matchDataType([quoted('DOUBLE PRECISION'), period])(0)).toBe(1);
  });

  it('leaves a bracket quoted name after the type out of the span', () => {
    expect(spanOf('[int] [name]')).toBe(1);
  });
});

describe('isArrayDimensionToken', () => {
  it('accepts an empty or numeric bracket quoted token', () => {
    const test = isArrayDimensionToken(tokenizer('[] [12] [a] "1" 1'));

    expect([0, 1, 2, 3, 4, 5].map(test)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('requote', () => {
  it('writes each quoted token back inside its own delimiters', () => {
    expect(
      tokenizer('`a` "b" \'c\' [d] e').map(token => requote(token))
    ).toEqual(['`a`', '"b"', "'c'", '[d]', 'e']);
  });

  it('doubles the quote a value holds', () => {
    expect(
      tokenizer('\'it\'\'s\' "a""b" `c``d`').map(token => requote(token))
    ).toEqual(["'it''s'", '"a""b"', '`c``d`']);
  });

  it('escapes the quote and backslash of a Databricks literal instead', () => {
    const tokens = tokenizer(
      "'it\\'s' 'a\\\\b' \"a\"\"b\" `c``d`",
      'Databricks'
    );

    expect(tokens.map(token => requote(token, 'Databricks'))).toEqual([
      "'it\\'s'",
      "'a\\\\b'",
      '"a""b"',
      '`c``d`',
    ]);
  });
});

describe('toStringLiteral', () => {
  it('doubles a quote, or escapes it and a backslash for Databricks', () => {
    expect(toStringLiteral("it's C:\\")).toBe("'it''s C:\\'");
    expect(toStringLiteral("it's C:\\", 'PostgreSQL')).toBe("'it''s C:\\'");
    expect(toStringLiteral("it's C:\\", 'Databricks')).toBe("'it\\'s C:\\\\'");
    expect(toStringLiteral('')).toBe("''");
  });
});

describe('unquoteTypeName', () => {
  it('drops the quotes of a listed name but those of "char" and "bit"', () => {
    expect(
      tokenizer('"char" "bit" "int4" "CHAR" [char] `bit` char').map(
        unquoteTypeName
      )
    ).toEqual(['"char"', '"bit"', 'int4', 'CHAR', 'char', 'bit', 'char']);
  });
});

describe('matchUserDataType', () => {
  const spanOf = (source: string) => matchUserDataType(tokenizer(source))(0);

  it('spans a single name the lists lack, quoted or not', () => {
    expect(spanOf('mood NOT NULL')).toBe(1);
    expect(spanOf('"My Type"')).toBe(1);
    expect(spanOf('[Phone]')).toBe(1);
  });

  it('spans every segment of a qualified name', () => {
    expect(spanOf('public.mood')).toBe(3);
    expect(spanOf('"public"."mood",')).toBe(3);
    expect(spanOf('db.dbo.Phone')).toBe(5);
    expect(spanOf('public.')).toBe(1);
  });

  it('spans the argument list and the array suffix', () => {
    expect(spanOf('halfvec(3) NOT NULL')).toBe(4);
    expect(spanOf("my_enum('a','b')")).toBe(6);
    expect(spanOf('public.mood[][]')).toBe(5);
    expect(spanOf('mood ARRAY[2]')).toBe(3);
    expect(spanOf('halfvec(3')).toBe(3);
  });

  it('joins the words the lists lack with the type that follows them', () => {
    expect(spanOf('UNSIGNED INTEGER NOT NULL')).toBe(2);
    expect(spanOf('FOO VARCHAR(10)')).toBe(5);
    expect(spanOf('UNSIGNED BIG INTEGER,')).toBe(3);
    expect(spanOf('SIGNED BIG INT(5)')).toBe(6);
    expect(spanOf('"x" INT')).toBe(1);
    expect(spanOf('money.amount')).toBe(3);
  });

  it('joins no words when no listed type follows them', () => {
    expect(spanOf('hstore COMPRESSION pglz')).toBe(1);
    expect(spanOf('x NULL INT')).toBe(1);
    expect(spanOf('x y.INT')).toBe(1);
    expect(spanOf('x "y" INT')).toBe(1);
  });

  it('refuses a column keyword, unless it is quoted', () => {
    for (const keyword of [
      'AS',
      'AUTO_INCREMENT',
      'AUTOINCREMENT',
      'CHECK',
      'COLLATE',
      'COMMENT',
      'CONSTRAINT',
      'DEFAULT',
      'ENCRYPT',
      'FOR',
      'FOREIGN',
      'GENERATED',
      'IDENTITY',
      'INVISIBLE',
      'KEY',
      'MASKING',
      'NOT',
      'NULL',
      'ON',
      'PRIMARY',
      'PROJECTION',
      'references',
      'UNIQUE',
      'USING',
      'VISIBLE',
      'WITH',
    ]) {
      expect(spanOf(`${keyword} x`)).toBe(0);
    }

    expect(spanOf('"CHECK"')).toBe(1);
  });

  it('refuses TAG before its list and SORT where the column ends', () => {
    expect(spanOf("TAG (k = 'v')")).toBe(0);
    for (const next of ['', ',', ')', 'VISIBLE', 'NOT NULL']) {
      expect(spanOf(`SORT ${next}`)).toBe(0);
    }

    expect(spanOf('tag NOT NULL')).toBe(1);
    expect(spanOf('sort[]')).toBe(2);
    expect(spanOf('"SORT",')).toBe(1);
    expect(spanOf('"TAG"(1)')).toBe(4);
  });

  it('refuses a string literal and anything but a word', () => {
    expect(spanOf("'mood'")).toBe(0);
    expect(spanOf('(a)')).toBe(0);
    expect(matchUserDataType([])(0)).toBe(0);
    expect(spanOf("public.'x'")).toBe(1);
  });
});

describe('isTableItemWord', () => {
  const opens = (source: string) => isTableItemWord(tokenizer(source))(0);

  it('reads the table items a column name could open', () => {
    for (const item of [
      'LIKE s INCLUDING ALL',
      'like public.s',
      'EXCLUDE USING gist (a WITH &&)',
      'EXCLUDE (a WITH =)',
      'FULLTEXT ft (title)',
      'SPATIAL (g)',
      'PERIOD FOR SYSTEM_TIME (a, b)',
      'SUPPLEMENTAL LOG DATA (ALL) COLUMNS',
      'CHECK (price > 0)',
      'check(price>0)',
      'CHECK NOT FOR REPLICATION (a > 0)',
    ]) {
      expect(opens(item)).toBe(true);
    }
  });

  it('leaves a column of the same name alone', () => {
    for (const column of [
      'like INT',
      "LIKE 'x'",
      '`like` s',
      'exclude BOOLEAN',
      'fulltext tsvector',
      'spatial GEOMETRY(Point, 4326)',
      'period INT',
      'supplemental TEXT',
      'check INT',
      'check NOT NULL',
      'check NOT FOR',
      '"check" NOT FOR REPLICATION (a)',
      '"check" (a)',
      'mood',
      '(a)',
    ]) {
      expect(opens(column)).toBe(false);
    }
  });
});
