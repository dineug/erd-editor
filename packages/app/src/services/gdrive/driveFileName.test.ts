import { describe, expect, it } from 'vite-plus/test';

import {
  isDriveDocumentName,
  renameKeepingExtension,
  splitDriveFileName,
  toDownloadFileName,
  toNewFileName,
} from '@/services/gdrive/driveFileName';

describe('splitDriveFileName', () => {
  it.each([
    ['orders.erd', 'orders', '.erd'],
    ['orders.vuerd', 'orders', '.vuerd'],
    ['orders.erd.json', 'orders', '.erd.json'],
    ['orders.vuerd.json', 'orders', '.vuerd.json'],
    ['my.orders.erd.json', 'my.orders', '.erd.json'],
  ])(
    'reads %s as %s and %s, the longest extension first',
    (name, base, extension) => {
      expect(splitDriveFileName(name)).toEqual({ base, extension });
    }
  );

  it('matches any case and keeps the case the file has', () => {
    expect(splitDriveFileName('Orders.ERD')).toEqual({
      base: 'Orders',
      extension: '.ERD',
    });
    expect(splitDriveFileName('orders.Erd.JSON')).toEqual({
      base: 'orders',
      extension: '.Erd.JSON',
    });
  });

  it.each(['orders.json', 'orders.sql', 'orders', 'orders.erd.txt', 'erd'])(
    'knows %s as no document',
    name => {
      expect(splitDriveFileName(name)).toBeNull();
      expect(isDriveDocumentName(name)).toBe(false);
    }
  );

  it('counts each of the four extensions as a document', () => {
    for (const name of ['a.erd', 'a.vuerd', 'a.erd.json', 'a.vuerd.json']) {
      expect(isDriveDocumentName(name)).toBe(true);
    }
  });
});

describe('toNewFileName', () => {
  it.each([
    ['orders', 'orders.erd.json'],
    ['  orders  ', 'orders.erd.json'],
    ['orders.erd', 'orders.erd.json'],
    ['orders.erd.json', 'orders.erd.json'],
    ['orders.VUERD', 'orders.erd.json'],
    ['orders.sql', 'orders.sql.erd.json'],
    ['', 'Untitled.erd.json'],
    ['.erd', 'Untitled.erd.json'],
  ])('names %j %s', (input, expected) => {
    expect(toNewFileName(input)).toBe(expected);
  });
});

describe('renameKeepingExtension', () => {
  it('replaces the part before the extension and keeps the extension', () => {
    expect(renameKeepingExtension('orders.vuerd', 'sales')).toBe('sales.vuerd');
    expect(renameKeepingExtension('orders.ERD', ' sales ')).toBe('sales.ERD');
  });

  it('drops an extension typed with the new name', () => {
    expect(renameKeepingExtension('orders.vuerd', 'sales.erd.json')).toBe(
      'sales.vuerd'
    );
  });

  it('gives a file outside the four the new-file extension', () => {
    expect(renameKeepingExtension('orders', 'sales')).toBe('sales.erd.json');
  });

  it('refuses a name with nothing left', () => {
    expect(renameKeepingExtension('orders.erd', '  ')).toBeNull();
    expect(renameKeepingExtension('orders.erd', '.erd.json')).toBeNull();
  });
});

describe('toDownloadFileName', () => {
  it('saves under the name with .erd, whatever the Drive extension', () => {
    expect(toDownloadFileName('orders.vuerd.json')).toBe('orders.erd');
    expect(toDownloadFileName('orders.erd')).toBe('orders.erd');
    expect(toDownloadFileName('.erd')).toBe('Untitled.erd');
  });
});
