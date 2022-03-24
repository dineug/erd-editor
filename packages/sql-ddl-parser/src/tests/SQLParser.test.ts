import { DDLParser } from '@/SQLParser';
import { CreateTable } from '@@types/index';

describe('parsing edge cases', () => {
  test('when column name is a keyword', () => {
    const ddl = `create table MY_TABLE (
      name          number,
      uuid          number,
      integer       number,
    );`;
    const expectedColumns = ['name', 'uuid', 'integer'];
    const parsedResult = DDLParser(ddl);
    const firstStatement = parsedResult[0] as CreateTable;
    const actualColumns = firstStatement.columns.map(column => column.name);
    expect(actualColumns).toEqual(expectedColumns);
  });
});
