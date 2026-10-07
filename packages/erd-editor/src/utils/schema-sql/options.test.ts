import { describe, expect, it } from 'vite-plus/test';

import { Database } from '@/constants/schema';

import {
  formatScript,
  HEADER_NAME_PATTERN,
  isSchemaSQLHeader,
  isSchemaSQLStatements,
  resolveSchemaSQLOptions,
  SchemaSQLHeader,
  SchemaSQLHeaderList,
  SchemaSQLStatements,
  SchemaSQLStatementsList,
  schemaSQLSupport,
} from './options';

type Vendor = keyof typeof Database;

describe('schemaSQLSupport', () => {
  it.each<[Vendor, boolean, SchemaSQLHeader[]]>([
    ['MySQL', true, ['use', 'createAndUse']],
    ['MariaDB', true, ['use', 'createAndUse']],
    ['PostgreSQL', true, ['createAndUse']],
    ['Oracle', false, ['use']],
    ['MSSQL', false, ['use', 'createAndUse']],
    ['SQLite', true, []],
    ['Snowflake', false, ['use', 'createAndUse']],
    ['Databricks', true, ['use', 'createAndUse']],
  ])('%s: ifNotExists %s, headers %j', (vendor, ifNotExists, headers) => {
    expect(schemaSQLSupport(Database[vendor])).toEqual({
      ifNotExists,
      headers,
    });
  });

  it('gives a database it does not know nothing', () => {
    expect(schemaSQLSupport(3)).toEqual({ ifNotExists: false, headers: [] });
  });
});

describe('resolveSchemaSQLOptions', () => {
  // Each vendor's statements and header for ifNotExists, use and createAndUse.
  const FALLBACKS: Record<
    Vendor,
    [SchemaSQLStatements, SchemaSQLHeader, SchemaSQLHeader]
  > = {
    MySQL: ['ifNotExists', 'use', 'createAndUse'],
    MariaDB: ['ifNotExists', 'use', 'createAndUse'],
    PostgreSQL: ['ifNotExists', 'none', 'createAndUse'],
    Oracle: ['create', 'use', 'use'],
    MSSQL: ['create', 'use', 'createAndUse'],
    SQLite: ['ifNotExists', 'none', 'none'],
    Snowflake: ['create', 'use', 'createAndUse'],
    Databricks: ['ifNotExists', 'use', 'createAndUse'],
  };
  const cases = (Object.keys(FALLBACKS) as Vendor[]).flatMap(vendor => {
    const [ifNotExists, use, createAndUse] = FALLBACKS[vendor];
    const statements: Record<SchemaSQLStatements, SchemaSQLStatements> = {
      create: 'create',
      ifNotExists,
      recreate: 'recreate',
    };
    const headers: Record<SchemaSQLHeader, SchemaSQLHeader> = {
      none: 'none',
      use,
      createAndUse,
    };

    return SchemaSQLStatementsList.flatMap(asked =>
      SchemaSQLHeaderList.map(
        header =>
          [vendor, asked, header, statements[asked], headers[header]] as const
      )
    );
  });

  it.each(cases)(
    '%s takes %s with %s as %s with %s',
    (vendor, statements, header, wantStatements, wantHeader) => {
      expect(
        resolveSchemaSQLOptions(
          Database[vendor],
          { statements, header },
          'shop'
        )
      ).toEqual({
        statements: wantStatements,
        header: wantHeader,
        headerName: 'valid',
      });
    }
  );

  it('reads no options, or values it does not know, as create and none', () => {
    const want = { statements: 'create', header: 'none', headerName: 'valid' };

    expect(resolveSchemaSQLOptions(Database.MySQL, undefined, 'shop')).toEqual(
      want
    );
    expect(resolveSchemaSQLOptions(Database.MySQL, {}, 'shop')).toEqual(want);
    expect(
      resolveSchemaSQLOptions(
        Database.MySQL,
        { statements: 'merge', header: 1 } as never,
        'shop'
      )
    ).toEqual(want);
  });

  it('gives a database it does not know create and none', () => {
    expect(
      resolveSchemaSQLOptions(
        3,
        { statements: 'ifNotExists', header: 'createAndUse' },
        'shop'
      )
    ).toEqual({ statements: 'create', header: 'none', headerName: 'valid' });
  });

  it.each([
    ['', 'empty'],
    ['shop', 'valid'],
    ['_shop_2', 'valid'],
    ['my shop', 'invalid'],
    ['1shop', 'invalid'],
    [' shop', 'invalid'],
    ['shop ', 'invalid'],
    ['shöp', 'invalid'],
  ])('reads the database name %j as %s', (databaseName, headerName) => {
    expect(
      resolveSchemaSQLOptions(Database.MySQL, { header: 'use' }, databaseName)
        .headerName
    ).toBe(headerName);
  });

  it('keeps the header a name cannot write, for the panel to say why', () => {
    expect(
      resolveSchemaSQLOptions(Database.MySQL, { header: 'use' }, 'my shop')
    ).toEqual({ statements: 'create', header: 'use', headerName: 'invalid' });
  });
});

