// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import { SQL_VENDORS } from '@/agent/read';
import { Database, DatabaseList } from '@/constants/schema';
import {
  DatabaseVendorList,
  DatabaseVendorToDatabase,
} from '@/constants/sql/database';
import { hasDatabaseVendor } from '@/utils/validation';

const sorted = <T>(values: Iterable<T>) => [...values].sort();

describe('a vendor name stands for exactly one database (AC-P16)', () => {
  it('offers the vendors the map resolves, and no others', () => {
    expect(SQL_VENDORS).toBe(DatabaseVendorList);
    expect(sorted(SQL_VENDORS)).toEqual(
      sorted(Object.keys(DatabaseVendorToDatabase))
    );
    expect(SQL_VENDORS.every(hasDatabaseVendor)).toBe(true);
  });

  it('maps the vendors onto the databases one to one, both ways', () => {
    const databases = Object.values(DatabaseVendorToDatabase);

    expect(new Set(databases).size).toBe(databases.length);
    expect(sorted(databases)).toEqual(sorted(DatabaseList));
    expect(sorted(DatabaseList)).toEqual(sorted(Object.values(Database)));
  });

  it('names each vendor as the database constant it maps to', () => {
    for (const [vendor, database] of Object.entries(DatabaseVendorToDatabase)) {
      expect(Database[vendor as keyof typeof Database], vendor).toBe(database);
    }
  });
});
