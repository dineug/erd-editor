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
  test('when column name is a keyword', () => {
    const ddl = `  CREATE TABLE "CMS03"."TA040_ATT_CLU"
    (	"C_AMB" VARCHAR2(6 BYTE),
   "C_ATT_CLU" VARCHAR2(7 BYTE),
    ) SEGMENT CREATION IMMEDIATE
   PCTFREE 10 PCTUSED 40 INITRANS 1 MAXTRANS 255
  NOCOMPRESS LOGGING
   STORAGE(INITIAL 65536 NEXT 1048576 MINEXTENTS 1 MAXEXTENTS 2147483645
   PCTINCREASE 0 FREELISTS 1 FREELIST GROUPS 1
   BUFFER_POOL DEFAULT FLASH_CACHE DEFAULT CELL_FLASH_CACHE DEFAULT)
   TABLESPACE "TS_CMS03_DAT" ;
 `;
    const expectedColumns = ['C_AMB', 'C_ATT_CLU'];
    const parsedResult = DDLParser(ddl);
    const firstStatement = parsedResult[0] as CreateTable;
    const actualColumns = firstStatement.columns.map(column => column.name);
    expect(actualColumns).toEqual(expectedColumns);
  });
});