describe('isSchemaSQLStatements and isSchemaSQLHeader', () => {
  it('take the listed values alone', () => {
    expect(SchemaSQLStatementsList).toEqual([
      'create',
      'ifNotExists',
      'recreate',
    ]);
    expect(SchemaSQLHeaderList).toEqual(['none', 'use', 'createAndUse']);
    SchemaSQLStatementsList.forEach(value =>
      expect(isSchemaSQLStatements(value)).toBe(true)
    );
    SchemaSQLHeaderList.forEach(value =>
      expect(isSchemaSQLHeader(value)).toBe(true)
    );
    [undefined, null, 1, 'none', 'CREATE', {}].forEach(value =>
      expect(isSchemaSQLStatements(value)).toBe(false)
    );
    [undefined, null, 1, 'create', 'USE', {}].forEach(value =>
      expect(isSchemaSQLHeader(value)).toBe(false)
    );
  });

  it('HEADER_NAME_PATTERN takes a plain identifier alone', () => {
    expect(HEADER_NAME_PATTERN.test('Shop_1')).toBe(true);
    expect(HEADER_NAME_PATTERN.test('shop-1')).toBe(false);
  });
});

describe('formatScript', () => {
  it.each<[string, number, string]>([
    ['', Database.MySQL, ''],
    ['', Database.MSSQL, ''],
    ['  \n\t\n', Database.MySQL, ''],
    ['  \n\t\n', Database.MSSQL, ''],
    ['\r\n\r\nSELECT 1;\r\n  ', Database.MySQL, 'SELECT 1;'],
    ['  -- note\nSELECT 1;  ', Database.PostgreSQL, '  -- note\nSELECT 1;'],
    ['a\rb', Database.SQLite, 'a\nb'],
    ['CREATE SCHEMA app', Database.MSSQL, 'CREATE SCHEMA app\nGO'],
    ['CREATE SCHEMA app\ngo', Database.MSSQL, 'CREATE SCHEMA app\ngo'],
    ['EXEC a\nGO 2', Database.MSSQL, 'EXEC a\nGO 2'],
    ['SELECT 1;\n\nGO  \n\n', Database.MSSQL, 'SELECT 1;\n\nGO'],
    ["PRINT 'GO'", Database.MSSQL, "PRINT 'GO'\nGO"],
    ['GO', Database.MSSQL, 'GO'],
    ['BEGIN\n  NULL;\nEND;\n/', Database.Oracle, 'BEGIN\n  NULL;\nEND;\n/'],
    ['CREATE SCHEMA app', Database.Oracle, 'CREATE SCHEMA app'],
  ])('writes %j for database %i as %j', (text, database, want) => {
    expect(formatScript(text, database)).toBe(want);
  });
});
