import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';

import { schemaSQLParser } from '@/index';

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
