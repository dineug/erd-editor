import { describe, expect, it } from 'vite-plus/test';

import { schemaSQLParser } from '@/parser';
import { SortType, Statement, StatementType } from '@/parser/statement';

describe('StatementType', () => {
  it('maps every statement kind to its dotted discriminator', () => {
    expect(StatementType).toEqual({
      createTable: 'create.table',
      createIndex: 'create.index',
      alterTableAddUnique: 'alter.table.add.unique',
      alterTableAddPrimaryKey: 'alter.table.add.primaryKey',
      alterTableAddForeignKey: 'alter.table.add.foreignKey',
      commentOnTable: 'comment.on.table',
      commentOnColumn: 'comment.on.column',
    });
  });

  it('exposes exactly seven distinct discriminators', () => {
    const values = Object.values(StatementType);

    expect(values).toHaveLength(7);
    expect(new Set(values).size).toBe(7);
  });

  it('names alter statements after their ALTER TABLE ADD prefix', () => {
    const alterValues = Object.entries(StatementType)
      .filter(([key]) => key.startsWith('alter'))
      .map(([, value]) => value);

    expect(alterValues).toEqual([
      'alter.table.add.unique',
      'alter.table.add.primaryKey',
      'alter.table.add.foreignKey',
    ]);
    for (const value of alterValues) {
      expect(value.startsWith('alter.table.add.')).toBe(true);
    }
  });
});

describe('SortType', () => {
  it('holds the two upper case SQL sort directions', () => {
    expect(SortType).toEqual({ asc: 'ASC', desc: 'DESC' });
  });

  it('uses values that round trip through the parsed index columns', () => {
    const [statement] = schemaSQLParser(
      'CREATE INDEX idx_user ON user (name, age DESC);'
    );

    expect(statement.type).toBe(StatementType.createIndex);
    if (statement.type !== StatementType.createIndex) return;
    expect(statement.columns).toEqual([
      { name: 'name', sort: SortType.asc },
      { name: 'age', sort: SortType.desc },
    ]);
  });
});

describe('Statement discriminators', () => {
  const source = `
    CREATE TABLE user (id INT, name VARCHAR(255));
    CREATE UNIQUE INDEX idx_user_name ON user (name);
    ALTER TABLE user ADD PRIMARY KEY (id);
    ALTER TABLE user ADD CONSTRAINT uq_user_name UNIQUE (name);
    ALTER TABLE post ADD FOREIGN KEY (user_id) REFERENCES user (id);
  `;

  it('tags every parsed statement with a StatementType value', () => {
    const statements: Statement[] = schemaSQLParser(source);
    const values: string[] = Object.values(StatementType);

    expect(statements).toHaveLength(5);
    for (const statement of statements) {
      expect(values).toContain(statement.type);
    }
  });

  it('emits the discriminators in source order', () => {
    const statements = schemaSQLParser(source);

    expect(statements.map(statement => statement.type)).toEqual([
      StatementType.createTable,
      StatementType.createIndex,
      StatementType.alterTableAddPrimaryKey,
      StatementType.alterTableAddUnique,
      StatementType.alterTableAddForeignKey,
    ]);
  });

  it('lets the discriminator narrow the union to its own payload', () => {
    const statements = schemaSQLParser(source);
    const names = statements.map(statement => {
      switch (statement.type) {
        case StatementType.createTable:
          return `${statement.type}:${statement.columns.length}`;
        case StatementType.createIndex:
          return `${statement.type}:${statement.unique}`;
        case StatementType.alterTableAddPrimaryKey:
        case StatementType.alterTableAddUnique:
          return `${statement.type}:${statement.columnNames.join()}`;
        case StatementType.alterTableAddForeignKey:
          return `${statement.type}:${statement.refTableName}`;
      }
    });

    expect(names).toEqual([
      'create.table:2',
      'create.index:true',
      'alter.table.add.primaryKey:id',
      'alter.table.add.unique:name',
      'alter.table.add.foreignKey:user',
    ]);
  });
});
