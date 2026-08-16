import { describe, expect, it } from 'vite-plus/test';

import { schemaSQLParser } from '@/parser';

describe('schemaSQLParser', () => {
  it('returns an empty ast for an empty source', () => {
    expect(schemaSQLParser('')).toEqual([]);
  });

  it('returns an empty ast for whitespace only source', () => {
    expect(schemaSQLParser('   \n\t  ')).toEqual([]);
  });

  it('skips tokens that do not open any supported statement', () => {
    expect(schemaSQLParser('DROP TABLE users;')).toEqual([]);
    expect(schemaSQLParser('SELECT * FROM users;')).toEqual([]);
    expect(schemaSQLParser('USE my_db;')).toEqual([]);
  });

  it('parses CREATE TABLE into a create.table statement', () => {
    const ast = schemaSQLParser(
      'CREATE TABLE users (id INT NOT NULL PRIMARY KEY, name VARCHAR(255));'
    );

    expect(ast).toEqual([
      {
        type: 'create.table',
        name: 'users',
        comment: '',
        columns: [
          {
            name: 'id',
            dataType: 'INT',
            default: '',
            comment: '',
            primaryKey: true,
            autoIncrement: false,
            unique: false,
            nullable: false,
          },
          {
            name: 'name',
            dataType: 'VARCHAR(255)',
            default: '',
            comment: '',
            primaryKey: false,
            autoIncrement: false,
            unique: false,
            nullable: true,
          },
        ],
        indexes: [],
        foreignKeys: [],
      },
    ]);
  });

  it('parses CREATE TABLE IF NOT EXISTS with a schema qualified name', () => {
    const ast = schemaSQLParser(
      'CREATE TABLE IF NOT EXISTS app.posts (id INT);'
    );

    expect(ast).toHaveLength(1);
    expect(ast[0]).toMatchObject({ type: 'create.table', name: 'posts' });
  });

  it('parses CREATE INDEX into a non unique create.index statement', () => {
    const ast = schemaSQLParser('CREATE INDEX idx_a ON t (a, b);');

    expect(ast).toEqual([
      {
        type: 'create.index',
        name: 'idx_a',
        unique: false,
        tableName: 't',
        columns: [
          { name: 'a', sort: 'ASC' },
          { name: 'b', sort: 'ASC' },
        ],
      },
    ]);
  });

  it('parses CREATE UNIQUE INDEX and the DESC sort modifier', () => {
    const ast = schemaSQLParser(
      'CREATE UNIQUE INDEX idx_users_name ON users (name DESC);'
    );

    expect(ast).toEqual([
      {
        type: 'create.index',
        name: 'idx_users_name',
        unique: true,
        tableName: 'users',
        columns: [{ name: 'name', sort: 'DESC' }],
      },
    ]);
  });

  it('parses ALTER TABLE ADD PRIMARY KEY', () => {
    const ast = schemaSQLParser(
      'ALTER TABLE users ADD PRIMARY KEY (id, email);'
    );

    expect(ast).toEqual([
      {
        type: 'alter.table.add.primaryKey',
        name: 'users',
        columnNames: ['id', 'email'],
      },
    ]);
  });

  it('parses ALTER TABLE ONLY ... ADD CONSTRAINT ... PRIMARY KEY', () => {
    const ast = schemaSQLParser(
      'ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);'
    );

    expect(ast).toEqual([
      {
        type: 'alter.table.add.primaryKey',
        name: 'users',
        columnNames: ['id'],
      },
    ]);
  });

  it('parses ALTER TABLE ADD CONSTRAINT ... FOREIGN KEY', () => {
    const ast = schemaSQLParser(
      'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id);'
    );

    expect(ast).toEqual([
      {
        type: 'alter.table.add.foreignKey',
        name: 'orders',
        columnNames: ['user_id'],
        refTableName: 'users',
        refColumnNames: ['id'],
      },
    ]);
  });

  it('parses ALTER TABLE ADD UNIQUE', () => {
    const ast = schemaSQLParser('ALTER TABLE users ADD UNIQUE (email);');

    expect(ast).toEqual([
      {
        type: 'alter.table.add.unique',
        name: 'users',
        columnNames: ['email'],
      },
    ]);
  });

  it('collects every statement of a multi statement source in order', () => {
    const ast = schemaSQLParser(`
      USE my_db;
      CREATE TABLE users (id INT);
      DROP TABLE legacy;
      CREATE INDEX idx_users_id ON users (id);
      ALTER TABLE users ADD PRIMARY KEY (id);
      ALTER TABLE users ADD UNIQUE (id);
      ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users (id);
    `);

    expect(ast.map(statement => statement.type)).toEqual([
      'create.table',
      'create.index',
      'alter.table.add.primaryKey',
      'alter.table.add.unique',
      'alter.table.add.foreignKey',
    ]);
  });

  it('keeps parsing after a statement that consumes no closing semicolon', () => {
    const ast = schemaSQLParser(
      'CREATE TABLE a (id INT) CREATE TABLE b (id INT)'
    );

    expect(ast.map(statement => statement.type)).toEqual([
      'create.table',
      'create.table',
    ]);
    expect(ast.map(statement => (statement as { name: string }).name)).toEqual([
      'a',
      'b',
    ]);
  });

  it('terminates on a truncated statement instead of looping forever', () => {
    expect(schemaSQLParser('CREATE TABLE t (a INT')).toEqual([
      {
        type: 'create.table',
        name: 't',
        comment: '',
        columns: [
          {
            name: 'a',
            dataType: 'INT',
            default: '',
            comment: '',
            primaryKey: false,
            autoIncrement: false,
            unique: false,
            nullable: true,
          },
        ],
        indexes: [],
        foreignKeys: [],
      },
    ]);
  });
});
