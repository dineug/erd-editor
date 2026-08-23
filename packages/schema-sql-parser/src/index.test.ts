import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, test } from 'vite-plus/test';

import { schemaSQLParser, SortType, StatementType } from '@/index';

type TestCase = [string, string, string];
const testCaseList: Array<TestCase> = [];
function setupCase() {
  const schemaSQLTestCase = fs.readFileSync(
    path.join(__dirname, './schema_sql_test_case.md'),
    'utf8'
  );
  const testCases = schemaSQLTestCase
    .split('### ')
    .slice(1)
    .map(value => `### ${value}`);
  testCases.forEach(testCase => {
    const caseName = /###.*/.exec(testCase);
    if (caseName) {
      const center = testCase.search(/```\s/);
      const jsonString = testCase.slice(center + 3);
      const sql = testCase.substring(testCase.search(/```sql/) + 6, center);
      const json = jsonString.substring(
        jsonString.search(/```json/) + 7,
        jsonString.search(/```\s/)
      );
      testCaseList.push([caseName.toString(), sql, JSON.parse(json)]);
    }
  });
}
setupCase();

test.each(testCaseList)('%s', (_, sql, json) => {
  const statements = schemaSQLParser(sql);
  expect(json).toEqual({ statements });
});

describe('public entry surface', () => {
  it('re-exports schemaSQLParser as a callable parser', () => {
    expect(typeof schemaSQLParser).toBe('function');
    expect(schemaSQLParser('CREATE TABLE t (id INT);')).toEqual([
      {
        type: StatementType.createTable,
        name: 't',
        comment: '',
        columns: [
          {
            name: 'id',
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

  it('re-exports the StatementType enum values', () => {
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

  it('re-exports the SortType enum values', () => {
    expect(SortType).toEqual({ asc: 'ASC', desc: 'DESC' });
  });

  it('produces statement types that all belong to StatementType', () => {
    const statements = schemaSQLParser(`
      CREATE TABLE t (id INT);
      CREATE INDEX idx_t_id ON t (id);
      ALTER TABLE t ADD UNIQUE (id);
    `);
    const known = Object.values(StatementType);

    expect(statements).toHaveLength(3);
    statements.forEach(statement => {
      expect(known).toContain(statement.type);
    });
  });

  it('reports the index sort using SortType members', () => {
    const [statement] = schemaSQLParser(
      'CREATE INDEX idx_t ON t (a ASC, b DESC);'
    );

    expect(statement).toEqual({
      type: StatementType.createIndex,
      name: 'idx_t',
      unique: false,
      tableName: 't',
      columns: [
        { name: 'a', sort: SortType.asc },
        { name: 'b', sort: SortType.desc },
      ],
    });
  });
});
