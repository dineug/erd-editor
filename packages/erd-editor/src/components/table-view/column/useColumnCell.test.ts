import { describe, expect, it } from 'vite-plus/test';

import { searchDataTypeHints } from '@/components/table-view/column/useColumnCell';
import { Database } from '@/constants/schema';
import { DatabaseHintMap } from '@/constants/sql/dataType';

type Vendor = keyof typeof Database;

const VENDORS = Object.keys(Database) as Vendor[];

const namesFor = (vendor: Vendor, typed: string) =>
  searchDataTypeHints(DatabaseHintMap[Database[vendor]], typed).map(
    hint => hint.name
  );

describe('searchDataTypeHints', () => {
  it('offers nothing for blank text', () => {
    expect(namesFor('MySQL', '')).toEqual([]);
    expect(namesFor('MySQL', '   ')).toEqual([]);
  });

  // Typing a name a letter at a time, in its own case or in lower case, is what
  // the list is for, so no step of it may leave the list empty.
  it.each(VENDORS)(
    'keeps a list open on every %s type name and every prefix of one',
    vendor => {
      const hints = DatabaseHintMap[Database[vendor]];
      const typed = hints.flatMap(({ name }) =>
        Array.from({ length: name.length }, (_, end) =>
          name.slice(0, end + 1)
        ).flatMap(prefix => [prefix, prefix.toLowerCase()])
      );

      expect(hints.length).toBeGreaterThan(0);
      expect(typed.filter(text => !namesFor(vendor, text).length)).toEqual([]);
    }
  );

  it.each<[Vendor, string]>([
    ['MySQL', 'VARCHAR(255)'],
    ['MySQL', 'DECIMAL(10,2)'],
    ['MySQL', 'BIGINT UNSIGNED'],
    ['MySQL', 'BIGINT '],
    ['PostgreSQL', 'int[]'],
    ['Databricks', 'ARRAY<STRING>'],
  ])(
    'offers %s nothing once %j has run past a whole type name',
    (vendor, typed) => {
      expect(namesFor(vendor, typed)).toEqual([]);
    }
  );

  it.each<[Vendor, string, string]>([
    ['MySQL', 'vch', 'VARCHAR'],
    ['MySQL', 'VARCHAR', 'VARCHARACTER'],
    ['MySQL', 'LONG V', 'LONG VARCHAR'],
    ['PostgreSQL', 'timestamp with', 'timestamp with time zone'],
    ['PostgreSQL', 'interval day to', 'interval day to second'],
  ])('still offers %s on %j the name %j', (vendor, typed, name) => {
    expect(namesFor(vendor, typed)).toContain(name);
  });
});
