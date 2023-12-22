import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from 'vitest';

import { parser, tokenizer } from '@/SQLParser';

type TestCase = [string, string, string];
const testCaseList: Array<TestCase> = [];
function setupCase() {
  const sqlDDLTestCase = fs.readFileSync(
    path.join(__dirname, './SQL_DDL_Test_Case.md'),
    'utf8'
  );
  const testCases = sqlDDLTestCase
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
  const tokens = tokenizer(sql);
  const statements = parser(tokens);
  expect(json).toEqual({ statements });
});
